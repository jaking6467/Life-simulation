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
    pending: () => timers.length,
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

function startTwoPlayerGame(options = { turnSeconds: 30 }) {
  const env = setup();
  const { manager } = env;
  const { code } = ok(manager.handle('host-client-1', 'room:create', { name: 'โฮสต์', options }));
  ok(manager.handle('guest-client-1', 'room:join', { name: 'แขก', code }));
  return { ...env, code };
}

test('ห้องรอ: เริ่มเกมได้เมื่อทุกคนกดพร้อม และเฉพาะเจ้าของห้อง', () => {
  const { manager, last } = startTwoPlayerGame();
  assert.equal(manager.handle('guest-client-1', 'room:start').ok, false);
  const notReady = manager.handle('host-client-1', 'room:start');
  assert.equal(notReady.ok, false);
  assert.match(notReady.error, /พร้อม/);
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  const room = last('guest-client-1', 'room');
  assert.equal(room.status, 'playing');
  const game = last('guest-client-1', 'game');
  assert.ok(game.view.currentPlayerId);
  assert.equal(game.view.players.length, 2);
});

test('เฉพาะผู้เล่นที่ถึงตาเท่านั้นที่สั่งได้ คนอื่นต้องรอ', () => {
  const { manager, last } = startTwoPlayerGame();
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  const room = last('host-client-1', 'room');
  const view = last('host-client-1', 'game').view;
  const hostSeat = room.you[0];
  const current = view.currentPlayerId === hostSeat ? 'host-client-1' : 'guest-client-1';
  const waiting = current === 'host-client-1' ? 'guest-client-1' : 'host-client-1';

  const denied = manager.handle(waiting, 'game:action', { action: { type: 'choose', value: 'work', seq: view.seq } });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /ยังไม่ถึงตา/);

  ok(manager.handle(current, 'game:action', { action: { type: 'choose', value: 'college', seq: view.seq } }));
  const after = last(waiting, 'game');
  assert.equal(after.view.phase.type, 'spin');
  assert.equal(after.view.currentPlayerId, view.currentPlayerId);
});

test('หมดเวลา: ระบบเล่นแทน และครบ 2 ครั้งถือว่าไม่อยู่', () => {
  const { manager, scheduler, last } = startTwoPlayerGame({ turnSeconds: 30 });
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  const firstView = last('host-client-1', 'game').view;
  const firstPlayer = firstView.currentPlayerId;
  const seq = firstView.seq;
  assert.ok(last('host-client-1', 'game').deadlineIn > 29000);

  scheduler.advance(31000);
  const v2 = last('host-client-1', 'game').view;
  assert.ok(v2.seq > seq, 'ระบบควรเลือกให้เมื่อหมดเวลา');
  assert.equal(v2.currentPlayerId, firstPlayer);

  scheduler.advance(40000);
  const room = last('host-client-1', 'room');
  const seat = room.seats.find((s) => s.id === firstPlayer);
  assert.equal(seat.away, true);
});

test('ผู้เล่นคนเดียวกับบอท 3 ตัว: บอทเล่นเองและส่งตากลับมาให้คนจริง', () => {
  const { manager, scheduler, last } = setup();
  ok(manager.handle('solo-client-1', 'room:create', { name: 'ฉัน', options: { turnSeconds: 0 } }));
  for (let i = 0; i < 3; i++) ok(manager.handle('solo-client-1', 'room:addBot'));
  ok(manager.handle('solo-client-1', 'room:start'));
  const me = last('solo-client-1', 'room').you[0];
  for (let i = 0; i < 50; i++) {
    const g = last('solo-client-1', 'game');
    if (g.view.currentPlayerId === me) break;
    scheduler.advance(5000);
  }
  const g = last('solo-client-1', 'game');
  assert.equal(g.view.currentPlayerId, me);
  // ไม่ได้ตั้งเวลา: ถ้าคนจริงไม่กด เกมต้องรอ
  const seq = g.view.seq;
  scheduler.advance(10 * 60 * 1000);
  assert.equal(last('solo-client-1', 'game').view.seq, seq);
});

test('เกมเต็มรูปแบบ (คนจริงไม่อยู่ + บอท) เล่นจนจบได้', () => {
  const { manager, scheduler, last } = setup();
  ok(manager.handle('afk-client-1', 'room:create', { name: 'คนหาย', options: { turnSeconds: 30, speed: 2 } }));
  for (let i = 0; i < 3; i++) ok(manager.handle('afk-client-1', 'room:addBot'));
  ok(manager.handle('afk-client-1', 'room:start'));
  for (let i = 0; i < 4000 && last('afk-client-1', 'room').status === 'playing'; i++) scheduler.advance(5000);
  assert.equal(last('afk-client-1', 'room').status, 'finished');
  const game = last('afk-client-1', 'game');
  assert.equal(game.view.status, 'finished');
  assert.equal(game.view.results.length, 4);
  assert.ok(game.view.results[0].tiles.length > 0, 'จบเกมแล้วต้องเปิดเผยบัตรความสุข');
});

