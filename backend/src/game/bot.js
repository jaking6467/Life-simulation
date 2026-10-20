// bot.js — สมองของบอท ใช้กับผู้เล่นบอท ผู้เล่นที่หมดเวลา และผู้เล่นที่หลุดการเชื่อมต่อ
// วางแผนทีละก้าว: เรียงเป้าหมายตามความสำคัญ (กิน → อาบน้ำ → เสื้อผ้า → หางาน → เรียน → ทำงาน → คลายเครียด → ใช้เงิน)
// แล้วเลือกเป้าหมายแรกที่ทำได้ทันเวลา ถ้ายังไม่ถึงที่ก็เดินไปก่อน
// ใช้ค่าสุ่มจากแฮช จึงไม่ไปรบกวนตัวสุ่มของเกม

import { RULES } from './rules.js';
import { JOBS, JOB_LIST, CLOTHES } from './jobs.js';
import { COURSES } from './courses.js';
import { FURNITURE_LIST } from './items.js';
import { CHOICE_EVENT_BY_ID } from './events.js';
import { HOMES } from './city.js';
import { hashString } from './rng.js';
import { fallbackAction, previewActionsAt, canTakeJob, courseFeeFor, netWorth } from './engine.js';

// เส้นทางการเรียนตามบทบาท/นิสัย
const STUDY_PLANS = {
  scholar: ['highschool', 'computer', 'business', 'mba', 'culinary', 'nursing'],
  artist: ['highschool', 'arts', 'business'],
  fitness: ['highschool', 'business', 'mba'],
  workaholic: ['highschool', 'business', 'mba'],
  default: [
    ['highschool', 'business', 'mba'],
    ['highschool', 'computer', 'business'],
    ['highschool', 'engineering', 'business'],
    ['highschool', 'nursing', 'medicine'],
    ['culinary', 'highschool', 'business'],
  ],
};

function studyPlan(p) {
  if (STUDY_PLANS[p.role]) return STUDY_PLANS[p.role];
  const plans = STUDY_PLANS.default;
  return plans[hashString(p.id) % plans.length];
}

export function decideActions(state, playerId) {
  const p = state.players[playerId];
  const ph = state.phase;
  if (ph.type === 'choice') return [{ type: 'choose', value: pickChoice(state, p, ph), seq: state.seq }];
  if (ph.type !== 'week') {
    const fb = fallbackAction(state);
    return fb ? [fb] : [];
  }
  return [{ ...planStep(state, p), seq: state.seq }];
}

function pickChoice(state, p, ph) {
  const ev = CHOICE_EVENT_BY_ID[ph.eventId];
  const job = JOBS[p.job];
  const hourValue = job ? job.wage / 60 : 1.5;
  let best = ph.options[ph.options.length - 1].id;
  let bestScore = -Infinity;
  for (const opt of ev.options) {
    const e = opt.eff || {};
    let score = (e.money || 0) / 150 + (e.happiness || 0) * (p.stats.happiness < 50 ? 1.2 : 0.7) + (e.health || 0) * (p.stats.health < 50 ? 1.2 : 0.7) + (e.points || 0) * 3 + (e.xp || 0) * 0.3;
    score += (e.hours || 0) * hourValue;
    if (e.overtime && job) score += (job.wage * e.overtime * 1.5) / 150 - e.overtime * hourValue;
    if (e.gamble) score += e.gamble.reduce((s, g) => s + (g.chance * g.money) / 150, 0);
    if (e.pet) score += 4;
    if ((e.money || 0) < 0 && p.cash + (e.money || 0) < 1000) score -= 20;
    if (score > bestScore) {
      bestScore = score;
      best = opt.id;
    }
  }
  return best;
}

function planStep(state, p) {
  const goals = buildGoals(state, p);
  for (const g of goals) {
    const step = tryGoal(state, p, g);
    if (step) return step;
  }
  // ไม่มีอะไรให้ทำแล้ว: กลับบ้านไปพักผ่อน
  const home = p.housing;
  if (p.location !== home) {
    const back = tryGoal(state, p, { loc: home, action: 'rest' });
    if (back) return back;
  } else if (p.hoursLeft >= 1 && (p.stats.health < 100 || p.stats.happiness < 100)) {
    return { type: 'act', action: 'rest', params: {} };
  }
  return { type: 'endTurn' };
}

// ถ้าอยู่ที่เป้าหมายแล้วและทำได้ → ทำเลย, ถ้ายังไม่ถึงแต่ไปทันและทำได้ → เดินไป
function tryGoal(state, p, g) {
  if (state.global.closed === g.loc) return null;
  const { travel, actions } = previewActionsAt(state, p.id, g.loc);
  const entry = actions.find((a) => a.action === g.action && (!g.params || sameParams(a.params, g.params)) && !a.disabled);
  if (!entry) return null;
  if (g.loc === p.location) return { type: 'act', action: entry.action, params: entry.params };
  if (travel + entry.hours > p.hoursLeft) return null;
  return { type: 'move', to: g.loc };
}

