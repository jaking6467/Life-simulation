import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, performAction, toPublicView, listActions, weeklyPoints } from '../src/game/engine.js';
import { RULES } from '../src/game/rules.js';
import { JOBS } from '../src/game/jobs.js';
import { ringPath, travelHours, gridPosition, LOCATIONS } from '../src/game/city.js';
import { playBotGame } from '../scripts/simulate.js';

const PLAYERS = [
  { id: 'a', name: 'เอ', role: 'workaholic' },
  { id: 'b', name: 'บี', role: 'artist' },
  { id: 'c', name: 'ซี' },
];

function newGame(opts = {}) {
  return createGame({ players: PLAYERS, seed: 42, options: { weeks: 3, ...opts } });
}

function act(state, action) {
  const res = performAction(state, state.currentPlayerId, { ...action, seq: state.seq });
  assert.ok(res.ok, res.error);
  return res;
}

const cur = (state) => state.players[state.currentPlayerId];

test('เริ่มเกม: สัปดาห์ที่ 1 ผู้เล่นคนแรกอยู่ที่บ้าน มีเวลา 60 ชม. และบทบาทไม่ซ้ำกัน', () => {
  const state = newGame();
  assert.equal(state.week, 1);
  assert.equal(state.phase.type, 'week');
  const p = cur(state);
  assert.equal(p.location, 'flat');
  assert.equal(p.hoursLeft, RULES.hoursPerWeek);
  assert.equal(state.players.a.role, 'workaholic');
  assert.equal(state.players.b.role, 'artist');
  const roles = Object.values(state.players).map((x) => x.role);
  assert.equal(new Set(roles).size, roles.length);
});

test('ผู้เล่นที่ยังไม่ถึงตาทำอะไรไม่ได้ และสถานะไม่เปลี่ยน', () => {
  const state = newGame();
  const other = state.order[1];
  const before = JSON.stringify(state);
  const res = performAction(state, other, { type: 'move', to: 'cluckers', seq: state.seq });
  assert.equal(res.ok, false);
  assert.match(res.error, /ยังไม่ถึงตา/);
  assert.equal(JSON.stringify(state), before);
});

test('คำสั่งที่ seq ไม่ตรง (ค้างจากหน้าจอเก่า) ถูกปฏิเสธ', () => {
  const state = newGame();
  const res = performAction(state, state.currentPlayerId, { type: 'move', to: 'cluckers', seq: state.seq - 1 });
  assert.equal(res.ok, false);
});

test('แผนที่: เดินทางตามทางที่สั้นกว่า และตำแหน่งบนตารางไม่ซ้ำกัน', () => {
  assert.deepEqual(ringPath('flat', 'market'), ['cluckers', 'market']);
  assert.deepEqual(ringPath('flat', 'park'), ['park']);
  assert.equal(travelHours('flat', 'market'), 2);
  assert.equal(travelHours('flat', 'market', 'motorbike'), 1);
  const cells = LOCATIONS.map((_, i) => JSON.stringify(gridPosition(i)));
  assert.equal(new Set(cells).size, LOCATIONS.length);
});

test('เดินไปที่อื่นเสียเวลาตามระยะทาง', () => {
  const state = newGame();
  const p = cur(state);
  const res = act(state, { type: 'move', to: 'market' });
  assert.equal(p.location, 'market');
  assert.equal(p.hoursLeft, 58);
  assert.deepEqual(res.events.find((e) => e.type === 'move').path, ['cluckers', 'market']);
});

test('เวลาไม่พอเดินทาง ถูกปฏิเสธ', () => {
  const state = newGame();
  const p = cur(state);
  p.hoursLeft = 2;
  const res = performAction(state, p.id, { type: 'move', to: 'condo', seq: state.seq });
  assert.equal(res.ok, false);
  assert.match(res.error, /เวลาไม่พอ/);
});

test('กินไก่ทอด: อิ่ม เสียเงินและเวลา', () => {
  const state = newGame();
  const p = cur(state);
  act(state, { type: 'move', to: 'cluckers' });
  const cash = p.cash;
  act(state, { type: 'act', action: 'eatFast' });
  assert.equal(p.ate, true);
  assert.equal(p.cash, cash - 120);
  assert.equal(p.hoursLeft, 58);
});

test('สมัครงานต้องมีคุณสมบัติตามที่กำหนด', () => {
  const state = newGame();
  const p = cur(state);
  act(state, { type: 'move', to: 'jobs' });
  const denied = performAction(state, p.id, { type: 'act', action: 'apply', params: { jobId: 'programmer' }, seq: state.seq });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /วุฒิ/);
  act(state, { type: 'act', action: 'apply', params: { jobId: 'fryCook' } });
  assert.equal(p.job, 'fryCook');
});

