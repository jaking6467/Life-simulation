import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/game/roomManager.js';

// นาฬิกาจำลอง: เลื่อนเวลาได้เองโดยไม่ต้องรอจริง
function fakeScheduler() {
  let now = 0;
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
  };
}

function setup({ offline = false } = {}) {
  const scheduler = fakeScheduler();
  const inbox = new Map();
  const send = (clientId, event, payload) => {
    if (!inbox.has(clientId)) inbox.set(clientId, []);
    inbox.get(clientId).push({ event, payload });
  };
  const manager = new RoomManager({ send, scheduler, offline });
  const last = (clientId, event) => {
    const list = (inbox.get(clientId) || []).filter((m) => m.event === event);
    return list.length ? list[list.length - 1].payload : undefined;
  };
  return { scheduler, manager, inbox, last };
}

const ok = (res) => {
  assert.ok(res.ok, res.error);
  return res;
};

function twoPlayerRoom(options = { turnSeconds: 120 }) {
  const env = setup();
  const { code } = ok(env.manager.handle('host-client-1', 'room:create', { name: 'โฮสต์', options }));
  ok(env.manager.handle('guest-client-1', 'room:join', { name: 'แขก', code }));
  return { ...env, code };
}

function startTwoPlayer(options) {
  const env = twoPlayerRoom(options);
  ok(env.manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(env.manager.handle('host-client-1', 'room:start'));
  const room = env.last('host-client-1', 'room');
  const view = env.last('host-client-1', 'game').view;
  const hostSeat = room.you[0];
  const current = view.currentPlayerId === hostSeat ? 'host-client-1' : 'guest-client-1';
  const waiting = current === 'host-client-1' ? 'guest-client-1' : 'host-client-1';
  return { ...env, current, waiting };
}

// ผ่านเรื่องให้ตัดสินใจตอนต้นตา (ถ้ามี)
function skipChoice(env, clientId) {
  const g = env.last(clientId, 'game');
  if (g.view.phase.type === 'choice') {
    ok(env.manager.handle(clientId, 'game:action', { action: { type: 'choose', value: g.view.phase.options.at(-1).id, seq: g.view.seq } }));
  }
}

test('ห้องรอ: เริ่มเกมได้เมื่อทุกคนกดพร้อม และเฉพาะเจ้าของห้อง', () => {
  const { manager, last } = twoPlayerRoom();
  assert.equal(manager.handle('guest-client-1', 'room:start').ok, false);
  const notReady = manager.handle('host-client-1', 'room:start');
  assert.equal(notReady.ok, false);
  assert.match(notReady.error, /พร้อม/);
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  assert.equal(last('guest-client-1', 'room').status, 'playing');
  const game = last('guest-client-1', 'game');
  assert.equal(game.view.players.length, 2);
  assert.equal(game.view.week, 1);
});

test('เลือกบทบาทในห้องรอได้ ห้ามซ้ำกับคนอื่น และเกมใช้บทบาทที่เลือก', () => {
  const { manager, last } = twoPlayerRoom();
  const room = last('host-client-1', 'room');
  const [hostSeat, guestSeat] = room.seats;
  ok(manager.handle('host-client-1', 'room:role', { seatId: hostSeat.id, role: 'mystic' }));
  assert.equal(manager.handle('guest-client-1', 'room:role', { seatId: guestSeat.id, role: 'mystic' }).ok, false);
  assert.equal(manager.handle('guest-client-1', 'room:role', { seatId: hostSeat.id, role: 'artist' }).ok, false);
  ok(manager.handle('guest-client-1', 'room:role', { seatId: guestSeat.id, role: 'scholar' }));
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  const players = last('host-client-1', 'game').view.players;
  assert.equal(players.find((p) => p.id === hostSeat.id).role, 'mystic');
  assert.equal(players.find((p) => p.id === guestSeat.id).role, 'scholar');
});

test('เฉพาะคนที่ถึงตาเท่านั้นที่เดินและทำกิจกรรมได้ คนอื่นต้องรอ', () => {
  const env = startTwoPlayer();
  const { manager, last, current, waiting } = env;
  const view = last(current, 'game').view;
  const denied = manager.handle(waiting, 'game:action', { action: { type: 'move', to: 'cluckers', seq: view.seq } });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /ยังไม่ถึงตา/);
  ok(manager.handle(current, 'game:action', { action: { type: 'move', to: 'cluckers', seq: view.seq } }));
  const after = last(waiting, 'game').view;
  assert.equal(after.players.find((p) => p.id === view.currentPlayerId).location, 'cluckers');
  assert.equal(after.currentPlayerId, view.currentPlayerId);
});

