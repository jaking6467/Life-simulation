// ค่าคงที่ของกติกา ปรับสมดุลเกมได้จากไฟล์นี้ที่เดียว

export const INSURANCE = Object.freeze({
  auto: { id: 'auto', name: 'ประกันรถยนต์', icon: '🚗', price: 10000, covers: 'อุบัติเหตุรถยนต์' },
  home: { id: 'home', name: 'ประกันบ้าน', icon: '🏠', price: 15000, covers: 'ภัยพิบัติที่ทำให้บ้านเสียหาย (ต้องมีบ้านก่อน)' },
  health: { id: 'health', name: 'ประกันสุขภาพ', icon: '❤️', price: 20000, covers: 'ค่ารักษาพยาบาล' },
});

export const RULES = Object.freeze({
  startCash: 10000,

  // เงินกู้ธนาคาร: กู้ 20,000 คืน 25,000
  loanAmount: 20000,
  loanRepay: 25000,
  maxVoluntaryLoans: 15,
  collegeLoans: 5,

  paydayLandBonus: 0.5, // หยุดตรงช่องเงินเดือนพอดี ได้โบนัสเพิ่ม 50%
  childUpkeep: 4000, // ค่าเลี้ยงดูลูกต่อคน ทุกครั้งที่เงินเดือนออก
  taxRate: 0.2,
  maxLevelBonus: 20000,

  // ใบหุ้นหมายเลข 1-10: ใครหมุนเดินได้เลขนั้น เจ้าของใบหุ้นรับปันผล
  stockPrice: 40000,
  stockPayout: 10000,
  maxStocks: 3,

  weddingCost: 20000,
  singleBonus: 10000,
  giftTable: [
    [1, 4, 5000],
    [5, 8, 10000],
    [9, 10, 20000],
  ],
  petCost: 5000,
  nightSchoolCost: 80000,
  lawsuitFee: 10000,
  spinToWin: { cost: 10000, prize: 150000, maxNumbers: 3 },

  retireBonusTiles: [2, 1], // เกษียณคนที่ 1 ได้ 2 ใบ คนที่ 2 ได้ 1 ใบ
  countryTiles: 1,
  estateTiles: 4,

  // มูลค่าบัตรความสุข (ซ่อนไว้จนจบเกม)
  lifeTiles: [
    ...Array(8).fill(20000),
    ...Array(8).fill(40000),
    ...Array(6).fill(60000),
    ...Array(4).fill(80000),
    ...Array(2).fill(100000),
  ],
});

export const AVERAGE_TILE_VALUE = RULES.lifeTiles.reduce((s, v) => s + v, 0) / RULES.lifeTiles.length;

// ช่วงเวลาแอนิเมชัน (มิลลิวินาที) ใช้ร่วมกันทั้งเซิร์ฟเวอร์และหน้าเว็บ
// เพื่อให้เซิร์ฟเวอร์รอจนแอนิเมชันเล่นจบก่อนให้บอทเล่นต่อ
export const TIMING = Object.freeze({
  base: 300,
  spin: 1800,
  subSpin: 1000,
  step: 240,
  card: 2600,
  retire: 1200,
  botThink: 900,
});

export function estimateAnimMs(events, speed = 1) {
  if (!events || !events.length) return 0;
  let ms = TIMING.base;
  for (const e of events) {
    if (e.type === 'spin') ms += e.purpose === 'move' ? TIMING.spin : TIMING.subSpin;
    else if (e.type === 'move') ms += e.path.length * TIMING.step;
    else if (e.type === 'card') ms += TIMING.card;
    else if (e.type === 'retire') ms += TIMING.retire;
  }
  return Math.round(ms / (speed || 1));
}
