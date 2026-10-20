// engine.js — กติกาและสถานะของเกมเส้นทางชีวิต
// ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (ออนไลน์) และในเบราว์เซอร์ (โหมดออฟไลน์)
//
// หลักการ: เล่นทีละคนตามลำดับ มีผู้เล่นปัจจุบันแค่คนเดียว (currentPlayerId)
// และ "phase" บอกว่าตอนนี้ผู้เล่นคนนั้นต้องทำอะไร ผู้เล่นคนอื่นต้องรอจนจบตา
// ทุกครั้งที่ phase เปลี่ยน state.seq จะเพิ่มขึ้น เพื่อกันคำสั่งที่ส่งมาซ้ำหรือค้าง

import { RULES, INSURANCE } from './rules.js';
import { CAREERS, CAREER_LIST } from './careers.js';
import { HOUSES, HOUSE_LIST } from './houses.js';
import { CARDS, buildCardDeck } from './cards.js';
import { SPACES, SEGMENTS, START_SPACE_ID, firstSpaceOf, forkOption } from './board.js';
import { randInt, shuffle } from './rng.js';
import { formatMoney as fm } from './format.js';

const MAX_LOG = 150;
const fail = (error) => ({ ok: false, error });
const roundK = (n) => Math.round(n / 1000) * 1000;
const INVALID = 'ตัวเลือกไม่ถูกต้อง';

// ============================================================
// สร้างเกม
// ============================================================

export function createGame({ players, seed = 1 }) {
  if (!Array.isArray(players) || players.length < 1) throw new Error('ต้องมีผู้เล่นอย่างน้อย 1 คน');
  const state = {
    version: 1,
    status: 'playing',
    seed: seed >>> 0,
    rng: seed >>> 0,
    seq: 0,
    round: 1,
    turn: 0,
    order: [],
    turnIndex: 0,
    currentPlayerId: null,
    phase: { type: 'starting' },
    players: {},
    decks: { cards: [], tiles: [], houses: [] },
    stockOwners: {},
    retiredCount: 0,
    extraSpin: false,
    lastSpin: null,
    log: [],
    logSeq: 0,
    events: [],
    results: null,
  };
  for (let n = 1; n <= 10; n++) state.stockOwners[n] = null;
  for (const p of players) state.players[p.id] = createPlayer(p);
  state.order = shuffle(state, players.map((p) => p.id));
  state.decks.cards = shuffle(state, buildCardDeck());
  state.decks.tiles = shuffle(state, RULES.lifeTiles);
  state.decks.houses = shuffle(state, HOUSE_LIST.map((h) => h.id));
  log(state, null, `เริ่มเกม! ลำดับการเล่น: ${state.order.map((id) => state.players[id].name).join(' → ')}`, 'info');
  beginTurn(state);
  state.events = [];
  return state;
}

function createPlayer({ id, name, color, isBot }) {
  return {
    id,
    name: String(name || 'ผู้เล่น'),
    color: color || '#888888',
    isBot: !!isBot,
    position: START_SPACE_ID,
    started: false,
    education: null,
    pendingBranch: null,
    cash: RULES.startCash,
    loans: 0,
    career: null,
    salaryLevel: 0,
    degree: false,
    married: false,
    children: 0,
    pets: 0,
    houses: [],
    soldHouses: [],
    insurance: { auto: false, home: false, health: false },
    stocks: [],
    lifeTiles: [],
    retired: false,
    retireChoice: null,
    retireRank: null,
    skipTurns: 0,
    stats: { paydays: 0, earned: 0, spent: 0, cards: 0 },
  };
}

// ============================================================
// คำสั่งจากผู้เล่น
// ============================================================

export function performAction(state, playerId, action) {
  if (!action || typeof action.type !== 'string') return fail('คำสั่งไม่ถูกต้อง');
  if (state.status !== 'playing') return fail('เกมจบแล้ว');
  if (playerId !== state.currentPlayerId) return fail('ยังไม่ถึงตาของคุณ');
  if (action.seq != null && action.seq !== state.seq) return fail('สถานะเกมเปลี่ยนไปแล้ว ลองใหม่อีกครั้ง');
  const handler = ACTIONS[action.type];
  if (!handler) return fail('ไม่รู้จักคำสั่งนี้');
  const p = state.players[playerId];
  state.events = [];
  // ตัวจัดการทุกตัวต้องตรวจสอบก่อนแก้ไขสถานะ ถ้าคืนข้อความ error แปลว่ายังไม่ได้แก้อะไร
  const error = handler(state, p, action);
  const events = state.events;
  state.events = [];
  if (error) return fail(error);
  return { ok: true, events };
}