test('จบสัปดาห์แล้วส่งตาให้อีกคน และเวลาของสัปดาห์ไม่รีเซ็ตเมื่อทำกิจกรรมระหว่างตา', () => {
  const env = startTwoPlayer({ turnSeconds: 120 });
  const { manager, last, scheduler, current, waiting } = env;
  const first = last(current, 'game');
  const deadline0 = first.deadlineIn;
  assert.ok(deadline0 > 119000);
  scheduler.advance(10000);
  const view = last(current, 'game').view;
  ok(manager.handle(current, 'game:action', { action: { type: 'move', to: 'park', seq: view.seq } }));
  assert.ok(last(current, 'game').deadlineIn < deadline0 - 9000, 'เวลาต้องเดินต่อ ไม่เริ่มใหม่');
  const v2 = last(current, 'game').view;
  ok(manager.handle(current, 'game:action', { action: { type: 'endTurn', seq: v2.seq } }));
  const v3 = last(waiting, 'game').view;
  assert.notEqual(v3.currentPlayerId, view.currentPlayerId);
  assert.ok(last(waiting, 'game').deadlineIn > 119000, 'คนใหม่ได้เวลาเต็ม');
});

test('หมดเวลา: ระบบจบสัปดาห์ให้ ครบ 2 ครั้งถือว่าไม่อยู่และบอทเล่นแทน', () => {
  const env = setup();
  ok(env.manager.handle('afk-client-1', 'room:create', { name: 'คนหาย', options: { turnSeconds: 60 } }));
  ok(env.manager.handle('afk-client-1', 'room:addBot'));
  ok(env.manager.handle('afk-client-1', 'room:start'));
  const me = env.last('afk-client-1', 'room').you[0];
  let timeouts = 0;
  for (let i = 0; i < 200 && timeouts < 2; i++) {
    const g = env.last('afk-client-1', 'game');
    if (g.view.currentPlayerId === me) {
      const turn = g.view.turn;
      env.scheduler.advance(62000);
      if (env.last('afk-client-1', 'game').view.turn !== turn) timeouts++;
    } else env.scheduler.advance(3000);
  }
  assert.equal(timeouts, 2);
  const seat = env.last('afk-client-1', 'room').seats.find((s) => s.id === me);
  assert.equal(seat.away, true);
});

test('คนเดียวกับบอท 3 ตัว: บอทเล่นเองและส่งตากลับมาให้คนจริง', () => {
  const { manager, scheduler, last } = setup();
  ok(manager.handle('solo-client-1', 'room:create', { name: 'ฉัน', options: { turnSeconds: 0 } }));
  for (let i = 0; i < 3; i++) ok(manager.handle('solo-client-1', 'room:addBot'));
  ok(manager.handle('solo-client-1', 'room:start'));
  const me = last('solo-client-1', 'room').you[0];
  for (let i = 0; i < 400; i++) {
    const g = last('solo-client-1', 'game');
    if (g.view.currentPlayerId === me && g.view.week >= 2) break;
    if (g.view.currentPlayerId === me) {
      skipChoice({ manager, last }, 'solo-client-1');
      const v = last('solo-client-1', 'game').view;
      ok(manager.handle('solo-client-1', 'game:action', { action: { type: 'endTurn', seq: v.seq } }));
    }
    scheduler.advance(2000);
  }
  const g = last('solo-client-1', 'game');
  assert.equal(g.view.currentPlayerId, me);
  assert.equal(g.view.week, 2);
  // ไม่ได้ตั้งเวลา: ถ้าคนจริงไม่กด เกมต้องรอ
  const seq = g.view.seq;
  scheduler.advance(10 * 60 * 1000);
  assert.equal(last('solo-client-1', 'game').view.seq, seq);
});

