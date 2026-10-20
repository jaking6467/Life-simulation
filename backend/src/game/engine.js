// engine.js — กติกาของเกมเส้นทางชีวิต (แนว Walk of Life)
// ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (ออนไลน์) และในเบราว์เซอร์ (โหมดออฟไลน์)
//
// หลักการ:
// - 1 รอบ = 1 สัปดาห์ ผู้เล่นผลัดกันเล่นตามลำดับ ทีละคน คนอื่นต้องรอจนคนก่อนหน้า "จบสัปดาห์"
// - ในตาของตัวเอง มีเวลา 60 ชั่วโมง เดินไปตามอาคารในเมือง (ใช้เวลาตามระยะทาง) แล้วทำกิจกรรม
// - จบสัปดาห์: จ่ายค่าเช่า ร่างกายทรุดโทรมตามเวลา เจอเหตุการณ์สุ่ม แล้วได้คะแนนตามสภาพชีวิต
// - ครบจำนวนสัปดาห์ ใครคะแนนรวมมากที่สุดชนะ
// ทุกครั้งที่สถานะเปลี่ยน state.seq จะเพิ่มขึ้น เพื่อกันคำสั่งที่ส่งมาซ้ำหรือค้างจากหน้าจอเก่า

import { RULES, SCORE_CATEGORIES } from './rules.js';
import { LOCATION_BY_ID, LOCATIONS, HOMES, VEHICLES, VEHICLE_ORDER, ringPath, travelHours } from './city.js';
import { JOBS, JOB_LIST, CLOTHES, JOB_PERKS } from './jobs.js';
import { COURSES, COURSE_LIST } from './courses.js';
import { FURNITURE, FURNITURE_LIST, PETS, STOCKS, STOCK_LIST, ARTIFACTS } from './items.js';
import { ROLES, ROLE_IDS } from './roles.js';
import { GLOBAL_EVENTS, CHOICE_EVENTS, CHOICE_EVENT_BY_ID, WEEKEND_EVENTS } from './events.js';
import { nextRandom, randInt, shuffle } from './rng.js';
import { formatMoney as fm } from './format.js';
import { STAT_NAMES, addPoints, addStats, currentMods, emit, gainCash, log, notify, one, payBill, spend, statText } from './core.js';
import { applyStockImpact, bumpDemand, decayDemand, demandPrice, demandText, stockQuote } from './market.js';
import { applyPendingCards, cardActions } from './cards.js';
import { changeAffection, familyActions, familyPoints, familyWeekly } from './family.js';
import { businessActions, businessCareer, businessWeekly, businessesValue } from './business.js';
import { homeEquity, homeValue, mortgageWeekly, propertyActions, updatePropertyMarket } from './property.js';
import { insuranceActions, insuranceWeekly, insured } from './insurance.js';

// เปลี่ยนเลขนี้ทุกครั้งที่โครงสร้างสถานะเกมเปลี่ยน (ไฟล์เซฟเก่าจะโหลดไม่ได้)
export const STATE_VERSION = 3;
export const BOT_LEVELS = ['easy', 'normal', 'hard'];

const fail = (error) => ({ ok: false, error });
const KEEP_CASH = 2000;
const SENIOR_PENSION = 2500;

// ============================================================
// สร้างเกม
// ============================================================

export function createGame({ players, seed = 1, options = {} }) {
  if (!Array.isArray(players) || players.length < 1) throw new Error('ต้องมีผู้เล่นอย่างน้อย 1 คน');
  const maxWeeks = RULES.weeksOptions.includes(Number(options.weeks)) ? Number(options.weeks) : RULES.defaultWeeks;
  const state = {
    version: STATE_VERSION,
    status: 'playing',
    botLevel: BOT_LEVELS.includes(options.botLevel) ? options.botLevel : 'normal',
    seed: seed >>> 0,
    rng: seed >>> 0,
    seq: 0,
    week: 0,
    maxWeeks,
    turn: 0,
    order: [],
    turnIndex: 0,
    currentPlayerId: null,
    phase: { type: 'starting' },
    players: {},
    global: { eventId: null, closed: null },
    stocks: {},
    demand: {},
    propertyIndex: 1,
    log: [],
    logSeq: 0,
    events: [],
    results: null,
  };
  for (const s of STOCK_LIST) state.stocks[s.id] = { price: s.price, change: 0 };

  // บทบาท: ใช้ที่เลือกไว้ (ห้ามซ้ำ) ที่เหลือสุ่มจากบทบาทที่ยังว่าง
  const taken = new Set();
  const wanted = players.map((p) => (ROLES[p.role] && !taken.has(p.role) ? (taken.add(p.role), p.role) : null));
  const free = shuffle(state, ROLE_IDS.filter((r) => !taken.has(r)));
  players.forEach((p, i) => {
    const role = wanted[i] || free.shift() || ROLE_IDS[i % ROLE_IDS.length];
    state.players[p.id] = createPlayer(p, role);
  });

  state.order = shuffle(state, players.map((p) => p.id));
  log(state, null, `เริ่มเกม ${maxWeeks} สัปดาห์! ลำดับการเล่น: ${state.order.map((id) => state.players[id].name).join(' → ')}`, 'info');
  for (const id of state.order) {
    const p = state.players[id];
    log(state, id, `${p.name} รับบทเป็น${ROLES[p.role].icon} ${ROLES[p.role].name}`, 'info');
  }
  startRound(state);
  state.events = [];
  return state;
}

function createPlayer({ id, name, color, isBot }, role) {
  const p = {
    id,
    name: String(name || 'ผู้เล่น'),
    color: color || '#888888',
    isBot: !!isBot,
    role,
    location: 'flat',
    hoursLeft: RULES.hoursPerWeek,
    hoursMax: RULES.hoursPerWeek,
    cash: RULES.startCash,
    savings: 0,
    loans: 0,
    stocks: {},
    stats: { ...RULES.startStats },
    ate: false,
    starving: false,
    groceries: 0,
    clothes: { ...RULES.startClothes },
    housing: 'flat',
    furniture: [],
    vehicle: null,
    pets: [],
    job: null,
    xp: 0,
    education: { completed: [], enrolled: null, progress: 0 },
    tickets: 0,
    artworks: [],
    finds: [],
    followers: role === 'influencer' ? 200 : 0,
    horoscope: null,
    weekShifts: 0,
    weekActs: {},
    weekMods: {},
    // ความรักและครอบครัว
    love: null,
    kids: [],
    // บ้านของตัวเอง (null = เช่า) และหนี้บ้าน
    owned: null,
    mortgage: null,
    businesses: [],
    insurance: {},
    // การ์ดในมือ การ์ดแกล้งที่รอมีผล และเครื่องรางกันภัย
    cards: [],
    pending: [],
    amulets: 0,
    score: 0,
    bonusPoints: 0,
    questPoints: 0,
    quests: {},
    breakdown: Object.fromEntries(SCORE_CATEGORIES.map((c) => [c.id, 0])),
    lastWeek: null,
    c: {
      shifts: 0, maxShiftsWeek: 0, workouts: 0, healthStreak: 0, artSold: 0, artBest: 0,
      findsSold: 0, artifactKinds: [], merits: 0, horoscopeHits: 0, lotteryWins: 0, happyWeek: false,
      netWorthBest: 0, wasTrainer: false, ateFastThisWeek: false, ticketsWeek: 0, streams: 0, paintings: 0,
      dates: 0, partners: 0, married: false, breakups: 0, manages: 0, bizProfit: 0, gifts: 0, pranks: 0, pranked: 0,
      displaced: 0, takeovers: 0,
    },
    totals: { earned: 0, spent: 0 },
  };
  if (role === 'fitness') p.stats.health = 100;
  if (role === 'senior') p.savings = 15000;
  return p;
}

// ============================================================
// คำสั่งจากผู้เล่น
// ============================================================

export function performAction(state, playerId, action) {
  if (!action || typeof action.type !== 'string') return fail('คำสั่งไม่ถูกต้อง');
  if (state.status !== 'playing') return fail('เกมจบแล้ว');
  if (playerId !== state.currentPlayerId) return fail('ยังไม่ถึงตาของคุณ');
  if (action.seq != null && action.seq !== state.seq) return fail('สถานะเกมเปลี่ยนไปแล้ว ลองใหม่อีกครั้ง');
  const handler = COMMANDS[action.type];
  if (!handler) return fail('ไม่รู้จักคำสั่งนี้');
  const p = state.players[playerId];
  state.events = [];
  // ตัวจัดการทุกตัวตรวจสอบก่อนแก้ไขสถานะ ถ้าคืนข้อความ error แปลว่ายังไม่ได้แก้อะไร
  const error = handler(state, p, action);
  const events = state.events;
  state.events = [];
  if (error) return fail(error);
  state.seq++;
  return { ok: true, events };
}

