// roomManager.js — จัดการหลายห้อง และแปลงข้อความจากผู้เล่นเป็นคำสั่งไปยังห้อง
// ใช้เหมือนกันทั้ง server.js (socket.io) และโหมดออฟไลน์ในเบราว์เซอร์

import { Room, sanitizeName } from './room.js';
import { forceEndTurn } from './engine.js';
import { SAVE_VERSION, SAVE_ERRORS, validateRoomSave, toLocalSave } from './save.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const IDLE_MS = 10 * 60 * 1000;
const EXPORT_COOLDOWN_MS = 3000;

export const PROTOCOL_EVENTS = [
  'room:create',
  'room:join',
  'room:quick',
  'room:leave',
  'room:ready',
  'room:role',
  'room:addBot',
  'room:addLocal',
  'room:removeSeat',
  'room:options',
  'room:start',
  'room:rematch',
  'room:back',
  'room:sync',
  'game:action',
  'chat:send',
  'room:export', // ขอไฟล์เซฟของห้องที่ตัวเองอยู่ (ออนไลน์ตัดรหัสเครื่องของทุกคนออก)
  'room:load', // โหลดเซฟ — ทำได้เฉพาะโหมดออฟไลน์ เซิร์ฟเวอร์ออนไลน์ปฏิเสธเสมอ
];

export const defaultScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  now: () => Date.now(),
};

export class RoomManager {
  // onChange: เรียกทุกครั้งที่สถานะห้องเปลี่ยน (ใช้บอกว่าถึงเวลาบันทึกเกม)
  constructor({ send, scheduler = defaultScheduler, offline = false, maxRooms = 300, onChange = null }) {
    this.onChange = onChange;
    // ทุกการเปลี่ยนแปลงของห้องจะส่งข้อความหาผู้เล่นเสมอ จึงใช้จังหวะส่งเป็นสัญญาณว่า "มีอะไรเปลี่ยน"
    this.send = (clientId, event, payload) => {
      this.notifyChange();
      send(clientId, event, payload);
    };
    this.scheduler = scheduler;
    this.offline = offline;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.clientRoom = new Map();
    this.exportTimes = new Map();
  }

  // ตัวจับเวลาของห้อง: ถ้าเกิด error ในจังหวะของบอท/หมดเวลา (เช่นเซฟเก่าไม่เข้ากับกติกาใหม่)
  // ห้ามทำให้ทั้งเซิร์ฟเวอร์ล่ม — บันทึก error แล้วพยายามจบตานั้นให้เกมเดินต่อ
  roomScheduler(code) {
    const base = this.scheduler;
    return {
      now: () => base.now(),
      clearTimeout: (handle) => base.clearTimeout(handle),
      setTimeout: (fn, ms) =>
        base.setTimeout(() => {
          try {
            fn();
          } catch (err) {
            console.error(`[room ${code}] timer error`, err);
            this.recoverRoom(code);
          }
        }, ms),
    };
  }

  recoverRoom(code) {
    const room = this.rooms.get(code);
    if (!room || room.destroyed || room.status !== 'playing' || !room.game) return;
    room.recoveries = (room.recoveries || 0) + 1;
    try {
      if (room.recoveries > 5) throw new Error('เกิดข้อผิดพลาดซ้ำหลายครั้ง');
      room.afterGameChange(forceEndTurn(room.game), true);
    } catch (err) {
      console.error(`[room ${code}] เล่นต่อไม่ได้ — หยุดเกมนี้`, err);
      room.clearTimer();
      room.systemChat('⚠️ เกิดข้อผิดพลาด เกมนี้เล่นต่อไม่ได้ ขออภัยด้วย');
    }
  }

  notifyChange() {
    try {
      this.onChange?.();
    } catch (err) {
      console.error('[rooms] onChange error', err);
    }
  }

  roomOf(clientId) {
    const code = this.clientRoom.get(clientId);
    return code ? this.rooms.get(code) || null : null;
  }

  // ผู้เล่นเชื่อมต่อ (หรือเชื่อมต่อใหม่หลังรีเฟรช) — ส่งสถานะห้องเดิมกลับไปให้เล่นต่อได้
  connect(clientId) {
    const room = this.roomOf(clientId);
    if (room) {
      room.setConnected(clientId, true);
      room.syncClient(clientId);
    } else {
      this.send(clientId, 'room', null);
    }
  }

  disconnect(clientId) {
    this.roomOf(clientId)?.setConnected(clientId, false);
  }

