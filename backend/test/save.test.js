import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/game/roomManager.js';
import { Room } from '../src/game/room.js';
import { SAVE_VERSION, validateRoomSave } from '../src/game/save.js';
import { STATE_VERSION } from '../src/game/engine.js';

// นาฬิกาจำลองแบบเดียวกับใน room.test.js: เลื่อนเวลาได้เองโดยไม่ต้องรอจริง
function fakeScheduler(start = 0) {
  let now = start;
  let timers = [];
  let id = 0;
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const t = { id: ++id, at: now + ms, fn };
      timers.push(t);
      return t.id;
    },
    clearTimeout(handle) {
      timers = timers.filter((t) => t.id !== handle);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift();
        now = t.at;
        t.fn();
      }
      now = end;
    },
    pending: () => timers.length,
  };
}

function setup({ offline = false, start = 0 } = {}) {
  const scheduler = fakeScheduler(start);
  const inbox = new Map();
  let changes = 0;
  const send = (clientId, event, payload) => {
    if (!inbox.has(clientId)) inbox.set(clientId, []);
    inbox.get(clientId).push({ event, payload: payload == null ? payload : JSON.parse(JSON.stringify(payload)) });
  };
  const manager = new RoomManager({ send, scheduler, offline, onChange: () => changes++ });
  const last = (clientId, event) => {
    const list = (inbox.get(clientId) || []).filter((m) => m.event === event);
    return list.length ? list[list.length - 1].payload : undefined;
  };
  return { scheduler, manager, inbox, last, changes: () => changes };
}

const ok = (res) => {
  assert.ok(res.ok, res.error);
  return res;
};

const LOCAL = 'local-player';

// ผ่านเรื่องให้ตัดสินใจตอนต้นตา (ถ้ามี)
function skipChoice(env, clientId) {
  const g = env.last(clientId, 'game');
  if (g.view.phase.type === 'choice') {
    ok(env.manager.handle(clientId, 'game:action', { action: { type: 'choose', value: g.view.phase.options.at(-1).id, seq: g.view.seq } }));
  }
  return env.last(clientId, 'game');
}

// ผ่านเรื่องให้ตัดสินใจ (ถ้ามี) แล้วจบสัปดาห์
function playMyWeek(env, clientId) {
  const g = skipChoice(env, clientId);
  if (g.view.status === 'playing' && g.view.phase.type === 'week') {
    ok(env.manager.handle(clientId, 'game:action', { action: { type: 'endTurn', seq: g.view.seq } }));
  }
}

// เล่นต่อไปจนถึงสัปดาห์ที่ต้องการ (คนจริงจบสัปดาห์เอง บอทเล่นตามเวลา)
function playUntilWeek(env, clientId, mySeats, week, maxLoops = 600) {
  for (let i = 0; i < maxLoops; i++) {
    const g = env.last(clientId, 'game');
    if (g.view.status !== 'playing' || g.view.week >= week) return g.view;
    if (mySeats.includes(g.view.currentPlayerId)) playMyWeek(env, clientId);
    else env.scheduler.advance(2000);
  }
  return env.last(clientId, 'game').view;
}

function roomOf(env, clientId) {
  return env.manager.roomOf(clientId);
}

// ห้องออนไลน์: คนจริง 1 คน + บอท 2 ตัว เล่นไปถึงสัปดาห์ที่ 3
function onlineGameMidway() {
  const env = setup();
  ok(env.manager.handle('host-client-1', 'room:create', { name: 'ก้อง', options: { turnSeconds: 0, weeks: 10 } }));
  ok(env.manager.handle('host-client-1', 'room:addBot'));
  ok(env.manager.handle('host-client-1', 'room:addBot'));
  ok(env.manager.handle('host-client-1', 'room:start'));
  const me = env.last('host-client-1', 'room').you;
  ok(env.manager.handle('host-client-1', 'chat:send', { text: 'สวัสดีบอท' }));
  playUntilWeek(env, 'host-client-1', me, 3);
  return { ...env, me };
}