const COMMANDS = {
  move(state, p, a) {
    if (state.phase.type !== 'week') return 'ตอนนี้ยังเดินไม่ได้';
    const to = a.to;
    if (!LOCATION_BY_ID[to]) return 'ไม่มีสถานที่นี้';
    if (to === p.location) return 'คุณอยู่ที่นี่แล้ว';
    if (state.global.closed === to) return `${LOCATION_BY_ID[to].name} ปิดชั่วคราวสัปดาห์นี้`;
    const hours = moveHours(state, p, to);
    if (hours > p.hoursLeft) return `เวลาไม่พอเดินทาง (ต้องใช้ ${hours} ชม. เหลือ ${p.hoursLeft} ชม.)`;
    const path = ringPath(p.location, to);
    p.location = to;
    p.hoursLeft -= hours;
    emit(state, { type: 'move', playerId: p.id, path, hours });
    if (p.role === 'mystic' && p.horoscope?.unlucky === to && !p.horoscope.unluckyHit) {
      p.horoscope.unluckyHit = true;
      addStats(state, p, { happiness: -5 });
      log(state, p.id, `🔮 ${p.name} มาที่${LOCATION_BY_ID[to].name} ซึ่งดวงบอกว่าเป็นที่อัปมงคล ความสุข -5`, 'bad');
    }
    if (p.hoursLeft <= 0) endWeek(state, p);
    return null;
  },

  act(state, p, a) {
    if (state.phase.type !== 'week') return 'ตอนนี้ยังทำกิจกรรมไม่ได้';
    const def = ACTION_BY_ID[a.action];
    if (!def) return 'ไม่มีกิจกรรมนี้';
    if (!isAt(state, p, def)) return 'ทำกิจกรรมนี้ที่นี่ไม่ได้';
    const variant = findVariant(state, p, def, a.params || {});
    if (!variant) return 'ตัวเลือกไม่ถูกต้อง';
    const reason = checkVariant(state, p, def, variant);
    if (reason) return reason;
    p.hoursLeft -= variant.hours;
    if (variant.cost > 0) spend(state, p, variant.cost);
    p.weekActs[def.id] = (p.weekActs[def.id] || 0) + 1;
    const boost = variant.hours > 0 ? luckyBoost(state, p) : 1;
    const text = def.run(state, p, variant.params, { hours: variant.hours, boost }) || variant.label;
    emit(state, { type: 'action', playerId: p.id, action: def.id, location: p.location, text, hours: variant.hours });
    checkQuests(state, p);
    if (checkCollapse(state, p)) return null;
    if (p.hoursLeft <= 0) endWeek(state, p);
    return null;
  },

  choose(state, p, a) {
    const ph = state.phase;
    if (ph.type !== 'choice') return 'ตอนนี้ไม่มีเรื่องให้ตัดสินใจ';
    const ev = CHOICE_EVENT_BY_ID[ph.eventId];
    const opt = ev?.options.find((o) => o.id === a.value);
    if (!opt) return 'ตัวเลือกไม่ถูกต้อง';
    log(state, p.id, `${ev.icon} ${p.name}: ${ev.name} → ${opt.label}`, 'info');
    applyEffect(state, p, opt.eff, ev.name);
    state.phase = { type: 'week' };
    checkQuests(state, p);
    if (!checkCollapse(state, p) && p.hoursLeft <= 0) endWeek(state, p);
    return null;
  },

  endTurn(state, p) {
    if (state.phase.type === 'choice') return 'ต้องตัดสินใจเรื่องนี้ก่อน';
    if (state.phase.type !== 'week') return 'ตอนนี้จบสัปดาห์ไม่ได้';
    endWeek(state, p);
    return null;
  },
};

// ============================================================
// กิจกรรมในแต่ละสถานที่
// ============================================================
// at: รายการสถานที่ | 'home' (ที่พักของตัวเอง) | 'job' (ที่ทำงานของตัวเอง)
// variants(state, p): ตัวเลือกย่อย [{ params, label, desc, hours, cost }]
// check(state, p, params): คืนเหตุผลถ้าทำไม่ได้
// run(state, p, params, { hours, boost }): ทำกิจกรรม คืนข้อความสรุป

const priceMod = (state, kind) => {
  const mods = currentMods(state);
  if (kind === 'entertainment') return mods.entertainmentPrice || 1;
  if (kind === 'shop') return mods.shopPrice || 1;
  return 1;
};