function sameParams(a, b) {
  return Object.keys(b).every((k) => a[k] === b[k]);
}

function buildGoals(state, p) {
  const goals = [];
  const add = (loc, action, params) => goals.push({ loc, action, params });
  const home = p.housing;
  const job = JOBS[p.job];
  const acts = p.weekActs;
  const h = (k) => acts[k] || 0;

  // 1. สุขภาพวิกฤต
  if (p.stats.health < 30 && p.cash >= 1500) add('hospital', 'checkup');

  // 2. อาหาร
  if (!p.ate) {
    if (job && (job.location === 'cluckers' || job.location === 'restaurant')) add(job.location, 'work');
    if (p.groceries > 0) add(home, 'cook');
    if (p.cash > 4000 && p.stats.health < 60) add('restaurant', 'dine');
    if (p.location === 'market' || p.groceries === 0) add('market', 'buyGroceries');
    add('cluckers', 'eatFast');
    add('restaurant', 'dine');
  }

  // 3. ความสะอาด (ตอนอยู่บ้านต้นสัปดาห์อาบน้ำไว้ก่อน)
  if (p.location === home && p.stats.hygiene < 75 && !h('shower')) add(home, 'shower');
  if (p.stats.hygiene < 40) {
    if (job?.location === 'gym') add('gym', 'work');
    add(home, 'shower');
    add('gym', 'gymShower');
  }

  // 4. หมดไฟ
  if (p.stats.happiness < 25) {
    add('park', 'walkPark');
    add('temple', 'meditate');
    add(home, 'rest');
  }

  // 5. เสื้อผ้า
  const target = bestJob(state, p, true);
  const neededTier = Math.max(1, target?.req.clothes || 0, job?.req.clothes || 0);
  const affordNeeded = p.cash >= CLOTHES[neededTier].price + 600;
  if (p.clothes.tier === 0 || p.clothes.weeksLeft <= 1) {
    const tier = affordNeeded ? neededTier : 1;
    if (p.cash >= CLOTHES[tier].price + 200) add('mall', 'buyClothes', { tier });
  } else if (p.clothes.tier < neededTier && affordNeeded) {
    add('mall', 'buyClothes', { tier: neededTier });
  }

  // 6. หางาน / เลื่อนตำแหน่ง
  const best = bestJob(state, p, false);
  if (best && (!job || best.wage >= job.wage * 1.12)) add('jobs', 'apply', { jobId: best.id });

  // 7. เรียน
  if (p.education.enrolled) {
    if (h('attend') + h('studyOnline') < 2) {
      if (p.furniture.includes('computer')) add(home, 'studyOnline');
      add('uni', 'attend');
    }
  } else {
    const next = plannedCourse(p);
    if (next) {
      const need = courseFeeFor(p, next) + 1500;
      if (p.cash >= need) add('uni', 'enroll', { courseId: next });
      else if (p.cash + p.savings >= need) add('bank', 'withdraw', { amount: 5000 });
    }
  }

  // 8. บทบาทพิเศษ
  roleGoals(state, p, add, h);

  // 9. ดูแลตัวเองก่อนทำงานหนัก
  if (p.stats.health < 60 && h('workout') + h('jog') < 1) {
    add('gym', 'workout');
    add('park', 'jog');
  }
  if (p.stats.happiness < 55 && h('watchMovie') + h('playArcade') + h('walkPark') + h('merit') < 2) {
    if (p.cash > 2000) add('arcade', 'watchMovie');
    add('park', 'walkPark');
    add('temple', 'merit');
  }

  // 10. ใช้เงินเมื่อมีเหลือ: ที่พัก พาหนะ ของแต่งบ้าน สัตว์เลี้ยง เงินฝาก
  spendGoals(state, p, add);

  // 11. ทำงาน
  if (job && h('work') < 4) add(job.location, 'work');
  if (p.groceries === 0 && p.cash >= 1500) add('market', 'buyGroceries');
  if (job && h('work') < 6) add(job.location, 'work');
  if (p.stats.happiness < 80 && p.cash > 3000) add('arcade', 'playArcade');
  return goals;
}

function plannedCourse(p) {
  if (p.education.enrolled) return null;
  return studyPlan(p).find((id) => !p.education.completed.includes(id) && (!COURSES[id].prereq || p.education.completed.includes(COURSES[id].prereq))) || null;
}

