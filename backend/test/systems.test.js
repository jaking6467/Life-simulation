// เทสต์ระบบเสริม: ตำแหน่งงานจำกัด ตลาด การ์ด ครอบครัว ธุรกิจ บ้านผ่อน ประกัน ระดับบอท
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, performAction, netWorth, weeklyPoints, listActions, toPublicView, STATE_VERSION } from '../src/game/engine.js';
import { decideActions } from '../src/game/bot.js';
import { RULES } from '../src/game/rules.js';
import { JOBS } from '../src/game/jobs.js';
import { HOMES } from '../src/game/city.js';
import { CARDS } from '../src/game/cards.js';
import { BUSINESSES } from '../src/game/business.js';
import { playBotGame } from '../scripts/simulate.js';

const PLAYERS = [
  { id: 'a', name: 'เอ', role: 'workaholic' },
  { id: 'b', name: 'บี', role: 'artist' },
  { id: 'c', name: 'ซี', role: 'scholar' },
];

function newGame(opts = {}) {
  return createGame({ players: PLAYERS, seed: 7, options: { weeks: 10, ...opts } });
}
const cur = (state) => state.players[state.currentPlayerId];

function act(state, action) {
  const res = performAction(state, state.currentPlayerId, { ...action, seq: state.seq });
  assert.ok(res.ok, res.error);
  return res;
}
function tryAct(state, action) {
  return performAction(state, state.currentPlayerId, { ...action, seq: state.seq });
}
function at(state, loc) {
  const p = cur(state);
  p.location = loc;
  return p;
}
// จบตาไปเรื่อย ๆ จนถึงตาของผู้เล่นคนนี้ (ข้ามเรื่องให้ตัดสินใจ)
function passTo(state, id) {
  for (let i = 0; i < 20 && (state.currentPlayerId !== id || state.phase.type !== 'week'); i++) {
    if (state.phase.type === 'choice') act(state, { type: 'choose', value: state.phase.options.at(-1).id });
    else {
      cur(state).ate = true;
      act(state, { type: 'endTurn' });
    }
  }
  assert.equal(state.currentPlayerId, id);
}
function qualify(p, job) {
  if (job.req.course) p.education.completed.push(job.req.course);
  p.xp = Math.max(p.xp, job.req.xp || 0);
  p.clothes = { tier: 3, weeksLeft: 9 };
  p.stats.hygiene = 100;
  p.stats.health = 100;
}

