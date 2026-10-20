// จำลองเกมที่มีแต่บอทหลายร้อยเกม เพื่อตรวจว่าเกมไม่ค้างและดูสมดุลของกติกา
// ใช้: node scripts/simulate.js [จำนวนเกม] [จำนวนผู้เล่น]

import { createGame, performAction } from '../src/game/engine.js';
import { decideActions } from '../src/game/bot.js';
import { CAREERS } from '../src/game/careers.js';

export function playBotGame(seed, playerCount) {
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `bot${i}-${seed}`, name: `บอท${i + 1}`, isBot: true }));
  const state = createGame({ players, seed });
  let steps = 0;
  while (state.status === 'playing') {
    if (++steps > 5000) throw new Error(`เกม seed ${seed} ไม่จบ (phase ${state.phase.type})`);
    const pid = state.currentPlayerId;
    const actions = decideActions(state, pid);
    const before = state.seq;
    for (const a of actions) {
      const res = performAction(state, pid, a);
      if (!res.ok) throw new Error(`seed ${seed}: บอททำคำสั่ง ${JSON.stringify(a)} ไม่ได้ (${res.error}) phase=${state.phase.type}`);
    }
    if (state.seq === before) throw new Error(`seed ${seed}: เกมไม่เดินต่อใน phase ${state.phase.type}`);
  }
  return state;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const games = Number(process.argv[2] || 300);
  const count = Number(process.argv[3] || 4);
  const byStart = { college: [], work: [] };
  const byCareer = {};
  const rounds = [];
  const winners = { college: 0, work: 0 };
  let tiles = 0;
  let cashSum = 0;
  for (let s = 1; s <= games; s++) {
    const state = playBotGame(s, count);
    rounds.push(state.round);
    for (const r of state.results) {
      const p = state.players[r.playerId];
      byStart[p.education].push(r.total);
      (byCareer[r.career] ||= []).push(r.total);
      tiles += r.tilesTotal;
      cashSum += r.cash - r.debt;
      if (r.rank === 1) winners[p.education]++;
    }
  }
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1));
  console.log(`เล่น ${games} เกม เกมละ ${count} คน — จำนวนรอบเฉลี่ย ${avg(rounds)} (สูงสุด ${Math.max(...rounds)})`);
  console.log(`คะแนนเฉลี่ย: เรียนมหาวิทยาลัย ${avg(byStart.college)} (${byStart.college.length} คน, ชนะ ${winners.college}) | ทำงานเลย ${avg(byStart.work)} (${byStart.work.length} คน, ชนะ ${winners.work})`);
  console.log(`สัดส่วน: เงินสดสุทธิเฉลี่ย ${Math.round(cashSum / (games * count))} | บัตรความสุขเฉลี่ย ${Math.round(tiles / (games * count))}`);
  for (const [id, list] of Object.entries(byCareer).sort((a, b) => avg(b[1]) - avg(a[1]))) {
    console.log(`  ${CAREERS[id]?.name || id}: ${avg(list)} (${list.length})`);
  }
}
