// งานทั้งหมด: ค่าแรงต่อชั่วโมง คุณสมบัติที่ต้องใช้ และระดับอาชีพ (tier 1–6 ใช้คิดคะแนนอาชีพ)
// req: { course: รหัสวุฒิ | minLevel: ระดับวุฒิสูงสุดขั้นต่ำ, xp: ชั่วโมงประสบการณ์, clothes: ระดับชุด, health: สุขภาพขั้นต่ำ }
// strain = สุขภาพที่ลดลงต่อกะ 8 ชั่วโมง

export const CLOTHES = Object.freeze([
  { tier: 0, name: 'เสื้อผ้าเก่า ๆ', price: 0, weeks: 0 },
  { tier: 1, name: 'ชุดลำลอง', icon: '👕', price: 800, weeks: 8 },
  { tier: 2, name: 'ชุดทำงาน', icon: '👔', price: 2500, weeks: 10 },
  { tier: 3, name: 'สูทหรูแบรนด์เนม', icon: '🤵', price: 7000, weeks: 12 },
]);

export const JOB_PERKS = Object.freeze({
  cluckers: 'ทำงานที่นี่ได้กินไก่ทอดฟรี (นับว่ากินแล้วในสัปดาห์นี้)',
  market: 'ส่วนลดพนักงาน: ได้ของสดกลับบ้าน 1 มื้อทุกกะ',
  restaurant: 'ได้กินอาหารพนักงาน (นับว่ากินแล้วในสัปดาห์นี้)',
  gym: 'ใช้ห้องอาบน้ำพนักงาน: ความสะอาดเต็มหลังเลิกงาน',
  hospital: 'ตรวจสุขภาพฟรี: สุขภาพ +5 หลังเลิกงาน',
  arcade: 'เล่นเกมฟรีช่วงพัก: ความสุขลดน้อยลง',
  bank: 'ดอกเบี้ยเงินฝากพนักงาน ×2',
  uni: 'เรียนฟรี: ลดค่าเทอม 50%',
});

const J = (id, location, title, tier, wage, req = {}, strain = 3) => ({ id, location, title, tier, wage, req, strain });

export const JOB_LIST = [
  J('fryCook', 'cluckers', 'พนักงานทอดไก่', 1, 60, {}, 3),
  J('cluckManager', 'cluckers', 'ผู้จัดการร้านไก่ทอด', 3, 130, { course: 'highschool', xp: 40, clothes: 1 }, 3),
  J('cashier', 'market', 'แคชเชียร์', 1, 65, { clothes: 1 }, 2),
  J('storeManager', 'market', 'ผู้จัดการสาขา', 3, 140, { course: 'highschool', xp: 50, clothes: 2 }, 2),
  J('arcadeStaff', 'arcade', 'พนักงานตู้เกม', 1, 60, {}, 2),
  J('clerk', 'mall', 'พนักงานขายเสื้อผ้า', 2, 80, { clothes: 1 }, 2),
  J('mallManager', 'mall', 'ผู้จัดการห้าง', 4, 200, { course: 'business', xp: 60, clothes: 2 }, 2),
  J('furnitureSales', 'furniture', 'พนักงานขายเฟอร์นิเจอร์', 2, 85, { course: 'highschool', clothes: 1 }, 2),
  J('gymDesk', 'gym', 'พนักงานต้อนรับฟิตเนส', 1, 65, {}, 2),
  J('trainer', 'gym', 'เทรนเนอร์ส่วนตัว', 3, 150, { health: 80, xp: 20 }, 2),
  J('worker', 'factory', 'คนงานโรงงาน', 1, 80, { health: 40 }, 7),
  J('foreman', 'factory', 'หัวหน้าคนงาน', 3, 140, { course: 'highschool', xp: 60, health: 40 }, 5),
  J('engineer', 'factory', 'วิศวกรโรงงาน', 5, 260, { course: 'engineering', xp: 30, clothes: 2 }, 3),
  J('waiter', 'restaurant', 'พนักงานเสิร์ฟ', 1, 70, { clothes: 1 }, 3),
  J('chef', 'restaurant', 'เชฟภัตตาคาร', 4, 190, { course: 'culinary', xp: 40 }, 4),
  J('cleaner', 'hospital', 'พนักงานทำความสะอาด', 1, 65, {}, 3),
  J('nurse', 'hospital', 'พยาบาลวิชาชีพ', 4, 210, { course: 'nursing', clothes: 1 }, 4),
  J('doctor', 'hospital', 'แพทย์', 6, 420, { course: 'medicine', xp: 40, clothes: 2 }, 4),
  J('librarian', 'uni', 'บรรณารักษ์', 2, 90, { course: 'highschool', clothes: 1 }, 1),
  J('lecturer', 'uni', 'อาจารย์มหาวิทยาลัย', 5, 280, { minLevel: 3, clothes: 2 }, 1),
  J('officeClerk', 'office', 'พนักงานธุรการ', 2, 100, { course: 'highschool', clothes: 2 }, 1),
  J('programmer', 'office', 'โปรแกรมเมอร์', 5, 280, { course: 'computer', clothes: 1 }, 2),
  J('manager', 'office', 'ผู้จัดการฝ่าย', 5, 300, { course: 'business', xp: 120, clothes: 3 }, 2),
  J('ceo', 'office', 'ประธานบริษัท (CEO)', 6, 550, { course: 'mba', xp: 200, clothes: 3 }, 2),
  J('guard', 'bank', 'พนักงานรักษาความปลอดภัย', 1, 70, { health: 50 }, 2),
  J('teller', 'bank', 'พนักงานธนาคาร', 3, 120, { course: 'highschool', clothes: 2 }, 1),
  J('bankManager', 'bank', 'ผู้จัดการธนาคาร', 6, 480, { course: 'mba', xp: 160, clothes: 3 }, 2),
];

export const JOBS = Object.freeze(Object.fromEntries(JOB_LIST.map((j) => [j.id, j])));
