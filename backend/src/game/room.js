// room.js — ห้องเกม: ที่นั่ง ห้องรอ แชท และการคุมจังหวะเทิร์น
// ไม่ผูกกับ socket.io: ส่งข้อความผ่าน send(clientId, event, payload)
// และตั้งเวลาผ่าน scheduler ทำให้ใช้ได้ทั้งบนเซิร์ฟเวอร์ ในเบราว์เซอร์ และในเทสต์
//
// การคุมเทิร์น: มีผู้เล่นปัจจุบันแค่คนเดียว
// - บอท / ผู้เล่นที่ "ไม่อยู่" → ระบบเล่นแทนหลังแอนิเมชันจบ
// - คนจริง → รอคำสั่ง ถ้าตั้งเวลาไว้แล้วหมดเวลา ระบบเล่นแทน (ครบ 2 ครั้งติดถือว่า "ไม่อยู่")
// - หลุดการเชื่อมต่อ → รอให้กลับมาสักพัก แล้วระบบเล่นแทน

import { createGame, performAction, toPublicView, fallbackAction, forceEndTurn, addLog } from './engine.js';
import { decideActions } from './bot.js';
import { estimateAnimMs, TIMING, RULES } from './rules.js';
import { ROLES } from './roles.js';
import { randomSeed } from './rng.js';
import { SAVE_VERSION, SaveError, validateRoomSave, normalizeSeats, normalizeChat, seatNumber, stripClientIds } from './save.js';

export const SEAT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const BOT_NAMES = ['บอทสมชาย', 'บอทมานี', 'บอทปิติ', 'บอทชูใจ', 'บอทวีระ', 'บอทมานะ', 'บอทดวงใจ', 'บอทเพชร'];
const TURN_SECONDS = [0, 60, 90, 120, 180, 300];
const MAX_BOT_STEPS_PER_TURN = 80;
const DISCONNECT_GRACE_MS = 20000;
const AFK_LIMIT = 2;
const MAX_CHAT = 100;

export function sanitizeName(name, fallback = 'ผู้เล่น') {
  const clean = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return clean || fallback;
}

export function normalizeOptions(input = {}, base = {}) {
  const merged = { maxPlayers: 4, turnSeconds: 120, speed: 2, isPublic: true, weeks: RULES.defaultWeeks, ...base, ...input };
  const maxPlayers = Math.min(4, Math.max(2, Math.round(Number(merged.maxPlayers) || 4)));
  const turnSeconds = TURN_SECONDS.includes(Number(merged.turnSeconds)) ? Number(merged.turnSeconds) : 120;
  const speed = [1, 2, 3].includes(Number(merged.speed)) ? Number(merged.speed) : 2;
  const weeks = RULES.weeksOptions.includes(Number(merged.weeks)) ? Number(merged.weeks) : RULES.defaultWeeks;
  return { maxPlayers, turnSeconds, speed, isPublic: !!merged.isPublic, weeks };
}

export class Room {
  constructor({ code, options, scheduler, send, offline = false, onClientLeft = () => {}, onEmpty = () => {} }) {
    this.code = code;
    this.scheduler = scheduler;
    this.send = send;
    this.offline = offline;
    this.onClientLeft = onClientLeft;
    this.onEmpty = onEmpty;
    this.options = normalizeOptions(options, offline ? { turnSeconds: 0, isPublic: false } : {});
    this.seats = [];
    this.hostClientId = null;
    this.status = 'lobby'; // lobby | playing | finished
    this.game = null;
    this.chat = [];
    this.chatSeq = 0;
    this.seatSeq = 0;
    this.timer = null;
    this.deadline = null;
    this.turnKey = null;
    this.graceUsedKey = null;
    this.botSteps = 0;
    this.destroyed = false;
    this.lastActivity = scheduler.now();
  }

  // ---------- ข้อมูลพื้นฐาน ----------

  seatsOf(clientId) {
    return this.seats.filter((s) => s.clientId === clientId);
  }

  hasClient(clientId) {
    return this.seats.some((s) => s.clientId === clientId);
  }