test('serialize → JSON → restore: สถานะเกมเหมือนเดิมทุกอย่าง และเล่นต่อได้เหมือนไม่เคยหยุด', () => {
  const a = onlineGameMidway();
  const original = roomOf(a, 'host-client-1');
  const text = JSON.stringify(a.manager.serialize());

  const b = setup({ start: 5_000_000 });
  const res = b.manager.restore(JSON.parse(text));
  assert.deepEqual(res, { restored: 1, skipped: 0, errors: [] });
  const restored = b.manager.rooms.get(original.code);
  assert.ok(restored);
  assert.deepEqual(restored.game, original.game);
  assert.equal(restored.status, 'playing');
  assert.deepEqual(restored.chat, original.chat);
  assert.equal(restored.hostClientId, 'host-client-1');
  // คนจริงเริ่มแบบหลุด รอเชื่อมต่อกลับด้วย clientId เดิม
  assert.equal(restored.seats.find((s) => s.clientId === 'host-client-1').connected, false);
  assert.equal(b.manager.roomOf('host-client-1'), restored);

  // เชื่อมต่อกลับ: ได้ห้องและเกมเต็ม ๆ กลับมา
  b.manager.connect('host-client-1');
  assert.equal(b.last('host-client-1', 'room').code, original.code);
  assert.ok(b.last('host-client-1', 'game').full);
  assert.equal(b.last('host-client-1', 'game').view.week, original.game.week);

  // ทั้งสองห้องเล่นต่อด้วยคำสั่งเดียวกัน → ผลลัพธ์ต้องเหมือนกันทุกอย่าง (ตัวสุ่มต่อจากเดิม)
  for (let i = 0; i < 400; i++) {
    const ga = a.last('host-client-1', 'game').view;
    const gb = b.last('host-client-1', 'game').view;
    if (ga.week >= 5 || ga.status !== 'playing') break;
    if (a.me.includes(ga.currentPlayerId) && a.me.includes(gb.currentPlayerId) && ga.seq === gb.seq) {
      playMyWeek(a, 'host-client-1');
      playMyWeek(b, 'host-client-1');
    } else {
      a.scheduler.advance(2000);
      b.scheduler.advance(2000);
    }
  }
  assert.ok(original.game.week >= 5);
  assert.deepEqual(restored.game, original.game);
  a.manager.destroyAll();
  b.manager.destroyAll();
});

test('เซฟไม่มีข้อมูลชั่วคราว (chatTimes) และเป็นสำเนาแยก แก้แล้วห้องจริงไม่เปลี่ยน', () => {
  const env = onlineGameMidway();
  const room = roomOf(env, 'host-client-1');
  const save = room.serialize();
  assert.equal(save.saveVersion, SAVE_VERSION);
  assert.equal(save.game.version, STATE_VERSION);
  assert.ok(typeof save.savedAt === 'number');
  for (const s of save.seats) assert.equal('chatTimes' in s, false);
  save.game.week = 999;
  save.seats[0].name = 'แก้ไข';
  assert.notEqual(room.game.week, 999);
  assert.notEqual(room.seats[0].name, 'แก้ไข');
  env.manager.destroyAll();
});

