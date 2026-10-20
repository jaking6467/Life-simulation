// ตัวช่วยฝั่งหน้าจอ: ดึงข้อมูลเกมจากโค้ดที่ใช้ร่วมกับเซิร์ฟเวอร์ และข้อความภาษาไทย
export { BOARD_ROWS, SPACES, SEGMENTS, TYPE_INFO, describeSpace } from '@game/board.js';
export { CAREERS, PERKS, perkOwnerCareer } from '@game/careers.js';
export { HOUSES, houseAverageSale } from '@game/houses.js';
export { CARDS } from '@game/cards.js';
export { RULES, INSURANCE, TIMING, AVERAGE_TILE_VALUE } from '@game/rules.js';
export { formatMoney, formatShort } from '@game/format.js';

import { CAREERS } from '@game/careers.js';
import { RULES } from '@game/rules.js';
import { houseAverageSale } from '@game/houses.js';
import { SPACES, SEGMENTS } from '@game/board.js';

export function careerTitle(p) {
  const c = CAREERS[p.career];
  if (!c) return null;
  return c.titles[Math.min(p.salaryLevel, c.titles.length - 1)];
}

// ทรัพย์สินสุทธิโดยประมาณ (ไม่รวมบัตรความสุขซึ่งยังไม่เปิดเผย)
export function netWorth(p) {
  const houses = p.houses.reduce((s, h) => s + houseAverageSale(h.id), 0);
  return p.cash - p.loans * RULES.loanRepay + houses;
}

export function playerAge(p) {
  return SPACES[p.position]?.age ?? 18;
}

export function playerStage(p) {
  const seg = SEGMENTS[SPACES[p.position]?.seg];
  return seg ? seg.title : '';
}

const PHASE_TEXT = {
  starting: 'กำลังเริ่มเกม',
  chooseStart: 'กำลังเลือกว่าจะเรียนต่อหรือทำงาน',
  chooseCareer: 'กำลังเลือกอาชีพ',
  spin: 'กำลังจะหมุนวงล้อ',
  moving: 'กำลังเดิน',
  resolving: 'กำลังดำเนินการ',
  choosePath: 'กำลังเลือกเส้นทาง',
  marriage: 'กำลังตัดสินใจเรื่องแต่งงาน',
  buyHouse: 'กำลังเลือกซื้อบ้าน',
  realEstate: 'กำลังดูบ้านในตลาดอสังหาฯ',
  lifeBuy: 'กำลังตัดสินใจใช้เงินแลกความสุข',
  spinToWin: 'กำลังเลือกเลขชิงโชค',
  lawsuit: 'กำลังเลือกคนที่จะฟ้อง',
  nightSchool: 'กำลังคิดเรื่องเปลี่ยนชีวิตวัยกลางคน',
  retire: 'กำลังเลือกที่พักหลังเกษียณ',
  cardChoice: 'กำลังตัดสินใจเรื่องการ์ดชีวิต',
  gameOver: 'จบเกมแล้ว',
};

export function phaseText(phase) {
  return PHASE_TEXT[phase?.type] || '';
}

export const SPIN_PURPOSE = {
  move: 'หมุนเดิน',
  gift: 'หมุนใส่ซอง',
  compete: 'หมุนแข่งขัน',
  gamble: 'หมุนเสี่ยงดวง',
  salary: 'หมุนรายได้',
  sellHouse: 'หมุนขายบ้าน',
  spinToWin: 'หมุนชิงโชค',
};

// นับว่าอีกกี่ตาจะถึงเรา (ข้ามคนที่เกษียณแล้ว)
export function turnsUntil(view, myIds) {
  if (!view || !view.currentPlayerId || !myIds.length) return null;
  if (myIds.includes(view.currentPlayerId)) return 0;
  const active = view.order.filter((id) => !view.players.find((p) => p.id === id)?.retired);
  const i = active.indexOf(view.currentPlayerId);
  if (i < 0) return null;
  for (let k = 1; k <= active.length; k++) {
    if (myIds.includes(active[(i + k) % active.length])) return k;
  }
  return null;
}

// ตัวอักษรย่อของชื่อสำหรับหมุดบนกระดาน (รองรับสระนำหน้าภาษาไทย เช่น "เอ" → "เอ")
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