  clientIds() {
    return [...new Set(this.seats.filter((s) => s.clientId).map((s) => s.clientId))];
  }

  hostSeat() {
    return this.seats.find((s) => s.clientId === this.hostClientId && !s.local) || null;
  }

  isHost(clientId) {
    return !!clientId && clientId === this.hostClientId;
  }

  humanCount() {
    return this.seats.filter((s) => s.clientId).length;
  }

  hasConnectedHuman() {
    return this.seats.some((s) => s.clientId && s.connected);
  }

  currentSeat() {
    if (!this.game || this.game.status !== 'playing') return null;
    return this.seats.find((s) => s.id === this.game.currentPlayerId) || null;
  }

  touch() {
    this.lastActivity = this.scheduler.now();
  }

  // ---------- ที่นั่ง ----------

  createSeat({ name, clientId = null, local = false }) {
    const used = new Set(this.seats.map((s) => s.color));
    const color = SEAT_COLORS.find((c) => !used.has(c)) || SEAT_COLORS[this.seats.length % SEAT_COLORS.length];
    const seat = {
      id: `p${++this.seatSeq}`,
      name: this.uniqueName(name),
      color,
      clientId,
      isBot: !clientId,
      local,
      ready: !clientId,
      role: 'random',
      connected: !!clientId,
      away: false,
      afk: 0,
      chatTimes: [],
    };
    this.seats.push(seat);
    return seat;
  }

