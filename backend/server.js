// server.js — เซิร์ฟเวอร์เกมออนไลน์ (Express + Socket.io)
// ถ้ามีไฟล์หน้าเว็บที่ build แล้ว (../frontend/build) จะเสิร์ฟหน้าเว็บให้ด้วย ใช้ deploy ที่เดียวได้

import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager, PROTOCOL_EVENTS } from './src/game/roomManager.js';
import { createPersistence, keepBadFile } from './src/persist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : '*';
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '../frontend/build');
// ไฟล์บันทึกห้องเกม (ตั้ง SAVE_FILE=off เพื่อปิด)
const SAVE_FILE = process.env.SAVE_FILE === 'off' ? null : path.resolve(process.env.SAVE_FILE || path.join(__dirname, 'data/rooms.json'));

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] } });

const clientRoomName = (clientId) => `client:${clientId}`;
let persistence = null;
const manager = new RoomManager({
  send: (clientId, event, payload) => io.to(clientRoomName(clientId)).emit(event, payload),
  onChange: () => persistence?.markDirty(),
});

// โหลดห้องที่บันทึกไว้ก่อนเปิดรับผู้เล่น — ผู้เล่นเชื่อมต่อกลับมาด้วย clientId เดิมแล้วเล่นต่อได้เลย
if (SAVE_FILE) {
  persistence = createPersistence({ file: SAVE_FILE, snapshot: () => manager, intervalMs: 10000 });
  const saved = persistence.load();
  if (saved) {
    const res = manager.restore(saved);
    console.log(`💾 โหลดห้องจาก ${SAVE_FILE}: กลับมา ${res.restored} ห้อง${res.skipped ? `, ข้าม ${res.skipped} ห้อง` : ''}`);
    if (res.errors.length) {
      console.error('💾 ห้องที่โหลดไม่ได้:', res.errors.slice(0, 20).join(' | '));
      const bad = keepBadFile(SAVE_FILE, { copy: true });
      if (bad) console.error(`💾 เก็บสำเนาไฟล์เดิมไว้ที่ ${bad}`);
    }
  }
  persistence.start();
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    const wrote = persistence.flush(true);
    console.log(`👋 ได้รับ ${signal} — ${wrote ? `บันทึก ${manager.rooms.size} ห้องแล้ว` : 'บันทึกห้องไม่สำเร็จ'} ปิดเซิร์ฟเวอร์`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

app.get('/api/status', (req, res) => {
  res.json({ ok: true, ...manager.stats(), uptime: Math.round(process.uptime()) });
});

if (fs.existsSync(path.join(STATIC_DIR, 'index.html'))) {
  app.use(express.static(STATIC_DIR));
  app.get('*', (req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));
  console.log(`🌐 เสิร์ฟหน้าเว็บจาก ${STATIC_DIR}`);
} else {
  app.get('/', (req, res) => res.type('text').send('Life Simulation game server is running.'));
}

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

io.on('connection', (socket) => {
  const clientId = socket.handshake.auth?.clientId;
  if (typeof clientId !== 'string' || !CLIENT_ID_RE.test(clientId)) {
    socket.emit('notice', { text: 'ข้อมูลการเชื่อมต่อไม่ถูกต้อง' });
    socket.disconnect(true);
    return;
  }
  socket.join(clientRoomName(clientId));
  manager.connect(clientId);

  // จำกัดจำนวนคำสั่งต่อวินาที กันการส่งรัว ๆ
  let tokens = 20;
  let last = Date.now();
  const allow = () => {
    const now = Date.now();
    tokens = Math.min(20, tokens + ((now - last) / 1000) * 10);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };

  for (const event of PROTOCOL_EVENTS) {
    socket.on(event, (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!allow()) return reply({ ok: false, error: 'ส่งคำสั่งเร็วเกินไป' });
      reply(manager.handle(clientId, event, payload));
    });
  }

  socket.on('disconnect', () => {
    // ผู้เล่นอาจเปิดหลายแท็บ ถือว่าหลุดเมื่อไม่มีแท็บไหนเชื่อมต่ออยู่เลย
    const sockets = io.sockets.adapter.rooms.get(clientRoomName(clientId));
    if (!sockets || sockets.size === 0) manager.disconnect(clientId);
  });
});

setInterval(() => manager.sweep(), 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`🚀 Life Simulation server พร้อมใช้งานที่พอร์ต ${PORT}`);
});