const ACTION_DEFS = [
  // ---------- งาน ----------
  {
    id: 'work', icon: '💼', group: 'งาน', at: 'job',
    variants: (state, p) => {
      const job = JOBS[p.job];
      const hours = Math.min(RULES.shiftHours, p.hoursLeft);
      return one({ label: `ทำงาน: ${job.title}`, desc: `${fm(job.wage)}/ชม. (${hours} ชม. ≈ ${fm(estimatePay(state, p, hours))})`, hours });
    },
    check: (state, p, v) => {
      if (v.hours < RULES.minShiftHours) return `ต้องมีเวลาอย่างน้อย ${RULES.minShiftHours} ชม.`;
      return workBlocker(p, JOBS[p.job]);
    },
    run: (state, p, params, { hours, boost }) => doWork(state, p, hours, boost),
  },

  // ---------- ที่พัก ----------
  {
    id: 'rest', icon: '😴', group: 'ที่พัก', at: 'home',
    variants: (state, p) => one({ label: 'นอนพักผ่อน', desc: 'สุขภาพและความสุขเพิ่มขึ้น', hours: Math.min(6, p.hoursLeft) }),
    check: (state, p, v) => (v.hours < 1 ? 'เวลาไม่พอ' : null),
    run: (state, p, params, { hours, boost }) => {
      const f = hours / 6;
      const bed = p.furniture.includes('bed') ? 3 : 0;
      const home = HOMES[p.housing];
      const d = addStats(state, p, { health: Math.round((6 + bed) * f), happiness: Math.round((5 + home.restBonus) * f) }, boost);
      return `นอนพักผ่อน ${hours} ชม. (${statText(d)})`;
    },
  },
  {
    id: 'shower', icon: '🚿', group: 'ที่พัก', at: 'home',
    variants: () => one({ label: 'อาบน้ำแต่งตัว', desc: 'ความสะอาดเต็ม 100', hours: 1 }),
    check: (state, p) => (p.stats.hygiene >= 100 ? 'สะอาดเต็มที่แล้ว' : null),
    run: (state, p) => {
      p.stats.hygiene = 100;
      return 'อาบน้ำ สะอาดสดชื่น (ความสะอาด 100)';
    },
  },
  {
    id: 'cook', icon: '🍳', group: 'ที่พัก', at: 'home',
    variants: (state, p) => one({ label: 'ทำอาหารกินเอง', desc: `ใช้ของสด 1 มื้อ (มี ${p.groceries}) สุขภาพ +4`, hours: 1 }),
    check: (state, p) => (p.groceries < 1 ? 'ไม่มีของสดในบ้าน (ซื้อที่ซูเปอร์มาร์เก็ต)' : null),
    run: (state, p, params, { boost }) => {
      p.groceries--;
      p.ate = true;
      const d = addStats(state, p, { health: 4, happiness: 1 }, boost);
      return `ทำอาหารกินเอง อิ่มอร่อย (${statText(d)})`;
    },
  },
  {
    id: 'studyOnline', icon: '🖥️', group: 'ที่พัก', at: 'home',
    variants: (state, p) => one({ label: 'เรียนออนไลน์', desc: courseProgressText(p), hours: classHours(p) }),
    check: (state, p) => {
      if (!p.furniture.includes('computer')) return 'ต้องมีคอมพิวเตอร์';
      return studyBlocker(p);
    },
    run: (state, p) => attendClass(state, p, true),
  },
  {
    id: 'paint', icon: '🎨', group: 'บทบาทพิเศษ', at: 'home', role: 'artist',
    variants: () => one({ label: 'วาดภาพ', desc: 'สร้างผลงานศิลปะไว้ขายที่ตลาดนัด ยิ่งมีความสุขยิ่งมีราคา', hours: 6 }),
    check: (state, p) => (p.stats.happiness < RULES.minHappinessToWork ? 'หมดแรงบันดาลใจ (ความสุขต่ำเกินไป)' : null),
    run: (state, p, params, { boost }) => {
      const base = p.stats.happiness * 13 + (p.education.completed.includes('arts') ? 1500 : 0) + randInt(state, 200, 1000);
      const value = Math.round((base * boost) / 100) * 100;
      p.c.paintings++;
      const title = ART_TITLES[(p.c.paintings - 1) % ART_TITLES.length];
      p.artworks.push({ id: `art${p.c.paintings}`, title, value });
      addStats(state, p, { happiness: 4 });
      return `วาดภาพ "${title}" เสร็จ ประเมินราคา ${fm(value)}`;
    },
  },
  {
    id: 'stream', icon: '📱', group: 'บทบาทพิเศษ', at: 'home', role: 'influencer',
    variants: (state, p) => one({ label: 'ไลฟ์สด', desc: `ผู้ติดตาม ${p.followers.toLocaleString('en-US')} คน`, hours: 4 }),
    check: (state, p) => (p.stats.hygiene < RULES.minHygieneToWork ? 'สภาพไม่พร้อมออกกล้อง (ความสะอาดต่ำเกินไป)' : null),
    run: (state, p, params, { boost }) => {
      const decor = decorScore(p);
      const quality = ((p.stats.hygiene + p.stats.happiness) / 200) * (p.furniture.includes('computer') ? 1.3 : 1) * (1 + decor / 20);
      // ผู้ติดตามเพิ่มแบบเกือบเป็นเส้นตรง (มีส่วนที่ทบต้นนิดหน่อย) ไม่ให้พุ่งแบบทวีคูณ
      const growth = Math.round(((300 + 600 * quality) * (0.75 + nextRandom(state) * 0.5) + p.followers * 0.03) * boost);
      p.followers += growth;
      const income = Math.round((200 + p.followers * 0.04) / 10) * 10;
      gainCash(state, p, income);
      p.c.streams++;
      addStats(state, p, { happiness: 3, hygiene: -5 });
      return `ไลฟ์สด ผู้ติดตาม +${growth.toLocaleString('en-US')} ได้เงินสนับสนุน ${fm(income)}`;
    },
  },
  {
    id: 'moveIn', icon: '📦', group: 'ที่พัก', at: ['flat', 'condo'],
    variants: (state, p) => {
      const home = HOMES[p.location];
      if (p.owned === home.id) return one({ label: `ย้ายกลับบ้านของตัวเอง (${home.name})`, desc: `ไม่ต้องจ่ายค่าเช่า วางของได้ ${home.slots} ชิ้น`, hours: 1, cost: 0 });
      return one({ label: `เช่า${home.name}`, desc: `ค่าเช่า ${fm(home.rent)}/สัปดาห์ (จ่ายล่วงหน้า 1 สัปดาห์) วางของได้ ${home.slots} ชิ้น`, hours: 1, cost: home.rent });
    },
    check: (state, p) => {
      if (p.housing === p.location) return 'คุณอยู่ที่นี่อยู่แล้ว';
      if (p.furniture.length > HOMES[p.location].slots) return `ของในบ้านเยอะเกิน ${HOMES[p.location].slots} ชิ้น`;
      return null;
    },
    run: (state, p) => {
      p.housing = p.location;
      p.rentPrepaid = p.owned !== p.location;
      return `ย้ายเข้า${HOMES[p.housing].name}เรียบร้อย`;
    },
  },

  // ---------- อาหาร ----------
  {
    id: 'eatFast', icon: '🍗', group: 'อาหาร', at: ['cluckers'],
    variants: () => one({ label: 'กินไก่ทอดชุดใหญ่', desc: 'อิ่มทั้งสัปดาห์ สุขภาพ -2 ความสุข +3', hours: 1, cost: 120 }),
    run: (state, p) => {
      p.ate = true;
      p.c.ateFastThisWeek = true;
      const d = addStats(state, p, { health: -2, happiness: 3 });
      return `กินไก่ทอดอิ่มแปล้ (${statText(d)})`;
    },
  },
  {
    id: 'dine', icon: '🍜', group: 'อาหาร', at: ['restaurant'],
    variants: () => one({ label: 'ทานอาหารริมน้ำ', desc: 'อิ่มทั้งสัปดาห์ สุขภาพ +4 ความสุข +8', hours: 2, cost: 450 }),
    run: (state, p, params, { boost }) => {
      p.ate = true;
      const d = addStats(state, p, { health: 4, happiness: 8 }, boost);
      return `ทานมื้อพิเศษ (${statText(d)})`;
    },
  },
  {
    id: 'buyGroceries', icon: '🥬', group: 'ซื้อของ', at: ['market'],
    variants: (state, p) => one({ label: 'ซื้อของสด 2 มื้อ', desc: `ไปทำกินที่บ้าน (เก็บได้สูงสุด ${groceryCap(p)} มื้อ, มี ${p.groceries})`, hours: 0, cost: 400 }),
    check: (state, p) => (p.groceries + 2 > groceryCap(p) ? 'เก็บของสดได้ไม่หมด (ซื้อตู้เย็นเพื่อเก็บเพิ่ม)' : null),
    run: (state, p) => {
      p.groceries += 2;
      return `ซื้อของสด 2 มื้อ (มี ${p.groceries} มื้อ)`;
    },
  },
  {
    id: 'buyLottery', icon: '🎟️', group: 'ซื้อของ', at: ['market'],
    variants: () => [1, 5].map((n) => ({ params: { n }, label: `ซื้อลอตเตอรี่ ${n} ใบ`, desc: `ออกรางวัลทุก ${RULES.lottery.every} สัปดาห์ รางวัลที่ 1 ${fm(RULES.lottery.prizes[0].amount)}`, hours: 0, cost: RULES.lottery.price * n })),
    check: (state, p, v) => (p.c.ticketsWeek + v.params.n > RULES.lottery.maxPerWeek ? `ซื้อได้สูงสุด ${RULES.lottery.maxPerWeek} ใบต่อสัปดาห์` : null),
    run: (state, p, { n }) => {
      p.tickets += n;
      p.c.ticketsWeek += n;
      return `ซื้อลอตเตอรี่ ${n} ใบ (ถืออยู่ ${p.tickets} ใบ)`;
    },
  },

  // ---------- งานและการเรียน ----------
  {
    id: 'apply', icon: '📝', group: 'สมัครงาน', at: ['jobs'],
    variants: (state, p) =>
      JOB_LIST.filter((j) => j.id !== p.job)
        .sort((a, b) => a.tier - b.tier || a.wage - b.wage)
        .map((j) => ({
          params: { jobId: j.id },
          label: `${jobFull(state, j, p) ? '⚔️ ชิงตำแหน่ง ' : ''}${j.title} @ ${LOCATION_BY_ID[j.location].name}`,
          desc: `${fm(j.wage)}/ชม. • ระดับ ${j.tier} • ${reqText(j)}${slotText(state, j, p)}${JOB_PERKS[j.location] ? ` • สวัสดิการ: ${JOB_PERKS[j.location]}` : ''}`,
          hours: 1,
          cost: 0,
        })),
    check: (state, p, v) => jobBlocker(p, JOBS[v.params.jobId]) || slotBlocker(state, p, JOBS[v.params.jobId]),
    run: (state, p, { jobId }) => {
      const job = JOBS[jobId];
      const old = JOBS[p.job];
      const rival = jobFull(state, job, p) ? weakestHolder(state, job, p) : null;
      p.job = jobId;
      if (jobId === 'trainer') p.c.wasTrainer = true;
      if (rival) displace(state, rival, job, p);
      log(state, p.id, `📝 ${p.name} ได้งานใหม่: ${job.title} (${fm(job.wage)}/ชม.)${old ? ` แทน${old.title}` : ''}`, 'good');
      return `ได้งาน${job.title}!${rival ? ` (ชิงตำแหน่งจาก ${rival.name})` : ''} ไปทำงานได้ที่${LOCATION_BY_ID[job.location].name}`;
    },
  },
  {
    id: 'enroll', icon: '🖊️', group: 'ลงทะเบียนเรียน', at: ['uni'],
    variants: (state, p) =>
      COURSE_LIST.filter((c) => !p.education.completed.includes(c.id) && p.education.enrolled !== c.id).map((c) => ({
        params: { courseId: c.id },
        label: `${c.icon} ${c.name}`,
        desc: `${c.sessions} คาบ • วุฒิระดับ ${c.level}${c.prereq ? ` • ต้องจบ${COURSES[c.prereq].name}` : ''}`,
        hours: 0,
        cost: courseFee(p, c),
      })),
    check: (state, p, v) => {
      const c = COURSES[v.params.courseId];
      if (p.education.enrolled) return `กำลังเรียน${COURSES[p.education.enrolled].name}อยู่ (เรียนได้ทีละหลักสูตร)`;
      if (c.prereq && !p.education.completed.includes(c.prereq)) return `ต้องเรียนจบ${COURSES[c.prereq].name}ก่อน`;
      return null;
    },
    run: (state, p, { courseId }) => {
      p.education.enrolled = courseId;
      p.education.progress = 0;
      log(state, p.id, `🖊️ ${p.name} ลงทะเบียนเรียน${COURSES[courseId].name}`, 'info');
      return `ลงทะเบียน${COURSES[courseId].name} (${COURSES[courseId].sessions} คาบ)`;
    },
  },
  {
    id: 'attend', icon: '📖', group: 'เรียน', at: ['uni'],
    variants: (state, p) => one({ label: 'เข้าเรียน', desc: courseProgressText(p), hours: classHours(p) }),
    check: (state, p) => studyBlocker(p),
    run: (state, p) => attendClass(state, p, false),
  },

  // ---------- ธนาคาร ----------
  ...['deposit', 'withdraw'].map((kind) => ({
    id: kind, icon: kind === 'deposit' ? '📥' : '📤', group: 'ธนาคาร', at: ['bank'],
    variants: (state, p) =>
      (kind === 'deposit' ? [1000, 5000, 'keep', 'all'] : [1000, 5000, 'all']).map((amt) => ({
        params: { amount: amt },
        label: `${kind === 'deposit' ? 'ฝาก' : 'ถอน'} ${amt === 'all' ? 'ทั้งหมด' : amt === 'keep' ? `ทั้งหมด เหลือติดตัว ${fm(KEEP_CASH)}` : fm(amt)}`,
        desc: kind === 'deposit' ? `ดอกเบี้ย ${Math.round(RULES.savingsInterest * 100)}%/สัปดาห์ ปลอดภัยจากขโมย` : `เงินฝาก ${fm(p.savings)}`,
        hours: 0,
        cost: 0,
      })),
    check: (state, p, v) => {
      const pool = kind === 'deposit' ? p.cash : p.savings;
      const amt = bankAmount(v.params.amount, pool);
      if (amt <= 0 || pool < amt) return kind === 'deposit' ? 'เงินสดไม่พอ' : 'เงินฝากไม่พอ';
      return null;
    },
    run: (state, p, { amount }) => {
      const pool = kind === 'deposit' ? p.cash : p.savings;
      const amt = bankAmount(amount, pool);
      if (kind === 'deposit') {
        p.cash -= amt;
        p.savings += amt;
      } else {
        p.savings -= amt;
        p.cash += amt;
      }
      return `${kind === 'deposit' ? 'ฝาก' : 'ถอน'}เงิน ${fm(amt)} (เงินฝาก ${fm(p.savings)})`;
    },
  })),
  {
    id: 'takeLoan', icon: '🏦', group: 'ธนาคาร', at: ['bank'],
    variants: () => one({ label: `กู้เงิน ${fm(RULES.loan.amount)}`, desc: `คืน ${fm(RULES.loan.repay)} (หนี้ที่เหลือหักตอนจบเกม)`, hours: 0 }),
    check: (state, p) => (p.loans >= RULES.loan.max ? `กู้ได้สูงสุด ${RULES.loan.max} สัญญา` : null),
    run: (state, p) => {
      p.loans++;
      p.cash += RULES.loan.amount;
      return `กู้เงิน ${fm(RULES.loan.amount)} (หนี้ ${p.loans} สัญญา)`;
    },
  },
  {
    id: 'repayLoan', icon: '✅', group: 'ธนาคาร', at: ['bank'],
    variants: () => one({ label: `คืนเงินกู้ 1 สัญญา`, desc: `จ่าย ${fm(RULES.loan.repay)}`, hours: 0, cost: RULES.loan.repay }),
    check: (state, p) => (p.loans < 1 ? 'ไม่มีหนี้' : null),
    run: (state, p) => {
      p.loans--;
      return `คืนเงินกู้ 1 สัญญา (เหลือ ${p.loans})`;
    },
  },
  {
    id: 'buyStock', icon: '📈', group: 'หุ้นและทองคำ', at: ['bank'],
    variants: (state) =>
      STOCK_LIST.flatMap((s) => {
        const sizes = s.id === 'GOLD' ? [1, 5] : [10, 50];
        return sizes.map((n) => {
          const q = stockQuote(state, s.id, n, 'buy');
          return { params: { symbol: s.id, n }, label: `ซื้อ ${s.icon} ${s.name} ${n} หน่วย`, desc: `ราคา ${fm(state.stocks[s.id].price)}/หน่วย • แรงซื้อดันราคา +${pct(q.impact)} • ค่าธรรมเนียม ${pct(RULES.market.stockFee)}`, hours: 0, cost: q.total };
        });
      }),
    run: (state, p, { symbol, n }) => {
      applyStockImpact(state, symbol, stockQuote(state, symbol, n, 'buy'));
      p.stocks[symbol] = (p.stocks[symbol] || 0) + n;
      return `ซื้อ ${STOCKS[symbol].name} ${n} หน่วย (ถือ ${p.stocks[symbol]}) ราคาขยับเป็น ${fm(state.stocks[symbol].price)}`;
    },
  },
  {
    id: 'sellStock', icon: '💱', group: 'หุ้นและทองคำ', at: ['bank'],
    variants: (state, p) =>
      Object.entries(p.stocks)
        .filter(([, n]) => n > 0)
        .map(([sym, n]) => {
          const q = stockQuote(state, sym, n, 'sell');
          return { params: { symbol: sym }, label: `ขาย ${STOCKS[sym].icon} ${STOCKS[sym].name} ทั้งหมด ${n} หน่วย`, desc: `ได้ประมาณ ${fm(q.total)} (แรงขายกดราคา -${pct(q.impact)})`, hours: 0, cost: 0 };
        }),
    run: (state, p, { symbol }) => {
      const n = p.stocks[symbol];
      const q = stockQuote(state, symbol, n, 'sell');
      applyStockImpact(state, symbol, q);
      delete p.stocks[symbol];
      gainCash(state, p, q.total);
      return `ขาย ${STOCKS[symbol].name} ${n} หน่วย ได้ ${fm(q.total)}`;
    },
  },

  // ---------- ซื้อของ ----------
  {
    id: 'buyClothes', icon: '👕', group: 'เสื้อผ้า', at: ['mall'],
    variants: (state) =>
      CLOTHES.filter((c) => c.tier > 0).map((c) => ({ params: { tier: c.tier }, label: `${c.icon} ${c.name}`, desc: `ใส่ได้ ${c.weeks} สัปดาห์${demandText(state, `clothes:${c.tier}`)}`, hours: 0, cost: shopPrice(state, `clothes:${c.tier}`, c.price) })),
    run: (state, p, { tier }) => {
      const c = CLOTHES[tier];
      bumpDemand(state, `clothes:${tier}`);
      p.clothes = { tier, weeksLeft: c.weeks };
      return `ซื้อ${c.name} (ใส่ได้ ${c.weeks} สัปดาห์)`;
    },
  },
  {
    id: 'buyFurniture', icon: '🛋️', group: 'แต่งบ้าน', at: ['furniture'],
    variants: (state, p) =>
      FURNITURE_LIST.filter((f) => !p.furniture.includes(f.id)).map((f) => ({ params: { itemId: f.id }, label: `${f.icon} ${f.name}`, desc: `${furnitureText(f)}${demandText(state, `furniture:${f.id}`)}`, hours: 0, cost: shopPrice(state, `furniture:${f.id}`, f.price) })),
    check: (state, p) => (p.furniture.length >= HOMES[p.housing].slots ? `บ้านเต็มแล้ว (${HOMES[p.housing].slots} ชิ้น) ย้ายไปคอนโดเพื่อวางของเพิ่ม` : null),
    run: (state, p, { itemId }) => {
      bumpDemand(state, `furniture:${itemId}`);
      p.furniture.push(itemId);
      log(state, p.id, `🛋️ ${p.name} ซื้อ${FURNITURE[itemId].name}เข้าบ้าน`, 'info');
      return `ซื้อ${FURNITURE[itemId].name} ส่งถึงบ้านแล้ว`;
    },
  },
  {
    id: 'buyVehicle', icon: '🛵', group: 'พาหนะ', at: ['vehicles'],
    variants: (state, p) => {
      const current = p.vehicle ? VEHICLE_ORDER.indexOf(p.vehicle) : -1;
      const tradeIn = p.vehicle ? Math.round(VEHICLES[p.vehicle].price * 0.5) : 0;
      return VEHICLE_ORDER.slice(current + 1).map((id) => {
        const v = VEHICLES[id];
        return { params: { vehicle: id }, label: `${v.icon} ${v.name}`, desc: `เดินทางเร็วขึ้น (เวลา ×${v.factor})${tradeIn ? ` • หักราคาเทิร์นรถเดิม ${fm(tradeIn)}` : ''}${demandText(state, `vehicle:${id}`)}`, hours: 0, cost: demandPrice(state, `vehicle:${id}`, v.price) - tradeIn };
      });
    },
    run: (state, p, { vehicle }) => {
      bumpDemand(state, `vehicle:${vehicle}`);
      p.vehicle = vehicle;
      log(state, p.id, `${VEHICLES[vehicle].icon} ${p.name} ถอย${VEHICLES[vehicle].name}ป้ายแดง!`, 'good');
      return `ได้${VEHICLES[vehicle].name}แล้ว เดินทางเร็วขึ้น`;
    },
  },

  // ---------- คลายเครียด / สุขภาพ ----------
  {
    id: 'playArcade', icon: '🕹️', group: 'บันเทิง', at: ['arcade'],
    variants: (state) => one({ label: 'เล่นตู้เกม', desc: `ความสุข +${Math.round(10 * entMul(state))}`, hours: 2, cost: Math.round(200 * priceMod(state, 'entertainment')) }),
    run: (state, p, params, { boost }) => `เล่นเกมสนุกสุดเหวี่ยง (${statText(addStats(state, p, { happiness: Math.round(10 * entMul(state)) }, boost))})`,
  },
  {
    id: 'watchMovie', icon: '🎬', group: 'บันเทิง', at: ['arcade'],
    variants: (state) => one({ label: 'ดูหนังรอบพิเศษ', desc: `ความสุข +${Math.round(14 * entMul(state))}`, hours: 3, cost: Math.round(300 * priceMod(state, 'entertainment')) }),
    run: (state, p, params, { boost }) => `ดูหนังฟอร์มยักษ์ (${statText(addStats(state, p, { happiness: Math.round(14 * entMul(state)) }, boost))})`,
  },
  {
    id: 'workout', icon: '🏋️', group: 'ออกกำลังกาย', at: ['gym'],
    variants: (state, p) => one({ label: 'ออกกำลังกาย', desc: `สุขภาพ +${p.role === 'fitness' ? 24 : 12} แต่ความสะอาด -15`, hours: 3, cost: 150 }),
    run: (state, p, params, { boost }) => {
      const fit = p.role === 'fitness';
      p.c.workouts++;
      const d = addStats(state, p, { health: fit ? 24 : 12, happiness: fit ? 6 : 3, hygiene: -15 }, boost);
      return `ออกกำลังกายเหงื่อท่วม (${statText(d)})`;
    },
  },
  {
    id: 'gymShower', icon: '🚿', group: 'ออกกำลังกาย', at: ['gym'],
    variants: () => one({ label: 'อาบน้ำที่ฟิตเนส', desc: 'ความสะอาดเต็ม 100', hours: 1, cost: 50 }),
    check: (state, p) => (p.stats.hygiene >= 100 ? 'สะอาดเต็มที่แล้ว' : null),
    run: (state, p) => {
      p.stats.hygiene = 100;
      return 'อาบน้ำ สะอาดสดชื่น (ความสะอาด 100)';
    },
  },
  {
    id: 'checkup', icon: '🩺', group: 'รักษาพยาบาล', at: ['hospital'],
    variants: (state, p) => one({ label: 'พบแพทย์และรักษาตัว', desc: `สุขภาพ +30${insured(p, 'health') ? ' (ประกันสุขภาพลด 50%)' : ''}`, hours: 2, cost: insured(p, 'health') ? 750 : 1500 }),
    check: (state, p) => (p.stats.health >= 100 ? 'สุขภาพแข็งแรงดีแล้ว' : null),
    run: (state, p, params, { boost }) => `รักษาตัว (${statText(addStats(state, p, { health: 30 }, boost))})`,
  },
  {
    id: 'merit', icon: '🙏', group: 'วัด', at: ['temple'],
    variants: () => one({ label: 'ทำบุญถวายสังฆทาน', desc: 'ความสุข +6', hours: 1, cost: 100 }),
    run: (state, p, params, { boost }) => {
      p.c.merits++;
      if (p.role === 'mystic' && p.c.merits <= 10) {
        p.bonusPoints += 1;
        p.score += 1;
      }
      return `ทำบุญ อิ่มใจ (${statText(addStats(state, p, { happiness: 6 }, boost))})`;
    },
  },
  {
    id: 'meditate', icon: '🧘', group: 'วัด', at: ['temple'],
    variants: () => one({ label: 'นั่งสมาธิ', desc: 'ความสุข +4 สุขภาพ +2 (ฟรี)', hours: 2 }),
    run: (state, p, params, { boost }) => `นั่งสมาธิ จิตใจสงบ (${statText(addStats(state, p, { happiness: 4, health: 2 }, boost))})`,
  },
  {
    id: 'walkPark', icon: '🌳', group: 'สวน', at: ['park'],
    variants: () => one({ label: 'เดินเล่นในสวน', desc: 'ความสุข +5 สุขภาพ +3 (ฟรี)', hours: 2 }),
    run: (state, p, params, { boost }) => `เดินเล่นรับลม (${statText(addStats(state, p, { happiness: 5, health: 3 }, boost))})`,
  },
  {
    id: 'jog', icon: '🏃', group: 'สวน', at: ['park'],
    variants: () => one({ label: 'วิ่งจ๊อกกิ้ง', desc: 'สุขภาพ +7 ความสะอาด -10 (ฟรี)', hours: 2 }),
    run: (state, p, params, { boost }) => `วิ่งรอบสวน (${statText(addStats(state, p, { health: 7, hygiene: -10 }, boost))})`,
  },
  {
    id: 'adoptPet', icon: '🐾', group: 'สัตว์เลี้ยง', at: ['park'],
    variants: (state, p) =>
      Object.values(PETS)
        .filter((pet) => !p.pets.includes(pet.id))
        .map((pet) => ({ params: { pet: pet.id }, label: `${pet.icon} รับเลี้ยง${pet.name}`, desc: `ความสุข +${pet.happiness}/สัปดาห์ • ${pet.note} • ค่าอาหาร ${fm(RULES.petFood)}/สัปดาห์`, hours: 0, cost: pet.price })),
    run: (state, p, { pet }) => {
      p.pets.push(pet);
      log(state, p.id, `${PETS[pet].icon} ${p.name} รับเลี้ยง${PETS[pet].name}`, 'good');
      return `รับเลี้ยง${PETS[pet].name}แล้ว น่ารักมาก!`;
    },
  },
  {
    id: 'scavenge', icon: '🧺', group: 'บทบาทพิเศษ', at: ['park'], role: 'scavenger',
    variants: () => one({ label: 'คุ้ยหาของมีค่า', desc: 'ลุ้นเจอของเก่าและวัตถุโบราณ (ความสะอาด -10)', hours: 2 }),
    run: (state, p, params, { boost }) => scavenge(state, p, boost),
  },
  {
    id: 'sellFinds', icon: '💵', group: 'ขายของ', at: ['park'],
    variants: (state, p) => {
      const junk = p.finds.filter((f) => !f.artifact);
      const list = [];
      if (junk.length) list.push({ params: { which: 'junk' }, label: `ขายของเก่า ${junk.length} ชิ้น`, desc: `ได้ ${fm(junk.reduce((s, f) => s + f.value, 0))}`, hours: 0, cost: 0 });
      p.finds.forEach((f, i) => {
        if (f.artifact) list.push({ params: { which: i }, label: `ขาย${f.name}`, desc: `ได้ ${fm(f.value)} (เก็บไว้สะสมก็ได้)`, hours: 0, cost: 0 });
      });
      return list;
    },
    run: (state, p, { which }) => {
      let amount = 0;
      let text;
      if (which === 'junk') {
        const junk = p.finds.filter((f) => !f.artifact);
        amount = junk.reduce((s, f) => s + f.value, 0);
        p.finds = p.finds.filter((f) => f.artifact);
        text = `ขายของเก่า ${junk.length} ชิ้น ได้ ${fm(amount)}`;
      } else {
        const [f] = p.finds.splice(which, 1);
        amount = f.value;
        text = `ขาย${f.name} ได้ ${fm(amount)}`;
      }
      p.c.findsSold += amount;
      gainCash(state, p, amount);
      return text;
    },
  },
  {
    id: 'sellArt', icon: '🖼️', group: 'ขายของ', at: ['park'],
    variants: (state, p) => p.artworks.map((a, i) => ({ params: { index: i }, label: `ขายภาพ "${a.title}"`, desc: `ราคาประเมิน ${fm(a.value)} (ขายจริงอาจได้มากหรือน้อยกว่า)`, hours: 0, cost: 0 })),
    run: (state, p, { index }) => {
      const [art] = p.artworks.splice(index, 1);
      const price = Math.round((art.value * (0.8 + nextRandom(state) * 0.5)) / 100) * 100;
      p.c.artSold++;
      p.c.artBest = Math.max(p.c.artBest, price);
      gainCash(state, p, price);
      log(state, p.id, `🖼️ ${p.name} ขายภาพ "${art.title}" ได้ ${fm(price)}`, 'good');
      return `ขายภาพ "${art.title}" ได้ ${fm(price)}`;
    },
  },

  // ---------- ระบบเสริม: ครอบครัว ธุรกิจ บ้าน ประกัน การ์ด ----------
  ...familyActions,
  ...businessActions,
  ...propertyActions,
  ...insuranceActions,
  ...cardActions,
];

