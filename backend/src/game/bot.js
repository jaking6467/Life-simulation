// bot.js — สมองของบอท ใช้กับผู้เล่นบอท ผู้เล่นที่หมดเวลา และผู้เล่นที่หลุดการเชื่อมต่อ
// บอทแต่ละตัวมีนิสัยต่างกัน (ใจกล้า/รักครอบครัว/รอบคอบ) คำนวณจาก id
// ใช้ค่าสุ่มจากแฮช จึงไม่ไปรบกวนตัวสุ่มของเกม

import { RULES, INSURANCE, AVERAGE_TILE_VALUE } from './rules.js';
import { CAREERS } from './careers.js';
import { HOUSES, houseAverageSale } from './houses.js';
import { CARDS } from './cards.js';
import { SPACES } from './board.js';
import { hashString } from './rng.js';
import { fallbackAction } from './engine.js';

export function personality(id) {
  const h = hashString(String(id));
  return {
    risk: (h & 0xff) / 255,
    family: ((h >>> 8) & 0xff) / 255,
    careful: ((h >>> 16) & 0xff) / 255,
  };
}

function roll(state, p, salt) {
  return (hashString(`${p.id}:${state.seq}:${salt}`) % 10000) / 10000;
}

function netWorth(p) {
  const houses = p.houses.reduce((s, h) => s + houseAverageSale(h.id), 0);
  return p.cash - p.loans * RULES.loanRepay + houses;
}

// คืนรายการคำสั่งที่บอทจะทำในตานี้ (คำสั่งจัดการเงินก่อน แล้วตามด้วยคำสั่งหลัก)
export function decideActions(state, playerId) {
  const p = state.players[playerId];
  const ph = state.phase;
  const me = personality(p.id);
  const seq = state.seq;
  const choose = (value) => [{ type: 'choose', value, seq }];

  switch (ph.type) {
    case 'spin':
      return [...manageMoney(state, p, me), { type: 'spin', seq }];

    case 'chooseStart':
      return choose(roll(state, p, 'start') < 0.35 + me.careful * 0.4 ? 'college' : 'work');

    case 'chooseCareer':
      return choose(bestCareer(state, p, ph.options));

    case 'choosePath':
      return choose(pickPath(state, p, me, ph.options));

    case 'marriage':
      return choose(me.family > 0.2 ? 'marry' : 'single');

    case 'buyHouse': {
      const pick = pickHouse(p, ph.options, 0);
      return choose(pick || 'skip');
    }

    case 'realEstate': {
      const pick = p.cash > 150000 ? pickHouse(p, ph.options, 20000) : null;
      if (pick && p.cash >= HOUSES[pick].price) return choose({ action: 'buy', houseId: pick });
      if (p.houses.length && p.loans >= 5) {
        const sell = p.houses.slice().sort((a, b) => HOUSES[b.id].sellLow - HOUSES[a.id].sellLow)[0];
        return choose({ action: 'sell', houseId: sell.id });
      }
      return choose({ action: 'skip' });
    }

    case 'lifeBuy': {
      const affordable = p.cash - ph.amount >= 5000 || (ph.amount <= 30000 && p.loans < 4);
      const worth = ph.count * AVERAGE_TILE_VALUE > ph.amount * (1.1 - me.family * 0.3);
      return choose(affordable && worth ? 'buy' : 'skip');
    }

    case 'spinToWin': {
      if (p.cash < 50000) return choose([]);
      const count = me.risk > 0.6 ? 2 : 1;
      const nums = [];
      let salt = 0;
      while (nums.length < count) {
        const n = 1 + Math.floor(roll(state, p, `num${salt++}`) * 10);
        if (!nums.includes(n)) nums.push(n);
      }
      return choose(nums);
    }

    case 'lawsuit': {
      const target = ph.targets.map((id) => state.players[id]).sort((a, b) => b.cash - a.cash)[0];
      return choose(target.id);
    }

    case 'nightSchool': {
      const c = CAREERS[p.career];
      const top = c ? c.salaries[c.salaries.length - 1] : 0;
      if (!p.degree && p.cash >= 120000 && top <= 65000) return choose('master');
      if (c?.variable && me.careful > 0.6) return choose('switch');
      return choose('stay');
    }

    case 'retire': {
      const mine = netWorth(p);
      const others = state.order.filter((id) => id !== p.id).map((id) => netWorth(state.players[id]));
      const best = others.length ? Math.max(...others) : 0;
      return choose(mine > best + 150000 * (1 - me.risk) ? 'estate' : 'country');
    }

    case 'cardChoice': {
      const card = CARDS[ph.cardId];
      let bestId = ph.options[ph.options.length - 1].id;
      let bestValue = 0;
      for (const opt of card.eff.options) {
        const value = effectValue(p, opt.eff, me);
        if (value > bestValue) {
          bestValue = value;
          bestId = opt.id;
        }
      }
      return choose(bestId);
    }

    default: {
      const fb = fallbackAction(state);
      return fb ? [fb] : [];
    }
  }
}