test('ทำงาน: ได้ค่าแรงตามชั่วโมง ประสบการณ์เพิ่ม และกินฟรีที่ร้านไก่ทอด', () => {
  const state = newGame();
  const p = cur(state);
  p.job = 'fryCook';
  p.role = 'artist';
  act(state, { type: 'move', to: 'cluckers' });
  const cash = p.cash;
  act(state, { type: 'act', action: 'work' });
  assert.equal(p.cash, cash + JOBS.fryCook.wage * 8);
  assert.equal(p.xp, 8);
  assert.equal(p.ate, true);
});

test('จบสัปดาห์: จ่ายค่าเช่า ได้คะแนน แล้วส่งตาให้คนถัดไปตามลำดับ', () => {
  const state = newGame();
  const [first, second] = state.order;
  const p = state.players[first];
  p.ate = true;
  const cash = p.cash;
  const preview = weeklyPoints(state, p);
  act(state, { type: 'endTurn' });
  assert.equal(state.currentPlayerId, second);
  assert.ok(p.totals.spent >= 600, 'ต้องจ่ายค่าเช่าแฟลตอย่างน้อย ฿600');
  assert.ok(cash > 0);
  assert.ok(p.score >= 0);
  assert.ok(p.lastWeek.points >= 0);
  assert.equal(typeof preview.total, 'number');
});

test('ไม่ได้กินอะไรทั้งสัปดาห์ สัปดาห์หน้าเวลาลดลง', () => {
  const state = newGame({ weeks: 2 });
  const first = state.order[0];
  for (let i = 0; i < state.order.length; i++) {
    const p = cur(state);
    if (p.id !== first) p.ate = true;
    if (state.phase.type === 'choice') act(state, { type: 'choose', value: state.phase.options.at(-1).id });
    act(state, { type: 'endTurn' });
  }
  assert.equal(state.week, 2);
  assert.equal(state.currentPlayerId, first);
  assert.equal(state.players[first].hoursMax, RULES.hoursPerWeek - RULES.hunger.hours);
});

test('หุ่นยนต์ดูดฝุ่นติดอาวุธกันขโมยได้เสมอ', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const state = createGame({ players: PLAYERS, seed, options: { weeks: 3 } });
    const p = cur(state);
    p.cash = 50000;
    p.furniture = ['robot'];
    p.ate = true;
    act(state, { type: 'endTurn' });
    assert.ok(p.cash >= 50000 - 600 - 2500 - 1200, `seed ${seed}: เงินหายเพราะขโมย (${p.cash})`);
  }
});

test('ครบจำนวนสัปดาห์ เกมจบและเรียงอันดับตามคะแนน', () => {
  const state = newGame({ weeks: 10 });
  state.maxWeeks = 1;
  for (let i = 0; i < state.order.length; i++) {
    if (state.phase.type === 'choice') act(state, { type: 'choose', value: state.phase.options[0].id });
    act(state, { type: 'endTurn' });
  }
  assert.equal(state.status, 'finished');
  assert.equal(state.results.length, 3);
  for (let i = 1; i < state.results.length; i++) assert.ok(state.results[i - 1].score >= state.results[i].score);
});

test('มุมมองสาธารณะ: มีรายการกิจกรรมของผู้เล่นปัจจุบัน และไม่ส่งตัวสุ่ม', () => {
  const state = newGame();
  const view = toPublicView(state);
  assert.equal(view.rng, undefined);
  assert.ok(view.actions.length > 0);
  assert.ok(view.actions.every((a) => typeof a.hours === 'number'));
  assert.ok(view.travel.market.ok);
  assert.deepEqual(listActions(state, state.order[1]), []);
});

test('เกมที่เล่นด้วยบอทจบได้เสมอ เวลาไม่ติดลบ และเงินสดไม่ติดลบ (2–4 คน)', () => {
  for (const count of [2, 3, 4]) {
    for (let seed = 1; seed <= 25; seed++) {
      const state = playBotGame(seed * 13 + count, count, 10);
      assert.equal(state.status, 'finished');
      assert.equal(state.results.length, count);
      for (const p of Object.values(state.players)) {
        assert.ok(p.cash >= 0, `${p.name} เงินติดลบ`);
        assert.ok(p.hoursLeft >= 0, `${p.name} เวลาติดลบ`);
        for (const v of Object.values(p.stats)) assert.ok(v >= 0 && v <= 100);
      }
    }
  }
});