const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const shopPrice = (state, key, base) => demandPrice(state, key, base * priceMod(state, 'shop'));

function bankAmount(amount, pool) {
  if (amount === 'all') return pool;
  if (amount === 'keep') return pool - KEEP_CASH;
  return amount;
}

const ACTION_BY_ID = Object.fromEntries(ACTION_DEFS.map((d) => [d.id, d]));
const ART_TITLES = ['แสงแรกของวัน', 'เจ้าพระยายามเย็น', 'แมวส้มบนหลังคา', 'ตลาดน้ำ', 'ฝันกลางรถติด', 'ภูเขาในใจ', 'ทุ่งทานตะวัน', 'เมืองที่ไม่หลับใหล', 'หัวใจสีคราม', 'ดอกบัวบาน'];

function isAt(state, p, def) {
  if (def.role && def.role !== p.role) return false;
  if (def.at === 'any') return true;
  if (def.at === 'home') return p.location === p.housing;
  if (def.at === 'job') return !!p.job && JOBS[p.job].location === p.location;
  return def.at.includes(p.location);
}

function findVariant(state, p, def, params) {
  const variants = def.variants(state, p);
  return variants.find((v) => Object.keys(v.params).every((k) => v.params[k] === params[k]) && Object.keys(params).every((k) => v.params[k] === params[k])) || null;
}