const ACTIONS = {
  spin(state, p) {
    if (state.phase.type !== 'spin') return 'ตอนนี้ยังหมุนไม่ได้';
    const value = spin(state, p, 'move');
    state.lastSpin = { playerId: p.id, value };
    log(state, p.id, `${p.name} หมุนได้ ${value}`, 'info');
    payStockHolder(state, value);
    setPhase(state, { type: 'moving' });
    moveSteps(state, p, value);
    return null;
  },

  choose(state, p, action) {
    const handler = CHOICES[state.phase.type];
    if (!handler) return 'ตอนนี้ไม่มีตัวเลือกให้เลือก';
    return handler(state, p, action.value);
  },

  takeLoan(state, p, action) {
    if (state.phase.type !== 'spin') return 'ทำรายการการเงินได้เฉพาะก่อนหมุนวงล้อ';
    const n = action.count ?? 1;
    if (!Number.isInteger(n) || n < 1 || n > 5) return 'จำนวนสัญญาไม่ถูกต้อง';
    if (p.loans + n > RULES.maxVoluntaryLoans) return `กู้เองได้สูงสุด ${RULES.maxVoluntaryLoans} สัญญา`;
    p.loans += n;
    p.cash += n * RULES.loanAmount;
    emit(state, { type: 'loan', playerId: p.id, count: n, auto: false });
    log(state, p.id, `${p.name} กู้เงินธนาคาร ${n} สัญญา (+${fm(n * RULES.loanAmount)})`, 'info');
    return null;
  },

  repayLoan(state, p, action) {
    if (state.phase.type !== 'spin') return 'ทำรายการการเงินได้เฉพาะก่อนหมุนวงล้อ';
    const n = action.count ?? 1;
    if (!Number.isInteger(n) || n < 1) return 'จำนวนสัญญาไม่ถูกต้อง';
    if (n > p.loans) return 'คุณมีเงินกู้ไม่ถึงจำนวนนี้';
    if (p.cash < n * RULES.loanRepay) return 'เงินสดไม่พอคืนเงินกู้';
    p.loans -= n;
    p.cash -= n * RULES.loanRepay;
    emit(state, { type: 'money', playerId: p.id, amount: -n * RULES.loanRepay, reason: 'คืนเงินกู้' });
    log(state, p.id, `${p.name} คืนเงินกู้ ${n} สัญญา (-${fm(n * RULES.loanRepay)})`, 'good');
    return null;
  },

  buyInsurance(state, p, action) {
    if (state.phase.type !== 'spin') return 'ซื้อประกันได้เฉพาะก่อนหมุนวงล้อ';
    const ins = INSURANCE[action.kind];
    if (!ins) return 'ไม่มีประกันประเภทนี้';
    if (p.insurance[ins.id]) return 'คุณมีประกันนี้อยู่แล้ว';
    if (ins.id === 'home' && !p.houses.length) return 'ต้องมีบ้านก่อนจึงจะซื้อประกันบ้านได้';
    if (p.cash < ins.price) return 'เงินสดไม่พอ (กู้เงินก่อนได้)';
    p.insurance[ins.id] = true;
    p.cash -= ins.price;
    p.stats.spent += ins.price;
    emit(state, { type: 'money', playerId: p.id, amount: -ins.price, reason: `ซื้อ${ins.name}` });
    log(state, p.id, `${p.name} ซื้อ${ins.name} (-${fm(ins.price)})`, 'info');
    return null;
  },

  buyStock(state, p, action) {
    if (state.phase.type !== 'spin') return 'ซื้อหุ้นได้เฉพาะก่อนหมุนวงล้อ';
    const n = action.number;
    if (!Number.isInteger(n) || n < 1 || n > 10) return 'หมายเลขหุ้นต้องเป็น 1–10';
    if (state.stockOwners[n]) return 'หุ้นหมายเลขนี้มีเจ้าของแล้ว';
    if (p.stocks.length >= RULES.maxStocks) return `ถือหุ้นได้สูงสุด ${RULES.maxStocks} ใบ`;
    if (p.cash < RULES.stockPrice) return 'เงินสดไม่พอ (กู้เงินก่อนได้)';
    p.cash -= RULES.stockPrice;
    p.stats.spent += RULES.stockPrice;
    p.stocks.push(n);
    p.stocks.sort((a, b) => a - b);
    state.stockOwners[n] = p.id;
    emit(state, { type: 'money', playerId: p.id, amount: -RULES.stockPrice, reason: `ซื้อหุ้นหมายเลข ${n}` });
    log(state, p.id, `${p.name} ซื้อใบหุ้นหมายเลข ${n} (-${fm(RULES.stockPrice)})`, 'info');
    return null;
  },
};

