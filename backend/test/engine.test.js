import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, performAction, toPublicView } from '../src/game/engine.js';
import { randInt } from '../src/game/rng.js';
import { RULES } from '../src/game/rules.js';
import { CAREERS } from '../src/game/careers.js';
import { SPACES } from '../src/game/board.js';
import { playBotGame } from '../scripts/simulate.js';

const PLAYERS = [
  { id: 'a', name: 'เอ' },
  { id: 'b', name: 'บี' },
  { id: 'c', name: 'ซี' },
];

function newGame(seed = 42, players = PLAYERS) {
  return createGame({ players, seed });
}

// ตั้งตัวสุ่มให้การหมุนครั้งถัดไปได้เลขที่ต้องการ
function forceSpin(state, value) {
  for (let x = 1; x < 1e6; x++) {
    const probe = { rng: x };
    if (randInt(probe, 1, 10) === value) {
      state.rng = x;
      return;
    }
  }
  throw new Error('หา seed ไม่เจอ');
}

function act(state, action) {
  const res = performAction(state, state.currentPlayerId, { ...action, seq: state.seq });
  assert.ok(res.ok, res.error);
  return res;
}

// ทำให้ผู้เล่นปัจจุบันพร้อมหมุน โดยมีอาชีพแล้ว
function readyToSpin(state, { position, career = 'police', cash } = {}) {
  const p = state.players[state.currentPlayerId];
  p.started = true;
  p.career = career;
  if (position) p.position = position;
  if (cash != null) p.cash = cash;
  state.phase = { type: 'spin' };
  state.seq++;
  return p;
}

test('เริ่มเกม: ผู้เล่นคนแรกต้องเลือกเส้นทางชีวิตก่อน', () => {
  const state = newGame();
  assert.equal(state.order.length, 3);
  assert.deepEqual([...state.order].sort(), ['a', 'b', 'c']);
  assert.equal(state.currentPlayerId, state.order[0]);
  assert.equal(state.phase.type, 'chooseStart');
});

test('ผู้เล่นที่ไม่ใช่ตาของตัวเองทำอะไรไม่ได้ และสถานะไม่เปลี่ยน', () => {
  const state = newGame();
  const other = state.order[1];
  const before = JSON.stringify(state);
  const res = performAction(state, other, { type: 'choose', value: 'work', seq: state.seq });
  assert.equal(res.ok, false);
  assert.match(res.error, /ยังไม่ถึงตา/);
  assert.equal(JSON.stringify(state), before);
});

test('คำสั่งที่ seq ไม่ตรง (ค้างจากหน้าจอเก่า) ถูกปฏิเสธ', () => {
  const state = newGame();
  const res = performAction(state, state.currentPlayerId, { type: 'choose', value: 'work', seq: state.seq - 1 });
  assert.equal(res.ok, false);
});

test('เลือกเรียนมหาวิทยาลัย: กู้ค่าเทอมแล้วหมุนได้เลย', () => {
  const state = newGame();
  const p = state.players[state.currentPlayerId];
  act(state, { type: 'choose', value: 'college' });
  assert.equal(p.loans, RULES.collegeLoans);
  assert.equal(p.cash, RULES.startCash);
  assert.equal(state.phase.type, 'spin');
});

test('เลือกทำงานเลย: ได้ตัวเลือกอาชีพที่ไม่ต้องใช้ปริญญา 3 อาชีพ', () => {
  const state = newGame();
  act(state, { type: 'choose', value: 'work' });
  assert.equal(state.phase.type, 'chooseCareer');
  assert.equal(state.phase.options.length, 3);
  for (const id of state.phase.options) assert.equal(CAREERS[id].degree, false);
  act(state, { type: 'choose', value: state.phase.options[0] });
  assert.equal(state.phase.type, 'spin');
});

test('จบตาแล้วส่งต่อให้ผู้เล่นคนถัดไปตามลำดับ', () => {
  const state = newGame();
  const [first, second] = state.order;
  readyToSpin(state, { position: 'work-0' });
  forceSpin(state, 3); // work-3 = จ่ายค่าเช่าหอพัก (ไม่มีตัวเลือก)
  act(state, { type: 'spin' });
  assert.equal(state.players[first].position, 'work-3');
  assert.equal(state.currentPlayerId, second);
  assert.equal(state.phase.type, 'chooseStart');
});

test('เดินผ่านช่องเงินเดือนได้รับเงินเดือน', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'work-0', career: 'police', cash: 0 });
  forceSpin(state, 4); // ผ่าน work-2 (เงินเดือน) แล้วหยุด work-4 (การ์ด)
  act(state, { type: 'spin' });
  assert.equal(p.stats.paydays, 1);
  assert.ok(p.cash >= 0);
});

test('หยุดตรงช่องเงินเดือนพอดีได้โบนัสเพิ่ม', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'work-0', career: 'police', cash: 0 });
  forceSpin(state, 2); // หยุดที่ work-2 พอดี
  act(state, { type: 'spin' });
  const salary = CAREERS.police.salaries[0];
  assert.equal(p.cash, salary + salary * RULES.paydayLandBonus);
});

test('ช่องหยุดบังคับหยุดแม้แต้มเหลือ', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'college-7' });
  forceSpin(state, 9);
  act(state, { type: 'spin' });
  assert.equal(p.position, 'college-8');
  assert.equal(state.phase.type, 'chooseCareer');
  assert.equal(p.degree, true);
});

test('ทางแยก: ต้องเลือกเส้นทางก่อนเดินต่อ แล้วเดินต่อด้วยแต้มที่เหลือ', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'early-15' });
  forceSpin(state, 3);
  act(state, { type: 'spin' });
  assert.equal(state.phase.type, 'choosePath');
  assert.equal(state.phase.remaining, 3);
  const career = state.phase.options.find((o) => o.segment === 'career');
  act(state, { type: 'choose', value: career.id });
  assert.equal(p.position, 'career-2');
});

