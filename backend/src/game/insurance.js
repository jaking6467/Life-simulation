// insurance.js — ประกันภัย ซื้อที่ธนาคาร จ่ายเบี้ยทุกสัปดาห์ ยกเลิกได้ตลอด

import { payBill } from './core.js';
import { formatMoney as fm } from './format.js';

export const INSURANCE_LIST = [
  { id: 'health', name: 'ประกันสุขภาพ', icon: '🩺', premium: 250, desc: 'หมดสติเข้าโรงพยาบาลจ่ายแค่ 20% และพบแพทย์ลดครึ่งราคา' },
  { id: 'property', name: 'ประกันบ้านและทรัพย์สิน', icon: '🛡️', premium: 200, desc: 'โดนขโมยได้เงินคืน 80% และค่าซ่อมบ้านจ่ายแค่ครึ่งเดียว' },
  { id: 'business', name: 'ประกันธุรกิจ', icon: '🏪', premium: 300, desc: 'ธุรกิจขาดทุน ประกันจ่ายแทน 70%', needs: (p) => p.businesses.length > 0, needsText: 'ต้องมีธุรกิจของตัวเองก่อน' },
];
export const INSURANCE = Object.freeze(Object.fromEntries(INSURANCE_LIST.map((i) => [i.id, i])));

export const insured = (p, id) => !!p.insurance[id];

export const insuranceActions = [
  {
    id: 'buyInsurance', icon: '📄', group: 'ประกันภัย', at: ['bank'],
    variants: (state, p) =>
      INSURANCE_LIST.filter((i) => !insured(p, i.id)).map((i) => ({ params: { kind: i.id }, icon: i.icon, label: `ทำ${i.name}`, desc: `${i.desc} · ${fm(i.premium)}/สัปดาห์`, hours: 0, cost: i.premium })),
    check: (state, p, v) => {
      const i = INSURANCE[v.params.kind];
      return i.needs && !i.needs(p) ? i.needsText : null;
    },
    run: (state, p, { kind }) => {
      p.insurance[kind] = { paidWeek: state.week };
      return `ทำ${INSURANCE[kind].name}แล้ว (จ่ายเบี้ยสัปดาห์แรกแล้ว)`;
    },
  },
  {
    id: 'cancelInsurance', icon: '✂️', group: 'ประกันภัย', at: ['bank'],
    variants: (state, p) =>
      INSURANCE_LIST.filter((i) => insured(p, i.id)).map((i) => ({ params: { kind: i.id }, label: `ยกเลิก${i.name}`, desc: `ไม่ต้องจ่ายเบี้ย ${fm(i.premium)}/สัปดาห์อีก`, hours: 0, cost: 0 })),
    run: (state, p, { kind }) => {
      delete p.insurance[kind];
      return `ยกเลิก${INSURANCE[kind].name}แล้ว`;
    },
  },
];

export function insuranceWeekly(state, p, notes) {
  let total = 0;
  for (const [id, info] of Object.entries(p.insurance)) {
    if (info.paidWeek === state.week) continue;
    info.paidWeek = state.week;
    total += INSURANCE[id].premium;
  }
  if (total) {
    payBill(state, p, total, 'เบี้ยประกัน');
    notes.push(`📄 เบี้ยประกัน ${fm(total)}`);
  }
}