// ตัวเลือกในแต่ละ phase — ตรวจสอบค่าก่อนเสมอ แล้วค่อยเปลี่ยนสถานะ
const CHOICES = {
  chooseStart(state, p, value) {
    if (value !== 'college' && value !== 'work') return INVALID;
    p.started = true;
    p.education = value;
    p.pendingBranch = firstSpaceOf(value);
    if (value === 'college') {
      p.loans += RULES.collegeLoans;
      emit(state, { type: 'loan', playerId: p.id, count: RULES.collegeLoans, auto: false });
      log(state, p.id, `${p.name} เลือกเรียนมหาวิทยาลัย กู้ค่าเทอม ${RULES.collegeLoans} สัญญา (${fm(RULES.collegeLoans * RULES.loanAmount)})`, 'info');
      setPhase(state, { type: 'spin' });
    } else {
      log(state, p.id, `${p.name} เลือกเริ่มทำงานทันที`, 'info');
      setPhase(state, { type: 'chooseCareer', reason: 'start', options: careerOptions(state, p, false) });
    }
    return null;
  },

  chooseCareer(state, p, value) {
    const ph = state.phase;
    if (!ph.options.includes(value)) return INVALID;
    const c = CAREERS[value];
    p.career = value;
    p.salaryLevel = ph.reason === 'nightSchool' ? 1 : 0;
    emit(state, { type: 'career', playerId: p.id, careerId: value, level: p.salaryLevel });
    log(state, p.id, `${p.name} เริ่มอาชีพ${c.name} ตำแหน่ง${c.titles[p.salaryLevel]} เงินเดือน${c.variable ? 'ฐาน ' : ' '}${fm(baseSalary(p))}`, 'good');
    if (ph.reason === 'start') setPhase(state, { type: 'spin' });
    else finishTurn(state);
    return null;
  },

  choosePath(state, p, value) {
    const ph = state.phase;
    const opt = ph.options.find((o) => o.id === value);
    if (!opt) return INVALID;
    p.pendingBranch = value;
    log(state, p.id, `${p.name} เลือก${opt.label}`, 'info');
    setPhase(state, { type: 'moving' });
    moveSteps(state, p, ph.remaining);
    return null;
  },

  marriage(state, p, value) {
    if (value !== 'marry' && value !== 'single') return INVALID;
    if (value === 'marry') {
      p.married = true;
      emit(state, { type: 'family', playerId: p.id, kind: 'marry' });
      log(state, p.id, `💍 ${p.name} แต่งงานแล้ว!`, 'good');
      charge(state, p, RULES.weddingCost, { category: 'food', reason: 'จัดงานเลี้ยงฉลองมงคลสมรส' });
      giveLife(state, p, 1, 'แต่งงาน');
      for (const id of state.order) {
        if (id === p.id) continue;
        const q = state.players[id];
        const v = spin(state, q, 'gift');
        const amount = lookup(RULES.giftTable, v);
        charge(state, q, amount, { to: p.id, reason: `ใส่ซองงานแต่ง${p.name} (หมุนได้ ${v})` });
      }
    } else {
      log(state, p.id, `${p.name} เลือกครองโสด ใช้ชีวิตอิสระ`, 'info');
      gain(state, p, RULES.singleBonus, 'ชีวิตโสดเก็บเงินได้มากขึ้น');
    }
    finishTurn(state);
    return null;
  },

  buyHouse(state, p, value) {
    const ph = state.phase;
    if (value !== 'skip' && !ph.options.includes(value)) return INVALID;
    state.decks.houses.push(...ph.options.filter((id) => id !== value));
    if (value === 'skip') log(state, p.id, `${p.name} ยังไม่ซื้อบ้าน`, 'info');
    else purchaseHouse(state, p, value);
    finishTurn(state);
    return null;
  },

  realEstate(state, p, value) {
    const ph = state.phase;
    const v = typeof value === 'string' ? { action: value } : value || {};
    if (v.action === 'buy' && !ph.options.includes(v.houseId)) return INVALID;
    if (v.action === 'sell' && !p.houses.some((h) => h.id === v.houseId)) return INVALID;
    if (!['buy', 'sell', 'skip'].includes(v.action)) return INVALID;
    state.decks.houses.push(...ph.options.filter((id) => !(v.action === 'buy' && id === v.houseId)));
    if (v.action === 'buy') purchaseHouse(state, p, v.houseId);
    else if (v.action === 'sell') sellHouse(state, p, v.houseId);
    else log(state, p.id, `${p.name} ไม่ซื้อขายบ้านรอบนี้`, 'info');
    finishTurn(state);
    return null;
  },

  lifeBuy(state, p, value) {
    if (value !== 'buy' && value !== 'skip') return INVALID;
    const ph = state.phase;
    if (value === 'buy') {
      charge(state, p, ph.amount, { category: ph.category, reason: ph.label });
      giveLife(state, p, ph.count, ph.label);
    } else {
      log(state, p.id, `${p.name} ข้าม "${ph.label}"`, 'info');
    }
    finishTurn(state);
    return null;
  },

  spinToWin(state, p, value) {
    const cfg = RULES.spinToWin;
    if (!Array.isArray(value)) return INVALID;
    const nums = [...new Set(value)];
    if (nums.length !== value.length || nums.length > cfg.maxNumbers || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 10)) {
      return `เลือกเลข 1–10 ได้สูงสุด ${cfg.maxNumbers} ตัว (ไม่ซ้ำกัน)`;
    }
    if (!nums.length) {
      log(state, p.id, `${p.name} ไม่ร่วมลุ้นชิงโชค`, 'info');
    } else {
      nums.sort((a, b) => a - b);
      charge(state, p, cfg.cost * nums.length, { reason: `ซื้อเลขชิงโชค ${nums.join(', ')}` });
      const v = spin(state, p, 'spinToWin');
      if (nums.includes(v)) gain(state, p, cfg.prize, `ถูกรางวัลชิงโชค! วงล้อออกเลข ${v}`);
      else log(state, p.id, `วงล้อออกเลข ${v} — ${p.name} ไม่ถูกรางวัล`, 'bad');
    }
    finishTurn(state);
    return null;
  },

  lawsuit(state, p, value) {
    const ph = state.phase;
    if (!ph.targets.includes(value)) return INVALID;
    const target = state.players[value];
    log(state, p.id, `⚖️ ${p.name} ฟ้อง ${target.name} เรียกค่าเสียหาย ${fm(ph.amount)}`, 'info');
    if (CAREERS[p.career]?.perk !== 'legal') {
      charge(state, p, RULES.lawsuitFee, { category: 'legal', reason: 'ค่าทนายความ' });
    }
    charge(state, target, ph.amount, { to: p.id, reason: `แพ้คดีที่ ${p.name} ฟ้อง` });
    finishTurn(state);
    return null;
  },

  nightSchool(state, p, value) {
    if (!['master', 'switch', 'stay'].includes(value)) return INVALID;
    if (value === 'stay') {
      log(state, p.id, `${p.name} ทำงานเดิมต่อไป`, 'info');
      finishTurn(state);
    } else if (value === 'master') {
      log(state, p.id, `🌙 ${p.name} ลงเรียนปริญญาโทภาคค่ำ`, 'info');
      charge(state, p, RULES.nightSchoolCost, { category: 'education', reason: 'ค่าเรียนปริญญาโท' });
      p.degree = true;
      setPhase(state, { type: 'chooseCareer', reason: 'nightSchool', options: careerOptions(state, p, true) });
    } else {
      log(state, p.id, `${p.name} ตัดสินใจเปลี่ยนงาน`, 'info');
      setPhase(state, { type: 'chooseCareer', reason: 'switch', options: careerOptions(state, p, p.degree) });
    }
    return null;
  },

  retire(state, p, value) {
    if (value !== 'estate' && value !== 'country') return INVALID;
    doRetire(state, p, value);
    finishTurn(state);
    return null;
  },

  cardChoice(state, p, value) {
    const card = CARDS[state.phase.cardId];
    const opt = card?.eff.options.find((o) => o.id === value);
    if (!opt) return INVALID;
    log(state, p.id, `${p.name} เลือก "${opt.label}"`, 'info');
    setPhase(state, { type: 'resolving' });
    if (!applyEffect(state, p, opt.eff, card)) finishTurn(state);
    return null;
  },
};

