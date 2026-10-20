// save.js — ตรวจสอบและเตรียมข้อมูลเซฟของห้องเกม (ใช้ทั้งเซิร์ฟเวอร์และโหมดออฟไลน์)
// ข้อมูลเซฟอาจมาจากไฟล์ที่ผู้เล่นเปิดเอง จึงต้องตรวจทุกอย่างก่อนใช้ และห้ามทำให้โปรแกรมล่ม
//
// รูปแบบเซฟ (ห้องหนึ่งห้อง): { saveVersion, savedAt, code, offline, options, seats, hostClientId,
//   status, game, chat, chatSeq, seatSeq } — game คือ state ของ engine ทั้งก้อน (ไม่แยกฟิลด์ของผู้เล่น)

import { STATE_VERSION, toPublicView, forceEndTurn } from './engine.js';
import { decideActions } from './bot.js';

export const SAVE_VERSION = 1;

export const SAVE_ERRORS = Object.freeze({
  notSave: 'ไฟล์นี้ไม่ใช่ไฟล์เซฟของเกมเส้นทางชีวิต',
  version: 'ไฟล์เซฟนี้มาจากเกมเวอร์ชันอื่น จึงโหลดไม่ได้',
  corrupt: 'ไฟล์เซฟเสียหายหรือมาจากเกมเวอร์ชันอื่น',
});

const STATUSES = ['lobby', 'playing', 'finished'];
const MAX_SEATS = 8;
const MAX_CHAT = 100;
const CODE_RE = /^[A-Z0-9]{1,12}$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v) && v >= 0;

export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, max);
}

// คืนข้อความผิดพลาด (ภาษาไทย) ถ้าเซฟใช้ไม่ได้ หรือ null ถ้าใช้ได้ — ไม่โยน error
export function validateRoomSave(data) {
  try {
    return checkRoomSave(data);
  } catch {
    return SAVE_ERRORS.corrupt;
  }
}

function checkRoomSave(data) {
  if (!isObj(data) || !('saveVersion' in data) || !Array.isArray(data.seats)) return SAVE_ERRORS.notSave;
  if (data.saveVersion !== SAVE_VERSION) return SAVE_ERRORS.version;
  if (data.game && isObj(data.game) && data.game.version !== STATE_VERSION) return SAVE_ERRORS.version;
  if (typeof data.code !== 'string' || !CODE_RE.test(data.code)) return SAVE_ERRORS.corrupt;
  if (!STATUSES.includes(data.status)) return SAVE_ERRORS.corrupt;

  const seats = data.seats;
  if (seats.length < 1 || seats.length > MAX_SEATS) return SAVE_ERRORS.corrupt;
  const ids = new Set();
  for (const s of seats) {
    if (!isObj(s) || typeof s.id !== 'string' || !s.id || s.id.length > 32 || ids.has(s.id)) return SAVE_ERRORS.corrupt;
    if (s.clientId != null && (typeof s.clientId !== 'string' || !s.clientId || s.clientId.length > 64)) return SAVE_ERRORS.corrupt;
    if (typeof s.name !== 'string') return SAVE_ERRORS.corrupt;
    ids.add(s.id);
  }
  if (!seats.some((s) => s.clientId)) return SAVE_ERRORS.corrupt; // ต้องมีคนจริงอย่างน้อย 1 คน

  if (data.status === 'lobby') {
    if (data.game != null) return SAVE_ERRORS.corrupt;
    return null;
  }

  const g = data.game;
  if (!isObj(g) || !isObj(g.players) || !Array.isArray(g.order) || !isObj(g.phase) || typeof g.phase.type !== 'string') return SAVE_ERRORS.corrupt;
  if (!Number.isFinite(g.rng) || !isInt(g.seq) || !isInt(g.week) || !isInt(g.turn)) return SAVE_ERRORS.corrupt;
  if (g.status !== data.status) return SAVE_ERRORS.corrupt;
  const playerIds = Object.keys(g.players);
  if (playerIds.length !== ids.size || !playerIds.every((id) => ids.has(id) && isObj(g.players[id]))) return SAVE_ERRORS.corrupt;
  if (g.order.length !== ids.size || new Set(g.order).size !== ids.size || !g.order.every((id) => ids.has(id))) return SAVE_ERRORS.corrupt;
  if (g.status === 'playing' && !ids.has(g.currentPlayerId)) return SAVE_ERRORS.corrupt;
  if (!Array.isArray(g.log)) return SAVE_ERRORS.corrupt;
  // ลองใช้เซฟจริงกับสำเนา: สร้างหน้าจอ ให้บอทคิด และจบสัปดาห์ของคนปัจจุบัน
  // ถ้าข้อมูลข้างในพังหรือไม่เข้ากับกติกาเวอร์ชันนี้ จะรู้ตั้งแต่ตอนโหลด ไม่ใช่ตอนเล่นไปแล้ว
  toPublicView(g);
  if (g.status === 'playing') {
    const trial = JSON.parse(JSON.stringify(g));
    decideActions(trial, trial.currentPlayerId);
    forceEndTurn(trial);
    toPublicView(trial);
  }
  return null;
}

