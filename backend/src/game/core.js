// core.js — เครื่องมือพื้นฐานที่ทุกระบบในเกมใช้ร่วมกัน (เงิน ค่าสถานะ บันทึกเหตุการณ์)
// แยกออกมาจาก engine.js เพื่อให้ระบบย่อย (ครอบครัว ธุรกิจ บ้าน ประกัน การ์ด) อยู่คนละไฟล์ได้

import { RULES } from './rules.js';
import { GLOBAL_EVENT_BY_ID } from './events.js';

const MAX_LOG = 150;
export const STAT_NAMES = { health: 'สุขภาพ', happiness: 'ความสุข', hygiene: 'ความสะอาด' };

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ตัวเลือกเดียวของกิจกรรม
export const one = (o) => [{ params: {}, cost: 0, ...o }];

export function emit(state, event) {
  state.events.push(event);
}

export function log(state, playerId, text, tone = 'info') {
  state.log.push({ id: ++state.logSeq, week: state.week, playerId, text, tone });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

// แจ้งเตือนสั้น ๆ ให้ทุกคนเห็น (เช่น โดนแย่งตำแหน่ง โดนแกล้ง)
export function notify(state, playerId, icon, text, tone = 'info') {
  emit(state, { type: 'notify', playerId, icon, text, tone });
}

export function currentMods(state) {
  return GLOBAL_EVENT_BY_ID[state.global.eventId]?.mods || {};
}

export function gainCash(state, p, amount) {
  if (amount <= 0) return;
  p.cash += amount;
  p.totals.earned += amount;
}

export function spend(state, p, amount) {
  p.cash -= amount;
  p.totals.spent += amount;
}

// ค่าใช้จ่ายจำเป็น: ตัดเงินสด → เงินฝาก → กู้ธนาคารอัตโนมัติ
export function payBill(state, p, amount, reason) {
  if (amount <= 0) return;
  p.totals.spent += amount;
  let left = amount;
  const fromCash = Math.min(p.cash, left);
  p.cash -= fromCash;
  left -= fromCash;
  if (left > 0) {
    const fromSavings = Math.min(p.savings, left);
    p.savings -= fromSavings;
    left -= fromSavings;
  }
  if (left > 0) {
    const n = Math.ceil(left / RULES.loan.amount);
    p.loans += n;
    p.cash += n * RULES.loan.amount - left;
    addStats(state, p, { happiness: -5 });
    log(state, p.id, `🏦 ${p.name} เงินไม่พอจ่าย${reason} ธนาคารให้กู้อัตโนมัติ ${n} สัญญา`, 'bad');
  }
}

// mult ใช้คูณเฉพาะค่าที่เพิ่มขึ้น (โบนัสจากดวง)
export function addStats(state, p, delta, mult = 1) {
  const applied = {};
  for (const [k, v] of Object.entries(delta)) {
    if (!v || !(k in p.stats)) continue;
    const before = p.stats[k];
    const change = v > 0 ? Math.round(v * mult) : v;
    p.stats[k] = clamp(before + change);
    applied[k] = p.stats[k] - before;
  }
  return applied;
}

export function statText(d) {
  return (
    Object.entries(d)
      .filter(([, v]) => v)
      .map(([k, v]) => `${STAT_NAMES[k]} ${v > 0 ? '+' : ''}${v}`)
      .join(', ') || 'ไม่มีอะไรเปลี่ยน'
  );
}

export function addPoints(p, points) {
  p.bonusPoints += points;
  p.score += points;
}

// ผู้เล่นคนอื่นตามลำดับการเล่น
export function others(state, p) {
  return state.order.filter((id) => id !== p.id).map((id) => state.players[id]);
}