// ============================================================
// การเดินบนกระดาน
// ============================================================

function moveSteps(state, p, steps) {
  let remaining = steps;
  let path = [];
  const flush = () => {
    if (path.length) emit(state, { type: 'move', playerId: p.id, path });
    path = [];
  };
  while (remaining > 0) {
    const here = SPACES[p.position];
    if (!here.next.length) break;
    let nextId = here.next[0];
    if (here.next.length > 1) {
      if (p.pendingBranch && here.next.includes(p.pendingBranch)) {
        nextId = p.pendingBranch;
        p.pendingBranch = null;
      } else {
        flush();
        setPhase(state, { type: 'choosePath', remaining, from: here.id, options: here.next.map(forkOption) });
        return;
      }
    }
    p.position = nextId;
    path.push(nextId);
    remaining--;
    const space = SPACES[nextId];
    if (space.stop) break; // ช่องหยุด: ต้องหยุดทันทีแม้แต้มยังเหลือ
    if (space.type === 'payday' && remaining > 0) {
      flush();
      payday(state, p, false);
    }
  }
  flush();
  landOn(state, p, SPACES[p.position]);
}

function landOn(state, p, space) {
  const handler = SPACE_HANDLERS[space.type];
  const pending = handler ? handler(state, p, space) : false;
  if (!pending) finishTurn(state);
}

// handler คืน true ถ้าต้องรอผู้เล่นตัดสินใจ (ตั้ง phase ใหม่แล้ว)
const SPACE_HANDLERS = {
  start() {},
  payday(state, p) { payday(state, p, true); },
  collect(state, p, s) { gain(state, p, s.amount, s.label); },
  pay(state, p, s) {
    payBill(state, p, { amount: s.amount, category: s.category, ins: s.insurance, needHouse: s.needHouse, reason: s.label });
  },
  tax(state, p) {
    const amount = roundK(baseSalary(p) * RULES.taxRate);
    if (amount > 0) charge(state, p, amount, { category: 'tax', reason: 'จ่ายภาษีเงินได้' });
  },
  life(state, p, s) { giveLife(state, p, s.count || 1, s.label); },
  lifeBuy(state, p, s) {
    setPhase(state, { type: 'lifeBuy', amount: s.amount, count: s.count || 1, category: s.category, label: s.label });
    return true;
  },
  action(state, p) { return drawCard(state, p); },
  promotion(state, p) { promote(state, p); },
  baby(state, p, s) { haveBaby(state, p, s.count || 1, s.label); },
  pet(state, p, s) { adoptPet(state, p, s.amount || RULES.petCost); },
  marriage(state) {
    setPhase(state, { type: 'marriage' });
    return true;
  },
  graduation(state, p) {
    p.degree = true;
    log(state, p.id, `🎓 ${p.name} เรียนจบได้รับปริญญา!`, 'good');
    setPhase(state, { type: 'chooseCareer', reason: 'graduation', options: careerOptions(state, p, true) });
    return true;
  },
  house(state, p) {
    const options = drawHouses(state, 3);
    if (!options.length) {
      log(state, p.id, 'ไม่มีบ้านเหลือขายในตลาด', 'info');
      return false;
    }
    setPhase(state, { type: 'buyHouse', options });
    return true;
  },
  realEstate(state, p) {
    const options = drawHouses(state, 2);
    if (!options.length && !p.houses.length) {
      log(state, p.id, 'ไม่มีบ้านให้ซื้อขายในตอนนี้', 'info');
      return false;
    }
    setPhase(state, { type: 'realEstate', options });
    return true;
  },
  spinToWin(state, p, s) {
    setPhase(state, { type: 'spinToWin', label: s.label, ...RULES.spinToWin });
    return true;
  },
  compete(state, p, s) { runCompete(state, s.amount, s.label); },
  lawsuit(state, p, s) { return startLawsuit(state, p, s.amount, s.label); },
  gamble(state, p, s) { runGamble(state, p, s.outcomes, s.label); },
  nightSchool(state) {
    setPhase(state, { type: 'nightSchool', cost: RULES.nightSchoolCost });
    return true;
  },
  holiday(state, p, s) { log(state, p.id, `🏖️ ${p.name} ${s.label} พักผ่อนสบาย ๆ`, 'info'); },
  everyonePays(state, p, s) { collectFromEveryone(state, p, s.amount, s.label); },
  retire(state) {
    setPhase(state, { type: 'retire' });
    return true;
  },
};

// ============================================================
// การ์ดและผลของการ์ด
// ============================================================

function drawCard(state, p) {
  if (!state.decks.cards.length) state.decks.cards = shuffle(state, buildCardDeck());
  const card = CARDS[state.decks.cards.pop()];
  p.stats.cards++;
  emit(state, { type: 'card', playerId: p.id, cardId: card.id });
  log(state, p.id, `🃏 ${p.name} จั่วการ์ด "${card.title}"`, 'info');
  return applyEffect(state, p, card.eff, card);
}