test('จัดการเงินได้เฉพาะก่อนหมุน และซื้อหุ้นซ้ำเจ้าของไม่ได้', () => {
  const state = newGame();
  const first = state.currentPlayerId;
  assert.equal(performAction(state, first, { type: 'takeLoan', count: 1 }).ok, false);
  readyToSpin(state, { cash: 100000 });
  assert.ok(performAction(state, first, { type: 'buyStock', number: 7 }).ok);
  assert.equal(state.stockOwners[7], first);
  assert.equal(performAction(state, first, { type: 'buyStock', number: 7 }).ok, false);
  assert.ok(performAction(state, first, { type: 'buyInsurance', kind: 'auto' }).ok);
  assert.equal(performAction(state, first, { type: 'buyInsurance', kind: 'home' }).ok, false); // ยังไม่มีบ้าน
  assert.ok(performAction(state, first, { type: 'takeLoan', count: 2 }).ok);
  assert.equal(state.players[first].loans, 2);
  assert.ok(performAction(state, first, { type: 'repayLoan', count: 1 }).ok);
  assert.equal(state.players[first].loans, 1);
});

test('ใบหุ้นจ่ายปันผลเมื่อมีคนหมุนได้เลขนั้น', () => {
  const state = newGame();
  const [first, second] = state.order;
  state.stockOwners[3] = second;
  state.players[second].stocks = [3];
  const cashBefore = state.players[second].cash;
  readyToSpin(state, { position: 'work-0' });
  forceSpin(state, 3);
  act(state, { type: 'spin' });
  assert.equal(state.players[second].cash, cashBefore + RULES.stockPayout);
  assert.notEqual(first, second);
});

test('อาชีพได้รับเงินจากหมวดของตัวเอง และประกันช่วยไม่ต้องจ่าย', () => {
  const state = newGame();
  const [first, second] = state.order;
  state.players[second].career = 'mechanic';
  const mechanicCash = state.players[second].cash;
  const p = readyToSpin(state, { position: 'early-3', cash: 50000 });
  forceSpin(state, 1); // early-4 รถเฉี่ยวชน 15,000 หมวดซ่อมรถ
  act(state, { type: 'spin' });
  assert.equal(p.cash, 35000);
  assert.equal(state.players[second].cash, mechanicCash + 15000);

  // รอบสอง: มีประกันรถ ไม่ต้องจ่าย
  const state2 = newGame();
  const p2 = readyToSpin(state2, { position: 'early-3', cash: 50000 });
  p2.insurance.auto = true;
  forceSpin(state2, 1);
  act(state2, { type: 'spin' });
  assert.equal(p2.cash, 50000);
  assert.ok(first);
});

test('เงินไม่พอ ธนาคารให้กู้อัตโนมัติ เงินสดไม่ติดลบ', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'early-3', cash: 1000 });
  forceSpin(state, 1);
  act(state, { type: 'spin' });
  assert.ok(p.cash >= 0);
  assert.equal(p.loans, 1);
});

test('แต่งงาน: รับของขวัญจากทุกคนและบัตรความสุข', () => {
  const state = newGame();
  const p = readyToSpin(state, { position: 'early-14', cash: 50000 });
  forceSpin(state, 1);
  act(state, { type: 'spin' });
  assert.equal(state.phase.type, 'marriage');
  const others = state.order.filter((id) => id !== p.id).map((id) => state.players[id].cash);
  act(state, { type: 'choose', value: 'marry' });
  assert.equal(p.married, true);
  assert.equal(p.lifeTiles.length, 1);
  const othersAfter = state.order.filter((id) => id !== p.id).map((id) => state.players[id]);
  othersAfter.forEach((q, i) => assert.ok(q.cash < others[i] || q.loans > 0));
});

test('มุมมองสาธารณะซ่อนมูลค่าบัตรความสุขจนจบเกม', () => {
  const state = newGame();
  state.players.a.lifeTiles = [20000, 100000];
  const view = toPublicView(state);
  const a = view.players.find((p) => p.id === 'a');
  assert.equal(a.lifeTileCount, 2);
  assert.equal(a.lifeTiles, null);
  assert.equal(view.rng, undefined);
  assert.equal(JSON.stringify(view).includes('"decks"'), false);
});

test('ผู้เล่นที่โดนข้ามตาจะถูกข้ามหนึ่งครั้ง', () => {
  const state = newGame();
  const [first, second, third] = state.order;
  state.players[second].skipTurns = 1;
  readyToSpin(state, { position: 'work-0' });
  forceSpin(state, 3);
  act(state, { type: 'spin' });
  assert.equal(state.currentPlayerId, third);
  assert.equal(state.players[second].skipTurns, 0);
  assert.ok(first);
});

test('เกมที่เล่นด้วยบอทจบได้เสมอ และเงินสดไม่ติดลบ (2–4 คน)', () => {
  for (const count of [2, 3, 4]) {
    for (let seed = 1; seed <= 60; seed++) {
      const state = playBotGame(seed * 7 + count, count);
      assert.equal(state.status, 'finished');
      assert.equal(state.results.length, count);
      for (const r of state.results) assert.ok(state.players[r.playerId].retired);
      for (const p of Object.values(state.players)) assert.ok(p.cash >= 0, `${p.name} เงินติดลบ`);
      for (let i = 1; i < state.results.length; i++) assert.ok(state.results[i - 1].total >= state.results[i].total);
      for (const id of Object.keys(SPACES)) assert.ok(SPACES[id]);
    }
  }
});
