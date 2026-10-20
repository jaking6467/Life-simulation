// roomManager.js — จัดการหลายห้อง และแปลงข้อความจากผู้เล่นเป็นคำสั่งไปยังห้อง
// ใช้เหมือนกันทั้ง server.js (socket.io) และโหมดออฟไลน์ในเบราว์เซอร์

import { Room, sanitizeName } from './room.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const IDLE_MS = 10 * 60 * 1000;

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
];

export const defaultScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  now: () => Date.now(),
};

export class RoomManager {
  constructor({ send, scheduler = defaultScheduler, offline = false, maxRooms = 300 }) {
    this.send = send;
    this.scheduler = scheduler;
    this.offline = offline;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.clientRoom = new Map();
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
    const room = new Room({
      code,
      options,
      scheduler: this.scheduler,
      send: this.send,
      offline: this.offline,
      onClientLeft: (cid) => {
        if (this.clientRoom.get(cid) === code) this.clientRoom.delete(cid);
      },
      onEmpty: () => this.removeRoom(code),
    });
    this.rooms.set(code, room);
    this.clientRoom.set(clientId, code);
    room.join(clientId, sanitizeName(name));
    return { ok: true, code };
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