// คืน true ถ้าต้องรอผู้เล่นตัดสินใจต่อ
function applyEffect(state, p, eff, card) {
  const title = card?.title || '';
  switch (eff.k) {
    case 'none':
      return false;
    case 'collect':
      gain(state, p, eff.a, title);
      return false;
    case 'pay':
      payBill(state, p, { amount: eff.a, category: eff.c, ins: eff.ins, needHouse: eff.needHouse, reason: title });
      return false;
    case 'life':
      giveLife(state, p, eff.n || 1, title);
      return false;
    case 'promotion':
      promote(state, p);
      return false;
    case 'demotion':
      demote(state, p);
      return false;
    case 'gamble':
      runGamble(state, p, eff.o, title);
      return false;
    case 'everyonePays':
      collectFromEveryone(state, p, eff.a, title);
      return false;
    case 'payEveryone':
      for (const id of state.order) {
        if (id !== p.id) charge(state, p, eff.a, { to: id, reason: title });
      }
      return false;
    case 'extraSpin':
      state.extraSpin = true;
      return false;
    case 'skipTurn':
      p.skipTurns += 1;
      log(state, p.id, `${p.name} ต้องข้ามตาถัดไป`, 'bad');
      return false;
    case 'perChild': {
      if (!p.children) {
        log(state, p.id, `${p.name} ไม่มีลูก จึงไม่มีผลจากการ์ดนี้`, 'info');
      } else if (eff.a > 0) {
        gain(state, p, eff.a * p.children, `${title} (ลูก ${p.children} คน)`);
      } else {
        charge(state, p, -eff.a * p.children, { category: eff.c, reason: `${title} (ลูก ${p.children} คน)` });
      }
      return false;
    }
    case 'perStock': {
      if (!p.stocks.length) {
        log(state, p.id, `${p.name} ไม่มีหุ้น จึงไม่มีผลจากการ์ดนี้`, 'info');
      } else if (eff.a > 0) {
        gain(state, p, eff.a * p.stocks.length, `${title} (หุ้น ${p.stocks.length} ใบ)`);
      } else {
        charge(state, p, -eff.a * p.stocks.length, { reason: `${title} (หุ้น ${p.stocks.length} ใบ)` });
      }
      return false;
    }
    case 'perHouse': {
      if (!p.houses.length) log(state, p.id, `${p.name} ไม่มีบ้าน จึงไม่มีผลจากการ์ดนี้`, 'info');
      else gain(state, p, eff.a * p.houses.length, `${title} (บ้าน ${p.houses.length} หลัง)`);
      return false;
    }
    case 'salaryBonus':
      gain(state, p, roundK(baseSalary(p) * eff.x), title);
      return false;
    case 'pet':
      adoptPet(state, p, eff.a || RULES.petCost);
      return false;
    case 'compete':
      runCompete(state, eff.a, title);
      return false;
    case 'lawsuit':
      return startLawsuit(state, p, eff.a, title);
    case 'loseJob': {
      const old = CAREERS[p.career];
      log(state, p.id, `📦 ${p.name} ถูกเลิกจ้างจากอาชีพ${old ? old.name : ''} ต้องหางานใหม่`, 'bad');
      // หาตัวเลือกก่อนล้างอาชีพเดิม เพื่อไม่ให้สุ่มได้อาชีพเดิมกลับมา
      const options = careerOptions(state, p, p.degree);
      p.career = null;
      setPhase(state, { type: 'chooseCareer', reason: 'layoff', options });
      return true;
    }
    case 'choice':
      setPhase(state, {
        type: 'cardChoice',
        cardId: card.id,
        options: eff.options.map((o) => ({ id: o.id, label: o.label, desc: o.desc })),
      });
      return true;
    case 'multi':
      for (const sub of eff.list) {
        if (applyEffect(state, p, sub, card)) return true;
      }
      return false;
    default:
      return false;
  }
}

// ============================================================
// ระบบย่อย
// ============================================================

function spin(state, p, purpose) {
  const value = randInt(state, 1, 10);
  emit(state, { type: 'spin', playerId: p.id, value, purpose });
  return value;
}

function lookup(table, v) {
  const row = table.find(([min, max]) => v >= min && v <= max);
  return row ? row[2] : 0;
}

export function baseSalary(p) {
  const c = CAREERS[p.career];
  return c ? c.salaries[Math.min(p.salaryLevel, c.salaries.length - 1)] : 0;
}

function payday(state, p, landed) {
  const c = CAREERS[p.career];
  if (!c) {
    log(state, p.id, `${p.name} ยังไม่มีงาน จึงไม่มีเงินเดือน`, 'info');
    return;
  }
  let salary = baseSalary(p);
  if (c.variable) {
    const v = spin(state, p, 'salary');
    salary = roundK((salary * v) / 5);
  }
  let total = salary;
  let reason = c.variable ? 'รายได้จากยอดวิว' : 'เงินเดือนออก';
  if (landed) {
    total += roundK(salary * RULES.paydayLandBonus);
    reason += ' + โบนัส';
  }
  p.stats.paydays++;
  gain(state, p, total, reason);
  if (p.children > 0) charge(state, p, p.children * RULES.childUpkeep, { reason: `ค่าเลี้ยงดูลูก ${p.children} คน` });
}

function payStockHolder(state, value) {
  const ownerId = state.stockOwners[value];
  if (ownerId) gain(state, state.players[ownerId], RULES.stockPayout, `ปันผลหุ้นหมายเลข ${value}`);
}

function gain(state, p, amount, reason) {
  if (!amount || amount <= 0) return;
  p.cash += amount;
  p.stats.earned += amount;
  emit(state, { type: 'money', playerId: p.id, amount, reason });
  log(state, p.id, `${p.name} ${reason} +${fm(amount)}`, 'good');
}