test('ออกจากห้องระหว่างเกม: บอทเล่นแทน เกมไม่ค้าง', () => {
  const { manager, scheduler, last } = startTwoPlayerGame({ turnSeconds: 0 });
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  ok(manager.handle('guest-client-1', 'room:leave'));
  assert.equal(last('guest-client-1', 'room'), null);
  const room = last('host-client-1', 'room');
  assert.equal(room.seats.filter((s) => s.isBot).length, 1);
  // หลังจากนี้เมื่อถึงตาบอท ต้องเล่นเองได้
  const me = room.you[0];
  for (let i = 0; i < 40; i++) {
    const g = last('host-client-1', 'game');
    if (g.view.currentPlayerId !== me) scheduler.advance(5000);
    else {
      const a = g.view.phase.type === 'chooseStart' ? { type: 'choose', value: 'work' } : g.view.phase.type === 'chooseCareer' ? { type: 'choose', value: g.view.phase.options[0] } : { type: 'spin' };
      if (g.view.phase.type === 'spin' || g.view.phase.type === 'chooseStart' || g.view.phase.type === 'chooseCareer') {
        manager.handle('host-client-1', 'game:action', { action: { ...a, seq: g.view.seq } });
      } else break;
    }
  }
  assert.ok(last('host-client-1', 'game').view.turn > 2);
});

test('หลุดการเชื่อมต่อตอนถึงตา: รอสักพักแล้วระบบเล่นแทน, เชื่อมต่อใหม่ได้สถานะเดิม', () => {
  const { manager, scheduler, last, inbox } = startTwoPlayerGame({ turnSeconds: 0 });
  ok(manager.handle('guest-client-1', 'room:ready', { ready: true }));
  ok(manager.handle('host-client-1', 'room:start'));
  const view = last('host-client-1', 'game').view;
  const room = last('host-client-1', 'room');
  const current = view.currentPlayerId === room.you[0] ? 'host-client-1' : 'guest-client-1';
  manager.disconnect(current);
  scheduler.advance(5000);
  assert.equal(last('host-client-1', 'game').view.seq, view.seq);
  scheduler.advance(20000);
  assert.ok(last('host-client-1', 'game').view.seq > view.seq);

  inbox.set(current, []);
  manager.connect(current);
  assert.equal(last(current, 'room').code, room.code);
  assert.ok(last(current, 'game').full);
});

test('จับคู่ด่วนเข้าห้องสาธารณะที่ว่างอยู่', () => {
  const { manager } = setup();
  const a = ok(manager.handle('quick-client-a', 'room:quick', { name: 'เอ' }));
  const b = ok(manager.handle('quick-client-b', 'room:quick', { name: 'บี' }));
  assert.equal(a.code, b.code);
});

test('แชท: ส่งถึงทุกคนในห้อง และกันการส่งรัว', () => {
  const { manager, last } = startTwoPlayerGame();
  ok(manager.handle('host-client-1', 'chat:send', { text: 'สวัสดี <b>ทุกคน</b>' }));
  assert.equal(last('guest-client-1', 'chat').text, 'สวัสดี <b>ทุกคน</b>');
  for (let i = 0; i < 4; i++) manager.handle('host-client-1', 'chat:send', { text: `ข้อความ ${i}` });
  assert.equal(manager.handle('host-client-1', 'chat:send', { text: 'เกิน' }).ok, false);
});

test('เล่นบนเครื่องเดียวกันหลายคน: เครื่องเดียวควบคุมได้หลายที่นั่ง', () => {
  const { manager, last } = setup({ offline: true });
  ok(manager.handle('local-player', 'room:create', { name: 'พ่อ' }));
  ok(manager.handle('local-player', 'room:addLocal', { name: 'แม่' }));
  ok(manager.handle('local-player', 'room:start'));
  const room = last('local-player', 'room');
  assert.equal(room.you.length, 2);
  const g = last('local-player', 'game');
  assert.ok(room.you.includes(g.view.currentPlayerId));
  ok(manager.handle('local-player', 'game:action', { action: { type: 'choose', value: 'work', seq: g.view.seq } }));
});
