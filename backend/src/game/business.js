// business.js — เปิดธุรกิจของตัวเอง
// ลงทุนครั้งเดียวที่สถานที่ของธุรกิจนั้น แล้วได้กำไรทุกสุดสัปดาห์ (มีขึ้นมีลง บางสัปดาห์ขาดทุน)
// เข้าไปดูแลร้านเอง (4 ชม.) สัปดาห์นั้นกำไรเพิ่ม 50% และความเสี่ยงลดครึ่งหนึ่ง ขยายสาขาได้ถึงระดับ 3

import { RULES } from './rules.js';
import { addStats, currentMods, gainCash, log, notify, one, payBill } from './core.js';
import { nextRandom } from './rng.js';
import { COURSES } from './courses.js';
import { formatMoney as fm } from './format.js';

// base = กำไรเฉลี่ยต่อสัปดาห์ (ระดับ 1 ไม่ได้ดูแล), vol = ความผันผวน, risk = โอกาสขาดทุน, career = คะแนนอาชีพ
export const BUSINESS_LIST = [
  { id: 'coffee', name: 'รถเข็นกาแฟ', icon: '☕', location: 'market', price: 8000, base: 900, vol: 0.5, risk: 0.1, career: 1, req: null },
  { id: 'onlineShop', name: 'ร้านเสื้อผ้าออนไลน์', icon: '🛍️', location: 'mall', price: 20000, base: 2000, vol: 0.8, risk: 0.14, career: 2, req: null },
  { id: 'franchise', name: 'แฟรนไชส์ไก่ทอด', icon: '🍗', location: 'cluckers', price: 35000, base: 3000, vol: 0.4, risk: 0.1, career: 3, req: { course: 'highschool' } },
  { id: 'startup', name: 'บริษัทสตาร์ทอัพ', icon: '🚀', location: 'office', price: 60000, base: 5500, vol: 1, risk: 0.18, career: 4, req: { anyCourse: ['business', 'computer'] } },
];
export const BUSINESSES = Object.freeze(Object.fromEntries(BUSINESS_LIST.map((b) => [b.id, b])));
const B = RULES.business;

const levelMult = (level) => 1 + B.levelBoost * (level - 1);
export const upgradeCost = (biz, level) => biz.price * level;
export const businessValue = (b) => Math.round(b.invested * B.sellRatio);
export const ownedBusiness = (p, id) => p.businesses.find((b) => b.id === id) || null;

function reqBlocker(p, biz) {
  const r = biz.req;
  if (!r) return null;
  if (r.course && !p.education.completed.includes(r.course)) return `ต้องมีวุฒิ${COURSES[r.course].name}`;
  if (r.anyCourse && !r.anyCourse.some((c) => p.education.completed.includes(c))) return `ต้องมีวุฒิ${r.anyCourse.map((c) => COURSES[c].name).join(' หรือ ')}`;
  return null;
}

function reqText(biz) {
  if (!biz.req) return 'ไม่ต้องใช้วุฒิ';
  if (biz.req.course) return `ต้องมีวุฒิ${COURSES[biz.req.course].name}`;
  return `ต้องมีวุฒิ${biz.req.anyCourse.map((c) => COURSES[c].name).join('/')}`;
}

const here = (p) => BUSINESS_LIST.filter((b) => b.location === p.location);