test('สถานะเกมมีเวอร์ชันและแปลงเป็น JSON แล้วกลับมาได้ครบ', () => {
  const state = newGame();
  assert.equal(state.version, STATE_VERSION);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test('ตำแหน่งงานจำกัด: เต็มแล้วสมัครไม่ได้ ถ้าคุณสมบัติดีกว่ามากชิงตำแหน่งได้ และคนเดิมถูกลดตำแหน่ง', () => {
  const state = newGame();
  const p = at(state, 'jobs');
  const holder = Object.values(state.players).find((x) => x.id !== p.id);
  const job = JOBS.programmer; // ระดับ 5 มีที่เดียว
  assert.equal(job.slots, 1);
  holder.job = 'programmer';
  holder.education.completed.push('highschool', 'computer');
  holder.xp = 50;
  qualify(p, job);
  p.education.completed.push('highschool');
  p.xp = 0;
  const denied = tryAct(state, { type: 'act', action: 'apply', params: { jobId: 'programmer' } });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /ตำแหน่งเต็ม/);
  p.xp = 200;
  const res = act(state, { type: 'act', action: 'apply', params: { jobId: 'programmer' } });
  assert.equal(p.job, 'programmer');
  assert.notEqual(holder.job, 'programmer');
  assert.equal(holder.c.displaced, 1);
  assert.ok(res.events.some((e) => e.type === 'notify' && e.playerId === holder.id));
});

test('ตลาด: ซื้อของชิ้นเดียวกันแล้วราคาขึ้น และค่อย ๆ ลดลงหลังจบสัปดาห์', () => {
  const state = newGame();
  const p = at(state, 'furniture');
  p.cash = 100000;
  const price = () => listActions(state, p.id).find((a) => a.action === 'buyFurniture' && a.params.itemId === 'tv').cost;
  const before = price();
  act(state, { type: 'act', action: 'buyFurniture', params: { itemId: 'tv' } });
  p.furniture = [];
  const after = price();
  assert.ok(after > before, `ราคาต้องขึ้น (${before} → ${after})`);
  for (let i = 0; i < state.order.length; i++) {
    if (state.phase.type === 'choice') act(state, { type: 'choose', value: state.phase.options.at(-1).id });
    cur(state).ate = true;
    act(state, { type: 'endTurn' });
  }
  assert.ok((state.demand['furniture:tv'] || 0) < RULES.market.demandStep);
});

test('หุ้น: ซื้อเยอะราคาขึ้น ซื้อแล้วขายทันทีขาดทุน (มีค่าธรรมเนียม)', () => {
  const state = newGame();
  const p = at(state, 'bank');
  p.cash = 50000;
  const price = state.stocks.TECH.price;
  act(state, { type: 'act', action: 'buyStock', params: { symbol: 'TECH', n: 50 } });
  assert.ok(state.stocks.TECH.price > price);
  act(state, { type: 'act', action: 'sellStock', params: { symbol: 'TECH' } });
  assert.ok(p.cash < 50000, `ปั่นราคาแล้วต้องไม่ได้กำไร (${p.cash})`);
});

test('การ์ดแกล้ง: มีผลตอนเริ่มตาของเป้าหมาย เครื่องรางกันได้ และใช้ได้สัปดาห์ละใบ', () => {
  const state = newGame();
  const [first, second, third] = state.order;
  const p = at(state, 'arcade');
  p.cash = 20000;
  act(state, { type: 'act', action: 'buyCard', params: { cardId: 'rumor' } });
  act(state, { type: 'act', action: 'buyCard', params: { cardId: 'spam' } });
  act(state, { type: 'act', action: 'playCard', params: { cardId: 'rumor', target: second } });
  const again = tryAct(state, { type: 'act', action: 'playCard', params: { cardId: 'spam', target: third } });
  assert.equal(again.ok, false);
  assert.equal(state.players[second].pending.length, 1);
  state.players[third].amulets = 1;
  const happy = state.players[second].stats.happiness;
  p.ate = true;
  const res = act(state, { type: 'endTurn' });
  assert.equal(state.currentPlayerId, second);
  assert.equal(state.players[second].stats.happiness, Math.max(0, happy + CARDS.rumor.effect.happiness));
  assert.equal(state.players[second].pending.length, 0);
  assert.ok(res.events.some((e) => e.type === 'event' && e.kind === 'prank'));
  passTo(state, first);
  act(state, { type: 'act', action: 'playCard', params: { cardId: 'spam', target: third } });
  passTo(state, third);
  assert.equal(state.players[third].amulets, 0, 'เครื่องรางต้องถูกใช้ไป');
  assert.equal(state.players[third].hoursLeft, state.players[third].hoursMax);
});

test('ความรัก: เดตที่ภัตตาคารนับเป็นมื้ออาหาร ขอแต่งงานต้องรักกันพอ และไม่มีเวลาให้จนความรักหมดก็เลิกกัน', () => {
  const state = newGame();
  const p = at(state, 'restaurant');
  p.cash = 50000;
  p.love = { name: 'ฝน', likes: 'dinner', income: 1500, affection: 40, stage: 'dating', weeks: 0 };
  act(state, { type: 'act', action: 'date' });
  assert.equal(p.ate, true);
  assert.equal(p.love.affection, 40 + 14 + 6);
  p.location = 'temple';
  const early = tryAct(state, { type: 'act', action: 'propose' });
  assert.equal(early.ok, false);
  p.love.weeks = RULES.family.proposeWeeks;
  p.love.affection = 90;
  act(state, { type: 'act', action: 'propose' });
  assert.equal(p.love.stage, 'married');
  assert.ok(weeklyPoints(state, p).breakdown.family >= 3);
  p.love.affection = 1;
  act(state, { type: 'endTurn' });
  assert.equal(p.love, null, 'ความรักหมดต้องหย่า');
  assert.ok(p.c.breakups === 1);
});

test('ครอบครัว: มีลูกที่โรงพยาบาล ค่าเลี้ยงดูทุกสัปดาห์ และได้คะแนนครอบครัว', () => {
  const state = newGame();
  const p = at(state, 'hospital');
  p.cash = 50000;
  p.love = { name: 'ฝน', likes: 'movie', income: 2000, affection: 80, stage: 'married', weeks: 5 };
  act(state, { type: 'act', action: 'haveBaby' });
  assert.equal(p.kids.length, 1);
  const pts = weeklyPoints(state, p).breakdown.family;
  assert.equal(pts, 3 + 1 + 1);
  const spent = p.totals.spent;
  act(state, { type: 'endTurn' });
  assert.ok(p.totals.spent - spent >= RULES.family.kidWeekly + RULES.family.household);
});

test('ธุรกิจ: เปิดกิจการ ได้กำไร/ขาดทุนทุกสุดสัปดาห์ ดูแลเองแล้วกำไรดีขึ้น และขายได้', () => {
  let profits = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const state = createGame({ players: PLAYERS, seed, options: { weeks: 10 } });
    const p = at(state, 'market');
    p.cash = 30000;
    act(state, { type: 'act', action: 'buyBusiness', params: { bizId: 'coffee' } });
    assert.equal(p.businesses.length, 1);
    assert.equal(netWorth(state, p) <= 30000, true);
    act(state, { type: 'act', action: 'manageBusiness', params: { bizId: 'coffee' } });
    const cash = p.cash;
    p.ate = true;
    act(state, { type: 'endTurn' });
    profits += p.businesses[0].lastProfit;
    assert.equal(p.businesses[0].managed, false);
    assert.ok(p.cash !== cash || p.businesses[0].lastProfit === 0);
  }
  assert.ok(profits / 30 > BUSINESSES.coffee.base * 0.8, `กำไรเฉลี่ยต่ำเกินไป (${profits / 30})`);
  const state = newGame();
  const p = at(state, 'market');
  p.cash = 30000;
  act(state, { type: 'act', action: 'buyBusiness', params: { bizId: 'coffee' } });
  act(state, { type: 'act', action: 'sellBusiness', params: { bizId: 'coffee' } });
  assert.equal(p.cash, 30000 - BUSINESSES.coffee.price + Math.round(BUSINESSES.coffee.price * RULES.business.sellRatio));
});

