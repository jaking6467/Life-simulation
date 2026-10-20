// บ้าน 10 หลัง (มีหลังเดียวในเกม ใครซื้อไปแล้วคนอื่นซื้อไม่ได้จนกว่าจะขายคืน)
// ตอนขาย หมุนวงล้อ: 1-5 ได้ราคาต่ำ, 6-10 ได้ราคาสูง

export const HOUSES = Object.freeze({
  studio: { id: 'studio', name: 'คอนโดสตูดิโอ', icon: '🏢', price: 100000, sellLow: 80000, sellHigh: 150000 },
  townhouse: { id: 'townhouse', name: 'ทาวน์เฮาส์', icon: '🏘️', price: 160000, sellLow: 130000, sellHigh: 230000 },
  cottage: { id: 'cottage', name: 'บ้านไม้ในสวน', icon: '🛖', price: 200000, sellLow: 170000, sellHigh: 280000 },
  loft: { id: 'loft', name: 'ลอฟต์ใจกลางเมือง', icon: '🏙️', price: 220000, sellLow: 150000, sellHigh: 340000 },
  suburban: { id: 'suburban', name: 'บ้านเดี่ยวชานเมือง', icon: '🏡', price: 260000, sellLow: 220000, sellHigh: 350000 },
  thai: { id: 'thai', name: 'เรือนไทยริมน้ำ', icon: '🛶', price: 300000, sellLow: 240000, sellHigh: 420000 },
  beach: { id: 'beach', name: 'บ้านพักริมทะเล', icon: '🏖️', price: 380000, sellLow: 260000, sellHigh: 600000 },
  farm: { id: 'farm', name: 'ฟาร์มเฮาส์เขาใหญ่', icon: '🌄', price: 420000, sellLow: 340000, sellHigh: 560000 },
  penthouse: { id: 'penthouse', name: 'เพนต์เฮาส์วิวแม่น้ำ', icon: '🌆', price: 500000, sellLow: 380000, sellHigh: 750000 },
  mansion: { id: 'mansion', name: 'คฤหาสน์หรู', icon: '🏰', price: 750000, sellLow: 550000, sellHigh: 1100000 },
});

export const HOUSE_LIST = Object.values(HOUSES);

export function houseAverageSale(id) {
  const h = HOUSES[id];
  return h ? (h.sellLow + h.sellHigh) / 2 : 0;
}