// จ่ายเงิน: ถ้ามีหมวด (category) และมีผู้เล่นอื่นที่อาชีพได้สิทธิ์หมวดนี้ เงินจะไปที่คนนั้น
function charge(state, p, amount, { reason, category = null, to = null } = {}) {
  if (!amount || amount <= 0) return;
  const recipient = to ? state.players[to] : category ? perkHolder(state, category, p.id) : null;
  p.cash -= amount;
  p.stats.spent += amount;
  emit(state, { type: 'money', playerId: p.id, amount: -amount, reason });
  if (recipient) {
    recipient.cash += amount;
    recipient.stats.earned += amount;
    const note = to ? reason : `${reason} — รายได้อาชีพ${CAREERS[recipient.career].name}`;
    emit(state, { type: 'money', playerId: recipient.id, amount, reason: note });
    log(state, p.id, `${p.name} ${reason} -${fm(amount)} → ${recipient.name}${to ? '' : ` (${CAREERS[recipient.career].name})`}`, 'bad');
  } else {
    log(state, p.id, `${p.name} ${reason} -${fm(amount)}`, 'bad');
  }
  ensureCash(state, p);
}

function ensureCash(state, p) {
  if (p.cash >= 0) return;
  const n = Math.ceil(-p.cash / RULES.loanAmount);
  p.loans += n;
  p.cash += n * RULES.loanAmount;
  emit(state, { type: 'loan', playerId: p.id, count: n, auto: true });
  log(state, p.id, `${p.name} เงินไม่พอ ธนาคารให้กู้อัตโนมัติ ${n} สัญญา (${fm(n * RULES.loanAmount)})`, 'bad');
}

function perkHolder(state, category, excludeId) {
  for (const id of state.order) {
    const q = state.players[id];
    if (id !== excludeId && !q.retired && q.career && CAREERS[q.career].perk === category) return q;
  }
  return null;
}

function payBill(state, p, { amount, category, ins, needHouse, reason }) {
  if (needHouse && !p.houses.length) {
    log(state, p.id, `${p.name} ยังไม่มีบ้าน จึงไม่เสียหายจาก "${reason}"`, 'info');
    return;
  }
  if (ins && p.insurance[ins]) {
    emit(state, { type: 'insured', playerId: p.id, kind: ins, amount });
    log(state, p.id, `🛡️ ${INSURANCE[ins].name}ของ ${p.name} จ่ายแทน "${reason}" (${fm(amount)})`, 'good');
    return;
  }
  charge(state, p, amount, { category, reason });
}

function giveLife(state, p, n, reason) {
  for (let i = 0; i < n; i++) {
    if (!state.decks.tiles.length) state.decks.tiles = shuffle(state, RULES.lifeTiles);
    p.lifeTiles.push(state.decks.tiles.pop());
  }
  emit(state, { type: 'life', playerId: p.id, count: n, reason });
  log(state, p.id, `⭐ ${p.name} ได้บัตรความสุข ${n} ใบ (${reason})`, 'good');
}

function promote(state, p) {
  const c = CAREERS[p.career];
  if (!c) return;
  if (p.salaryLevel < c.salaries.length - 1) {
    p.salaryLevel++;
    emit(state, { type: 'career', playerId: p.id, careerId: c.id, level: p.salaryLevel });
    log(state, p.id, `📈 ${p.name} เลื่อนตำแหน่งเป็น${c.titles[p.salaryLevel]} เงินเดือน ${fm(baseSalary(p))}`, 'good');
  } else {
    gain(state, p, RULES.maxLevelBonus, 'ตำแหน่งสูงสุดแล้ว รับโบนัสแทน');
  }
}

function demote(state, p) {
  const c = CAREERS[p.career];
  if (!c) return;
  if (p.salaryLevel > 0) {
    p.salaryLevel--;
    emit(state, { type: 'career', playerId: p.id, careerId: c.id, level: p.salaryLevel });
    log(state, p.id, `📉 ${p.name} ถูกลดตำแหน่งเป็น${c.titles[p.salaryLevel]}`, 'bad');
  } else {
    log(state, p.id, `${p.name} อยู่ตำแหน่งเริ่มต้นแล้ว ไม่ถูกลดตำแหน่ง`, 'info');
  }
}

function haveBaby(state, p, n, label) {
  if (!p.married) {
    log(state, p.id, `${p.name} ยังโสด ช่อง "${label}" จึงไม่มีผล`, 'info');
    return;
  }
  p.children += n;
  emit(state, { type: 'family', playerId: p.id, kind: 'baby', count: n });
  log(state, p.id, `👶 ${p.name} ${label} (ลูกทั้งหมด ${p.children} คน)`, 'good');
  giveLife(state, p, n, 'ลูกน้อยนำความสุขมาให้');
}

function adoptPet(state, p, cost) {
  p.pets++;
  emit(state, { type: 'family', playerId: p.id, kind: 'pet', count: 1 });
  charge(state, p, cost, { category: 'shopping', reason: 'ค่าวัคซีนและของใช้สัตว์เลี้ยง' });
  giveLife(state, p, 1, 'มีสัตว์เลี้ยงแสนรัก');
}

function collectFromEveryone(state, p, amount, reason) {
  for (const id of state.order) {
    if (id !== p.id) charge(state, state.players[id], amount, { to: p.id, reason });
  }
}

function runGamble(state, p, outcomes, label) {
  const v = spin(state, p, 'gamble');
  const row = outcomes.find(([min, max]) => v >= min && v <= max) || [v, v, 0, 'ไม่มีอะไรเกิดขึ้น'];
  const [, , amount, text] = row;
  const what = `${label} (หมุนได้ ${v}): ${text}`;
  if (amount > 0) gain(state, p, amount, what);
  else if (amount < 0) charge(state, p, -amount, { reason: what });
  else log(state, p.id, `${p.name} ${what}`, 'info');
}

function runCompete(state, amount, label) {
  log(state, null, `🏆 ${label}: ผู้เล่นทุกคนหมุนแข่งกัน ชิงรางวัล ${fm(amount)}`, 'info');
  let contenders = state.order.slice();
  for (let round = 0; round < 3 && contenders.length > 1; round++) {
    const rolls = contenders.map((id) => ({ id, v: spin(state, state.players[id], 'compete') }));
    const best = Math.max(...rolls.map((r) => r.v));
    contenders = rolls.filter((r) => r.v === best).map((r) => r.id);
  }
  const share = roundK(amount / contenders.length);
  for (const id of contenders) gain(state, state.players[id], share, `ชนะ${label}`);
}

