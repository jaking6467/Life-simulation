// bot.js — สมองของบอท ใช้กับผู้เล่นบอท ผู้เล่นที่หมดเวลา และผู้เล่นที่หลุดการเชื่อมต่อ
// วางแผนทีละก้าว: เรียงเป้าหมายตามความสำคัญ (กิน → อาบน้ำ → เสื้อผ้า → หางาน → เรียน → ครอบครัว → ทำงาน → ใช้เงิน)
// แล้วเลือกเป้าหมายแรกที่ทำได้ทันเวลา ถ้ายังไม่ถึงที่ก็เดินไปก่อน
// ใช้ค่าสุ่มจากแฮช จึงไม่ไปรบกวนตัวสุ่มของเกม
//
// ระดับความเก่ง (ตั้งในห้องรอ ใช้กับผู้เล่นบอทเท่านั้น คนที่หมดเวลา/หลุดใช้ระดับปกติเสมอ):
// - ง่าย: ทำแค่เรื่องพื้นฐาน เดินเล่นไปเรื่อย บางทีก็จบสัปดาห์เร็ว ไม่ลงทุน ไม่แกล้งใคร
// - ปกติ: ใช้ชีวิตครบทุกด้าน มีครอบครัว เปิดธุรกิจเล็ก ๆ ซื้อบ้านเมื่อพร้อม
// - ยาก: วางแผนเต็มที่ ทำงานหนัก ลงทุนทุกทาง ใช้การ์ดแกล้งคนที่นำอยู่ และป้องกันตัวเอง

import { RULES } from './rules.js';
import { JOBS, JOB_LIST, CLOTHES } from './jobs.js';
import { COURSES } from './courses.js';
import { FURNITURE_LIST } from './items.js';
import { CHOICE_EVENT_BY_ID } from './events.js';
import { HOMES } from './city.js';
import { BUSINESSES, BUSINESS_LIST, upgradeCost } from './business.js';
import { DATE_SPOTS } from './family.js';
import { homeValue } from './property.js';
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

function studyPlan(p, level) {
  if (level === 'easy') return ['highschool'];
  if (STUDY_PLANS[p.role]) return STUDY_PLANS[p.role];
  const plans = STUDY_PLANS.default;
  return plans[hashString(p.id) % plans.length];
}

export function botLevel(state, p) {
  return p.isBot ? state.botLevel || 'normal' : 'normal';
}

// ค่าสุ่ม 0–1 ที่คงที่ต่อสถานะเกม (ไม่แตะตัวสุ่มของเกม)
function roll(state, p, salt) {
  return hashString(`${p.id}:${state.seq}:${state.turn}:${salt}`) / 4294967296;
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
  if (botLevel(state, p) === 'easy' && roll(state, p, 'choice') < 0.4) return ph.options[Math.floor(roll(state, p, 'pick') * ph.options.length)].id;
  let best = ph.options[ph.options.length - 1].id;
  let bestScore = -Infinity;
  for (const opt of ev.options) {
    const e = opt.eff || {};
    let score = (e.money || 0) / 150 + (e.happiness || 0) * (p.stats.happiness < 50 ? 1.2 : 0.7) + (e.health || 0) * (p.stats.health < 50 ? 1.2 : 0.7) + (e.points || 0) * 3 + (e.xp || 0) * 0.3;
    score += (e.hours || 0) * hourValue;
    if (e.overtime && job) score += (job.wage * e.overtime * 1.5) / 150 - e.overtime * hourValue;
    if (e.gamble) score += e.gamble.reduce((s, g) => s + (g.chance * g.money) / 150, 0);
    if (e.pet) score += 4;
    if (e.affection && p.love) score += e.affection * (p.love.affection < 40 ? 1 : 0.5);
    if ((e.money || 0) < 0 && p.cash + (e.money || 0) < 1000) score -= 20;
    if (score > bestScore) {
      bestScore = score;
      best = opt.id;
    }
  }
  return best;
}