test('เกมเต็มรูปแบบ (คนจริงไม่อยู่ + บอท) เล่นจนจบได้', () => {
  const { manager, scheduler, last } = setup();
  ok(manager.handle('afk-client-2', 'room:create', { name: 'คนหาย', options: { turnSeconds: 60, speed: 2, weeks: 10 } }));
  for (let i = 0; i < 3; i++) ok(manager.handle('afk-client-2', 'room:addBot'));
  ok(manager.handle('afk-client-2', 'room:start'));
  for (let i = 0; i < 20000 && last('afk-client-2', 'room').status === 'playing'; i++) scheduler.advance(5000);
  assert.equal(last('afk-client-2', 'room').status, 'finished');
  const game = last('afk-client-2', 'game');
  assert.equal(game.view.status, 'finished');
  assert.equal(game.view.results.length, 4);
  assert.equal(game.view.week, 10);
});

test('ออกจากห้องระหว่างเกม: บอทเล่นแทน เกมไม่ค้าง', () => {
  const env = startTwoPlayer({ turnSeconds: 0 });
  const { manager, scheduler, last } = env;
  ok(manager.handle('guest-client-1', 'room:leave'));
  assert.equal(last('guest-client-1', 'room'), null);
  const room = last('host-client-1', 'room');
  assert.equal(room.seats.filter((s) => s.isBot).length, 1);
  const me = room.you[0];
  for (let i = 0; i < 300; i++) {
    const g = last('host-client-1', 'game');
    if (g.view.week >= 3) break;
    if (g.view.currentPlayerId === me) {
      skipChoice(env, 'host-client-1');
      const v = last('host-client-1', 'game').view;
      ok(manager.handle('host-client-1', 'game:action', { action: { type: 'endTurn', seq: v.seq } }));
    } else scheduler.advance(2000);
  }
  assert.ok(last('host-client-1', 'game').view.week >= 3);
});

test('หลุดการเชื่อมต่อตอนถึงตา: รอสักพักแล้วระบบเล่นแทน, เชื่อมต่อใหม่ได้สถานะเดิม', () => {
  const env = startTwoPlayer({ turnSeconds: 0 });
  const { manager, scheduler, last, inbox, current } = env;
  const view = last('host-client-1', 'game').view;
  manager.disconnect(current);
  scheduler.advance(5000);
  assert.equal(last('host-client-1', 'game').view.seq, view.seq);
  scheduler.advance(60000);
  assert.ok(last('host-client-1', 'game').view.seq > view.seq);
  inbox.set(current, []);
  manager.connect(current);
  assert.equal(last(current, 'room').code, env.code);
  assert.ok(last(current, 'game').full);
});

test('จับคู่ด่วนเข้าห้องสาธารณะที่ว่างอยู่', () => {
  const { manager } = setup();
  const a = ok(manager.handle('quick-client-a', 'room:quick', { name: 'เอ' }));
  const b = ok(manager.handle('quick-client-b', 'room:quick', { name: 'บี' }));
  assert.equal(a.code, b.code);
});

test('แชท: ส่งถึงทุกคนในห้อง และกันการส่งรัว', () => {
  const { manager, last } = twoPlayerRoom();
  ok(manager.handle('host-client-1', 'chat:send', { text: 'สวัสดี <b>ทุกคน</b>' }));
  assert.equal(last('guest-client-1', 'chat').text, 'สวัสดี <b>ทุกคน</b>');
  for (let i = 0; i < 4; i++) manager.handle('host-client-1', 'chat:send', { text: `ข้อความ ${i}` });
  assert.equal(manager.handle('host-client-1', 'chat:send', { text: 'เกิน' }).ok, false);
});

test('เล่นบนเครื่องเดียวกันหลายคน: เครื่องเดียวควบคุมได้หลายที่นั่ง', () => {
  const env = setup({ offline: true });
  const { manager, last } = env;
  ok(manager.handle('local-player', 'room:create', { name: 'พ่อ' }));
  ok(manager.handle('local-player', 'room:addLocal', { name: 'แม่' }));
  ok(manager.handle('local-player', 'room:start'));
  const room = last('local-player', 'room');
  assert.equal(room.you.length, 2);
  for (let i = 0; i < 2; i++) {
    const g = last('local-player', 'game');
    assert.ok(room.you.includes(g.view.currentPlayerId));
    skipChoice(env, 'local-player');
    const v = last('local-player', 'game').view;
    ok(manager.handle('local-player', 'game:action', { action: { type: 'endTurn', seq: v.seq } }));
  }
  assert.equal(last('local-player', 'game').view.week, 2);
});