  uniqueName(name) {
    const names = new Set(this.seats.map((s) => s.name));
    if (!names.has(name)) return name;
    for (let i = 2; ; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!names.has(candidate)) return candidate;
    }
  }

  join(clientId, rawName) {
    this.touch();
    if (this.hasClient(clientId)) {
      this.setConnected(clientId, true);
      this.syncClient(clientId);
      return { ok: true };
    }
    if (this.status !== 'lobby') return { ok: false, error: 'เกมในห้องนี้เริ่มไปแล้ว' };
    if (this.seats.length >= this.options.maxPlayers) return { ok: false, error: 'ห้องเต็มแล้ว' };
    const seat = this.createSeat({ name: sanitizeName(rawName), clientId });
    if (!this.hostClientId) this.hostClientId = clientId;
    this.systemChat(`${seat.name} เข้าห้อง`);
    this.broadcastRoom();
    this.sendChatHistory(clientId);
    return { ok: true };
  }

  addBot(clientId) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องเท่านั้น' };
    if (this.status !== 'lobby') return { ok: false, error: 'เพิ่มบอทได้เฉพาะตอนรอเริ่มเกม' };
    if (this.seats.length >= this.options.maxPlayers) return { ok: false, error: 'ห้องเต็มแล้ว' };
    const used = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'บอท';
    const seat = this.createSeat({ name });
    this.systemChat(`เพิ่ม ${seat.name} เข้าห้อง`);
    this.broadcastRoom();
    return { ok: true };
  }

  // ผู้เล่นคนที่สอง/สาม/สี่ที่เล่นบนเครื่องเดียวกับเจ้าของห้อง (ผลัดกันกด)
  addLocal(clientId, rawName) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องเท่านั้น' };
    if (this.status !== 'lobby') return { ok: false, error: 'เพิ่มผู้เล่นได้เฉพาะตอนรอเริ่มเกม' };
    if (this.seats.length >= this.options.maxPlayers) return { ok: false, error: 'ห้องเต็มแล้ว' };
    const seat = this.createSeat({ name: sanitizeName(rawName, `ผู้เล่น ${this.seats.length + 1}`), clientId, local: true });
    seat.ready = true;
    this.systemChat(`${seat.name} เข้าร่วม (เล่นบนเครื่องเดียวกัน)`);
    this.broadcastRoom();
    return { ok: true };
  }

  removeSeat(clientId, seatId) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องเท่านั้น' };
    if (this.status !== 'lobby') return { ok: false, error: 'นำผู้เล่นออกได้เฉพาะตอนรอเริ่มเกม' };
    const seat = this.seats.find((s) => s.id === seatId);
    if (!seat) return { ok: false, error: 'ไม่พบผู้เล่น' };
    if (seat.clientId === clientId && !seat.local) return { ok: false, error: 'ใช้ปุ่มออกจากห้องแทน' };
    this.seats = this.seats.filter((s) => s !== seat);
    const kicked = seat.clientId && !seat.local ? seat.clientId : null;
    this.systemChat(`${seat.name} ออกจากห้อง`);
    if (kicked && !this.hasClient(kicked)) {
      this.send(kicked, 'room', null);
      this.send(kicked, 'notice', { text: 'คุณถูกนำออกจากห้อง' });
      this.onClientLeft(kicked);
    }
    this.broadcastRoom();
    return { ok: true };
  }

  leave(clientId) {
    const mine = this.seatsOf(clientId);
    if (!mine.length) return { ok: true };
    this.touch();
    if (this.status === 'lobby') {
      this.seats = this.seats.filter((s) => s.clientId !== clientId);
    } else {
      // ระหว่างเกม: ให้บอทเล่นแทนต่อไปจนจบ เพื่อไม่ให้ผู้เล่นคนอื่นค้าง
      for (const s of mine) {
        s.clientId = null;
        s.isBot = true;
        s.local = false;
        s.connected = false;
        s.away = false;
        s.name = s.name.endsWith('(บอท)') ? s.name : `${s.name.slice(0, 12)} (บอท)`;
      }
    }
    this.systemChat(`${mine[0].name.replace(' (บอท)', '')} ออกจากห้อง${this.status === 'playing' ? ' — บอทเล่นแทน' : ''}`);
    this.send(clientId, 'room', null);
    this.onClientLeft(clientId);
    if (!this.humanCount()) {
      this.destroy();
      this.onEmpty(this);
      return { ok: true };
    }
    if (this.hostClientId === clientId) {
      this.hostClientId = this.seats.find((s) => s.clientId && !s.local)?.clientId || this.seats.find((s) => s.clientId)?.clientId || null;
      const host = this.hostSeat();
      if (host) this.systemChat(`${host.name} เป็นเจ้าของห้องคนใหม่`);
    }
    if (this.status === 'playing' && mine.some((s) => s.id === this.game.currentPlayerId)) this.schedule(0);
    this.broadcastRoom();
    return { ok: true };
  }

  setReady(clientId, ready) {
    if (this.status !== 'lobby') return { ok: false, error: 'เกมเริ่มไปแล้ว' };
    const mine = this.seatsOf(clientId);
    if (!mine.length) return { ok: false, error: 'คุณไม่ได้อยู่ในห้องนี้' };
    for (const s of mine) s.ready = !!ready;
    this.broadcastRoom();
    return { ok: true };
  }

  // เลือกบทบาท: ของตัวเอง (รวมผู้เล่นในเครื่องเดียวกัน) หรือของบอทถ้าเป็นเจ้าของห้อง
  setRole(clientId, seatId, role) {
    if (this.status !== 'lobby') return { ok: false, error: 'เลือกบทบาทได้เฉพาะตอนรอเริ่มเกม' };
    const seat = this.seats.find((s) => s.id === seatId);
    if (!seat) return { ok: false, error: 'ไม่พบผู้เล่น' };
    const allowed = seat.clientId === clientId || (seat.isBot && this.isHost(clientId));
    if (!allowed) return { ok: false, error: 'เลือกบทบาทให้คนอื่นไม่ได้' };
    if (role !== 'random' && !ROLES[role]) return { ok: false, error: 'ไม่มีบทบาทนี้' };
    if (role !== 'random' && this.seats.some((s) => s !== seat && s.role === role)) return { ok: false, error: 'มีคนเลือกบทบาทนี้แล้ว' };
    seat.role = role;
    this.broadcastRoom();
    return { ok: true };
  }

  setOptions(clientId, input) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องเท่านั้น' };
    if (this.status !== 'lobby') return { ok: false, error: 'เปลี่ยนการตั้งค่าได้เฉพาะตอนรอเริ่มเกม' };
    const next = normalizeOptions(input, this.options);
    if (next.maxPlayers < this.seats.length) return { ok: false, error: 'มีผู้เล่นในห้องมากกว่าจำนวนที่ตั้ง' };
    this.options = next;
    this.broadcastRoom();
    return { ok: true };
  }

  setConnected(clientId, connected) {
    const mine = this.seatsOf(clientId);
    if (!mine.length) return;
    const changed = mine.some((s) => s.connected !== connected);
    for (const s of mine) s.connected = connected;
    if (connected) this.touch();
    if (!changed) return;
    if (this.status === 'playing' && mine.some((s) => s.id === this.game.currentPlayerId)) this.schedule(0);
    this.broadcastRoom();
  }

  // กลับมาเล่นเองหลังถูกตั้งเป็น "ไม่อยู่"
  comeBack(clientId) {
    const mine = this.seatsOf(clientId);
    if (!mine.length) return { ok: false, error: 'คุณไม่ได้อยู่ในห้องนี้' };
    let changed = false;
    for (const s of mine) {
      if (s.away) changed = true;
      s.away = false;
      s.afk = 0;
    }
    if (changed && this.status === 'playing' && mine.some((s) => s.id === this.game.currentPlayerId)) this.schedule(0);
    this.broadcastRoom();
    return { ok: true };
  }

  // ---------- เริ่มเกม / จบเกม ----------

  start(clientId) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องที่เริ่มเกมได้' };
    if (this.status !== 'lobby') return { ok: false, error: 'เกมเริ่มไปแล้ว' };
    if (this.seats.length < 2) return { ok: false, error: 'ต้องมีผู้เล่นอย่างน้อย 2 คน (เพิ่มบอทได้)' };
    const waiting = this.seats.filter((s) => s.clientId && s.clientId !== clientId && !s.ready);
    if (waiting.length) return { ok: false, error: `รอ ${waiting.map((s) => s.name).join(', ')} กดพร้อมก่อน` };
    this.game = createGame({
      players: this.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, isBot: s.isBot, role: s.role === 'random' ? null : s.role })),
      seed: randomSeed(),
      options: { weeks: this.options.weeks },
    });
    this.turnKey = null;
    this.status = 'playing';
    for (const s of this.seats) {
      s.afk = 0;
      s.away = false;
    }
    this.touch();
    this.systemChat('เกมเริ่มแล้ว! ผลัดกันเล่นตามลำดับ คนละ 1 สัปดาห์');
    this.broadcastRoom();
    this.schedule(TIMING.base, true);
    this.broadcastGame([], true);
    return { ok: true };
  }

  rematch(clientId) {
    if (!this.isHost(clientId)) return { ok: false, error: 'เฉพาะเจ้าของห้องเท่านั้น' };
    if (this.status !== 'finished') return { ok: false, error: 'เกมยังไม่จบ' };
    this.clearTimer();
    this.status = 'lobby';
    this.game = null;
    this.deadline = null;
    for (const s of this.seats) s.ready = s.isBot || s.local;
    this.systemChat('กลับสู่ห้องรอ พร้อมเล่นอีกรอบ!');
    this.broadcastRoom();
    for (const cid of this.clientIds()) this.send(cid, 'game', null);
    return { ok: true };
  }

  // ---------- คำสั่งในเกม ----------

  handleAction(clientId, action) {
    if (this.status !== 'playing' || !this.game) return { ok: false, error: 'ยังไม่ได้เริ่มเกม' };
    const seat = this.currentSeat();
    if (!seat || seat.isBot || seat.clientId !== clientId) {
      const whose = seat ? seat.name : '';
      return { ok: false, error: `ยังไม่ถึงตาของคุณ — ตอนนี้เป็นตาของ ${whose}` };
    }
    if (!action || typeof action !== 'object') return { ok: false, error: 'คำสั่งไม่ถูกต้อง' };
    const res = performAction(this.game, seat.id, action);
    if (!res.ok) return res;
    this.touch();
    const wasAway = seat.away;
    seat.afk = 0;
    seat.away = false;
    this.afterGameChange(res.events, wasAway);
    if (wasAway) this.broadcastRoom();
    return { ok: true };
  }

  // หลังสถานะเกมเปลี่ยน: ถ้าเปลี่ยนคนเล่นหรือเปลี่ยนช่วงตัดสินใจ เริ่มจับเวลาใหม่
  // ถ้ายังเป็นตาเดิมของคนจริง เวลาที่เหลือของสัปดาห์นั้นเดินต่อ
  afterGameChange(events, forceReset = false) {
    const anim = estimateAnimMs(events, this.options.speed);
    if (this.game.status === 'finished') {
      this.clearTimer();
      this.deadline = null;
      this.status = 'finished';
      this.broadcastGame(events);
      this.systemChat('จบเกมแล้ว! ดูผลอันดับได้เลย');
      this.broadcastRoom();
      return;
    }
    const key = `${this.game.turn}:${this.game.phase.type}`;
    const reset = forceReset || key !== this.turnKey;
    const seat = this.currentSeat();
    if (reset || seat?.isBot || seat?.away || !seat?.connected) this.schedule(anim, reset);
    this.broadcastGame(events);
  }

  schedule(animMs, resetDeadline = true) {
    const key = this.game ? `${this.game.turn}:${this.game.phase.type}` : null;
    if (key !== this.turnKey) this.botSteps = 0;
    this.turnKey = key;
    const seat = this.currentSeat();
    if (!seat || this.destroyed) {
      this.clearTimer();
      this.deadline = null;
      return;
    }
    const speed = this.options.speed;
    const now = this.scheduler.now();
    if (seat.isBot || seat.away) {
      this.clearTimer();
      this.deadline = null;
      this.timer = this.scheduler.setTimeout(() => this.runAuto(), animMs + Math.round(TIMING.botThink / speed));
      return;
    }
    if (!seat.connected) {
      this.clearTimer();
      if (this.graceUsedKey === key) {
        // รอครบเวลาแล้วในตานี้ ระบบเล่นแทนต่อไปเรื่อย ๆ
        this.deadline = null;
        this.timer = this.scheduler.setTimeout(() => this.runAuto(), animMs + Math.round(TIMING.botThink / speed));
      } else {
        this.deadline = now + animMs + DISCONNECT_GRACE_MS;
        this.timer = this.scheduler.setTimeout(() => this.onTimeout(seat.id), animMs + DISCONNECT_GRACE_MS);
      }
      return;
    }
    if (!resetDeadline && this.timer) return;
    this.clearTimer();
    this.deadline = null;
    if (this.options.turnSeconds > 0) {
      const ms = animMs + this.options.turnSeconds * 1000;
      this.deadline = now + ms;
      this.timer = this.scheduler.setTimeout(() => this.onTimeout(seat.id), ms);
    }
  }

  clearTimer() {
    if (this.timer) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
  }

  onTimeout(seatId) {
    this.timer = null;
    const seat = this.currentSeat();
    if (!seat || seat.id !== seatId) return;
    if (seat.connected) {
      seat.afk += 1;
      addLog(this.game, `⏰ ${seat.name} หมดเวลา จบสัปดาห์ให้อัตโนมัติ`, 'info', seat.id);
      if (seat.afk >= AFK_LIMIT && !seat.away) {
        seat.away = true;
        this.systemChat(`${seat.name} ไม่ได้เล่นหลายครั้ง ระบบจะเล่นแทนจนกว่าจะกดกลับมาเล่น`);
        this.broadcastRoom();
      }
      // หมดเวลา: ถ้ามีเรื่องให้เลือกให้ระบบเลือก แล้วจบสัปดาห์
      const events = [];
      for (let i = 0; i < 3 && this.game.status === 'playing' && this.game.currentPlayerId === seat.id; i++) {
        const fb = fallbackAction(this.game);
        const res = fb ? performAction(this.game, seat.id, fb) : { ok: false };
        if (!res.ok) break;
        events.push(...res.events);
      }
      if (this.game.status === 'playing' && this.game.currentPlayerId === seat.id) events.push(...forceEndTurn(this.game));
      this.afterGameChange(events, true);
      return;
    }
    addLog(this.game, `📡 ${seat.name} หลุดการเชื่อมต่อ ระบบเล่นแทนชั่วคราว`, 'info', seat.id);
    this.graceUsedKey = this.turnKey;
    this.runAuto();
  }

  runAuto() {
    this.timer = null;
    if (!this.game || this.game.status !== 'playing' || this.destroyed) return;
    const pid = this.game.currentPlayerId;
    const seqBefore = this.game.seq;
    const events = [];
    // บอทซื้อของ/ฝากเงิน (ไม่เสียเวลาในเกม) ต่อกันได้เลยโดยไม่ต้องหยุดรอ
    for (let chain = 0; chain < 6; chain++) {
      this.botSteps++;
      let actions = [];
      try {
        actions = this.botSteps > MAX_BOT_STEPS_PER_TURN ? [] : decideActions(this.game, pid);
      } catch (err) {
        console.error('[room] bot error', err);
      }
      const p = this.game.players[pid];
      const hoursBefore = p.hoursLeft;
      let instant = false;
      for (const a of actions) {
        const res = performAction(this.game, pid, a);
        if (!res.ok) {
          console.error(`[room ${this.code}] bot action rejected`, a, res.error);
          break;
        }
        events.push(...res.events);
        instant = a.type === 'act' && p.hoursLeft === hoursBefore && this.game.currentPlayerId === pid && this.game.phase.type === 'week';
      }
      if (!instant) break;
    }
    if (this.game.seq === seqBefore && this.game.status === 'playing') {
      const fb = fallbackAction(this.game);
      const res = fb ? performAction(this.game, pid, fb) : { ok: false };
      if (res.ok) events.push(...res.events);
    }
    if (this.game.seq === seqBefore && this.game.status === 'playing') {
      console.error(`[room ${this.code}] เกมค้างที่ phase ${this.game.phase.type} — บังคับจบตา`);
      events.push(...forceEndTurn(this.game));
    }
    this.afterGameChange(events, true);
  }

  // ---------- แชท ----------

  chatMessage(clientId, rawText) {
    const seat = this.seatsOf(clientId).find((s) => !s.local) || this.seatsOf(clientId)[0];
    if (!seat) return { ok: false, error: 'คุณไม่ได้อยู่ในห้องนี้' };
    const text = String(rawText ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
    if (!text) return { ok: false, error: 'ข้อความว่าง' };
    const now = this.scheduler.now();
    seat.chatTimes = seat.chatTimes.filter((t) => now - t < 5000);
    if (seat.chatTimes.length >= 5) return { ok: false, error: 'ส่งข้อความเร็วเกินไป' };
    seat.chatTimes.push(now);
    this.pushChat({ seatId: seat.id, name: seat.name, color: seat.color, text });
    return { ok: true };
  }

  systemChat(text) {
    this.pushChat({ seatId: null, name: 'ระบบ', color: null, text, system: true });
  }

  pushChat(msg) {
    const full = { id: ++this.chatSeq, ts: this.scheduler.now(), ...msg };
    this.chat.push(full);
    if (this.chat.length > MAX_CHAT) this.chat.shift();
    for (const cid of this.clientIds()) this.send(cid, 'chat', full);
  }

  sendChatHistory(clientId) {
    this.send(clientId, 'chatHistory', this.chat.slice());
  }

  // ---------- ส่งสถานะ ----------

  roomView(clientId) {
    return {
      code: this.code,
      status: this.status,
      offline: this.offline,
      options: { ...this.options },
      isHost: this.isHost(clientId),
      you: this.seatsOf(clientId).map((s) => s.id),
      seats: this.seats.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        isBot: s.isBot,
        local: s.local,
        ready: s.ready,
        role: s.role,
        connected: s.isBot ? true : s.connected,
        away: s.away,
        isHost: !!s.clientId && s.clientId === this.hostClientId && !s.local,
      })),
    };
  }

  broadcastRoom() {
    for (const cid of this.clientIds()) this.send(cid, 'room', this.roomView(cid));
  }

  gamePayload(events, full) {
    const now = this.scheduler.now();
    return {
      view: toPublicView(this.game),
      events,
      full: !!full,
      deadlineIn: this.deadline ? Math.max(0, this.deadline - now) : null,
      turnSeconds: this.options.turnSeconds,
    };
  }

  broadcastGame(events, full = false) {
    if (!this.game) return;
    const payload = this.gamePayload(events, full);
    for (const cid of this.clientIds()) this.send(cid, 'game', payload);
  }

  syncClient(clientId) {
    this.send(clientId, 'room', this.roomView(clientId));
    this.sendChatHistory(clientId);
    this.send(clientId, 'game', this.game ? this.gamePayload([], true) : null);
  }

  // ---------- บันทึก / โหลดเกม ----------

  // ข้อมูลห้องแบบ JSON (อ้างอิงสถานะจริง ใช้กับ JSON.stringify ทันทีเท่านั้น)
  toJSON() {
    return {
      saveVersion: SAVE_VERSION,
      savedAt: Date.now(),
      code: this.code,
      offline: this.offline,
      options: this.options,
      seats: this.seats.map(({ chatTimes, ...seat }) => seat),
      hostClientId: this.hostClientId,
      status: this.status,
      game: this.game,
      chat: this.chat,
      chatSeq: this.chatSeq,
      seatSeq: this.seatSeq,
    };
  }

  // สำเนาแยกจากสถานะจริง เก็บไว้ได้นานโดยไม่เปลี่ยนตามเกม
  serialize() {
    return JSON.parse(JSON.stringify(this));
  }

  // เซฟสำหรับดาวน์โหลด: ออนไลน์จะเอารหัสเครื่องของทุกคนออก และสุ่มตัวสุ่มใหม่ (ไฟล์ไม่บอกอนาคตของเกมออนไลน์)
  exportSave(clientId) {
    if (!this.hasClient(clientId)) return { ok: false, error: 'คุณไม่ได้อยู่ในห้องนี้' };
    if (!this.game) return { ok: false, error: 'ยังไม่ได้เริ่มเกม ยังไม่มีอะไรให้บันทึก' };
    const save = this.serialize();
    if (!this.offline) {
      stripClientIds(save);
      save.game.rng = randomSeed();
    }
    return { ok: true, save };
  }

  // สร้างห้องจากเซฟ — โยน SaveError (ข้อความภาษาไทย) ถ้าเซฟใช้ไม่ได้
  static restore(input, { scheduler, send, offline = false, onClientLeft, onEmpty }) {
    const problem = validateRoomSave(input);
    if (problem) throw new SaveError(problem);
    const data = JSON.parse(JSON.stringify(input));
    const room = new Room({ code: data.code, options: data.options, scheduler, send, offline, onClientLeft, onEmpty });
    room.seats = normalizeSeats(data.seats, { offline, fallbackColors: SEAT_COLORS });
    if (offline) {
      // คนที่โหลดเซฟอยู่หน้าเครื่องแน่นอน ไม่ต้องถือว่า "ไม่อยู่"
      for (const s of room.seats) {
        s.away = false;
        s.afk = 0;
      }
    }
    const humans = room.seats.filter((s) => s.clientId);
    room.hostClientId = humans.some((s) => s.clientId === data.hostClientId)
      ? data.hostClientId
      : (humans.find((s) => !s.local) || humans[0]).clientId;
    room.status = data.status;
    room.game = data.status === 'lobby' ? null : data.game;
    room.chat = normalizeChat(data.chat);
    const maxSeat = Math.max(0, ...room.seats.map((s) => seatNumber(s.id)));
    const maxChat = Math.max(0, ...room.chat.map((m) => m.id));
    room.seatSeq = Math.max(Number.isInteger(data.seatSeq) ? data.seatSeq : 0, maxSeat);
    room.chatSeq = Math.max(Number.isInteger(data.chatSeq) ? data.chatSeq : 0, maxChat);
    if (room.game) room.game.events = [];
    if (room.status === 'playing') room.schedule(0, true);
    return room;
  }

  isAbandoned(now, idleMs) {
    return !this.hasConnectedHuman() && now - this.lastActivity > idleMs;
  }

  destroy() {
    this.destroyed = true;
    this.clearTimer();
  }
}
