// อาชีพทั้งหมด 12 อาชีพ (ไม่ซ้ำกันในเกมเดียว)
// perk = หมวดค่าใช้จ่าย เมื่อผู้เล่นคนอื่นจ่ายเงินหมวดนี้ เงินจะเข้ากระเป๋าเจ้าของอาชีพแทนธนาคาร

export const PERKS = Object.freeze({
  medical: { id: 'medical', name: 'ค่ารักษาพยาบาล', icon: '🏥' },
  legal: { id: 'legal', name: 'ค่าทนายและกฎหมาย', icon: '⚖️' },
  tech: { id: 'tech', name: 'อุปกรณ์ไอที', icon: '💻' },
  tax: { id: 'tax', name: 'ภาษี', icon: '🧾' },
  education: { id: 'education', name: 'การศึกษา', icon: '📚' },
  home: { id: 'home', name: 'บ้านและการซ่อมแซม', icon: '🏠' },
  fine: { id: 'fine', name: 'ค่าปรับ', icon: '🚨' },
  car: { id: 'car', name: 'ซ่อมรถ', icon: '🔧' },
  shopping: { id: 'shopping', name: 'ช้อปปิ้ง', icon: '🛍️' },
  food: { id: 'food', name: 'อาหารและงานเลี้ยง', icon: '🍲' },
  sport: { id: 'sport', name: 'กีฬาและฟิตเนส', icon: '🏋️' },
  entertainment: { id: 'entertainment', name: 'บันเทิงและท่องเที่ยว', icon: '🎬' },
});

export const CAREERS = Object.freeze({
  // ---------- ต้องมีปริญญา ----------
  doctor: {
    id: 'doctor', name: 'แพทย์', icon: '🩺', degree: true, perk: 'medical',
    salaries: [50000, 65000, 80000, 95000],
    titles: ['แพทย์ใช้ทุน', 'แพทย์ประจำบ้าน', 'แพทย์เฉพาะทาง', 'ผู้อำนวยการโรงพยาบาล'],
  },
  lawyer: {
    id: 'lawyer', name: 'ทนายความ', icon: '⚖️', degree: true, perk: 'legal',
    salaries: [45000, 60000, 75000, 90000],
    titles: ['ทนายฝึกหัด', 'ทนายความ', 'หุ้นส่วนสำนักงานกฎหมาย', 'ทนายชื่อดังระดับประเทศ'],
  },
  engineer: {
    id: 'engineer', name: 'วิศวกรซอฟต์แวร์', icon: '💻', degree: true, perk: 'tech',
    salaries: [45000, 60000, 75000, 95000],
    titles: ['จูเนียร์ดีเวลอปเปอร์', 'ซีเนียร์ดีเวลอปเปอร์', 'เทคลีด', 'CTO'],
  },
  accountant: {
    id: 'accountant', name: 'นักบัญชี', icon: '📊', degree: true, perk: 'tax',
    salaries: [40000, 55000, 70000, 90000],
    titles: ['ผู้ช่วยผู้สอบบัญชี', 'นักบัญชีอาวุโส', 'ผู้จัดการฝ่ายบัญชี', 'CFO'],
  },
  teacher: {
    id: 'teacher', name: 'ครู', icon: '📚', degree: true, perk: 'education',
    salaries: [40000, 50000, 60000, 75000],
    titles: ['ครูผู้ช่วย', 'ครูชำนาญการ', 'รองผู้อำนวยการ', 'ผู้อำนวยการโรงเรียน'],
  },
  architect: {
    id: 'architect', name: 'สถาปนิก', icon: '📐', degree: true, perk: 'home',
    salaries: [40000, 55000, 70000, 90000],
    titles: ['สถาปนิกจูเนียร์', 'สถาปนิก', 'สถาปนิกอาวุโส', 'เจ้าของบริษัทออกแบบ'],
  },

  // ---------- ไม่ต้องใช้ปริญญา ----------
  police: {
    id: 'police', name: 'ตำรวจ', icon: '👮', degree: false, perk: 'fine',
    salaries: [30000, 40000, 55000, 65000],
    titles: ['สิบตำรวจตรี', 'จ่าสิบตำรวจ', 'ร้อยตำรวจเอก', 'ผู้กำกับการ'],
  },
  mechanic: {
    id: 'mechanic', name: 'ช่างยนต์', icon: '🔧', degree: false, perk: 'car',
    salaries: [30000, 40000, 50000, 65000],
    titles: ['ช่างฝึกหัด', 'ช่างประจำอู่', 'หัวหน้าช่าง', 'เจ้าของอู่'],
  },
  sales: {
    id: 'sales', name: 'พนักงานขาย', icon: '🛍️', degree: false, perk: 'shopping',
    salaries: [30000, 40000, 55000, 70000],
    titles: ['พนักงานขาย', 'ซูเปอร์ไวเซอร์', 'ผู้จัดการฝ่ายขาย', 'ผู้อำนวยการฝ่ายขาย'],
  },
  chef: {
    id: 'chef', name: 'เชฟ', icon: '🍳', degree: false, perk: 'food',
    salaries: [30000, 40000, 50000, 65000],
    titles: ['ผู้ช่วยเชฟ', 'เชฟประจำครัว', 'หัวหน้าเชฟ', 'เจ้าของร้านติดดาว'],
  },
  athlete: {
    id: 'athlete', name: 'นักกีฬาอาชีพ', icon: '⚽', degree: false, perk: 'sport',
    salaries: [35000, 45000, 55000, 70000],
    titles: ['นักกีฬาสำรอง', 'ผู้เล่นตัวจริง', 'กัปตันทีม', 'ตำนานทีมชาติ'],
  },
  influencer: {
    id: 'influencer', name: 'อินฟลูเอนเซอร์', icon: '📱', degree: false, perk: 'entertainment',
    variable: true,
    salaries: [25000, 35000, 50000, 65000],
    titles: ['ไมโครอินฟลูเอนเซอร์', 'ครีเอเตอร์', 'ดาวรุ่งโซเชียล', 'เซเลบระดับประเทศ'],
    note: 'รายได้ผันผวน: ทุกวันเงินเดือนต้องหมุน ได้ตั้งแต่ ×0.2 ถึง ×2 ของฐานเงินเดือน',
  },
});

export const CAREER_LIST = Object.values(CAREERS);

export function perkOwnerCareer(perkId) {
  return CAREER_LIST.find((c) => c.perk === perkId) || null;
}