export const businessActions = [
  {
    id: 'buyBusiness', icon: '🏪', group: 'ธุรกิจของตัวเอง', at: [...new Set(BUSINESS_LIST.map((b) => b.location))],
    variants: (state, p) =>
      here(p)
        .filter((b) => !ownedBusiness(p, b.id))
        .map((b) => ({ params: { bizId: b.id }, label: `เปิด${b.icon} ${b.name}`, desc: `กำไรเฉลี่ย ~${fm(b.base)}/สัปดาห์ ความเสี่ยงขาดทุน ${Math.round(b.risk * 100)}% • ${reqText(b)}`, hours: 2, cost: b.price })),
    check: (state, p, v) => {
      if (p.businesses.length >= B.maxOwned) return `มีธุรกิจได้สูงสุด ${B.maxOwned} กิจการ`;
      return reqBlocker(p, BUSINESSES[v.params.bizId]);
    },
    run: (state, p, { bizId }) => {
      const biz = BUSINESSES[bizId];
      p.businesses.push({ id: bizId, level: 1, invested: biz.price, weeks: 0, lastProfit: null });
      log(state, p.id, `🏪 ${p.name} เปิดกิจการ${biz.name}!`, 'good');
      notify(state, p.id, biz.icon, `${p.name} เปิดกิจการ${biz.name}!`, 'info');
      return `เปิด${biz.name}แล้ว! กำไรจะเข้าทุกสุดสัปดาห์`;
    },
  },
  {
    id: 'manageBusiness', icon: '🧑‍💼', group: 'ธุรกิจของตัวเอง', at: [...new Set(BUSINESS_LIST.map((b) => b.location))],
    variants: (state, p) =>
      here(p)
        .filter((b) => ownedBusiness(p, b.id))
        .map((b) => ({ params: { bizId: b.id }, label: `ดูแลร้าน${b.name}เอง`, desc: `สัปดาห์นี้กำไร +${Math.round((B.manageBoost - 1) * 100)}% และโอกาสขาดทุนลดครึ่งหนึ่ง`, hours: B.manageHours, cost: 0 })),
    check: (state, p, v) => (ownedBusiness(p, v.params.bizId).managed ? 'สัปดาห์นี้ดูแลร้านแล้ว' : null),
    run: (state, p, { bizId }) => {
      const b = ownedBusiness(p, bizId);
      b.managed = true;
      p.c.manages++;
      addStats(state, p, { happiness: -2, hygiene: -4 });
      return `ดูแลร้าน${BUSINESSES[bizId].name}ทั้งวัน ลูกค้าแน่นร้าน`;
    },
  },
  {
    id: 'upgradeBusiness', icon: '📈', group: 'ธุรกิจของตัวเอง', at: [...new Set(BUSINESS_LIST.map((b) => b.location))],
    variants: (state, p) =>
      here(p)
        .map((biz) => ({ biz, b: ownedBusiness(p, biz.id) }))
        .filter(({ b }) => b && b.level < B.maxLevel)
        .map(({ biz, b }) => ({ params: { bizId: biz.id }, label: `ขยายสาขา${biz.name} (ระดับ ${b.level + 1})`, desc: `กำไรเฉลี่ยเป็น ~${fm(biz.base * levelMult(b.level + 1))}/สัปดาห์`, hours: 2, cost: upgradeCost(biz, b.level) })),
    run: (state, p, { bizId }) => {
      const biz = BUSINESSES[bizId];
      const b = ownedBusiness(p, bizId);
      b.invested += upgradeCost(biz, b.level);
      b.level++;
      log(state, p.id, `📈 ${p.name} ขยาย${biz.name}เป็นระดับ ${b.level}`, 'good');
      return `ขยาย${biz.name}เป็นระดับ ${b.level} แล้ว`;
    },
  },
  {
    id: 'sellBusiness', icon: '🤝', group: 'ธุรกิจของตัวเอง', at: [...new Set(BUSINESS_LIST.map((b) => b.location))],
    variants: (state, p) =>
      here(p)
        .map((biz) => ({ biz, b: ownedBusiness(p, biz.id) }))
        .filter(({ b }) => b)
        .map(({ biz, b }) => ({ params: { bizId: biz.id }, label: `ขายกิจการ${biz.name}`, desc: `ได้เงิน ${fm(businessValue(b))} (${Math.round(B.sellRatio * 100)}% ของเงินที่ลงทุน)`, hours: 0, cost: 0 })),
    run: (state, p, { bizId }) => {
      const b = ownedBusiness(p, bizId);
      const amount = businessValue(b);
      p.businesses = p.businesses.filter((x) => x !== b);
      gainCash(state, p, amount);
      log(state, p.id, `🤝 ${p.name} ขายกิจการ${BUSINESSES[bizId].name} ได้ ${fm(amount)}`, 'info');
      return `ขายกิจการ${BUSINESSES[bizId].name} ได้ ${fm(amount)}`;
    },
  },
];

// สุดสัปดาห์: คิดกำไร/ขาดทุนของทุกกิจการ (insured = มีประกันธุรกิจ จ่ายแทน 70% ของที่ขาดทุน)
export function businessWeekly(state, p, notes, insured) {
  const wageMod = currentMods(state).wage || 1;
  for (const b of p.businesses) {
    const biz = BUSINESSES[b.id];
    const base = biz.base * levelMult(b.level) * wageMod;
    const risk = biz.risk * (b.managed ? 0.5 : 1);
    b.weeks++;
    if (nextRandom(state) < risk) {
      const loss = Math.round((base * (0.4 + nextRandom(state) * 0.6)) / 10) * 10;
      const covered = insured ? Math.round(loss * 0.7) : 0;
      payBill(state, p, loss - covered, `ขาดทุน${biz.name}`);
      b.lastProfit = -(loss - covered);
      notes.push(`${biz.icon} ${biz.name}ขาดทุน ${fm(loss)}${covered ? ` (ประกันจ่ายแทน ${fm(covered)})` : ''}`);
    } else {
      const roll = 1 - biz.vol + nextRandom(state) * 2 * biz.vol;
      const profit = Math.max(0, Math.round((base * roll * (b.managed ? B.manageBoost : 1)) / 10) * 10);
      gainCash(state, p, profit);
      p.c.bizProfit += profit;
      b.lastProfit = profit;
      notes.push(`${biz.icon} ${biz.name}กำไร +${fm(profit)}${b.managed ? ' (ดูแลเอง)' : ''}`);
    }
    b.managed = false;
  }
}

// คะแนนอาชีพจากธุรกิจ (ใช้ค่าที่ดีกว่าระหว่างงานประจำกับธุรกิจ)
export function businessCareer(p) {
  return p.businesses.reduce((best, b) => Math.max(best, BUSINESSES[b.id].career + b.level - 1), 0);
}

export function businessesValue(p) {
  return p.businesses.reduce((s, b) => s + businessValue(b), 0);
}