test('เซิร์ฟเวอร์รีสตาร์ตระหว่างตาของคนจริง: รอให้กลับมาก่อน ไม่กลับมาก็ระบบเล่นแทน กลับมาแล้วเล่นต่อเองได้', () => {
  const a = onlineGameMidway();
  // ให้ถึงตาของคนจริงก่อนบันทึก
  for (let i = 0; i < 200 && !a.me.includes(a.last('host-client-1', 'game').view.currentPlayerId); i++) a.scheduler.advance(2000);
  const room = roomOf(a, 'host-client-1');
  assert.ok(a.me.includes(room.game.currentPlayerId));
  const data = JSON.parse(JSON.stringify(a.manager));
  a.manager.destroyAll();

  const b = setup({ start: 10_000_000 });
  b.manager.restore(data);
  const restored = b.manager.rooms.get(room.code);
  const seq = restored.game.seq;
  b.scheduler.advance(5000);
  assert.equal(restored.game.seq, seq, 'ยังรอให้คนจริงเชื่อมต่อกลับมา');
  // ไม่กลับมาในเวลา → ระบบเล่นแทนตานี้ (ตามกติกาหลุดการเชื่อมต่อเดิม)
  b.scheduler.advance(60000);
  assert.ok(restored.game.seq > seq);
  // กลับมาแล้ว: ถึงตาตัวเองเมื่อไหร่ก็เล่นเองได้
  b.manager.connect('host-client-1');
  const view = playUntilWeek(b, 'host-client-1', a.me, restored.game.week + 2);
  assert.equal(view.status, 'playing');
  for (let i = 0; i < 200 && !a.me.includes(b.last('host-client-1', 'game').view.currentPlayerId); i++) b.scheduler.advance(2000);
  const g = skipChoice(b, 'host-client-1').view;
  ok(b.manager.handle('host-client-1', 'game:action', { action: { type: 'move', to: 'park', seq: g.seq } }));
  assert.equal(b.last('host-client-1', 'game').view.players.find((p) => p.id === g.currentPlayerId).location, 'park');
  b.manager.destroyAll();
});