function checkVariant(state, p, def, v) {
  if (state.global.closed === p.location) return 'สถานที่นี้ปิดชั่วคราวสัปดาห์นี้';
  if (v.hours > p.hoursLeft) return `เวลาไม่พอ (ต้องใช้ ${v.hours} ชม.)`;
  if (v.cost > p.cash) return `เงินสดไม่พอ (ต้องใช้ ${fm(v.cost)})`;
  return def.check ? def.check(state, p, v) : null;
}

// รายการกิจกรรมที่ทำได้ ณ ตำแหน่งปัจจุบัน (ส่งให้หน้าจอแสดงปุ่ม)
export function listActions(state, playerId) {
  const p = state.players[playerId];
  if (!p || state.phase.type !== 'week' || state.currentPlayerId !== playerId) return [];
  const out = [];
  for (const def of ACTION_DEFS) {
    if (!isAt(state, p, def)) continue;
    for (const v of def.variants(state, p)) {
      const reason = checkVariant(state, p, def, v);
      out.push({ action: def.id, params: v.params, icon: def.icon, group: def.group, label: v.label, desc: v.desc, hours: v.hours, cost: v.cost, disabled: !!reason, reason });
    }
  }
  return out;
}

// กิจกรรมที่จะทำได้ถ้าเดินไปถึงสถานที่นั้น (ใช้วางแผนให้บอท) — ไม่เปลี่ยนสถานะเกม
export function previewActionsAt(state, playerId, locationId) {
  const p = state.players[playerId];
  const saved = { location: p.location, hoursLeft: p.hoursLeft };
  const travel = locationId === p.location ? 0 : moveHours(state, p, locationId);
  p.location = locationId;
  p.hoursLeft = saved.hoursLeft - travel;
  try {
    return { travel, actions: p.hoursLeft >= 0 ? listActions(state, playerId) : [] };
  } finally {
    p.location = saved.location;
    p.hoursLeft = saved.hoursLeft;
  }
}

export function courseFeeFor(p, courseId) {
  return courseFee(p, COURSES[courseId]);
}

// สมัครงานนี้ได้ไหม (รวมเรื่องตำแหน่งเต็ม) — ใช้วางแผนให้บอท
export function canTakeJob(state, p, job) {
  return !jobBlocker(p, job) && !slotBlocker(state, p, job);
}

export function moveHours(state, p, to) {
  let hours = travelHours(p.location, to, p.vehicle);
  if (hours > 0 && currentMods(state).travelExtra && p.vehicle !== 'car') hours += currentMods(state).travelExtra;
  return hours;
}

export function travelOptions(state, playerId) {
  const p = state.players[playerId];
  if (!p || state.phase.type !== 'week' || state.currentPlayerId !== playerId) return {};
  const out = {};
  for (const loc of LOCATIONS) {
    if (loc.id === p.location) continue;
    const hours = moveHours(state, p, loc.id);
    out[loc.id] = { hours, ok: hours <= p.hoursLeft && state.global.closed !== loc.id };
  }
  return out;
}

// ============================================================
// รายละเอียดกิจกรรม
// ============================================================

function classHours(p) {
  return p.role === 'scholar' ? 4 : RULES.classHours;
}

function courseFee(p, c) {
  let fee = c.fee;
  if (p.role === 'scholar') fee *= 0.7;
  if (p.job && JOBS[p.job].location === 'uni') fee *= 0.5;
  return Math.round(fee / 100) * 100;
}

function courseProgressText(p) {
  const id = p.education.enrolled;
  if (!id) return 'ยังไม่ได้ลงทะเบียนเรียน';
  return `${COURSES[id].name} คาบที่ ${p.education.progress + 1}/${COURSES[id].sessions}`;
}

function studyBlocker(p) {
  if (!p.education.enrolled) return 'ต้องลงทะเบียนเรียนที่มหาวิทยาลัยก่อน';
  if (p.clothes.tier < 1) return 'เสื้อผ้าเก่าจนใส่ไปเรียนไม่ได้ (ซื้อที่ห้าง)';
  if (p.stats.happiness < RULES.minHappinessToWork) return 'หมดไฟ เรียนไม่ไหว (ความสุขต่ำเกินไป)';
  if (p.stats.hygiene < RULES.minHygieneToWork) return 'ตัวเหม็นจนเพื่อนหนี (ความสะอาดต่ำเกินไป)';
  return null;
}

function attendClass(state, p, online) {
  const c = COURSES[p.education.enrolled];
  p.education.progress++;
  addStats(state, p, { happiness: -2 });
  if (p.education.progress >= c.sessions) {
    p.education.completed.push(c.id);
    p.education.enrolled = null;
    p.education.progress = 0;
    if (p.role === 'scholar') addPoints(p, 7);
    log(state, p.id, `🎓 ${p.name} เรียนจบ${c.name}!${p.role === 'scholar' ? ' (หนอนหนังสือ +7 คะแนน)' : ''}`, 'good');
    return `${online ? 'เรียนออนไลน์' : 'เข้าเรียน'}คาบสุดท้าย — เรียนจบ${c.name}! 🎓`;
  }
  return `${online ? 'เรียนออนไลน์' : 'เข้าเรียน'}${c.name} (${p.education.progress}/${c.sessions} คาบ)`;
}

function reqText(job) {
  const r = job.req;
  const parts = [];
  if (r.course) parts.push(`วุฒิ${COURSES[r.course].name}`);
  if (r.minLevel) parts.push(`วุฒิระดับ ${r.minLevel}+`);
  if (r.xp) parts.push(`ประสบการณ์ ${r.xp} ชม.`);
  if (r.clothes) parts.push(CLOTHES[r.clothes].name);
  if (r.health) parts.push(`สุขภาพ ${r.health}+`);
  return parts.length ? parts.join(', ') : 'ไม่ต้องใช้คุณสมบัติ';
}

function maxCourseLevel(p) {
  return Math.max(0, ...p.education.completed.map((id) => COURSES[id].level));
}

