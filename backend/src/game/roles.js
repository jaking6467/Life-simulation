// บทบาท (role): แต่ละบทบาทมีความสามารถพิเศษและภารกิจของตัวเอง ทำภารกิจสำเร็จได้คะแนนโบนัส
// check(p) ใช้ข้อมูลของผู้เล่นในเกม (ดู createPlayer ใน engine.js)

import { COURSES } from './courses.js';
import { JOBS } from './jobs.js';

const courseLevelMax = (p) => Math.max(0, ...p.education.completed.map((id) => COURSES[id].level));

export const ROLE_LIST = [
  {
    id: 'workaholic',
    name: 'คนบ้างาน',
    icon: '💼',
    desc: 'ชีวิตคือการทำงาน ยิ่งทำติดกันยิ่งได้เงินมาก',
    perks: ['ทำงานกะที่ 2 ขึ้นไปในสัปดาห์เดียวกัน ได้ค่าแรงเพิ่มกะละ 10% (สูงสุด +40%)', 'ทำงานแล้วความสุขลดลงแค่ครึ่งเดียว'],
    quests: [
      { id: 'w1', text: 'ทำงานครบ 5 กะในสัปดาห์เดียว', points: 15, check: (p) => p.c.maxShiftsWeek >= 5 },
      { id: 'w2', text: 'ทำงานรวม 25 กะ', points: 25, check: (p) => p.c.shifts >= 25 },
      { id: 'w3', text: 'ได้งานระดับ 5 ขึ้นไป', points: 40, check: (p) => (JOBS[p.job]?.tier || 0) >= 5 },
    ],
  },
  {
    id: 'artist',
    name: 'ศิลปิน',
    icon: '🎨',
    desc: 'ไม่อยากทำงานประจำ วาดภาพขายเลี้ยงชีพ',
    perks: ['วาดภาพที่บ้านได้ (6 ชม.) ยิ่งมีความสุขภาพยิ่งมีราคา', 'ขายภาพได้ที่สวน & ตลาดนัด', 'ทำงานประจำแล้วความสุขลดเป็น 2 เท่า'],
    quests: [
      { id: 'a1', text: 'เรียนจบศิลปกรรมศาสตร์', points: 15, check: (p) => p.education.completed.includes('arts') },
      { id: 'a2', text: 'ขายภาพได้ 6 ภาพ', points: 25, check: (p) => p.c.artSold >= 6 },
      { id: 'a3', text: 'ขายภาพได้ราคา ฿4,800 ขึ้นไป', points: 40, check: (p) => p.c.artBest >= 4800 },
    ],
  },
  {
    id: 'scavenger',
    name: 'นักเก็บของเก่า',
    icon: '🧺',
    desc: 'ขยะของคนหนึ่งคือสมบัติของอีกคน',
    perks: ['คุ้ยหาของที่สวน & ตลาดนัดได้ (2 ชม.) มีโอกาสเจอวัตถุโบราณหายาก', 'ขายของที่เจอได้ที่ตลาดนัด', 'วัตถุโบราณที่สะสมไว้เพิ่มความหรูของบ้าน (ชนิดละ +2)'],
    quests: [
      { id: 's1', text: 'ขายของที่คุ้ยเจอได้รวม ฿8,000', points: 15, check: (p) => p.c.findsSold >= 8000 },
      { id: 's2', text: 'เจอวัตถุโบราณ 2 ชนิด', points: 25, check: (p) => p.c.artifactKinds.length >= 2 },
      { id: 's3', text: 'ถือวัตถุโบราณ 4 ชนิดพร้อมกัน', points: 40, check: (p) => new Set(p.finds.filter((f) => f.artifact).map((f) => f.artifact)).size >= 4 },
    ],
  },
  {
    id: 'mystic',
    name: 'หมอดู',
    icon: '🔮',
    desc: 'เชื่อดวงดาว ทำตามดวงแล้วโชคดี',
    perks: ['ทุกสัปดาห์ได้ดวงบอกสถานที่นำโชค ทำกิจกรรมที่นั่นได้ผล +50% และ +4 คะแนน', 'ทำบุญที่วัดได้ +1 คะแนน (สูงสุด 10 ครั้ง)', 'ลอตเตอรี่ถูกง่ายขึ้น 2 เท่า'],
    quests: [
      { id: 'm1', text: 'ทำบุญที่วัด 4 ครั้ง', points: 15, check: (p) => p.c.merits >= 4 },
      { id: 'm2', text: 'ทำตามดวงสำเร็จ 5 ครั้ง', points: 25, check: (p) => p.c.horoscopeHits >= 5 },
      { id: 'm3', text: 'ถูกลอตเตอรี่รางวัลใดก็ได้ 2 ครั้ง', points: 40, check: (p) => p.c.lotteryWins >= 2 },
    ],
  },
  {
    id: 'scholar',
    name: 'หนอนหนังสือ',
    icon: '📚',
    desc: 'รักการเรียนรู้ เรียนเร็วและได้ทุน',
    perks: ['เข้าเรียนใช้เวลาแค่ 4 ชม. (ปกติ 6 ชม.)', 'ค่าเทอมลด 30%', 'เรียนจบแต่ละหลักสูตรได้ +7 คะแนน'],
    quests: [
      { id: 'sc1', text: 'เรียนจบ 3 หลักสูตร', points: 15, check: (p) => p.education.completed.length >= 3 },
      { id: 'sc2', text: 'เรียนจบปริญญาโท (ระดับ 3)', points: 25, check: (p) => courseLevelMax(p) >= 3 },
      { id: 'sc3', text: 'เรียนจบ 5 หลักสูตร', points: 40, check: (p) => p.education.completed.length >= 5 },
    ],
  },
  {
    id: 'fitness',
    name: 'สายฟิต',
    icon: '💪',
    desc: 'ร่างกายแข็งแรงคือทุกอย่าง',
    perks: ['เริ่มเกมสุขภาพเต็ม 100', 'ออกกำลังกายได้สุขภาพ 2 เท่าและความสุขเพิ่ม'],
    quests: [
      { id: 'f1', text: 'ออกกำลังกาย 10 ครั้ง', points: 15, check: (p) => p.c.workouts >= 10 },
      { id: 'f2', text: 'ได้งานเทรนเนอร์ส่วนตัว', points: 25, check: (p) => p.job === 'trainer' || p.c.wasTrainer },
      { id: 'f3', text: 'จบสัปดาห์ด้วยสุขภาพ 90+ ติดกัน 5 สัปดาห์', points: 40, check: (p) => p.c.healthStreak >= 5 },
    ],
  },
  {
    id: 'senior',
    name: 'วัยเกษียณ',
    icon: '👴',
    desc: 'มีเงินเก็บและบำนาญ แต่เวลาและแรงน้อยลง',
    perks: ['เริ่มด้วยเงินฝาก ฿15,000 และได้บำนาญ ฿2,500 ทุกสัปดาห์', 'มีเวลาแค่ 50 ชม./สัปดาห์ และสุขภาพลดเร็วขึ้น'],
    quests: [
      { id: 'se1', text: 'มีทั้งแมวและสุนัข', points: 15, check: (p) => p.pets.includes('cat') && p.pets.includes('dog') },
      { id: 'se2', text: 'จบสัปดาห์ด้วยความสุข 80+', points: 25, check: (p) => p.c.happyWeek },
      { id: 'se3', text: 'มีทรัพย์สินสุทธิ ฿70,000', points: 40, check: (p) => p.c.netWorthBest >= 70000 },
    ],
  },
  {
    id: 'influencer',
    name: 'อินฟลูเอนเซอร์',
    icon: '📱',
    desc: 'ชีวิตต้องคอนเทนต์ ยอดฟอลคือรายได้',
    perks: ['ไลฟ์สดที่บ้านได้ (4 ชม.) ได้ผู้ติดตามและรายได้', 'ยิ่งสะอาด มีความสุข และบ้านสวย ผู้ติดตามยิ่งเพิ่มเร็ว'],
    quests: [
      { id: 'i1', text: 'มีผู้ติดตาม 5,000 คน', points: 15, check: (p) => p.followers >= 5000 },
      { id: 'i2', text: 'มีผู้ติดตาม 20,000 คน', points: 25, check: (p) => p.followers >= 20000 },
      { id: 'i3', text: 'มีผู้ติดตาม 50,000 คน', points: 40, check: (p) => p.followers >= 50000 },
    ],
  },
];

export const ROLES = Object.freeze(Object.fromEntries(ROLE_LIST.map((r) => [r.id, r])));
export const ROLE_IDS = ROLE_LIST.map((r) => r.id);