test('ห้องสองคนหลังรีสตาร์ต: แต่ละคนกลับเข้าห้องเดิมด้วย clientId ของตัวเอง', () => {
  const env = setup();
  const { code } = ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์', options: { turnSeconds: 120 } }));
  ok(env.manager.handle('guest-client-1', 'room:join', { name: 'แขก', code }));
  ok(env.manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(env.manager.handle('host-client-1', 'room:start'));
  // ห้องรอของอีกห้องก็กลับมาด้วย
  ok(env.manager.handle('lobby-client-1', 'room:create', { name: 'รอเพื่อน' }));
  const data = JSON.parse(JSON.stringify(env.manager.serialize()));
  env.manager.destroyAll();

  const b = setup();
  assert.equal(b.manager.restore(data).restored, 2);
  b.manager.connect('guest-client-1');
  b.manager.connect('host-client-1');
  b.manager.connect('lobby-client-1');
  assert.equal(b.last('guest-client-1', 'room').code, code);
  assert.equal(b.last('host-client-1', 'room').isHost, true);
  assert.equal(b.last('guest-client-1', 'room').isHost, false);
  assert.equal(b.last('lobby-client-1', 'room').status, 'lobby');
  assert.ok(b.last('host-client-1', 'room').seats.every((s) => s.connected));
  // คนที่ถึงตาเล่นได้ คนที่ไม่ถึงตาเล่นไม่ได้ เหมือนก่อนรีสตาร์ต
  const view = b.last('host-client-1', 'game').view;
  const mine = b.last('host-client-1', 'room').you[0];
  const current = view.currentPlayerId === mine ? 'host-client-1' : 'guest-client-1';
  const waiting = current === 'host-client-1' ? 'guest-client-1' : 'host-client-1';
  assert.equal(b.manager.handle(waiting, 'game:action', { action: { type: 'move', to: 'park', seq: view.seq } }).ok, false);
  ok(b.manager.handle(current, 'game:action', { action: { type: 'move', to: 'park', seq: view.seq } }));
  // คนใหม่เข้าห้องรอที่กลับมาได้
  ok(b.manager.handle('new-client-1', 'room:join', { name: 'เพื่อนใหม่', code: b.last('lobby-client-1', 'room').code }));
  b.manager.destroyAll();
});

test('ส่งออกเซฟจากเกมออนไลน์: ไม่มี clientId ของใครหลุดออกไป และสุ่มตัวสุ่มใหม่', () => {
  const env = setup();
  const { code } = ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์', options: { turnSeconds: 90 } }));
  ok(env.manager.handle('guest-client-1', 'room:join', { name: 'แขก', code }));
  ok(env.manager.handle('host-client-1', 'room:addBot'));
  ok(env.manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(env.manager.handle('host-client-1', 'room:start'));
  const room = env.manager.rooms.get(code);

  const res = ok(env.manager.handle('guest-client-1', 'room:export'));
  const playersAtExport = JSON.parse(JSON.stringify(room.game.players));
  const text = JSON.stringify(res.save);
  assert.equal(text.includes('host-client-1'), false);
  assert.equal(text.includes('guest-client-1'), false);
  assert.equal(res.save.exported, true);
  assert.equal(res.save.hostClientId, 'player-1');
  assert.deepEqual(res.save.seats.map((s) => s.clientId), ['player-1', 'player-2', null]);
  assert.equal(typeof res.save.game.rng, 'number');
  assert.notEqual(res.save.game.rng, room.game.rng);
  assert.equal(room.hostClientId, 'host-client-1', 'ห้องจริงไม่ถูกแก้');
  // กดรัว ๆ ไม่ได้
  assert.equal(env.manager.handle('guest-client-1', 'room:export').ok, false);
  env.scheduler.advance(3000);
  ok(env.manager.handle('guest-client-1', 'room:export'));
  // คนนอกห้อง / ห้องที่ยังไม่เริ่ม ขอไม่ได้
  assert.equal(env.manager.handle('stranger-client', 'room:export').ok, false);
  ok(env.manager.handle('lobby-client-1', 'room:create', { name: 'รอ' }));
  assert.match(env.manager.handle('lobby-client-1', 'room:export').error, /ยังไม่ได้เริ่มเกม/);

  // เอาไปเล่นต่อแบบออฟไลน์บนเครื่องเดียว: ทุกคนจริงเป็นของเครื่องนี้ (คนแรกเป็นเจ้าของห้อง ที่เหลือผลัดกันเล่น)
  const off = setup({ offline: true });
  const loaded = ok(off.manager.handle(LOCAL, 'room:load', { save: res.save }));
  assert.equal(loaded.code, code);
  const r = off.last(LOCAL, 'room');
  assert.equal(r.offline, true);
  assert.equal(r.isHost, true);
  assert.equal(r.options.turnSeconds, 0, 'เล่นบนเครื่องเดียวไม่จับเวลา');
  assert.deepEqual(r.you, ['p1', 'p2']);
  assert.deepEqual(r.seats.map((s) => [s.local, s.isBot]), [[false, false], [true, false], [false, true]]);
  assert.deepEqual(off.manager.roomOf(LOCAL).game.players, playersAtExport);
  // เล่นต่อได้จริง: ทั้งสองที่นั่งเป็นของเครื่องนี้
  const view = playUntilWeek(off, LOCAL, r.you, 3);
  assert.equal(view.week, 3);
  env.manager.destroyAll();
  off.manager.destroyAll();
});

test('โหมดออฟไลน์: ส่งออก → โหลดกลับ ได้เกมเดิม (ผู้เล่นบนเครื่องเดียวกันครบ) และเล่นต่อได้', () => {
  const env = setup({ offline: true });
  ok(env.manager.handle(LOCAL, 'room:create', { name: 'พ่อ' }));
  ok(env.manager.handle(LOCAL, 'room:addLocal', { name: 'แม่' }));
  ok(env.manager.handle(LOCAL, 'room:addBot'));
  ok(env.manager.handle(LOCAL, 'room:start'));
  const you = env.last(LOCAL, 'room').you;
  playUntilWeek(env, LOCAL, you, 2);
  const { save } = ok(env.manager.handle(LOCAL, 'room:export'));
  const before = env.manager.roomOf(LOCAL);
  assert.equal(save.seats[0].clientId, LOCAL, 'ออฟไลน์ไม่ต้องตัดรหัสเครื่อง');
  assert.equal(save.game.rng, before.game.rng, 'ออฟไลน์ตัวสุ่มเหมือนเดิม');

  // เครื่องเดิม หลังรีเฟรชหน้า: สร้างการเชื่อมต่อใหม่แล้วโหลด
  const b = setup({ offline: true });
  b.manager.connect(LOCAL);
  ok(b.manager.handle(LOCAL, 'room:load', { save: JSON.parse(JSON.stringify(save)) }));
  const room = b.last(LOCAL, 'room');
  assert.deepEqual(room.you, you);
  assert.equal(room.status, 'playing');
  assert.ok(b.last(LOCAL, 'game').full);
  assert.deepEqual(b.manager.roomOf(LOCAL).game, before.game);
  assert.deepEqual(b.last(LOCAL, 'chatHistory').map((m) => m.text), before.chat.map((m) => m.text));
  const view = playUntilWeek(b, LOCAL, you, 4);
  assert.equal(view.week, 4);
  // โหลดเซฟทับเกมที่กำลังเล่นอยู่: ห้องเดิมหายไป ใช้ห้องจากเซฟแทน
  ok(b.manager.handle(LOCAL, 'room:load', { save }));
  assert.equal(b.manager.rooms.size, 1);
  assert.equal(b.manager.roomOf(LOCAL).game.week, before.game.week);
  env.manager.destroyAll();
  b.manager.destroyAll();
});

test('เซิร์ฟเวอร์ออนไลน์ปฏิเสธ room:load เสมอ (ห้ามฝังสถานะเกมเองเข้าเซิร์ฟเวอร์)', () => {
  const off = setup({ offline: true });
  ok(off.manager.handle(LOCAL, 'room:create', { name: 'ก' }));
  ok(off.manager.handle(LOCAL, 'room:addBot'));
  ok(off.manager.handle(LOCAL, 'room:start'));
  const { save } = ok(off.manager.handle(LOCAL, 'room:export'));

  const env = setup();
  const res = env.manager.handle('hacker-client', 'room:load', { save });
  assert.equal(res.ok, false);
  assert.match(res.error, /ออฟไลน์/);
  assert.equal(env.manager.rooms.size, 0);
  assert.equal(env.manager.roomOf('hacker-client'), null);
  // คนที่อยู่ในห้องแล้วก็โหลดทับไม่ได้
  ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์' }));
  assert.equal(env.manager.handle('host-client-1', 'room:load', { save }).ok, false);
  assert.equal(env.manager.roomOf('host-client-1').status, 'lobby');
  off.manager.destroyAll();
  env.manager.destroyAll();
});

test('เซฟเสีย / ผิดเวอร์ชัน ถูกปฏิเสธด้วยข้อความภาษาไทย ไม่ทำให้ล่ม และเกมที่เล่นอยู่ไม่หาย', () => {
  const env = setup({ offline: true });
  ok(env.manager.handle(LOCAL, 'room:create', { name: 'ก' }));
  ok(env.manager.handle(LOCAL, 'room:addBot'));
  ok(env.manager.handle(LOCAL, 'room:start'));
  const good = ok(env.manager.handle(LOCAL, 'room:export')).save;
  const current = env.manager.roomOf(LOCAL);
  const mutate = (fn) => {
    const copy = JSON.parse(JSON.stringify(good));
    fn(copy);
    return copy;
  };
  const firstPlayer = Object.keys(good.game.players)[0];
  const bad = {
    null: null,
    string: 'hello',
    number: 42,
    array: [1, 2],
    empty: {},
    otherJson: { name: 'ไม่ใช่เซฟ', seats: 'x' },
    newerSave: mutate((d) => (d.saveVersion = SAVE_VERSION + 1)),
    oldGame: mutate((d) => (d.game.version = STATE_VERSION - 1)),
    noGame: mutate((d) => (d.game = null)),
    gameNotObject: mutate((d) => (d.game = 'x')),
    seatsEmpty: mutate((d) => (d.seats = [])),
    seatsNotObjects: mutate((d) => (d.seats = [1, 2])),
    duplicateSeat: mutate((d) => (d.seats[1].id = d.seats[0].id)),
    noHumans: mutate((d) => d.seats.forEach((s) => (s.clientId = null))),
    playersMismatch: mutate((d) => {
      d.game.players.zzz = d.game.players[firstPlayer];
      delete d.game.players[firstPlayer];
    }),
    extraPlayer: mutate((d) => (d.game.players.p99 = d.game.players[firstPlayer])),
    badCurrent: mutate((d) => (d.game.currentPlayerId = 'nobody')),
    statusMismatch: mutate((d) => (d.status = 'finished')),
    badStatus: mutate((d) => (d.status = 'hacked')),
    badCode: mutate((d) => (d.code = '<script>')),
    badRng: mutate((d) => (d.game.rng = 'abc')),
    badOrder: mutate((d) => (d.game.order = ['p1', 'p1'])),
    playerGutted: mutate((d) => (d.game.players[firstPlayer] = {})),
    phaseMissing: mutate((d) => delete d.game.phase),
    // ผ่านการตรวจโครงสร้างและสร้างหน้าจอได้ แต่พังตอนบอทคิด / ตอนจบสัปดาห์ (เช่นเซฟจากกติกาเวอร์ชันอื่น)
    breaksBot: mutate((d) => Object.values(d.game.players).forEach((p) => (p.c = null))),
    breaksEndWeek: mutate((d) => Object.values(d.game.players).forEach((p) => (p.quests = null))),
  };
  for (const [name, save] of Object.entries(bad)) {
    let res;
    assert.doesNotThrow(() => {
      res = env.manager.handle(LOCAL, 'room:load', { save });
    }, name);
    assert.equal(res.ok, false, `${name} ต้องถูกปฏิเสธ`);
    assert.match(res.error, /เซฟ/, name);
    assert.equal(validateRoomSave(save) !== null, true, name);
    assert.throws(() => Room.restore(save, { scheduler: env.scheduler, send: () => {} }), /เซฟ/, name);
  }
  assert.match(env.manager.handle(LOCAL, 'room:load', { save: bad.oldGame }).error, /เวอร์ชัน/);
  assert.match(env.manager.handle(LOCAL, 'room:load', { save: bad.otherJson }).error, /ไม่ใช่ไฟล์เซฟ/);
  assert.equal(env.manager.handle(LOCAL, 'room:load', {}).ok, false);
  // ห้องเดิมยังเล่นอยู่ตามปกติ
  assert.equal(env.manager.roomOf(LOCAL), current);
  assert.equal(current.destroyed, false);
  // ข้อมูลส่วนห้องที่แปลก ๆ (แชทพัง ตัวนับหาย ชื่อยาว/มีแท็ก) ถูกทำความสะอาด ไม่ถึงกับโหลดไม่ได้
  const messy = mutate((d) => {
    d.chat = [null, 'x', { id: 1, text: 'ok', ts: 'bad' }, { id: 'y', text: 1 }];
    delete d.chatSeq;
    delete d.seatSeq;
    d.seats[0].name = '<b>ชื่อยาวมากกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกกก</b>';
    d.seats[0].color = 'url(javascript:alert(1))';
    d.options = { turnSeconds: 'lots', maxPlayers: 99 };
  });
  ok(env.manager.handle(LOCAL, 'room:load', { save: messy }));
  const room = env.manager.roomOf(LOCAL);
  assert.deepEqual(room.chat.map((m) => m.text), ['ok']);
  assert.ok(room.seatSeq >= room.seats.length);
  assert.ok(!room.seats[0].name.includes('<'));
  assert.ok(room.seats[0].name.length <= 40);
  assert.match(room.seats[0].color, /^#/);
  assert.equal(room.options.maxPlayers, 4);
  env.manager.destroyAll();
});

test('RoomManager.restore: ข้ามห้องที่เสีย เก็บห้องที่ดี และไม่โยน error กับไฟล์ที่ไม่ใช่เซฟ', () => {
  const a = onlineGameMidway();
  const data = a.manager.serialize();
  a.manager.destroyAll();
  const broken = JSON.parse(JSON.stringify(data.rooms[0]));
  broken.code = 'BROKE';
  broken.game.players = {};
  data.rooms.push(broken, null, 'x', { ...data.rooms[0] }); // ห้องซ้ำรหัสก็ถูกข้าม

  const b = setup();
  const res = b.manager.restore(data);
  assert.equal(res.restored, 1);
  assert.equal(res.skipped, 4);
  assert.equal(b.manager.rooms.size, 1);
  for (const input of [null, undefined, 5, 'x', [], {}, { rooms: 'x' }, { saveVersion: 999, rooms: [] }]) {
    const fresh = setup();
    assert.doesNotThrow(() => fresh.manager.restore(input));
    assert.equal(fresh.manager.rooms.size, 0);
  }
  b.manager.destroyAll();
});

test('onChange ถูกเรียกเมื่อห้องเปลี่ยน (ใช้เป็นสัญญาณให้บันทึก) รวมถึงตอนลบห้อง', () => {
  const env = setup();
  ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์' }));
  const n1 = env.changes();
  assert.ok(n1 > 0);
  ok(env.manager.handle('host-client-1', 'room:addBot'));
  const n2 = env.changes();
  assert.ok(n2 > n1);
  env.manager.disconnect('host-client-1');
  env.scheduler.advance(11 * 60 * 1000);
  env.manager.sweep();
  assert.equal(env.manager.rooms.size, 0);
  assert.ok(env.changes() > n2);
});

test('error ในจังหวะของบอทไม่ทำให้ล่ม: ครั้งเดียวระบบจบตาให้แล้วเล่นต่อ, ซ้ำ ๆ หยุดเกมนั้นพร้อมแจ้งในแชท', (t) => {
  t.mock.method(console, 'error', () => {});
  const env = setup();
  ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์', options: { turnSeconds: 0 } }));
  ok(env.manager.handle('host-client-1', 'room:addBot'));
  ok(env.manager.handle('host-client-1', 'room:start'));
  const room = roomOf(env, 'host-client-1');
  const me = env.last('host-client-1', 'room').you;
  const toBotTurn = () => {
    for (let i = 0; i < 100 && me.includes(room.game.currentPlayerId); i++) {
      playMyWeek(env, 'host-client-1');
      env.scheduler.advance(10);
    }
  };
  toBotTurn();
  const bot = room.game.currentPlayerId;
  assert.ok(!me.includes(bot));

  // error ครั้งเดียว: ระบบจบตาของบอทให้ เกมเดินต่อ
  const realRunAuto = room.runAuto;
  room.runAuto = function () {
    room.runAuto = realRunAuto;
    throw new Error('ทดสอบ error');
  };
  assert.doesNotThrow(() => env.scheduler.advance(10000));
  assert.ok(me.includes(room.game.currentPlayerId), 'ข้ามตาบอทที่ error มาถึงตาคนจริง');

  // error ทุกครั้ง (สถานะเสียจริง): หยุดเกมนั้น ไม่ล่ม ไม่วนไม่จบ
  toBotTurn();
  for (const p of Object.values(room.game.players)) p.quests = null;
  assert.doesNotThrow(() => env.scheduler.advance(60000));
  assert.match(env.last('host-client-1', 'chat').text, /เล่นต่อไม่ได้/);
  assert.equal(env.scheduler.pending(), 0, 'ไม่มีตัวจับเวลาค้างวนซ้ำ');
  env.manager.destroyAll();
});