function jobBlocker(p, job) {
  const r = job.req;
  if (r.course && !p.education.completed.includes(r.course)) return `ต้องมีวุฒิ${COURSES[r.course].name}`;
  if (r.minLevel && maxCourseLevel(p) < r.minLevel) return `ต้องมีวุฒิระดับ ${r.minLevel} ขึ้นไป`;
  if (r.xp && p.xp < r.xp) return `ประสบการณ์ไม่พอ (มี ${p.xp}/${r.xp} ชม.)`;
  if (r.clothes && p.clothes.tier < r.clothes) return `ต้องแต่ง${CLOTHES[r.clothes].name}ไปสัมภาษณ์`;
  if (r.health && p.stats.health < r.health) return `สุขภาพต้อง ${r.health} ขึ้นไป`;
  if (p.stats.hygiene < RULES.minHygieneInterview) return 'ความสะอาดต่ำเกินไป ไม่ผ่านสัมภาษณ์';
  return null;
}

// ---------- ตำแหน่งงานมีจำกัด ----------
// คะแนนคุณสมบัติ = ประสบการณ์ + ระดับวุฒิรวม×40 + ระดับชุด×15
export function jobMerit(p) {
  const levels = p.education.completed.reduce((s, id) => s + COURSES[id].level, 0);
  return p.xp + levels * RULES.jobs.eduWeight + p.clothes.tier * RULES.jobs.clothesWeight;
}

export function jobHolders(state, job, except = null) {
  return state.order.map((id) => state.players[id]).filter((x) => x.job === job.id && x !== except);
}

function jobFull(state, job, p) {
  return job.slots > 0 && jobHolders(state, job, p).length >= job.slots;
}

function weakestHolder(state, job, p) {
  return jobHolders(state, job, p).sort((a, b) => jobMerit(a) - jobMerit(b))[0] || null;
}

function slotText(state, job, p) {
  if (!job.slots) return '';
  const holders = jobHolders(state, job, p);
  if (holders.length < job.slots) return ` • ว่าง ${job.slots - holders.length}/${job.slots} ตำแหน่ง`;
  const rival = weakestHolder(state, job, p);
  return ` • เต็ม! ${holders.map((h) => h.name).join(', ')} ครองอยู่ (คุณสมบัติ ${jobMerit(rival)} + เปรียบ ${RULES.jobs.incumbent} / คุณ ${jobMerit(p)})`;
}

function slotBlocker(state, p, job) {
  if (!jobFull(state, job, p)) return null;
  const rival = weakestHolder(state, job, p);
  const need = jobMerit(rival) + RULES.jobs.incumbent;
  if (jobMerit(p) > need) return null;
  return `ตำแหน่งเต็ม ${rival.name} ครองอยู่ — คุณสมบัติต้องเกิน ${need} (คุณมี ${jobMerit(p)})`;
}

// ถูกแย่งตำแหน่ง: ย้ายไปงานที่ดีที่สุดในที่เดียวกันที่ยังทำได้ ถ้าไม่มีก็ตกงาน
function displace(state, rival, job, winner) {
  const fallback = JOB_LIST.filter((j) => j.location === job.location && j.id !== job.id && j.tier < job.tier && !jobBlocker(rival, j) && !jobFull(state, j, rival)).sort((a, b) => b.wage - a.wage)[0];
  rival.job = fallback ? fallback.id : null;
  rival.c.displaced++;
  winner.c.takeovers++;
  const where = fallback ? `ถูกลดตำแหน่งเป็น${fallback.title}` : 'ตกงาน!';
  log(state, rival.id, `⚔️ ${winner.name} ชิงตำแหน่ง${job.title}จาก ${rival.name} — ${rival.name} ${where}`, 'bad');
  notify(state, rival.id, '⚔️', `${winner.name} ชิงตำแหน่ง${job.title}จาก ${rival.name}! (${where})`, 'bad');
  addStats(state, rival, { happiness: -8 });
}

function workBlocker(p, job) {
  if (p.stats.happiness < RULES.minHappinessToWork) return 'หมดไฟ ทำงานไม่ไหว (ความสุขต่ำเกินไป)';
  if (p.stats.hygiene < RULES.minHygieneToWork) return 'ความสะอาดต่ำเกินไป หัวหน้าไม่ให้เข้างาน';
  if (job.req.clothes && p.clothes.tier < job.req.clothes) return `ต้องแต่ง${CLOTHES[job.req.clothes].name}มาทำงาน`;
  return null;
}

function wageMultiplier(state, p) {
  let mult = (currentMods(state).wage || 1) * (p.weekMods.wage || 1);
  if (p.pets.includes('dog')) mult *= 1.1;
  if (p.role === 'workaholic') mult *= 1 + 0.1 * Math.min(4, p.weekShifts);
  return mult;
}

function estimatePay(state, p, hours) {
  return Math.round(JOBS[p.job].wage * hours * wageMultiplier(state, p));
}

function doWork(state, p, hours, boost) {
  const job = JOBS[p.job];
  const pay = Math.round(job.wage * hours * wageMultiplier(state, p) * boost);
  gainCash(state, p, pay);
  p.xp += hours;
  p.weekShifts++;
  p.c.shifts++;
  p.c.maxShiftsWeek = Math.max(p.c.maxShiftsWeek, p.weekShifts);
  const f = hours / RULES.shiftHours;
  let happy = -4;
  if (p.role === 'artist') happy *= 2;
  if (p.role === 'workaholic') happy *= 0.5;
  if (job.location === 'arcade') happy = -1;
  addStats(state, p, { health: -Math.round(job.strain * f), happiness: Math.round(happy * f), hygiene: -Math.round(6 * f) });
  const perks = [];
  if (job.location === 'cluckers' && !p.ate) {
    p.ate = true;
    p.c.ateFastThisWeek = true;
    perks.push('กินไก่ทอดฟรี');
  }
  if (job.location === 'restaurant' && !p.ate) {
    p.ate = true;
    perks.push('กินข้าวพนักงาน');
  }
  if (job.location === 'gym') {
    p.stats.hygiene = 100;
    perks.push('อาบน้ำห้องพนักงาน');
  }
  if (job.location === 'hospital') {
    addStats(state, p, { health: 5 });
    perks.push('ตรวจสุขภาพฟรี');
  }
  if (job.location === 'market' && p.groceries < groceryCap(p)) {
    p.groceries++;
    perks.push('ได้ของสด 1 มื้อ');
  }
  return `ทำงาน${job.title} ${hours} ชม. ได้ ${fm(pay)}${perks.length ? ` (${perks.join(', ')})` : ''}`;
}

function scavenge(state, p, boost) {
  addStats(state, p, { hygiene: -10 });
  const r = nextRandom(state) / boost;
  let find;
  if (r < 0.1) {
    const art = ARTIFACTS[randInt(state, 0, ARTIFACTS.length - 1)];
    find = { name: `${art.icon} ${art.name}`, value: art.value, artifact: art.id };
    if (!p.c.artifactKinds.includes(art.id)) p.c.artifactKinds.push(art.id);
    log(state, p.id, `🏺 ${p.name} คุ้ยเจอวัตถุโบราณ: ${art.name}!`, 'good');
  } else if (r < 0.28) {
    find = { name: '📻 ของสะสมวินเทจ', value: randInt(state, 5, 20) * 100 };
  } else if (r < 0.65) {
    find = { name: '🥫 ขวดและกระป๋อง', value: randInt(state, 10, 30) * 10 };
  } else {
    find = { name: '🧦 ของเก่าทั่วไป', value: randInt(state, 5, 15) * 10 };
  }
  p.finds.push(find);
  return `คุ้ยเจอ ${find.name} (มูลค่า ${fm(find.value)})`;
}

function groceryCap(p) {
  return p.furniture.includes('fridge') ? 6 : 2;
}

// ความหรูของบ้าน: ของแต่งบ้าน + วัตถุโบราณที่นักเก็บของเก่าสะสมไว้ (ชิ้นละ 2)
function decorScore(p) {
  const artifacts = new Set(p.finds.filter((f) => f.artifact).map((f) => f.artifact)).size;
  return p.furniture.reduce((s, id) => s + FURNITURE[id].decor, 0) + artifacts * 2;
}

function furnitureText(f) {
  const parts = [];
  if (f.decor) parts.push(`ความหรู +${f.decor}`);
  for (const [k, v] of Object.entries(f.weekly)) parts.push(`${STAT_NAMES[k]} +${v}/สัปดาห์`);
  if (f.note) parts.push(f.note);
  return parts.join(' • ');
}

function entMul(state) {
  return currentMods(state).entertainment || 1;
}

// หมอดู: ทำกิจกรรมแรกที่สถานที่นำโชค ได้ผล ×1.5 และ +2 คะแนน
function luckyBoost(state, p) {
  if (p.role !== 'mystic' || !p.horoscope || p.horoscope.used || p.horoscope.lucky !== p.location) return 1;
  p.horoscope.used = true;
  p.c.horoscopeHits++;
  p.bonusPoints += 4;
  p.score += 4;
  log(state, p.id, `🔮 ${p.name} ทำตามดวงที่${LOCATION_BY_ID[p.location].name} โชคดี ผล ×1.5 และ +4 คะแนน`, 'good');
  return 1.5;
}

// ============================================================
// ระบบพื้นฐาน: เงิน ค่าสถานะ ผลของเหตุการณ์
// ============================================================

