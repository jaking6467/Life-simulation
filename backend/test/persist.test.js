import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPersistence, writeFileAtomic, readJsonFile } from '../src/persist.js';
import { RoomManager } from '../src/game/roomManager.js';

const SERVER = fileURLToPath(new URL('../server.js', import.meta.url));
const quiet = { error: () => {}, log: () => {} };

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'life-sim-save-'));
}

test('persistence: เขียนเฉพาะเมื่อมีอะไรเปลี่ยน แบบ atomic (ไม่เหลือไฟล์ชั่วคราว) และอ่านกลับได้', () => {
  const dir = tempDir();
  const file = path.join(dir, 'nested', 'rooms.json');
  let value = { rooms: [1] };
  const p = createPersistence({ file, snapshot: () => value, log: quiet });
  assert.equal(p.load(), null, 'ยังไม่มีไฟล์');
  assert.equal(p.flush(), false, 'ไม่มีอะไรเปลี่ยน ไม่ต้องเขียน');
  assert.equal(fs.existsSync(file), false);
  p.markDirty();
  assert.equal(p.flush(), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { rooms: [1] });
  assert.equal(p.dirty, false);
  value = { rooms: [1, 2] };
  assert.equal(p.flush(), false);
  p.markDirty();
  p.flush();
  assert.deepEqual(p.load(), { rooms: [1, 2] });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['rooms.json']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persistence: ไฟล์เสียอ่านไม่ได้ → เริ่มใหม่ และเก็บไฟล์เดิมไว้เป็น .bad', () => {
  const dir = tempDir();
  const file = path.join(dir, 'rooms.json');
  fs.writeFileSync(file, '{"rooms": [ ครึ่ง ๆ');
  const errors = [];
  const p = createPersistence({ file, snapshot: () => ({}), log: { error: (...a) => errors.push(a.join(' ')) } });
  assert.equal(p.load(), null);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(`${file}.bad`, 'utf8'), '{"rooms": [ ครึ่ง ๆ');
  assert.equal(errors.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persistence: เขียนไม่สำเร็จไม่ทำให้ล่ม และจะลองใหม่รอบหน้า', () => {
  const dir = tempDir();
  const blocker = path.join(dir, 'not-a-dir');
  fs.writeFileSync(blocker, 'x');
  const p = createPersistence({ file: path.join(blocker, 'rooms.json'), snapshot: () => ({}), log: quiet });
  p.markDirty();
  assert.equal(p.flush(), false);
  assert.equal(p.dirty, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeFileAtomic / readJsonFile ทำงานร่วมกับ RoomManager: บันทึกแล้วโหลดกลับได้ห้องเดิม', () => {
  const dir = tempDir();
  const file = path.join(dir, 'rooms.json');
  const a = new RoomManager({ send: () => {} });
  ok(a.handle('host-client-1', 'room:create', { name: 'โฮสต์' }));
  ok(a.handle('host-client-1', 'room:addBot'));
  ok(a.handle('host-client-1', 'room:start'));
  writeFileAtomic(file, JSON.stringify(a));
  const { data } = readJsonFile(file);
  const b = new RoomManager({ send: () => {} });
  assert.equal(b.restore(data).restored, 1);
  assert.deepEqual(b.roomOf('host-client-1').game, a.roomOf('host-client-1').game);
  a.destroyAll();
  b.destroyAll();
  fs.rmSync(dir, { recursive: true, force: true });
});

function ok(res) {
  assert.ok(res.ok, res.error);
  return res;
}

// ---------- เซิร์ฟเวอร์จริง: เปิด → ปิดด้วย SIGTERM (บันทึก) → เปิดใหม่ (โหลดห้องกลับมา) ----------

function startServer(env) {
  const port = 20000 + Math.floor(Math.random() * 30000);
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), STATIC_DIR: path.join(os.tmpdir(), 'no-static-here'), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const ready = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('พร้อมใช้งาน')) resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${output}`)));
    setTimeout(() => reject(new Error(`server start timeout: ${output}`)), 10000).unref();
  });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return { child, port, ready, exited, output: () => output };
}

test('server.js: โหลดห้องจาก SAVE_FILE ตอนเริ่ม และบันทึกห้องลงไฟล์ตอนได้ SIGTERM', { timeout: 30000 }, async () => {
  const dir = tempDir();
  const file = path.join(dir, 'data', 'rooms.json');
  // เตรียมไฟล์เซฟ: ห้องที่กำลังเล่น 1 ห้อง + ห้องรอ 1 ห้อง
  const m = new RoomManager({ send: () => {} });
  const { code } = ok(m.handle('host-client-1', 'room:create', { name: 'โฮสต์' }));
  ok(m.handle('host-client-1', 'room:addBot'));
  ok(m.handle('host-client-1', 'room:start'));
  ok(m.handle('lobby-client-1', 'room:create', { name: 'รอเพื่อน' }));
  writeFileAtomic(file, JSON.stringify(m));
  m.destroyAll();

  const s1 = startServer({ SAVE_FILE: file });
  try {
    await s1.ready;
    assert.match(s1.output(), /กลับมา 2 ห้อง/);
    const status = await (await fetch(`http://127.0.0.1:${s1.port}/api/status`)).json();
    assert.equal(status.rooms, 2);
    assert.equal(status.playing, 1);
  } finally {
    s1.child.kill('SIGTERM');
  }
  const exit = await s1.exited;
  assert.equal(exit.code, 0);
  assert.match(s1.output(), /บันทึก 2 ห้องแล้ว/);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.rooms.length, 2);
  assert.ok(saved.rooms.some((r) => r.code === code && r.status === 'playing'));

  // ไฟล์เสีย: เซิร์ฟเวอร์ยังเปิดได้ เริ่มใหม่ และเก็บไฟล์เดิมเป็น .bad
  fs.writeFileSync(file, 'not json at all');
  const s2 = startServer({ SAVE_FILE: file });
  try {
    await s2.ready;
    const status = await (await fetch(`http://127.0.0.1:${s2.port}/api/status`)).json();
    assert.equal(status.rooms, 0);
    assert.equal(fs.readFileSync(`${file}.bad`, 'utf8'), 'not json at all');
  } finally {
    s2.child.kill('SIGTERM');
  }
  await s2.exited;
  fs.rmSync(dir, { recursive: true, force: true });
});
