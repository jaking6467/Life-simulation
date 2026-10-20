// market.js — ราคาที่ขยับตามการซื้อขายของผู้เล่น
// - ของในร้าน (เฟอร์นิเจอร์ พาหนะ เสื้อผ้า การ์ด): ทุกครั้งที่มีคนซื้อ ราคาชิ้นนั้นขึ้น แล้วค่อย ๆ ลดลงทุกสัปดาห์
// - หุ้น: ซื้อเยอะราคาขึ้น ขายเยอะราคาลง (คนที่ซื้อตามทีหลังจ่ายแพงกว่า) มีค่าธรรมเนียมกันการปั่นราคา

import { RULES } from './rules.js';
import { STOCKS } from './items.js';

export function demandOf(state, key) {
  return state.demand?.[key] || 0;
}

// ราคาตามความต้องการของตลาด (base = ราคาหลังส่วนลดจากเหตุการณ์แล้ว)
export function demandPrice(state, key, base) {
  return Math.round((base * (1 + demandOf(state, key))) / 10) * 10;
}

export function bumpDemand(state, key) {
  state.demand ||= {};
  state.demand[key] = Math.min(RULES.market.maxDemand, demandOf(state, key) + RULES.market.demandStep);
}

// สิ้นสัปดาห์: ความต้องการค่อย ๆ ลดลง ราคากลับสู่ปกติ
export function decayDemand(state) {
  for (const key of Object.keys(state.demand || {})) {
    const v = state.demand[key] * RULES.market.demandDecay;
    if (v < 0.02) delete state.demand[key];
    else state.demand[key] = Math.round(v * 1000) / 1000;
  }
}

export function demandText(state, key) {
  const d = demandOf(state, key);
  return d >= 0.05 ? ` • 📈 ราคาขึ้น ${Math.round(d * 100)}% (มีคนแห่ซื้อ)` : '';
}

// ซื้อขายหุ้น: ราคาที่ได้จริงคือค่าเฉลี่ยระหว่างก่อนและหลังแรงซื้อ/ขาย + ค่าธรรมเนียม
export function stockQuote(state, symbol, n, side) {
  const st = state.stocks[symbol];
  const value = st.price * n;
  const impact = value / STOCKS[symbol].depth;
  const fee = RULES.market.stockFee;
  if (side === 'buy') {
    return { total: Math.round(value * (1 + impact / 2) * (1 + fee)), impact, after: st.price * (1 + impact) };
  }
  return { total: Math.round(value * (1 - impact / 2) * (1 - fee)), impact, after: st.price * (1 - impact) };
}

export function applyStockImpact(state, symbol, quote) {
  const base = STOCKS[symbol].price;
  const st = state.stocks[symbol];
  st.price = Math.round(Math.min(base * 4, Math.max(base * 0.3, quote.after)) * 100) / 100;
}