test('บ้านผ่อน: ต้องมีรายได้ ซื้อแล้วไม่ต้องจ่ายค่าเช่า ผ่อนทุกสัปดาห์ ทรัพย์สินสุทธิไม่หายตอนซื้อ', () => {
  const state = newGame();
  const p = at(state, 'bank');
  p.cash = 30000;
  const noJob = tryAct(state, { type: 'act', action: 'buyHome', params: { homeId: 'flat' } });
  assert.equal(noJob.ok, false);
  p.job = 'fryCook';
  const nw = netWorth(state, p);
  act(state, { type: 'act', action: 'buyHome', params: { homeId: 'flat' } });
  assert.equal(p.owned, 'flat');
  assert.equal(p.housing, 'flat');
  assert.equal(netWorth(state, p), nw);
  const debt = p.mortgage.remaining;
  assert.ok(weeklyPoints(state, p).breakdown.home >= HOMES.flat.homePoints + 2);
  p.ate = true;
  const res = act(state, { type: 'endTurn' });
  const notes = res.events.find((e) => e.type === 'weekend').notes.join(' ');
  assert.doesNotMatch(notes, /ค่าเช่า/);
  assert.match(notes, /ค่าผ่อนบ้าน/);
  assert.ok(p.mortgage.remaining < debt);
});

test('ประกันสุขภาพ: หมดสติจ่ายแค่ 20% / ประกันบ้าน: โดนขโมยได้เงินคืน', () => {
  const state = newGame();
  const p = at(state, 'bank');
  p.cash = 10000;
  act(state, { type: 'act', action: 'buyInsurance', params: { kind: 'health' } });
  assert.ok(p.insurance.health);
  p.job = 'worker';
  p.location = 'factory';
  p.stats = { health: 3, happiness: 80, hygiene: 100 };
  const res = act(state, { type: 'act', action: 'work' });
  const collapse = res.events.find((e) => e.kind === 'collapse');
  assert.ok(collapse);
  assert.match(collapse.text, new RegExp(`฿${Math.round(RULES.hospitalized.cost * 0.2)}`));
  assert.match(collapse.text, /ประกันสุขภาพ/);

  let reimbursed = 0;
  for (let seed = 1; seed <= 60 && !reimbursed; seed++) {
    const g = createGame({ players: PLAYERS, seed, options: { weeks: 10 } });
    const q = cur(g);
    q.cash = 20000;
    q.ate = true;
    q.insurance.property = { paidWeek: g.week };
    const r = performAction(g, q.id, { type: 'endTurn', seq: g.seq });
    const notes = r.events.find((e) => e.type === 'weekend').notes.join(' ');
    if (notes.includes('ขโมย')) {
      assert.match(notes, /ประกันจ่ายคืน/);
      reimbursed++;
    }
  }
  assert.ok(reimbursed, 'ควรมีอย่างน้อย 1 seed ที่โดนขโมย');
});

test('มุมมองสาธารณะมีข้อมูลระบบใหม่ และรายการกิจกรรมมีการ์ดในมือได้ทุกที่', () => {
  const state = newGame();
  const p = at(state, 'flat');
  p.cards = ['gift'];
  const view = toPublicView(state);
  assert.ok(view.actions.some((a) => a.action === 'playCard'));
  assert.equal(typeof view.propertyIndex, 'number');
  assert.equal(view.botLevel, 'normal');
  assert.ok('merit' in view.players[0]);
});

test('บอททุกระดับเล่นจนจบเกมได้ ไม่ค้าง และค่าต่าง ๆ ไม่ผิดปกติ', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 12; seed++) {
      const state = playBotGame(seed * 31 + 7, 2 + (seed % 3), 12, level);
      assert.equal(state.status, 'finished');
      assert.equal(state.botLevel, level);
      for (const p of Object.values(state.players)) {
        assert.ok(p.cash >= 0, `${level} ${p.name} เงินติดลบ`);
        assert.ok(p.hoursLeft >= 0);
        assert.ok(!p.love || (p.love.affection >= 0 && p.love.affection <= 100));
      }
    }
  }
});

test('บอทระดับยากทำคะแนนได้ดีกว่าบอทระดับง่ายเมื่อเล่นด้วยกฎเดียวกัน', () => {
  const avg = (level) => {
    let sum = 0;
    for (let seed = 1; seed <= 15; seed++) sum += playBotGame(seed, 3, 12, level).results.reduce((s, r) => s + r.score, 0);
    return sum / 45;
  };
  assert.ok(avg('hard') > avg('easy'));
});

test('บอทตัดสินใจได้เสมอเมื่อถึงตา', () => {
  const state = newGame({ botLevel: 'hard' });
  const actions = decideActions(state, state.currentPlayerId);
  assert.equal(actions.length, 1);
});
