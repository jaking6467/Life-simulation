// ของแต่งบ้านและของใช้ (ซื้อที่ร้านเฟอร์นิเจอร์ & ไอที) — มีผลทุกสุดสัปดาห์
// decor = คะแนนความหรูของบ้าน, weekly = ค่าที่ได้เพิ่มทุกสุดสัปดาห์

export const FURNITURE_LIST = [
  { id: 'plants', name: 'ต้นไม้ฟอกอากาศ', icon: '🪴', price: 1200, decor: 1, weekly: { health: 1 } },
  { id: 'bed', name: 'เตียงนอนนุ่มพิเศษ', icon: '🛏️', price: 2500, decor: 1, weekly: {}, note: 'นอนพักผ่อนได้สุขภาพเพิ่มอีก 3' },
  { id: 'fridge', name: 'ตู้เย็น', icon: '🧊', price: 4000, decor: 0, weekly: {}, note: 'เก็บของสดได้ถึง 6 มื้อ' },
  { id: 'aquarium', name: 'ตู้ปลาสวยงาม', icon: '🐠', price: 4500, decor: 2, weekly: { happiness: 2 } },
  { id: 'tv', name: 'ทีวีจอยักษ์', icon: '📺', price: 6000, decor: 1, weekly: { happiness: 3 } },
  { id: 'robot', name: 'หุ่นยนต์ดูดฝุ่นติดอาวุธ', icon: '🤖', price: 7000, decor: 1, weekly: { hygiene: 5 }, note: 'ไล่ขโมยได้ บ้านปลอดภัย 100%' },
  { id: 'console', name: 'เครื่องเล่นเกม', icon: '🕹️', price: 8000, decor: 1, weekly: { happiness: 4 } },
  { id: 'sofa', name: 'โซฟาดีไซเนอร์', icon: '🛋️', price: 9000, decor: 3, weekly: { happiness: 2 } },
  { id: 'painting', name: 'ภาพวาดราคาแพง', icon: '🖼️', price: 12000, decor: 4, weekly: {} },
  { id: 'computer', name: 'คอมพิวเตอร์สเปกแรง', icon: '🖥️', price: 14000, decor: 1, weekly: {}, note: 'เรียนออนไลน์ที่บ้านได้' },
  { id: 'massage', name: 'เก้าอี้นวดไฟฟ้า', icon: '💺', price: 16000, decor: 2, weekly: { health: 3 } },
];

export const FURNITURE = Object.freeze(Object.fromEntries(FURNITURE_LIST.map((f) => [f.id, f])));

export const PETS = Object.freeze({
  cat: { id: 'cat', name: 'แมว', icon: '🐱', price: 2000, happiness: 3, note: 'นำโชค: ถูกลอตเตอรี่ง่ายขึ้น' },
  dog: { id: 'dog', name: 'สุนัข', icon: '🐶', price: 3500, happiness: 4, note: 'ขยันตาม: ค่าแรง +10%' },
});

// หุ้น: ราคาเปลี่ยนทุกสิ้นสัปดาห์ (หลังทุกคนเล่นครบ)
export const STOCK_LIST = [
  { id: 'CLUCK', name: 'คลั๊กเกอร์ฟู้ดส์', icon: '🍗', price: 100, vol: 0.08 },
  { id: 'SIAM', name: 'ธนาคารสยามสยาม', icon: '🏦', price: 150, vol: 0.05 },
  { id: 'TECH', name: 'ไทยเทคยูนิคอร์น', icon: '🚀', price: 250, vol: 0.16 },
  { id: 'GOLD', name: 'ทองคำ (กรัม)', icon: '🥇', price: 2000, vol: 0.03 },
];
export const STOCKS = Object.freeze(Object.fromEntries(STOCK_LIST.map((s) => [s.id, s])));

// ของที่นักเก็บของเก่าคุ้ยเจอ
export const ARTIFACTS = Object.freeze([
  { id: 'amulet', name: 'พระเครื่องโบราณ', icon: '📿', value: 6000 },
  { id: 'coin', name: 'เหรียญกษาปณ์ ร.5', icon: '🪙', value: 5000 },
  { id: 'vase', name: 'แจกันลายคราม', icon: '🏺', value: 8000 },
  { id: 'watch', name: 'นาฬิกาพกทองคำ', icon: '⌚', value: 12000 },
  { id: 'vinyl', name: 'แผ่นเสียงหายาก', icon: '💿', value: 4000 },
]);