function applyEffect(state, p, eff, source) {
  if (!eff) return;
  if (eff.hours) p.hoursLeft = Math.max(0, Math.min(p.hoursMax, p.hoursLeft + eff.hours));
  if (eff.money > 0) gainCash(state, p, eff.money);
  if (eff.money < 0) payBill(state, p, -eff.money, source);
  const stats = {};
  for (const k of ['health', 'happiness', 'hygiene']) if (eff[k]) stats[k] = eff[k];
  if (Object.keys(stats).length) addStats(state, p, stats);
  if (eff.xp) p.xp += eff.xp;
  if (eff.points) addPoints(p, eff.points);
  if (eff.groceries) p.groceries = Math.min(groceryCap(p), p.groceries + eff.groceries);
  if (eff.affection) changeAffection(p, eff.affection);
  if (eff.pet && !p.pets.includes(eff.pet)) p.pets.push(eff.pet);
  if (eff.tickets) p.tickets += eff.tickets;
  if (eff.overtime && p.job) {
    const hours = Math.min(eff.overtime, p.hoursLeft);
    p.hoursLeft -= hours;
    const pay = Math.round(JOBS[p.job].wage * hours * 1.5 * (currentMods(state).wage || 1));
    gainCash(state, p, pay);
    p.xp += hours;
    log(state, p.id, `⏰ ${p.name} ทำโอที ${hours} ชม. ได้ ${fm(pay)}`, 'good');
  }
  if (eff.gamble) {
    let r = nextRandom(state);
    const outcome = eff.gamble.find((o) => (r -= o.chance) < 0) || eff.gamble[eff.gamble.length - 1];
    if (outcome.money > 0) gainCash(state, p, outcome.money);
    if (outcome.money < 0) payBill(state, p, -outcome.money, source);
    log(state, p.id, `${p.name}: ${outcome.text}${outcome.money ? ` ${outcome.money > 0 ? '+' : '-'}${fm(Math.abs(outcome.money))}` : ''}`, outcome.money >= 0 ? 'good' : 'bad');
  }
  if (eff.fromOthers) {
    for (const id of state.order) {
      if (id === p.id) continue;
      payBill(state, state.players[id], eff.fromOthers, `ของขวัญให้${p.name}`);
      gainCash(state, p, eff.fromOthers);
    }
  }
}

// สุขภาพหมด → หมดสติ ถูกหามส่งโรงพยาบาล จบสัปดาห์ทันที
function checkCollapse(state, p) {
  if (p.stats.health > 0) return false;
  hospitalize(state, p);
  if (state.phase.type === 'week' && state.currentPlayerId === p.id) endWeek(state, p);
  return true;
}

function hospitalize(state, p) {
  p.stats.health = RULES.hospitalized.health;
  p.location = 'hospital';
  const cost = insured(p, 'health') ? Math.round(RULES.hospitalized.cost * 0.2) : RULES.hospitalized.cost;
  const covered = insured(p, 'health') ? ' (ประกันสุขภาพจ่ายให้ 80%)' : '';
  payBill(state, p, cost, 'ค่าโรงพยาบาล');
  emit(state, { type: 'event', kind: 'collapse', playerId: p.id, icon: '🚑', name: 'หมดสติ!', text: `${p.name} ร่างกายไม่ไหว ถูกหามส่งโรงพยาบาล เสียค่ารักษา ${fm(cost)}${covered}` });
  log(state, p.id, `🚑 ${p.name} หมดสติ ถูกหามส่งโรงพยาบาล (-${fm(cost)})${covered}`, 'bad');
}

export function netWorth(state, p) {
  const stocks = Object.entries(p.stocks).reduce((s, [sym, n]) => s + state.stocks[sym].price * n, 0);
  const vehicle = p.vehicle ? VEHICLES[p.vehicle].price * 0.5 : 0;
  const furniture = p.furniture.reduce((s, id) => s + FURNITURE[id].price * 0.4, 0);
  const assets = stocks + vehicle + furniture + homeEquity(state, p) + businessesValue(p);
  return Math.round(p.cash + p.savings + assets - p.loans * RULES.loan.repay);
}

// ============================================================
// คะแนนและภารกิจ
// ============================================================

export function weeklyPoints(state, p) {
  const nw = netWorth(state, p);
  const levels = p.education.completed.reduce((s, id) => s + COURSES[id].level, 0);
  const job = JOBS[p.job];
  const b = {
    health: Math.min(8, Math.floor(p.stats.health / 12.5)),
    happiness: Math.min(8, Math.floor(p.stats.happiness / 12.5)),
    hygiene: Math.min(4, Math.floor(p.stats.hygiene / 25)),
    education: Math.min(8, levels),
    career: Math.min(8, Math.max(job ? job.tier + Math.min(2, Math.floor(p.xp / 100)) : 0, businessCareer(p))),
    wealth: RULES.wealthTiers.filter((t) => nw >= t).length,
    home: HOMES[p.housing].homePoints + (p.owned && p.owned === p.housing ? 2 : 0) + Math.min(4, Math.floor(decorScore(p) / 2)),
    family: familyPoints(p),
  };
  return { breakdown: b, total: Object.values(b).reduce((s, v) => s + v, 0) };
}

function checkQuests(state, p) {
  const role = ROLES[p.role];
  for (const q of role.quests) {
    if (p.quests[q.id] || !q.check(p)) continue;
    p.quests[q.id] = true;
    p.questPoints += q.points;
    p.score += q.points;
    emit(state, { type: 'quest', playerId: p.id, questId: q.id, points: q.points });
    log(state, p.id, `🏅 ${p.name} ทำภารกิจ "${q.text}" สำเร็จ! +${q.points} คะแนน`, 'good');
  }
}

// ============================================================
// เทิร์น: สัปดาห์ → ผู้เล่นแต่ละคน → สุดสัปดาห์
// ============================================================

function startRound(state) {
  state.week++;
  state.turnIndex = 0;
  state.global = { eventId: null, closed: null };
  if (state.week > 1 && nextRandom(state) < RULES.globalEventChance) {
    const ev = GLOBAL_EVENTS[randInt(state, 0, GLOBAL_EVENTS.length - 1)];
    state.global.eventId = ev.id;
    let text = ev.text;
    if (ev.mods.closeRandom) {
      const candidates = LOCATIONS.filter((l) => !HOMES[l.id] && l.id !== 'jobs');
      state.global.closed = candidates[randInt(state, 0, candidates.length - 1)].id;
      text = `${ev.text}: ${LOCATION_BY_ID[state.global.closed].name} ปิด!`;
    }
    emit(state, { type: 'globalEvent', eventId: ev.id, icon: ev.icon, name: ev.name, text });
    log(state, null, `${ev.icon} สัปดาห์ที่ ${state.week}: ${ev.name} — ${text}`, 'info');
  } else {
    log(state, null, `📅 เริ่มสัปดาห์ที่ ${state.week}/${state.maxWeeks}`, 'info');
  }
  beginTurn(state);
}

function beginTurn(state) {
  const p = state.players[state.order[state.turnIndex]];
  state.currentPlayerId = p.id;
  state.turn++;
  p.hoursMax = (p.role === 'senior' ? 50 : RULES.hoursPerWeek) - (p.starving ? RULES.hunger.hours : 0);
  p.hoursLeft = p.hoursMax;
  p.starving = false;
  p.location = p.housing;
  p.ate = false;
  p.weekShifts = 0;
  p.weekActs = {};
  p.weekMods = {};
  p.c.ateFastThisWeek = false;
  p.c.ticketsWeek = 0;
  emit(state, { type: 'turn', playerId: p.id, week: state.week });

  const mods = currentMods(state);
  if (mods.startEffect) addStats(state, p, mods.startEffect);
  applyPendingCards(state, p);
  if (p.role === 'senior') {
    gainCash(state, p, SENIOR_PENSION);
    log(state, p.id, `👴 ${p.name} ได้รับเงินบำนาญ ${fm(SENIOR_PENSION)}`, 'good');
  }
  if (p.role === 'mystic') {
    const pool = LOCATIONS.filter((l) => !HOMES[l.id] && l.id !== state.global.closed);
    const lucky = pool[randInt(state, 0, pool.length - 1)].id;
    const rest = pool.filter((l) => l.id !== lucky);
    const unlucky = rest[randInt(state, 0, rest.length - 1)].id;
    p.horoscope = { lucky, unlucky, used: false, unluckyHit: false };
    log(state, p.id, `🔮 ดวงสัปดาห์นี้ของ ${p.name}: นำโชคที่${LOCATION_BY_ID[lucky].name} อัปมงคลที่${LOCATION_BY_ID[unlucky].name}`, 'info');
  }

  const choices = CHOICE_EVENTS.filter((e) => !e.when || e.when(p, state));
  if (state.week > 1 && choices.length && nextRandom(state) < RULES.choiceEventChance) {
    const ev = choices[randInt(state, 0, choices.length - 1)];
    state.phase = { type: 'choice', eventId: ev.id, options: ev.options.map((o) => ({ id: o.id, label: o.label, desc: o.desc })) };
    emit(state, { type: 'event', kind: 'choice', playerId: p.id, icon: ev.icon, name: ev.name, text: ev.text });
  } else {
    state.phase = { type: 'week' };
  }
}