function startLawsuit(state, p, amount, label) {
  const targets = state.order.filter((id) => id !== p.id);
  if (!targets.length) return false;
  setPhase(state, { type: 'lawsuit', amount, label, targets });
  return true;
}

function drawHouses(state, n) {
  return state.decks.houses.splice(0, n);
}

function purchaseHouse(state, p, houseId) {
  const h = HOUSES[houseId];
  p.houses.push({ id: houseId, price: h.price });
  emit(state, { type: 'house', playerId: p.id, kind: 'buy', houseId });
  charge(state, p, h.price, { reason: `ซื้อ${h.name}` });
}

function sellHouse(state, p, houseId) {
  const idx = p.houses.findIndex((h) => h.id === houseId);
  if (idx < 0) return;
  const h = HOUSES[houseId];
  const v = spin(state, p, 'sellHouse');
  const price = v >= 6 ? h.sellHigh : h.sellLow;
  p.houses.splice(idx, 1);
  p.soldHouses.push({ id: houseId, price });
  state.decks.houses.push(houseId);
  emit(state, { type: 'house', playerId: p.id, kind: 'sell', houseId, amount: price });
  gain(state, p, price, `ขาย${h.name} (หมุนได้ ${v} ${v >= 6 ? 'ได้ราคาสูง' : 'ได้ราคาต่ำ'})`);
  if (!p.houses.length && p.insurance.home) p.insurance.home = false;
}

// เลือกอาชีพมาให้เลือก 3 อาชีพ ไม่ซ้ำกับที่ผู้เล่นคนอื่นมีอยู่
function careerOptions(state, p, degree) {
  const taken = new Set(state.order.map((id) => state.players[id].career).filter(Boolean));
  const free = CAREER_LIST.filter((c) => !taken.has(c.id));
  const preferred = free.filter((c) => (degree ? c.degree : !c.degree));
  let picks = shuffle(state, preferred).slice(0, 3);
  if (picks.length < 3) {
    const extra = free.filter((c) => !picks.includes(c) && (degree || !c.degree));
    picks = picks.concat(shuffle(state, extra).slice(0, 3 - picks.length));
  }
  return picks.map((c) => c.id);
}

function doRetire(state, p, choice) {
  p.retired = true;
  p.retireChoice = choice;
  p.retireRank = ++state.retiredCount;
  emit(state, { type: 'retire', playerId: p.id, choice, rank: p.retireRank });
  log(state, p.id, `🌅 ${p.name} เกษียณเป็นคนที่ ${p.retireRank} เลือกอยู่${choice === 'estate' ? 'คฤหาสน์เศรษฐี' : 'บ้านสวนชนบท'}`, 'good');
  for (const h of p.houses.slice()) sellHouse(state, p, h.id);
  const repayable = Math.min(p.loans, Math.floor(p.cash / RULES.loanRepay));
  if (repayable > 0) {
    p.loans -= repayable;
    p.cash -= repayable * RULES.loanRepay;
    emit(state, { type: 'money', playerId: p.id, amount: -repayable * RULES.loanRepay, reason: 'คืนเงินกู้ตอนเกษียณ' });
    log(state, p.id, `${p.name} คืนเงินกู้ ${repayable} สัญญา (-${fm(repayable * RULES.loanRepay)})`, 'info');
  }
  const bonus = RULES.retireBonusTiles[p.retireRank - 1] || 0;
  if (bonus) giveLife(state, p, bonus, `เกษียณเป็นคนที่ ${p.retireRank}`);
  if (choice === 'country') giveLife(state, p, RULES.countryTiles, 'ชีวิตสงบสุขที่บ้านสวน');
}

// ============================================================
// เทิร์น
// ============================================================

function setPhase(state, phase) {
  state.phase = phase;
  state.seq++;
}

function beginTurn(state) {
  const p = state.players[state.order[state.turnIndex]];
  state.currentPlayerId = p.id;
  state.turn++;
  emit(state, { type: 'turn', playerId: p.id, round: state.round });
  setPhase(state, p.started ? { type: 'spin' } : { type: 'chooseStart' });
}

function finishTurn(state) {
  const p = state.players[state.currentPlayerId];
  if (state.extraSpin && p && !p.retired) {
    state.extraSpin = false;
    log(state, p.id, `🏖️ ${p.name} ได้หมุนอีกครั้ง!`, 'good');
    emit(state, { type: 'extraSpin', playerId: p.id });
    setPhase(state, { type: 'spin' });
    return;
  }
  state.extraSpin = false;
  advanceTurn(state);
}

// ส่งตาให้ผู้เล่นคนถัดไปตามลำดับ ข้ามคนที่เกษียณแล้วหรือโดนข้ามตา
function advanceTurn(state) {
  for (;;) {
    if (state.order.every((id) => state.players[id].retired)) {
      finishGame(state);
      return;
    }
    state.turnIndex = (state.turnIndex + 1) % state.order.length;
    if (state.turnIndex === 0) state.round++;
    const p = state.players[state.order[state.turnIndex]];
    if (p.retired) continue;
    if (p.skipTurns > 0) {
      p.skipTurns--;
      emit(state, { type: 'skip', playerId: p.id });
      log(state, p.id, `⏭️ ${p.name} ข้ามตานี้`, 'bad');
      continue;
    }
    beginTurn(state);
    return;
  }
}