  handle(clientId, event, payload) {
    const data = payload && typeof payload === 'object' ? payload : {};
    try {
      switch (event) {
        case 'room:create':
          return this.createRoom(clientId, data.name, data.options);
        case 'room:join':
          return this.joinRoom(clientId, data.name, data.code);
        case 'room:quick':
          return this.quickJoin(clientId, data.name);
        case 'room:leave':
          return this.leave(clientId);
        case 'room:sync': {
          const room = this.roomOf(clientId);
          if (room) room.syncClient(clientId);
          else this.send(clientId, 'room', null);
          return { ok: true };
        }
        case 'room:ready':
          return this.withRoom(clientId, (r) => r.setReady(clientId, data.ready !== false));
        case 'room:role':
          return this.withRoom(clientId, (r) => r.setRole(clientId, String(data.seatId || ''), String(data.role || '')));
        case 'room:addBot':
          return this.withRoom(clientId, (r) => r.addBot(clientId));
        case 'room:addLocal':
          return this.withRoom(clientId, (r) => r.addLocal(clientId, data.name));
        case 'room:removeSeat':
          return this.withRoom(clientId, (r) => r.removeSeat(clientId, String(data.seatId || '')));
        case 'room:options':
          return this.withRoom(clientId, (r) => r.setOptions(clientId, data.options || {}));
        case 'room:start':
          return this.withRoom(clientId, (r) => r.start(clientId));
        case 'room:rematch':
          return this.withRoom(clientId, (r) => r.rematch(clientId));
        case 'room:back':
          return this.withRoom(clientId, (r) => r.comeBack(clientId));
        case 'game:action':
          return this.withRoom(clientId, (r) => r.handleAction(clientId, data.action));
        case 'chat:send':
          return this.withRoom(clientId, (r) => r.chatMessage(clientId, data.text));
        case 'room:export':
          return this.withRoom(clientId, (r) => this.exportRoom(clientId, r));
        case 'room:load':
          return this.loadSave(clientId, data.save);
        default:
          return { ok: false, error: 'ไม่รู้จักคำสั่งนี้' };
      }
    } catch (err) {
      console.error('[rooms] error handling', event, err);
      return { ok: false, error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' };
    }
  }

  withRoom(clientId, fn) {
    const room = this.roomOf(clientId);
    if (!room) return { ok: false, error: 'คุณยังไม่ได้อยู่ในห้อง' };
    return fn(room);
  }

  newCode() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('สร้างรหัสห้องไม่ได้');
  }

  createRoom(clientId, name, options) {
    this.leave(clientId);
    if (this.rooms.size >= this.maxRooms) this.sweep(0);
    if (this.rooms.size >= this.maxRooms) return { ok: false, error: 'เซิร์ฟเวอร์มีห้องเต็มแล้ว ลองใหม่ภายหลัง' };
    const code = this.newCode();
    const room = new Room({ code, options, ...this.roomHooks(code) });
    this.rooms.set(code, room);
    this.clientRoom.set(clientId, code);
    room.join(clientId, sanitizeName(name));
    return { ok: true, code };
  }

  roomHooks(code) {
    return {
      scheduler: this.roomScheduler(code),
      send: this.send,
      offline: this.offline,
      onClientLeft: (cid) => {
        if (this.clientRoom.get(cid) === code) this.clientRoom.delete(cid);
      },
      onEmpty: () => this.removeRoom(code),
    };
  }

  joinRoom(clientId, name, rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ไม่พบห้องนี้ ตรวจสอบรหัสอีกครั้ง' };
    if (this.roomOf(clientId) === room) return room.join(clientId, name);
    if (room.status !== 'lobby') return { ok: false, error: 'เกมในห้องนี้เริ่มไปแล้ว' };
    if (room.seats.length >= room.options.maxPlayers) return { ok: false, error: 'ห้องเต็มแล้ว' };
    this.leave(clientId);
    const res = room.join(clientId, sanitizeName(name));
    if (res.ok) this.clientRoom.set(clientId, code);
    return { ...res, code };
  }

  // จับคู่ด่วน: เข้าห้องสาธารณะที่ยังว่าง ถ้าไม่มีก็สร้างห้องใหม่
  quickJoin(clientId, name) {
    for (const room of this.rooms.values()) {
      if (room.status === 'lobby' && room.options.isPublic && !room.offline && room.hasConnectedHuman() && room.seats.length < room.options.maxPlayers && !room.hasClient(clientId)) {
        return this.joinRoom(clientId, name, room.code);
      }
    }
    return this.createRoom(clientId, name, { isPublic: true });
  }