// ทำความสะอาดข้อมูลส่วนห้อง (ที่นั่ง แชท ตัวนับ) — ส่วน game ใช้ทั้งก้อนตามที่บันทึกไว้
export function normalizeSeats(rawSeats, { offline, fallbackColors }) {
  return rawSeats.map((raw, i) => {
    const { chatTimes, ...rest } = raw;
    const clientId = typeof raw.clientId === 'string' && raw.clientId ? raw.clientId : null;
    return {
      ...rest,
      id: raw.id,
      name: cleanText(raw.name, 40) || `ผู้เล่น ${i + 1}`,
      color: typeof raw.color === 'string' && COLOR_RE.test(raw.color) ? raw.color : fallbackColors[i % fallbackColors.length],
      clientId,
      isBot: !clientId,
      local: !!clientId && !!raw.local,
      ready: !clientId || !!raw.ready,
      role: typeof raw.role === 'string' ? raw.role : 'random',
      // ออนไลน์: ทุกคนเริ่มแบบ "หลุด" แล้วค่อยเชื่อมต่อกลับด้วย clientId เดิม
      connected: offline ? !!clientId : false,
      away: !!clientId && !!raw.away,
      afk: isInt(raw.afk) ? raw.afk : 0,
      chatTimes: [],
    };
  });
}

export function normalizeChat(rawChat) {
  if (!Array.isArray(rawChat)) return [];
  return rawChat
    .filter((m) => isObj(m) && isInt(m.id) && typeof m.text === 'string')
    .slice(-MAX_CHAT)
    .map((m) => ({
      id: m.id,
      ts: Number.isFinite(m.ts) ? m.ts : 0,
      seatId: typeof m.seatId === 'string' ? m.seatId : null,
      name: cleanText(m.name, 40),
      color: typeof m.color === 'string' && COLOR_RE.test(m.color) ? m.color : null,
      text: cleanText(m.text, 200),
      ...(m.system ? { system: true } : {}),
    }));
}

// ตัวเลขของ seatId แบบ "p12" → 12 (ใช้ตั้งตัวนับต่อ ไม่ให้ id ชนกัน)
export function seatNumber(id) {
  const m = /^p(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

// เตรียมเซฟเพื่อเล่นต่อบนเครื่องเดียว (โหมดออฟไลน์):
// ทุกที่นั่งที่เป็นคนจริงกลายเป็นของเครื่องนี้ — คนแรก (เจ้าของห้อง) เป็นที่นั่งหลัก คนอื่นผลัดกันเล่นบนเครื่องเดียวกัน
export function toLocalSave(data, clientId) {
  const copy = JSON.parse(JSON.stringify(data));
  const humans = copy.seats.filter((s) => s.clientId);
  const main = humans.find((s) => s.clientId === copy.hostClientId && !s.local) || humans[0];
  for (const s of humans) {
    s.clientId = clientId;
    s.local = s !== main;
  }
  copy.hostClientId = clientId;
  if (!copy.offline) {
    // เกมที่มาจากออนไลน์: เล่นบนเครื่องเดียวไม่ต้องจับเวลา และไม่เปิดเป็นห้องสาธารณะ
    copy.options = { ...(isObj(copy.options) ? copy.options : {}), turnSeconds: 0, isPublic: false };
    copy.offline = true;
  }
  return copy;
}

// เซฟสำหรับส่งออกเป็นไฟล์: เอารหัสประจำเครื่องของผู้เล่นออก
export function stripClientIds(data) {
  const ids = new Map();
  for (const s of data.seats) {
    if (!s.clientId) continue;
    if (!ids.has(s.clientId)) ids.set(s.clientId, `player-${ids.size + 1}`);
    s.clientId = ids.get(s.clientId);
  }
  data.hostClientId = data.hostClientId ? ids.get(data.hostClientId) || null : null;
  data.exported = true;
  return data;
}
