// ค่าคงที่ของกติกา ปรับสมดุลเกมได้จากไฟล์นี้ที่เดียว

export const RULES = Object.freeze({
  hoursPerWeek: 60,
  startCash: 3000,
  startStats: { health: 80, happiness: 70, hygiene: 80 },
  startClothes: { tier: 1, weeksLeft: 6 },

  // ค่าที่ลดลงเองทุกสุดสัปดาห์
  passive: { health: -5, happiness: -4, hygiene: -20 },
  // ไม่ได้กินอะไรเลยทั้งสัปดาห์
  hunger: { health: -15, happiness: -10, hours: 10 },

  minHappinessToWork: 15, // ต่ำกว่านี้ "หมดไฟ" ทำงาน/เรียนไม่ได้
  minHygieneToWork: 20,
  minHygieneInterview: 30,
  minShiftHours: 2,
  shiftHours: 8,
  classHours: 6,

  loan: { amount: 5000, repay: 5500, max: 10 },
  savingsInterest: 0.01,
  hospitalized: { cost: 3000, health: 40 },
  theft: { flat: 0.15, condo: 0.03, minCash: 3000, share: 0.5, max: 20000 },
  lottery: {
    price: 100,
    maxPerWeek: 10,
    every: 2, // ออกรางวัลทุก 2 สัปดาห์
    prizes: [
      { chance: 1 / 1000, amount: 60000, name: 'รางวัลที่ 1' },
      { chance: 1 / 100, amount: 2000, name: 'เลขท้าย 3 ตัว' },
      { chance: 1 / 20, amount: 200, name: 'เลขท้าย 2 ตัว' },
    ],
  },
  petFood: 150,
  weeksOptions: [10, 15, 20, 30],
  defaultWeeks: 15,

  // คะแนนความมั่งคั่ง: ทรัพย์สินสุทธิถึงแต่ละขั้นได้ +1 คะแนนต่อสัปดาห์
  wealthTiers: [2000, 5000, 10000, 20000, 40000, 70000, 120000, 200000],
  weeklyEventChance: 0.35,
  choiceEventChance: 0.5,
  globalEventChance: 0.5,
});

// หมวดคะแนนประจำสัปดาห์
export const SCORE_CATEGORIES = Object.freeze([
  { id: 'health', name: 'สุขภาพ', icon: '❤️', max: 8 },
  { id: 'happiness', name: 'ความสุข', icon: '😊', max: 8 },
  { id: 'hygiene', name: 'ความสะอาด', icon: '🧼', max: 4 },
  { id: 'education', name: 'การศึกษา', icon: '🎓', max: 8 },
  { id: 'career', name: 'อาชีพ', icon: '💼', max: 8 },
  { id: 'wealth', name: 'ความมั่งคั่ง', icon: '💰', max: 8 },
  { id: 'home', name: 'บ้าน', icon: '🏠', max: 6 },
]);

// ช่วงเวลาแอนิเมชัน (มิลลิวินาที) ใช้ร่วมกันทั้งเซิร์ฟเวอร์และหน้าเว็บ
// เซิร์ฟเวอร์รอจนแอนิเมชันเล่นจบก่อนให้บอทเล่นขั้นต่อไป
export const TIMING = Object.freeze({
  base: 100,
  step: 110, // เดินผ่านอาคาร 1 หลัง
  action: 280,
  card: 1900, // การ์ดเหตุการณ์
  weekend: 700, // สรุปสุดสัปดาห์ (ของเราเองค้างไว้ให้อ่านจนกดปิด)
  botThink: 250,
});

export function estimateAnimMs(events, speed = 1) {
  if (!events || !events.length) return 0;
  let ms = TIMING.base;
  for (const e of events) {
    if (e.type === 'move') ms += e.path.length * TIMING.step;
    else if (e.type === 'action') ms += TIMING.action;
    else if (e.type === 'event' || e.type === 'globalEvent') ms += TIMING.card;
    else if (e.type === 'weekend') ms += TIMING.weekend;
  }
  return Math.round(ms / (speed || 1));
}