function planStep(state, p) {
  const level = botLevel(state, p);
  if (level === 'easy') {
    const lazy = easyWander(state, p);
    if (lazy) return lazy;
  }
  const goals = buildGoals(state, p, level);
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

// บอทระดับง่าย: บางครั้งก็เดินเล่นหรือทำอะไรตามใจ และขี้เกียจจบสัปดาห์เร็ว
const BIG_DECISIONS = ['apply', 'buyHome', 'sellHome', 'buyBusiness', 'sellBusiness', 'upgradeBusiness', 'propose', 'haveBaby', 'meet', 'enroll'];
function easyWander(state, p) {
  if (!p.ate) return null; // เรื่องกินยังไงก็ต้องทำ
  if (p.hoursLeft < 18 && roll(state, p, 'lazy') < 0.35) return { type: 'endTurn' };
  const r = roll(state, p, 'wander');
  if (r < 0.18) {
    const { actions } = previewActionsAt(state, p.id, p.location);
    const options = actions.filter((a) => !a.disabled && a.hours > 0 && a.cost <= Math.min(2000, p.cash - 1500) && !BIG_DECISIONS.includes(a.action));
    if (options.length) {
      const a = options[Math.floor(roll(state, p, 'act') * options.length)];
      return { type: 'act', action: a.action, params: a.params };
    }
  } else if (r < 0.26) {
    const spots = ['park', 'arcade', 'temple', 'market', 'mall', 'restaurant'].filter((l) => l !== p.location && state.global.closed !== l);
    const to = spots[Math.floor(roll(state, p, 'to') * spots.length)];
    const { travel } = previewActionsAt(state, p.id, to);
    if (travel + 4 <= p.hoursLeft) return { type: 'move', to };
  }
  return null;
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

function buildGoals(state, p, level) {
  const goals = [];
  const add = (loc, action, params) => goals.push({ loc, action, params });
  const home = p.housing;
  const job = JOBS[p.job];
  const acts = p.weekActs;
  const h = (k) => acts[k] || 0;
  const easy = level === 'easy';
  const hard = level === 'hard';

  // 1. สุขภาพวิกฤต
  if (p.stats.health < 30 && p.cash >= 1500) add('hospital', 'checkup');

  // 2. อาหาร (มีแฟนก็ไปดินเนอร์ด้วยกัน นับเป็นมื้ออาหาร)
  if (!p.ate) {
    if (job && (job.location === 'cluckers' || job.location === 'restaurant')) add(job.location, 'work');
    if (p.love && !easy && p.cash >= 2500) add('restaurant', 'date');
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
  const target = bestJob(state, p, true, level);
  const neededTier = Math.max(1, target?.req.clothes || 0, job?.req.clothes || 0);
  const affordNeeded = p.cash >= CLOTHES[neededTier].price + 600;
  if (p.clothes.tier === 0 || p.clothes.weeksLeft <= 1) {
    const tier = affordNeeded ? neededTier : 1;
    if (p.cash >= CLOTHES[tier].price + 200) add('mall', 'buyClothes', { tier });
  } else if (p.clothes.tier < neededTier && affordNeeded) {
    add('mall', 'buyClothes', { tier: neededTier });
  }

  // 6. หางาน / เลื่อนตำแหน่ง (ถ้าตำแหน่งเต็มแต่คุณสมบัติดีกว่า ก็ชิงตำแหน่งได้)
  const best = bestJob(state, p, false, level);
  if (best && (!job || best.wage >= job.wage * 1.12)) add('jobs', 'apply', { jobId: best.id });

  // 7. เรียน
  if (p.education.enrolled) {
    if (h('attend') + h('studyOnline') < 2) {
      if (p.furniture.includes('computer')) add(home, 'studyOnline');
      add('uni', 'attend');
    }
  } else {
    const next = plannedCourse(p, level);
    if (next) {
      const need = courseFeeFor(p, next) + 1500;
      if (p.cash >= need) add('uni', 'enroll', { courseId: next });
      else if (p.cash + p.savings >= need) add('bank', 'withdraw', { amount: 5000 });
    }
  }

  // 8. ครอบครัว และป้องกันตัวจากการ์ดแกล้ง
  if (!easy) familyGoals(state, p, add, h, level);
  if (!easy && p.c.pranked >= 2 && p.amulets < 1 && p.cash - reserveFor(p, level) >= 4000) add('temple', 'buyAmulet');

  // 9. บทบาทพิเศษ
  roleGoals(state, p, add, h);

  // 10. ดูแลตัวเองก่อนทำงานหนัก
  if (p.stats.health < 60 && h('workout') + h('jog') < 1) {
    add('gym', 'workout');
    add('park', 'jog');
  }
  if (p.stats.happiness < 55 && h('watchMovie') + h('playArcade') + h('walkPark') + h('merit') < 2) {
    if (p.cash > 2000) add('arcade', 'watchMovie');
    add('park', 'walkPark');
    add('temple', 'merit');
  }

  // 11. การ์ดแกล้งคนที่นำอยู่ (ไม่เสียเวลา ใช้ได้ทุกที่)
  if (!easy) cardGoals(state, p, add, h, level);

  // 12. ใช้เงินเมื่อมีเหลือ: ที่พัก บ้าน ธุรกิจ ประกัน พาหนะ ของแต่งบ้าน สัตว์เลี้ยง เงินฝาก
  spendGoals(state, p, add, level);

  // 13. ทำงานและดูแลธุรกิจ
  const shifts = easy ? 3 : hard ? 6 : 5;
  if (job && h('work') < Math.min(shifts, 3)) add(job.location, 'work');
  if (!easy) for (const b of p.businesses) if (!b.managed && (hard || BUSINESSES[b.id].base >= 2000 || !job)) add(BUSINESSES[b.id].location, 'manageBusiness', { bizId: b.id });
  if (job && h('work') < Math.min(shifts, 4)) add(job.location, 'work');
  if (p.groceries === 0 && p.cash >= 1500) add('market', 'buyGroceries');
  if ((p.love?.stage === 'married' || p.kids.length) && !h('familyTime')) add(home, 'familyTime');
  if (job && h('work') < shifts) add(job.location, 'work');
  if (!easy) for (const b of p.businesses) if (!b.managed) add(BUSINESSES[b.id].location, 'manageBusiness', { bizId: b.id });
  if (p.stats.happiness < 80 && p.cash > 3000) add('arcade', 'playArcade');
  return goals;
}

function familyGoals(state, p, add, h, level) {
  const home = p.housing;
  const F = RULES.family;
  const L = p.love;
  if (!L) {
    if (!h('meet') && state.week >= 2 && p.stats.hygiene >= 50 && p.stats.happiness >= 35) add('park', 'meet');
    return;
  }
  // ช่วงต้นสัปดาห์ที่บ้าน: ใช้เวลากับครอบครัวก่อนออกไปข้างนอก
  if (p.location === home && (L.stage === 'married' || p.kids.length) && !h('familyTime') && L.affection < 80) add(home, 'familyTime');
  if (L.affection < 75 && h('date') < 1) {
    const liked = Object.keys(DATE_SPOTS).find((loc) => DATE_SPOTS[loc].style === L.likes);
    if (p.cash >= DATE_SPOTS[liked].cost + 1500) add(liked, 'date');
    add('park', 'date');
  }
  const reserve = reserveFor(p, level) - (weddingSoon(p) ? F.weddingCost + 3000 : 0);
  if (L.stage === 'dating' && L.weeks >= F.proposeWeeks && L.affection >= F.proposeAffection) {
    if (p.cash - reserve >= F.weddingCost + 3000) add('temple', 'propose');
    else if (p.hoursLeft >= 14 && p.cash + p.savings - reserve >= F.weddingCost + 3000) add('bank', 'withdraw', { amount: 'all' });
  }
  const maxKids = level === 'hard' ? 1 : F.maxKids;
  const income = (JOBS[p.job]?.wage || 0) * 24 + (L.income || 0);
  if (L.stage === 'married' && p.kids.length < maxKids && L.affection >= F.babyAffection && income >= 3500 && p.cash - reserve >= F.babyCost + 4000) add('hospital', 'haveBaby');
}

// บอทปกติ: แกล้งเฉพาะตอนมีคนนำห่างมาก / บอทยาก: แกล้งคนที่นำอยู่เสมอ และซื้อการ์ดเตรียมไว้
function cardGoals(state, p, add, h, level) {
  const hard = level === 'hard';
  const rivals = state.order.filter((id) => id !== p.id).map((id) => state.players[id]);
  const ranked = rivals.sort((a, b) => b.score - a.score);
  const leader = ranked[0];
  const last = ranked[ranked.length - 1];
  const budget = Math.ceil(state.week / (hard ? 3 : 4));
  const behind = leader && leader.score >= p.score + (hard ? 10 : 20);
  const spare = p.cash - reserveFor(p, level);
  if (!h('playCard') && p.cards.length) {
    const pick = ['sabotage', 'spam', 'rumor', 'stink'].find((c) => p.cards.includes(c) && (c !== 'sabotage' || (leader.job && JOBS[leader.job].wage >= 120)));
    if (pick && behind && p.c.pranks < budget && leader.pending.length < RULES.cards.maxPending) add(p.location, 'playCard', { cardId: pick, target: leader.id });
    // นำอยู่ห่าง ๆ: ส่งของขวัญให้คนที่ตามหลังสุด
    if (p.cards.includes('gift') && last) add(p.location, 'playCard', { cardId: 'gift', target: last.id });
  }
  if (p.cards.length >= 1 || state.week >= state.maxWeeks) return;
  if (behind && p.c.pranks < budget && (hard ? spare >= 6000 : spare >= 9000 && p.location === 'arcade')) {
    add('arcade', 'buyCard', { cardId: leader.job && JOBS[leader.job].wage >= 150 ? 'sabotage' : 'spam' });
  } else if (!hard && p.location === 'arcade' && p.cash >= 10000 && last && p.score >= last.score + 40) {
    add('arcade', 'buyCard', { cardId: 'gift' });
  }
}

function plannedCourse(p, level) {
  if (p.education.enrolled) return null;
  return studyPlan(p, level).find((id) => !p.education.completed.includes(id) && (!COURSES[id].prereq || p.education.completed.includes(COURSES[id].prereq))) || null;
}

// เงินที่ต้องกันไว้: ค่าเทอมหลักสูตรถัดไป และค่างานแต่งถ้าใกล้ถึงเวลาขอแต่งงาน
function reserveFor(p, level = 'normal') {
  const next = plannedCourse(p, level);
  let reserve = next ? courseFeeFor(p, next) + 1500 : 0;
  if (level !== 'easy' && weddingSoon(p)) reserve += RULES.family.weddingCost + 3000;
  return reserve;
}

function weddingSoon(p) {
  const L = p.love;
  return !!L && L.stage === 'dating' && L.weeks >= RULES.family.proposeWeeks - 1 && L.affection >= RULES.family.proposeAffection - 15;
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

function spendGoals(state, p, add, level) {
  const easy = level === 'easy';
  const hard = level === 'hard';
  const job = JOBS[p.job];
  const weeklyIncome = job ? job.wage * 24 : 0;
  let cash = p.cash - reserveFor(p, level);

  // ประกันภัย
  if (!easy && state.week >= 2) {
    if (!p.insurance.health && cash >= 2500 && (hard || p.stats.health < 60 || (job?.strain || 0) >= 4 || p.role === 'senior')) add('bank', 'buyInsurance', { kind: 'health' });
    if (!p.insurance.property && (p.owned || (hard && p.housing === 'flat' && cash >= 6000))) add('bank', 'buyInsurance', { kind: 'property' });
    if (!p.insurance.business && p.businesses.some((b) => hard || BUSINESSES[b.id].base >= 2000)) add('bank', 'buyInsurance', { kind: 'business' });
  }

  // การลงทุนก้อนใหญ่ (บ้าน ธุรกิจ ขยายสาขา): ถ้าเงินสดไม่พอแต่มีเงินฝาก ถอนมาซื้อ
  const plan = plannedPurchase(state, p, level);
  if (plan) {
    if (p.cash - reserveFor(p, level) >= plan.cost) add(plan.loc, plan.action, plan.params);
    else if (p.hoursLeft >= 16) add('bank', 'withdraw', { amount: 'all' });
    cash -= plan.cost;
  }
  if (p.housing === 'flat' && p.owned !== 'flat' && weeklyIncome >= 6000 && cash >= 4000) add('condo', 'moveIn');

  if (!p.vehicle && cash >= 4500) add('vehicles', 'buyVehicle', { vehicle: 'bicycle' });
  if (p.vehicle === 'bicycle' && cash >= 24000) add('vehicles', 'buyVehicle', { vehicle: 'motorbike' });
  if (!p.pets.includes('dog') && job && cash >= 7000) add('park', 'adoptPet', { pet: 'dog' });
  if (p.furniture.length < HOMES[p.housing].slots) {
    const wish = FURNITURE_LIST.filter((f) => !p.furniture.includes(f.id) && cash >= f.price + 3000).sort((a, b) => value(b) / b.price - value(a) / a.price)[0];
    if (wish) add('furniture', 'buyFurniture', { itemId: wish.id });
  }
  if (p.loans > 0 && cash >= RULES.loan.repay + 3000) add('bank', 'repayLoan');
  // ฝากเงินเฉพาะตอนไม่ได้เก็บไว้จ่ายค่าเทอม (ไม่งั้นจะฝาก-ถอนวนไปมา)
  if (!reserveFor(p, level) && !plan && p.cash >= 8000) add('bank', 'deposit', { amount: 'keep' });
}

// สิ่งที่บอทกำลังเก็บเงินซื้อ (เฉพาะที่เงินสด + เงินฝากพอแล้ว) cost รวมเงินสำรองหลังซื้อด้วย
function plannedPurchase(state, p, level) {
  if (level === 'easy') return null;
  const hard = level === 'hard';
  const job = JOBS[p.job];
  const weeklyIncome = job ? job.wage * 24 : 0;
  const weeksLeft = state.maxWeeks - state.week;
  const liquid = p.cash + p.savings - reserveFor(p, level);
  const plans = [];
  if (!p.owned && weeksLeft >= 5 && (job || p.businesses.length)) {
    const want = p.housing === 'condo' || weeklyIncome >= 9000 ? 'condo' : 'flat';
    if (weeklyIncome >= (want === 'condo' ? 8000 : 2500)) {
      const down = Math.round((homeValue(state, want) * RULES.mortgage.down) / 100) * 100;
      plans.push({ loc: 'bank', action: 'buyHome', params: { homeId: want }, cost: down + (hard ? 3000 : 4000) });
    }
  }
  if (weeksLeft >= 4 && p.businesses.length < RULES.business.maxOwned) {
    const buffer = hard ? 2000 : 3000;
    const pick = BUSINESS_LIST.filter((b) => !p.businesses.some((x) => x.id === b.id) && (hard || b.price <= 35000) && liquid >= b.price + buffer && hasReq(p, b)).sort((a, b) => b.base - a.base)[0];
    if (pick) plans.push({ loc: pick.location, action: 'buyBusiness', params: { bizId: pick.id }, cost: pick.price + buffer });
  }
  if (hard && weeksLeft >= 4) {
    for (const b of p.businesses) {
      const biz = BUSINESSES[b.id];
      if (b.level < RULES.business.maxLevel) plans.push({ loc: biz.location, action: 'upgradeBusiness', params: { bizId: b.id }, cost: upgradeCost(biz, b.level) + 4000 });
    }
  }
  return plans.find((x) => liquid >= x.cost) || null;
}

function hasReq(p, b) {
  if (!b.req) return true;
  if (b.req.course) return p.education.completed.includes(b.req.course);
  return b.req.anyCourse.some((c) => p.education.completed.includes(c));
}

function value(f) {
  return f.decor * 2 + (f.weekly.happiness || 0) * 2 + (f.weekly.health || 0) * 2 + (f.weekly.hygiene || 0) + (f.id === 'fridge' || f.id === 'robot' ? 4 : 0);
}

// งานที่ดีที่สุดที่สมัครได้ตอนนี้ (lookahead=true: งานที่อยากได้ถ้ามีชุดที่เหมาะ)
function bestJob(state, p, lookahead, level = 'normal') {
  let best = null;
  for (const j of JOB_LIST) {
    if (level === 'easy' && j.tier > 3) continue;
    let ok = canTakeJob(state, p, j);
    if (!ok && lookahead && j.req.clothes && p.clothes.tier < j.req.clothes) ok = canTakeJob(state, { ...p, clothes: { tier: j.req.clothes, weeksLeft: 9 } }, j);
    if (!ok || state.global.closed === j.location) continue;
    if (!best || j.wage > best.wage) best = j;
  }
  return best;
}

export { netWorth };