// เงินที่ต้องกันไว้สำหรับค่าเทอมหลักสูตรถัดไป
function reserveFor(p) {
  const next = plannedCourse(p);
  return next ? courseFeeFor(p, next) + 1500 : 0;
}

function roleGoals(state, p, add, h) {
  const home = p.housing;
  switch (p.role) {
    case 'artist':
      if (p.artworks.length && (p.artworks.length >= 2 || p.cash < 1500)) add('park', 'sellArt', { index: 0 });
      if (h('paint') < 2 && p.stats.happiness >= 35) add(home, 'paint');
      break;
    case 'scavenger': {
      const junk = p.finds.filter((f) => !f.artifact).length;
      if (junk >= 3 || (junk && p.cash < 1000)) add('park', 'sellFinds', { which: 'junk' });
      // ขายวัตถุโบราณที่ซ้ำกัน เก็บชนิดละชิ้นไว้สะสม
      const seen = new Set();
      p.finds.forEach((f, i) => {
        if (!f.artifact) return;
        if (seen.has(f.artifact)) add('park', 'sellFinds', { which: i });
        seen.add(f.artifact);
      });
      if (h('scavenge') < 4) add('park', 'scavenge');
      break;
    }
    case 'influencer':
      if (h('stream') < 3 && p.stats.hygiene >= 30) add(home, 'stream');
      break;
    case 'mystic':
      if (p.horoscope && !p.horoscope.used) {
        const { actions } = previewActionsAt(state, p.id, p.horoscope.lucky);
        const timed = actions.find((a) => !a.disabled && a.hours > 0 && a.action !== 'apply');
        if (timed) add(p.horoscope.lucky, timed.action, timed.params);
      }
      if (h('merit') < 1 && p.cash >= 500) add('temple', 'merit');
      if (h('buyLottery') < 1 && p.cash >= 2000) add('market', 'buyLottery', { n: 1 });
      break;
    case 'fitness':
      if (h('workout') < 2 && p.cash >= 500) add('gym', 'workout');
      break;
    case 'senior':
      if (!p.pets.includes('cat') && p.cash >= 3000) add('park', 'adoptPet', { pet: 'cat' });
      if (!p.pets.includes('dog') && p.cash >= 5000) add('park', 'adoptPet', { pet: 'dog' });
      break;
    default:
      break;
  }
}

function spendGoals(state, p, add) {
  const job = JOBS[p.job];
  const weeklyIncome = job ? job.wage * 24 : 0;
  const cash = p.cash - reserveFor(p);
  if (p.housing === 'flat' && weeklyIncome >= 6000 && cash >= 4000) add('condo', 'moveIn');
  if (!p.vehicle && cash >= 4500) add('vehicles', 'buyVehicle', { vehicle: 'bicycle' });
  if (p.vehicle === 'bicycle' && cash >= 24000) add('vehicles', 'buyVehicle', { vehicle: 'motorbike' });
  if (!p.pets.includes('dog') && job && cash >= 7000) add('park', 'adoptPet', { pet: 'dog' });
  if (p.furniture.length < HOMES[p.housing].slots) {
    const wish = FURNITURE_LIST.filter((f) => !p.furniture.includes(f.id) && cash >= f.price + 3000).sort((a, b) => value(b) / b.price - value(a) / a.price)[0];
    if (wish) add('furniture', 'buyFurniture', { itemId: wish.id });
  }
  if (p.loans > 0 && cash >= RULES.loan.repay + 3000) add('bank', 'repayLoan');
  // ฝากเงินเฉพาะตอนไม่ได้เก็บไว้จ่ายค่าเทอม (ไม่งั้นจะฝาก-ถอนวนไปมา)
  if (!reserveFor(p) && p.cash >= 8000) add('bank', 'deposit', { amount: 'keep' });
}

function value(f) {
  return f.decor * 2 + (f.weekly.happiness || 0) * 2 + (f.weekly.health || 0) * 2 + (f.weekly.hygiene || 0) + (f.id === 'fridge' || f.id === 'robot' ? 4 : 0);
}

// งานที่ดีที่สุดที่สมัครได้ตอนนี้ (lookahead=true: งานที่อยากได้ถ้ามีชุดที่เหมาะ)
function bestJob(state, p, lookahead) {
  let best = null;
  for (const j of JOB_LIST) {
    let ok = canTakeJob(p, j);
    if (!ok && lookahead && j.req.clothes && p.clothes.tier < j.req.clothes) ok = canTakeJob({ ...p, clothes: { tier: j.req.clothes, weeksLeft: 9 } }, j);
    if (!ok || state.global.closed === j.location) continue;
    if (!best || j.wage > best.wage) best = j;
  }
  return best;
}

export { netWorth };