  leave(clientId) {
    const room = this.roomOf(clientId);
    this.clientRoom.delete(clientId);
    if (room) room.leave(clientId);
    return { ok: true };
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    this.rooms.delete(code);
    for (const [cid, c] of this.clientRoom) {
      if (c === code) this.clientRoom.delete(cid);
    }
    this.notifyChange();
  }

  // ---------- บันทึก / โหลดเกม ----------

  exportRoom(clientId, room) {
    if (!this.offline) {
      const now = this.scheduler.now();
      const last = this.exportTimes.get(clientId);
      if (last != null && now - last < EXPORT_COOLDOWN_MS) return { ok: false, error: 'เพิ่งดาวน์โหลดไป รอสักครู่แล้วลองใหม่' };
      this.exportTimes.set(clientId, now);
      if (this.exportTimes.size > 1000) this.exportTimes.clear();
    }
    return room.exportSave(clientId);
  }

  // โหมดออฟไลน์: แทนที่ห้องปัจจุบันด้วยห้องจากเซฟ (ห้องเดิมยังอยู่ถ้าเซฟใช้ไม่ได้)
  loadSave(clientId, save) {
    if (!this.offline) return { ok: false, error: 'โหลดไฟล์เซฟได้เฉพาะเกมออฟไลน์บนเครื่องนี้' };
    const problem = validateRoomSave(save);
    if (problem) return { ok: false, error: problem };
    let room;
    try {
      const data = toLocalSave(save, clientId);
      room = Room.restore(data, this.roomHooks(data.code));
    } catch (err) {
      if (err?.name !== 'SaveError') console.error('[rooms] load error', err);
      return { ok: false, error: err?.name === 'SaveError' ? err.message : SAVE_ERRORS.corrupt };
    }
    for (const code of [...this.rooms.keys()]) this.removeRoom(code);
    this.rooms.set(room.code, room);
    this.clientRoom.set(clientId, room.code);
    room.touch();
    room.syncClient(clientId);
    return { ok: true, code: room.code };
  }

  // ทุกห้อง (รวมห้องรอ) สำหรับเขียนลงไฟล์ — อ้างอิงสถานะจริง ใช้กับ JSON.stringify ทันที
  toJSON() {
    return {
      saveVersion: SAVE_VERSION,
      savedAt: Date.now(),
      rooms: [...this.rooms.values()].filter((r) => !r.destroyed && r.humanCount() > 0),
    };
  }

  serialize() {
    return JSON.parse(JSON.stringify(this));
  }

  // สร้างห้องกลับมาจากไฟล์ ห้องที่เสียจะถูกข้าม ไม่โยน error
  restore(data) {
    const result = { restored: 0, skipped: 0, errors: [] };
    if (!data || typeof data !== 'object' || !Array.isArray(data.rooms)) {
      result.errors.push(SAVE_ERRORS.notSave);
      return result;
    }
    if (data.saveVersion !== SAVE_VERSION) {
      result.skipped = data.rooms.length;
      result.errors.push(SAVE_ERRORS.version);
      return result;
    }
    for (const raw of data.rooms) {
      const code = raw && typeof raw.code === 'string' ? raw.code : '?';
      try {
        if (this.rooms.size >= this.maxRooms) throw new Error('ห้องเต็ม');
        if (this.rooms.has(code)) throw new Error('รหัสห้องซ้ำ');
        const room = Room.restore(raw, this.roomHooks(code));
        this.rooms.set(code, room);
        for (const cid of room.clientIds()) {
          if (!this.clientRoom.has(cid)) this.clientRoom.set(cid, code);
        }
        result.restored++;
      } catch (err) {
        result.skipped++;
        result.errors.push(`${code}: ${err?.message || err}`);
      }
    }
    return result;
  }

  // ลบห้องที่ไม่มีคนเชื่อมต่อนานเกินไป
  sweep(idleMs = IDLE_MS) {
    const now = this.scheduler.now();
    for (const [code, room] of this.rooms) {
      if (room.isAbandoned(now, idleMs)) this.removeRoom(code);
    }
  }

  destroyAll() {
    for (const code of [...this.rooms.keys()]) this.removeRoom(code);
  }

  stats() {
    let playing = 0;
    for (const r of this.rooms.values()) if (r.status === 'playing') playing++;
    return { rooms: this.rooms.size, playing, clients: this.clientRoom.size };
  }
}