function manageMoney(state, p, me) {
  const acts = [];
  let cash = p.cash;
  let loans = p.loans;
  const age = SPACES[p.position]?.age ?? 18;

  while (loans > 0 && cash - RULES.loanRepay >= 40000) {
    acts.push({ type: 'repayLoan', count: 1 });
    cash -= RULES.loanRepay;
    loans--;
  }
  const buyIns = (kind) => {
    acts.push({ type: 'buyInsurance', kind });
    cash -= INSURANCE[kind].price;
  };
  if (!p.insurance.auto && age < 45 && me.careful > 0.35 && cash - INSURANCE.auto.price >= 15000) buyIns('auto');
  if (!p.insurance.home && p.houses.length && cash - INSURANCE.home.price >= 15000) buyIns('home');
  if (!p.insurance.health && age < 60 && (me.careful > 0.5 || age >= 38) && cash - INSURANCE.health.price >= 25000) buyIns('health');

  const wantStocks = me.risk > 0.6 ? 2 : 1;
  if (p.stocks.length < wantStocks && state.round <= 6 && state.order.length >= 3 && cash - RULES.stockPrice >= 20000) {
    const free = [];
    for (let n = 1; n <= 10; n++) if (!state.stockOwners[n]) free.push(n);
    if (free.length) {
      const n = free[Math.floor(roll(state, p, 'stock') * free.length)];
      acts.push({ type: 'buyStock', number: n });
      cash -= RULES.stockPrice;
    }
  }
  return acts;
}

function bestCareer(state, p, options) {
  let best = options[0];
  let bestScore = -Infinity;
  for (const id of options) {
    const c = CAREERS[id];
    const avg = c.salaries.reduce((s, v) => s + v, 0) / c.salaries.length;
    const score = avg * (c.variable ? 1.05 : 1) + roll(state, p, id) * 6000;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function pickPath(state, p, me, options) {
  const segs = options.map((o) => o.segment);
  const pick = (seg) => options.find((o) => o.segment === seg)?.id;
  if (segs.includes('family')) {
    return pick(p.married && me.family > 0.35 ? 'family' : 'career');
  }
  if (segs.includes('risky')) {
    const others = state.order.filter((id) => id !== p.id).map((id) => netWorth(state.players[id]));
    const behind = others.length && Math.max(...others) - netWorth(p) > 150000;
    return pick(me.risk > 0.55 || (behind && me.risk > 0.3) ? 'risky' : 'safe');
  }
  return options[Math.floor(roll(state, p, 'path') * options.length)].id;
}

function pickHouse(p, options, minScore) {
  let best = null;
  let bestScore = -Infinity;
  for (const id of options) {
    const h = HOUSES[id];
    const shortfall = Math.max(0, h.price - (p.cash - 10000));
    const loansNeeded = Math.ceil(shortfall / RULES.loanAmount);
    if (loansNeeded > 8) continue;
    const loanCost = loansNeeded * (RULES.loanRepay - RULES.loanAmount);
    const score = houseAverageSale(id) - h.price - loanCost + 15000;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return bestScore > minScore ? best : null;
}

function effectValue(p, eff, me) {
  switch (eff.k) {
    case 'none': return 0;
    case 'collect': return eff.a;
    case 'pay':
      if ((eff.ins && p.insurance[eff.ins]) || (eff.needHouse && !p.houses.length)) return 0;
      return -eff.a;
    case 'life': return AVERAGE_TILE_VALUE * (eff.n || 1);
    case 'promotion': return CAREERS[p.career] && p.salaryLevel < 3 ? 40000 : RULES.maxLevelBonus;
    case 'demotion': return -40000;
    case 'gamble':
      return eff.o.reduce((s, [min, max, amount]) => {
        const weight = (max - min + 1) / 10;
        return s + weight * (amount < 0 ? amount * (1.6 - me.risk) : amount);
      }, 0);
    case 'multi': return eff.list.reduce((s, e) => s + effectValue(p, e, me), 0);
    default: return 0;
  }
}