// จบสัปดาห์ของผู้เล่น: ค่าใช้จ่าย สภาพร่างกาย เหตุการณ์ คะแนน แล้วส่งตาต่อ
function endWeek(state, p) {
  const before = { ...p.stats, cash: p.cash, savings: p.savings, loans: p.loans };
  const notes = [];
  const mods = currentMods(state);

  if (!p.ate) {
    addStats(state, p, { health: RULES.hunger.health, happiness: RULES.hunger.happiness });
    p.starving = true;
    notes.push(`😫 ไม่ได้กินอะไรเลย! สุขภาพ ${RULES.hunger.health} ความสุข ${RULES.hunger.happiness} และสัปดาห์หน้าเวลาลด ${RULES.hunger.hours} ชม.`);
  }

  const home = HOMES[p.housing];
  if (p.rentPrepaid) p.rentPrepaid = false;
  else if (p.owned !== p.housing) {
    payBill(state, p, home.rent, 'ค่าเช่า');
    notes.push(`🏠 จ่ายค่าเช่า${home.name} ${fm(home.rent)}`);
  }
  mortgageWeekly(state, p, notes);
  if (p.pets.length) {
    payBill(state, p, RULES.petFood * p.pets.length, 'ค่าอาหารสัตว์');
    notes.push(`🐾 ค่าอาหารสัตว์ ${fm(RULES.petFood * p.pets.length)}`);
  }
  familyWeekly(state, p, notes);
  businessWeekly(state, p, notes, insured(p, 'business'));
  insuranceWeekly(state, p, notes);

  const passive = { ...RULES.passive };
  if (p.role === 'senior') passive.health = -7;
  if (mods.hygieneDecay) passive.hygiene *= mods.hygieneDecay;
  const weekly = { health: 0, happiness: 0, hygiene: 0 };
  for (const id of p.furniture) for (const [k, v] of Object.entries(FURNITURE[id].weekly)) weekly[k] += v;
  for (const pet of p.pets) weekly.happiness += PETS[pet].happiness;
  if (p.vehicle === 'car') weekly.happiness += VEHICLES.car.happiness;
  addStats(state, p, { health: passive.health + weekly.health, happiness: passive.happiness + weekly.happiness, hygiene: passive.hygiene + weekly.hygiene });

  if (p.clothes.tier > 0) {
    p.clothes.weeksLeft--;
    if (p.clothes.weeksLeft <= 0) {
      notes.push(`👕 ${CLOTHES[p.clothes.tier].name}เก่าจนใส่ไม่ได้แล้ว ต้องซื้อใหม่`);
      p.clothes = { tier: 0, weeksLeft: 0 };
    }
  }

  if (p.savings > 0) {
    const rate = RULES.savingsInterest * (p.job && JOBS[p.job].location === 'bank' ? 2 : 1);
    const interest = Math.round(p.savings * rate);
    p.savings += interest;
    if (interest) notes.push(`🏦 ดอกเบี้ยเงินฝาก +${fm(interest)}`);
  }

  // ขโมยขึ้นบ้าน (เงินสดในกระเป๋า)
  if (p.cash >= RULES.theft.minCash) {
    const chance = RULES.theft[home.theft] * (mods.theft || 1);
    if (nextRandom(state) < chance) {
      if (p.furniture.includes('robot')) {
        notes.push('🤖 หุ่นยนต์ดูดฝุ่นติดอาวุธไล่ขโมยหนีไปได้!');
      } else {
        const lost = Math.min(RULES.theft.max, Math.round(p.cash * RULES.theft.share));
        const back = insured(p, 'property') ? Math.round(lost * 0.8) : 0;
        p.cash -= lost - back;
        notes.push(`🦹 ขโมยขึ้นบ้าน! เงินสดหาย ${fm(lost)}${back ? ` (ประกันจ่ายคืน ${fm(back)})` : ' (ฝากธนาคารไว้จะปลอดภัยกว่า)'}`);
        log(state, p.id, `🦹 ขโมยขึ้นบ้าน ${p.name} เงินหาย ${fm(lost - back)}`, 'bad');
      }
    }
  }

  let weekendEvent = null;
  const pool = WEEKEND_EVENTS.filter((e) => !e.when || e.when(p, state));
  if (pool.length && nextRandom(state) < RULES.weeklyEventChance) {
    const ev = pool[randInt(state, 0, pool.length - 1)];
    let eff = ev.eff;
    let text = ev.text;
    // ประกันบ้านจ่ายค่าซ่อมให้ครึ่งหนึ่ง
    if (ev.insurable && insured(p, ev.insurable) && eff.money < 0) {
      eff = { ...eff, money: Math.round(eff.money / 2) };
      text += ` (ประกันจ่ายให้ครึ่งหนึ่ง)`;
    }
    weekendEvent = { icon: ev.icon, name: ev.name, text };
    log(state, p.id, `${ev.icon} ${p.name}: ${ev.name} — ${text}`, 'info');
    applyEffect(state, p, eff, ev.name);
  }

  if (p.stats.health <= 0) hospitalize(state, p);

  p.c.healthStreak = p.stats.health >= 90 ? p.c.healthStreak + 1 : 0;
  if (p.stats.happiness >= 80) p.c.happyWeek = true;
  p.c.netWorthBest = Math.max(p.c.netWorthBest, netWorth(state, p));

  const { breakdown, total } = weeklyPoints(state, p);
  for (const [k, v] of Object.entries(breakdown)) p.breakdown[k] += v;
  p.score += total;
  p.lastWeek = { week: state.week, points: total, breakdown };
  checkQuests(state, p);

  const delta = {
    health: p.stats.health - before.health,
    happiness: p.stats.happiness - before.happiness,
    hygiene: p.stats.hygiene - before.hygiene,
    money: p.cash + p.savings - before.cash - before.savings,
  };
  emit(state, { type: 'weekend', playerId: p.id, week: state.week, points: total, breakdown, notes, delta, event: weekendEvent });
  log(state, p.id, `🌙 ${p.name} จบสัปดาห์ที่ ${state.week} ได้ ${total} คะแนน (รวม ${p.score})`, 'info');

  state.phase = { type: 'between' };
  nextTurn(state);
}

function nextTurn(state) {
  if (state.turnIndex + 1 < state.order.length) {
    state.turnIndex++;
    beginTurn(state);
    return;
  }
  endRound(state);
}

function endRound(state) {
  // ราคาหุ้นเปลี่ยน ของในร้านกลับสู่ราคาปกติทีละน้อย ราคาบ้านขยับ
  const drift = currentMods(state).stockDrift || 0;
  decayDemand(state);
  updatePropertyMarket(state, drift);
  for (const s of STOCK_LIST) {
    const st = state.stocks[s.id];
    const change = drift + 0.005 + (nextRandom(state) - 0.5) * 2 * s.vol;
    const price = Math.min(s.price * 4, Math.max(s.price * 0.3, st.price * (1 + change)));
    st.change = price / st.price - 1;
    st.price = Math.round(price * 100) / 100;
  }
  // ออกรางวัลลอตเตอรี่
  if (state.week % RULES.lottery.every === 0) drawLottery(state);

  if (state.week >= state.maxWeeks) finishGame(state);
  else startRound(state);
}

function drawLottery(state) {
  const winners = [];
  for (const id of state.order) {
    const p = state.players[id];
    if (!p.tickets) continue;
    const luck = (p.pets.includes('cat') ? 1.5 : 1) * (p.role === 'mystic' ? 2 : 1);
    let won = 0;
    for (let t = 0; t < p.tickets; t++) {
      const r = nextRandom(state);
      let acc = 0;
      for (const prize of RULES.lottery.prizes) {
        acc += prize.chance * luck;
        if (r < acc) {
          won += prize.amount;
          winners.push(`${p.name} ถูก${prize.name} ${fm(prize.amount)}`);
          break;
        }
      }
    }
    if (won) {
      p.cash += won;
      p.totals.earned += won;
      p.c.lotteryWins++;
      checkQuests(state, p);
    }
    p.tickets = 0;
  }
  const text = winners.length ? winners.join(' • ') : 'งวดนี้ไม่มีใครถูกรางวัล';
  emit(state, { type: 'lottery', text });
  log(state, null, `🎟️ ผลลอตเตอรี่: ${text}`, winners.length ? 'good' : 'info');
}

function finishGame(state) {
  state.status = 'finished';
  const results = state.order.map((id) => {
    const p = state.players[id];
    return {
      playerId: id,
      name: p.name,
      color: p.color,
      role: p.role,
      score: p.score,
      breakdown: { ...p.breakdown },
      questPoints: p.questPoints,
      bonusPoints: p.bonusPoints,
      quests: Object.keys(p.quests),
      netWorth: netWorth(state, p),
      job: p.job,
      education: p.education.completed.slice(),
      stats: { ...p.stats },
      totals: { ...p.totals },
      love: p.love ? { name: p.love.name, stage: p.love.stage } : null,
      kids: p.kids.length,
      owned: p.owned,
      businesses: p.businesses.map((b) => ({ id: b.id, level: b.level })),
    };
  });
  results.sort((a, b) => b.score - a.score || b.netWorth - a.netWorth);
  results.forEach((r, i) => {
    r.rank = i > 0 && r.score === results[i - 1].score && r.netWorth === results[i - 1].netWorth ? results[i - 1].rank : i + 1;
  });
  state.results = results;
  state.currentPlayerId = null;
  state.phase = { type: 'gameOver' };
  emit(state, { type: 'gameOver' });
  log(state, null, `🏁 จบเกม! ผู้ชนะคือ ${results[0].name} ด้วยคะแนน ${results[0].score}`, 'good');
}

// ============================================================
// เครื่องมือสำหรับห้องเกม
// ============================================================

export function addLog(state, text, tone = 'info', playerId = null) {
  log(state, playerId, text, tone);
}

// คำสั่งพื้นฐานเมื่อหมดเวลา: ถ้ามีเรื่องให้เลือก เลือกข้อสุดท้าย (มักเป็นการปฏิเสธ) ไม่งั้นจบสัปดาห์
export function fallbackAction(state) {
  const ph = state.phase;
  if (ph.type === 'choice') return { type: 'choose', value: ph.options[ph.options.length - 1].id, seq: state.seq };
  if (ph.type === 'week') return { type: 'endTurn', seq: state.seq };
  return null;
}

// ทางหนีไฟ: ถ้าเกิดปัญหาจนไม่มีใครเล่นต่อได้ ให้จบตาปัจจุบันทันที
export function forceEndTurn(state) {
  if (state.status !== 'playing') return [];
  state.events = [];
  const p = state.players[state.currentPlayerId];
  log(state, p?.id, 'ระบบจบสัปดาห์ให้อัตโนมัติ', 'info');
  if (p) endWeek(state, p);
  state.seq++;
  const events = state.events;
  state.events = [];
  return events;
}

// ============================================================
// มุมมองสาธารณะ (ส่งให้ผู้เล่นทุกคน) — ไม่ส่งตัวสุ่มของเกม
// ============================================================

export function toPublicView(state) {
  const cur = state.currentPlayerId;
  return {
    status: state.status,
    week: state.week,
    maxWeeks: state.maxWeeks,
    turn: state.turn,
    seq: state.seq,
    order: state.order.slice(),
    currentPlayerId: cur,
    phase: JSON.parse(JSON.stringify(state.phase)),
    global: { ...state.global },
    botLevel: state.botLevel,
    stocks: JSON.parse(JSON.stringify(state.stocks)),
    demand: { ...state.demand },
    propertyIndex: state.propertyIndex,
    players: state.order.map((id) => publicPlayer(state, state.players[id])),
    actions: cur ? listActions(state, cur) : [],
    travel: cur ? travelOptions(state, cur) : {},
    log: state.log.slice(-80).map((l) => ({ ...l })),
    results: state.results ? JSON.parse(JSON.stringify(state.results)) : null,
  };
}

function publicPlayer(state, p) {
  const copy = JSON.parse(JSON.stringify(p));
  copy.netWorth = netWorth(state, p);
  copy.weeklyPreview = weeklyPoints(state, p);
  copy.decor = decorScore(p);
  copy.merit = jobMerit(p);
  copy.homeValue = p.owned ? homeValue(state, p.owned) : 0;
  return copy;
}

export { JOB_PERKS };