function finishGame(state) {
  state.status = 'finished';
  const net = (p) => p.cash - p.loans * RULES.loanRepay;
  const players = state.order.map((id) => state.players[id]);
  const richest = Math.max(...players.map(net));
  for (const p of players) {
    if (p.retireChoice !== 'estate') continue;
    if (net(p) === richest) giveLife(state, p, RULES.estateTiles, 'เศรษฐีที่รวยที่สุดในคฤหาสน์');
    else log(state, p.id, `${p.name} ไม่ใช่คนที่รวยที่สุด จึงไม่ได้โบนัสคฤหาสน์เศรษฐี`, 'bad');
  }
  const results = players.map((p) => {
    const tilesTotal = p.lifeTiles.reduce((s, v) => s + v, 0);
    const debt = p.loans * RULES.loanRepay;
    return {
      playerId: p.id,
      name: p.name,
      color: p.color,
      cash: p.cash,
      debt,
      tiles: p.lifeTiles.slice(),
      tilesTotal,
      total: p.cash - debt + tilesTotal,
      career: p.career,
      salaryLevel: p.salaryLevel,
      degree: p.degree,
      married: p.married,
      children: p.children,
      pets: p.pets,
      soldHouses: p.soldHouses.slice(),
      retireChoice: p.retireChoice,
      retireRank: p.retireRank,
      stats: { ...p.stats },
    };
  });
  results.sort((a, b) => b.total - a.total);
  results.forEach((r, i) => {
    r.rank = i > 0 && r.total === results[i - 1].total ? results[i - 1].rank : i + 1;
  });
  state.results = results;
  state.currentPlayerId = null;
  setPhase(state, { type: 'gameOver' });
  emit(state, { type: 'gameOver' });
  log(state, null, `🏁 จบเกม! ผู้ชนะคือ ${results[0].name} ด้วยทรัพย์สินรวม ${fm(results[0].total)}`, 'good');
}

// ============================================================
// เครื่องมือสำหรับห้องเกม
// ============================================================

function emit(state, event) {
  state.events.push(event);
}

function log(state, playerId, text, tone = 'info') {
  state.log.push({ id: ++state.logSeq, round: state.round, playerId, text, tone });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function addLog(state, text, tone = 'info', playerId = null) {
  log(state, playerId, text, tone);
}

// ทางหนีไฟ: ถ้าเกิดปัญหาจนไม่มีใครเล่นต่อได้ ให้จบตาปัจจุบันทันที
export function forceEndTurn(state) {
  if (state.status !== 'playing') return [];
  state.events = [];
  const ph = state.phase;
  if ((ph.type === 'buyHouse' || ph.type === 'realEstate') && ph.options) state.decks.houses.push(...ph.options);
  const p = state.players[state.currentPlayerId];
  if (p && !p.career && p.started) p.career = careerOptions(state, p, p.degree)[0] || null;
  log(state, state.currentPlayerId, 'ระบบจบตานี้ให้อัตโนมัติ', 'info');
  state.extraSpin = false;
  advanceTurn(state);
  const events = state.events;
  state.events = [];
  return events;
}

// คำสั่งพื้นฐานที่ใช้ได้เสมอในแต่ละ phase (ใช้เป็นตัวสำรองตอนหมดเวลา)
export function fallbackAction(state) {
  const ph = state.phase;
  const choose = (value) => ({ type: 'choose', value, seq: state.seq });
  switch (ph.type) {
    case 'spin': return { type: 'spin', seq: state.seq };
    case 'chooseStart': return choose('work');
    case 'chooseCareer': return choose(ph.options[0]);
    case 'choosePath': return choose(ph.options[0].id);
    case 'marriage': return choose('single');
    case 'buyHouse': return choose('skip');
    case 'realEstate': return choose({ action: 'skip' });
    case 'lifeBuy': return choose('skip');
    case 'spinToWin': return choose([]);
    case 'lawsuit': return choose(ph.targets[0]);
    case 'nightSchool': return choose('stay');
    case 'retire': return choose('country');
    case 'cardChoice': return choose(ph.options[ph.options.length - 1].id);
    default: return null;
  }
}

// ============================================================
// มุมมองสาธารณะ (ส่งให้ผู้เล่นทุกคน)
// ซ่อนลำดับไพ่ ตัวสุ่ม และมูลค่าบัตรความสุขจนกว่าจะจบเกม
// ============================================================

export function toPublicView(state) {
  const finished = state.status === 'finished';
  return {
    status: state.status,
    round: state.round,
    turn: state.turn,
    seq: state.seq,
    order: state.order.slice(),
    currentPlayerId: state.currentPlayerId,
    phase: JSON.parse(JSON.stringify(state.phase)),
    lastSpin: state.lastSpin ? { ...state.lastSpin } : null,
    stockOwners: { ...state.stockOwners },
    players: state.order.map((id) => publicPlayer(state.players[id], finished)),
    log: state.log.slice(-80).map((l) => ({ ...l })),
    results: finished && state.results ? JSON.parse(JSON.stringify(state.results)) : null,
    housesLeft: state.decks.houses.length,
  };
}

function publicPlayer(p, reveal) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: p.isBot,
    position: p.position,
    started: p.started,
    education: p.education,
    cash: p.cash,
    loans: p.loans,
    career: p.career,
    salaryLevel: p.salaryLevel,
    salary: baseSalary(p),
    degree: p.degree,
    married: p.married,
    children: p.children,
    pets: p.pets,
    houses: p.houses.map((h) => ({ ...h })),
    soldHouses: p.soldHouses.map((h) => ({ ...h })),
    insurance: { ...p.insurance },
    stocks: p.stocks.slice(),
    lifeTileCount: p.lifeTiles.length,
    lifeTiles: reveal ? p.lifeTiles.slice() : null,
    retired: p.retired,
    retireChoice: p.retireChoice,
    retireRank: p.retireRank,
    skipTurns: p.skipTurns,
    stats: { ...p.stats },
  };
}
