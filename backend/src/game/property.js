// property.js — ซื้อบ้านผ่อนธนาคาร
// ดาวน์ 20% ที่ธนาคาร แล้วย้ายเข้าทันที ไม่ต้องจ่ายค่าเช่า แต่ต้องผ่อนทุกสัปดาห์ (มีดอกเบี้ย)
// ราคาบ้านค่อย ๆ ขึ้นตามตลาด ขายต่อได้ บ้านของตัวเองได้คะแนนบ้านเพิ่ม

import { RULES } from './rules.js';
import { HOMES } from './city.js';
import { gainCash, log, notify, payBill } from './core.js';
import { nextRandom } from './rng.js';
import { formatMoney as fm } from './format.js';

const M = RULES.mortgage;

export function homeValue(state, homeId) {
  return Math.round((HOMES[homeId].price * (state.propertyIndex || 1)) / 100) * 100;
}

export function mortgagePayment(principal) {
  return Math.ceil((principal / M.weeks + principal * M.rate) / 100) * 100;
}

export function homeEquity(state, p) {
  if (!p.owned) return 0;
  return homeValue(state, p.owned) - (p.mortgage?.remaining || 0);
}

const hasIncome = (p) => !!p.job || p.businesses.length > 0 || p.role === 'senior';

export const propertyActions = [
  {
    id: 'buyHome', icon: '🔑', group: 'บ้านของตัวเอง', at: ['bank'],
    variants: (state, p) =>
      Object.values(HOMES)
        .filter((h) => h.id !== p.owned)
        .map((h) => {
          const value = homeValue(state, h.id);
          const down = Math.round((value * M.down) / 100) * 100;
          const payment = mortgagePayment(value - down);
          return {
            params: { homeId: h.id },
            label: `ซื้อ${h.name} (ผ่อนธนาคาร)`,
            desc: `ราคา ${fm(value)} · ผ่อน ~${fm(payment)}/สัปดาห์ แทนค่าเช่า · ย้ายเข้าทันที · คะแนนบ้าน +2`,
            hours: 1,
            cost: down,
          };
        }),
    check: (state, p, v) => {
      if (p.owned) return 'มีบ้านของตัวเองแล้ว (ขายหลังเดิมก่อน)';
      if (!hasIncome(p)) return 'ต้องมีรายได้ประจำ (งานหรือธุรกิจ) ธนาคารถึงจะอนุมัติ';
      if (p.furniture.length > HOMES[v.params.homeId].slots) return `ของในบ้านเยอะเกิน ${HOMES[v.params.homeId].slots} ชิ้น`;
      return null;
    },
    run: (state, p, { homeId }, { hours }) => {
      const value = homeValue(state, homeId);
      const down = Math.round((value * M.down) / 100) * 100;
      p.owned = homeId;
      p.mortgage = { remaining: value - down, payment: mortgagePayment(value - down) };
      p.housing = homeId;
      p.rentPrepaid = false;
      log(state, p.id, `🔑 ${p.name} ซื้อ${HOMES[homeId].name}เป็นของตัวเอง!`, 'good');
      notify(state, p.id, '🔑', `${p.name} ซื้อ${HOMES[homeId].name}เป็นของตัวเอง!`, 'good');
      return `ซื้อ${HOMES[homeId].name}แล้ว! ผ่อน ${fm(p.mortgage.payment)}/สัปดาห์ (${hours} ชม. ทำเรื่องกู้)`;
    },
  },
  {
    id: 'payMortgage', icon: '💳', group: 'บ้านของตัวเอง', at: ['bank'],
    variants: (state, p) => {
      if (!p.mortgage) return [];
      const r = p.mortgage.remaining;
      const list = [];
      if (r > 10000) list.push({ params: { amount: 10000 }, label: `โปะหนี้บ้าน ${fm(10000)}`, desc: `เหลือหนี้ ${fm(r)}`, hours: 0, cost: 10000 });
      list.push({ params: { amount: 'all' }, label: `ปิดหนี้บ้านทั้งหมด`, desc: `จ่าย ${fm(r)} แล้วไม่ต้องผ่อนอีก`, hours: 0, cost: r });
      return list;
    },
    run: (state, p, { amount }) => {
      const pay = amount === 'all' ? p.mortgage.remaining : amount;
      p.mortgage.remaining -= pay;
      if (p.mortgage.remaining <= 0) {
        p.mortgage = null;
        log(state, p.id, `🎉 ${p.name} ปิดหนี้บ้านหมดแล้ว!`, 'good');
        return 'ปิดหนี้บ้านหมดแล้ว! 🎉';
      }
      p.mortgage.payment = Math.min(p.mortgage.payment, mortgagePayment(p.mortgage.remaining));
      return `โปะหนี้บ้าน ${fm(pay)} (เหลือ ${fm(p.mortgage.remaining)})`;
    },
  },
  {
    id: 'sellHome', icon: '🏷️', group: 'บ้านของตัวเอง', at: ['bank'],
    variants: (state, p) => {
      if (!p.owned) return [];
      const net = Math.round(homeValue(state, p.owned) * (1 - M.sellFee)) - (p.mortgage?.remaining || 0);
      return [{ params: {}, label: `ขาย${HOMES[p.owned].name}`, desc: `ได้เงินสุทธิ ${fm(net)} หลังหักหนี้และค่าธรรมเนียม ${Math.round(M.sellFee * 100)}% (อยู่ต่อแบบเช่า)`, hours: 1, cost: Math.max(0, -net) }];
    },
    run: (state, p) => {
      const homeId = p.owned;
      const net = Math.round(homeValue(state, homeId) * (1 - M.sellFee)) - (p.mortgage?.remaining || 0);
      if (net > 0) gainCash(state, p, net);
      p.owned = null;
      p.mortgage = null;
      log(state, p.id, `🏷️ ${p.name} ขาย${HOMES[homeId].name} ได้เงินสุทธิ ${fm(net)}`, 'info');
      return `ขาย${HOMES[homeId].name}แล้ว ได้สุทธิ ${fm(net)}`;
    },
  },
];

// สุดสัปดาห์: จ่ายค่าผ่อน (ดอกเบี้ยคิดจากหนี้ที่เหลือ)
export function mortgageWeekly(state, p, notes) {
  const m = p.mortgage;
  if (!m) return;
  const interest = Math.round(m.remaining * M.rate);
  const pay = Math.min(m.payment, m.remaining + interest);
  m.remaining = m.remaining + interest - pay;
  payBill(state, p, pay, 'ค่าผ่อนบ้าน');
  if (m.remaining <= 0) {
    p.mortgage = null;
    notes.push(`🎉 จ่ายค่าผ่อนงวดสุดท้าย ${fm(pay)} — บ้านเป็นของคุณเต็มตัวแล้ว!`);
    log(state, p.id, `🎉 ${p.name} ผ่อนบ้านหมดแล้ว!`, 'good');
  } else {
    notes.push(`🔑 ค่าผ่อนบ้าน ${fm(pay)} (เหลือหนี้ ${fm(m.remaining)})`);
  }
}

// สิ้นสัปดาห์ของทุกคน: ราคาบ้านในเมืองขยับ
export function updatePropertyMarket(state, drift = 0) {
  const change = M.growth + drift / 5 + (nextRandom(state) - 0.5) * 0.01;
  state.propertyIndex = Math.round((state.propertyIndex || 1) * (1 + change) * 10000) / 10000;
}
