// จำลองเกมที่มีแต่บอทหลายร้อยเกม เพื่อตรวจว่าเกมไม่ค้างและดูสมดุลของกติกา
// ใช้: node scripts/simulate.js [จำนวนเกม] [จำนวนผู้เล่น] [จำนวนสัปดาห์]

import { createGame, performAction } from '../src/game/engine.js';
import { decideActions } from '../src/game/bot.js';
import { ROLES } from '../src/game/roles.js';
import { JOBS } from '../src/game/jobs.js';

export function playBotGame(seed, playerCount, weeks = 15) {
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `bot${i}-${seed}`, name: `บอท${i + 1}`, isBot: true }));
  const state = createGame({ players, seed, options: { weeks } });
  let steps = 0;
  let turnSteps = 0;
  let lastTurn = state.turn;
  while (state.status === 'playing') {
    if (++steps > 20000) throw new Error(`เกม seed ${seed} ไม่จบ (phase ${state.phase.type})`);
    if (state.turn !== lastTurn) {
      lastTurn = state.turn;
      turnSteps = 0;
    }
    if (++turnSteps > 80) throw new Error(`seed ${seed}: บอทวนอยู่ในตาเดียวเกิน 80 ขั้น (สัปดาห์ ${state.week}) phase=${state.phase.type}`);
    const pid = state.currentPlayerId;
    const actions = decideActions(state, pid);
    for (const a of actions) {
      const res = performAction(state, pid, a);
      if (!res.ok) throw new Error(`seed ${seed}: บอททำคำสั่ง ${JSON.stringify(a)} ไม่ได้ (${res.error}) phase=${state.phase.type} at=${state.players[pid].location}`);
    }
  }
  return state;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const games = Number(process.argv[2] || 200);
  const count = Number(process.argv[3] || 4);
  const weeks = Number(process.argv[4] || 15);
  const byRole = {};
  const quests = {};
  const jobs = {};
  let hosp = 0;
  const cats = {};
  for (let s = 1; s <= games; s++) {
    const state = playBotGame(s, count, weeks);
    for (const r of state.results) {
      (byRole[r.role] ||= { scores: [], wins: 0, nw: [] }).scores.push(r.score);
      byRole[r.role].nw.push(r.netWorth);
      if (r.rank === 1) byRole[r.role].wins++;
      for (const q of r.quests) quests[q] = (quests[q] || 0) + 1;
      jobs[r.job || 'none'] = (jobs[r.job || 'none'] || 0) + 1;
      for (const [k, v] of Object.entries(r.breakdown)) cats[k] = (cats[k] || 0) + v;
    }
    hosp += state.log.filter((l) => l.text.includes('หมดสติ')).length;
  }
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1));
  console.log(`เล่น ${games} เกม เกมละ ${count} คน ${weeks} สัปดาห์`);
  for (const [role, d] of Object.entries(byRole).sort((a, b) => avg(b[1].scores) - avg(a[1].scores))) {
    console.log(`  ${ROLES[role].icon} ${ROLES[role].name.padEnd(14)} คะแนนเฉลี่ย ${avg(d.scores)}  ชนะ ${((d.wins / d.scores.length) * 100).toFixed(0)}%  ทรัพย์สิน ${avg(d.nw)}  (${d.scores.length} คน)`);
  }
  const total = games * count;
  console.log('คะแนนเฉลี่ยต่อหมวด:', Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round(v / total)])));
  console.log('ภารกิจที่ทำสำเร็จ (%):', Object.fromEntries(Object.entries(quests).map(([k, v]) => [k, Math.round((v / total) * 100 * 8) / 1])));
  console.log('งานสุดท้าย:', Object.entries(jobs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${JOBS[k]?.title || k}:${v}`).join(', '));
  console.log('หมดสติต่อเกม:', (hosp / games).toFixed(2));
}
