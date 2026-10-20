// แผนที่เมือง: อาคาร 18 หลังเรียงรอบถนนวงแหวน (ตารางขอบ 6×5)
// เดินจากที่หนึ่งไปอีกที่ใช้เวลาตามจำนวนอาคารที่ต้องผ่าน (เลือกทางที่สั้นกว่า)

export const LOCATIONS = Object.freeze([
  { id: 'flat', short: 'แฟลต', name: 'แฟลตการเคหะ', icon: '🏚️', desc: 'ห้องเช่าราคาถูก (ใช้ของได้ 4 ชิ้น) ระวังขโมย' },
  { id: 'cluckers', short: 'ไก่ทอด', name: 'ไก่ทอดคลั๊กเกอร์', icon: '🍗', desc: 'อาหารจานด่วน อิ่มเร็ว แต่ไม่ค่อยดีต่อสุขภาพ' },
  { id: 'market', short: 'ซูเปอร์', name: 'ซูเปอร์มาร์เก็ต', icon: '🛒', desc: 'ของสดไปทำกินเองที่บ้าน และลอตเตอรี่' },
  { id: 'jobs', short: 'จัดหางาน', name: 'ศูนย์จัดหางาน', icon: '💼', desc: 'สมัครงาน เลื่อนตำแหน่ง ดูคุณสมบัติที่ต้องใช้' },
  { id: 'uni', short: 'มหาลัย', name: 'มหาวิทยาลัย', icon: '🎓', desc: 'ลงทะเบียนเรียนและเข้าเรียนเพื่อรับวุฒิ' },
  { id: 'office', short: 'ออฟฟิศ', name: 'อาคารสำนักงาน', icon: '🏢', desc: 'งานออฟฟิศเงินเดือนสูง ต้องมีวุฒิและชุดทำงาน' },
  { id: 'bank', short: 'ธนาคาร', name: 'ธนาคาร', icon: '🏦', desc: 'ฝากเงิน กู้เงิน และซื้อขายหุ้น' },
  { id: 'restaurant', short: 'ภัตตาคาร', name: 'ภัตตาคารริมน้ำ', icon: '🍜', desc: 'อาหารดี ๆ ดีต่อสุขภาพและใจ' },
  { id: 'condo', short: 'คอนโด', name: 'คอนโดหรู', icon: '🏙️', desc: 'ที่พักหรู (ใช้ของได้ 8 ชิ้น) ปลอดภัย พักผ่อนได้ดีกว่า' },
  { id: 'mall', short: 'ห้าง', name: 'ห้างสรรพสินค้า', icon: '👕', desc: 'ซื้อเสื้อผ้า จำเป็นต่อการทำงานและเรียน' },
  { id: 'furniture', short: 'เฟอร์นิเจอร์', name: 'ร้านเฟอร์นิเจอร์ & ไอที', icon: '🛋️', desc: 'แต่งบ้านอวดความรวย และของใช้ที่ช่วยชีวิต' },
  { id: 'arcade', short: 'ตู้เกม', name: 'ตู้เกม & โรงหนัง', icon: '🎮', desc: 'คลายเครียด เพิ่มความสุข' },
  { id: 'gym', short: 'ฟิตเนส', name: 'ฟิตเนส', icon: '🏋️', desc: 'ออกกำลังกายเพิ่มสุขภาพ (แต่เหงื่อออก)' },
  { id: 'hospital', short: 'โรงพยาบาล', name: 'โรงพยาบาล', icon: '🏥', desc: 'รักษาตัวเมื่อสุขภาพแย่' },
  { id: 'factory', short: 'โรงงาน', name: 'โรงงาน', icon: '🏭', desc: 'งานใช้แรง ไม่ต้องใช้วุฒิมาก แต่เหนื่อย' },
  { id: 'vehicles', short: 'โชว์รูม', name: 'โชว์รูมรถ', icon: '🛵', desc: 'มีพาหนะ เดินทางได้เร็วขึ้น' },
  { id: 'temple', short: 'วัด', name: 'วัด', icon: '⛩️', desc: 'ทำบุญ นั่งสมาธิ จิตใจสงบ' },
  { id: 'park', short: 'สวน', name: 'สวน & ตลาดนัด', icon: '🌳', desc: 'เดินเล่นฟรี รับเลี้ยงสัตว์ ขายของมือสอง' },
]);

export const LOCATION_IDS = LOCATIONS.map((l) => l.id);
export const LOCATION_BY_ID = Object.freeze(Object.fromEntries(LOCATIONS.map((l, i) => [l.id, { ...l, index: i }])));
export const HOMES = Object.freeze({
  flat: { id: 'flat', name: 'แฟลตการเคหะ', rent: 600, price: 40000, slots: 4, restBonus: 0, homePoints: 0, theft: 'flat' },
  condo: { id: 'condo', name: 'คอนโดหรู', rent: 2000, price: 150000, slots: 8, restBonus: 3, homePoints: 2, theft: 'condo' },
});

export const VEHICLES = Object.freeze({
  bicycle: { id: 'bicycle', name: 'จักรยาน', icon: '🚲', price: 2500, factor: 0.75 },
  motorbike: { id: 'motorbike', name: 'มอเตอร์ไซค์', icon: '🛵', price: 18000, factor: 0.5 },
  car: { id: 'car', name: 'รถยนต์', icon: '🚗', price: 90000, factor: 0.34, happiness: 2 },
});
export const VEHICLE_ORDER = ['bicycle', 'motorbike', 'car'];

const N = LOCATIONS.length;

export function ringSteps(fromId, toId) {
  const a = LOCATION_BY_ID[fromId].index;
  const b = LOCATION_BY_ID[toId].index;
  const d = Math.abs(a - b);
  return Math.min(d, N - d);
}

// เส้นทางเดิน (ไม่รวมจุดเริ่ม) ตามทิศที่สั้นกว่า
export function ringPath(fromId, toId) {
  const a = LOCATION_BY_ID[fromId].index;
  const b = LOCATION_BY_ID[toId].index;
  const forward = (b - a + N) % N;
  const dir = forward <= N - forward ? 1 : -1;
  const path = [];
  for (let i = a; i !== b; ) {
    i = (i + dir + N) % N;
    path.push(LOCATIONS[i].id);
  }
  return path;
}

export function travelHours(fromId, toId, vehicle = null) {
  const steps = ringSteps(fromId, toId);
  if (!steps) return 0;
  const factor = vehicle ? VEHICLES[vehicle].factor : 1;
  return Math.max(1, Math.ceil(steps * factor));
}

// ตำแหน่งบนตาราง 6 คอลัมน์ × 5 แถว (เฉพาะขอบ) เรียงตามเข็มนาฬิกาจากมุมซ้ายบน
export const GRID = { cols: 6, rows: 5 };
export function gridPosition(index) {
  const { cols, rows } = GRID;
  if (index < cols) return { col: index + 1, row: 1 };
  if (index < cols + rows - 2) return { col: cols, row: index - cols + 2 };
  if (index < 2 * cols + rows - 2) return { col: cols - (index - (cols + rows - 2)), row: rows };
  return { col: 1, row: rows - (index - (2 * cols + rows - 2)) - 1 };
}
