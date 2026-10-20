// ตัวช่วยฝั่งหน้าจอ: ดึงข้อมูลเกมจากโค้ดที่ใช้ร่วมกับเซิร์ฟเวอร์ และข้อความภาษาไทย
export { LOCATIONS, LOCATION_BY_ID, HOMES, VEHICLES, GRID, gridPosition } from '@game/city.js';
export { JOBS, CLOTHES, JOB_PERKS } from '@game/jobs.js';
export { COURSES } from '@game/courses.js';
export { FURNITURE, PETS, STOCKS, STOCK_LIST, ARTIFACTS } from '@game/items.js';
export { ROLES, ROLE_LIST } from '@game/roles.js';
export { RULES, TIMING, SCORE_CATEGORIES } from '@game/rules.js';
export { GLOBAL_EVENT_BY_ID, CHOICE_EVENT_BY_ID } from '@game/events.js';
export { formatMoney, formatShort } from '@game/format.js';
export { CARDS, CARD_LIST } from '@game/cards.js';
export { BUSINESSES, BUSINESS_LIST } from '@game/business.js';
export { INSURANCE, INSURANCE_LIST } from '@game/insurance.js';
export { DATE_SPOTS, DATE_STYLES } from '@game/family.js';

import { JOBS } from '@game/jobs.js';
import { LOCATION_BY_ID } from '@game/city.js';

export const BOT_LEVEL_TEXT = { easy: '😊 ง่าย', normal: '🙂 ปกติ', hard: '😈 ยาก' };

export function jobTitle(p) {
  return JOBS[p.job]?.title || null;
}

export function locationName(id) {
  return LOCATION_BY_ID[id]?.name || '';
}

const PHASE_TEXT = {
  choice: 'กำลังตัดสินใจเรื่องสำคัญ',
  week: 'กำลังใช้ชีวิตในสัปดาห์นี้',
  between: 'กำลังจบสัปดาห์',
  gameOver: 'จบเกมแล้ว',
};

export function phaseText(phase) {
  return PHASE_TEXT[phase?.type] || '';
}

// นับว่าอีกกี่ตาจะถึงเรา (ในสัปดาห์นี้ หรือสัปดาห์ถัดไป)
export function turnsUntil(view, myIds) {
  if (!view || !view.currentPlayerId || !myIds.length) return null;
  if (myIds.includes(view.currentPlayerId)) return 0;
  const i = view.order.indexOf(view.currentPlayerId);
  for (let k = 1; k <= view.order.length; k++) {
    if (myIds.includes(view.order[(i + k) % view.order.length])) return k;
  }
  return null;
}

// ตัวอักษรย่อของชื่อสำหรับหมุดบนแผนที่ (รองรับสระนำหน้าภาษาไทย เช่น "เอ" → "เอ")
const LEADING_VOWELS = 'เแโใไ';
export function initials(name) {
  // บอทชื่อขึ้นต้นด้วย "บอท" เหมือนกันหมด จึงใช้ชื่อส่วนที่เหลือแทน
  const text = String(name || '?').trim().replace(/^บอท(?=.)/, '');
  let parts;
  try {
    parts = Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  } catch {
    parts = Array.from(text);
  }
  if (!parts.length) return '?';
  return LEADING_VOWELS.includes(parts[0]) && parts[1] ? parts[0] + parts[1] : parts[0].toUpperCase();
}
