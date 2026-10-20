// กระดานเกม: แบ่งเป็นช่วงชีวิต (segment) ต่อกันเป็นเส้นทาง มีทางแยกให้เลือก
// แต่ละช่องอ้างอิงด้วย id รูปแบบ "<segment>-<ลำดับ>"

import { RULES, INSURANCE } from './rules.js';
import { perkOwnerCareer, PERKS } from './careers.js';
import { formatMoney } from './format.js';

export const TYPE_INFO = Object.freeze({
  start: { icon: '🚩', name: 'จุดเริ่มต้น' },
  payday: { icon: '💰', name: 'วันเงินเดือนออก', label: 'เงินเดือนออก' },
  action: { icon: '🃏', name: 'การ์ดชีวิต', label: 'การ์ดชีวิต' },
  life: { icon: '⭐', name: 'บัตรความสุข' },
  lifeBuy: { icon: '🎁', name: 'แลกความสุข' },
  collect: { icon: '💵', name: 'รับเงิน' },
  pay: { icon: '💸', name: 'จ่ายเงิน' },
  tax: { icon: '🧾', name: 'ภาษี', label: 'จ่ายภาษี' },
  promotion: { icon: '📈', name: 'เลื่อนตำแหน่ง', label: 'เลื่อนตำแหน่ง' },
  baby: { icon: '👶', name: 'มีลูก' },
  pet: { icon: '🐶', name: 'สัตว์เลี้ยง' },
  marriage: { icon: '💍', name: 'แต่งงาน' },
  graduation: { icon: '🎓', name: 'รับปริญญา' },
  house: { icon: '🏠', name: 'ซื้อบ้าน' },
  realEstate: { icon: '🏘️', name: 'ตลาดอสังหาฯ' },
  spinToWin: { icon: '🎡', name: 'หมุนชิงโชค' },
  compete: { icon: '🏆', name: 'แข่งขัน' },
  lawsuit: { icon: '⚖️', name: 'ฟ้องร้อง' },
  gamble: { icon: '🎲', name: 'เสี่ยงดวง' },
  nightSchool: { icon: '🌙', name: 'จุดเปลี่ยนชีวิต' },
  holiday: { icon: '🏖️', name: 'วันหยุด' },
  everyonePays: { icon: '🎉', name: 'ทุกคนให้เงิน' },
  retire: { icon: '🌅', name: 'เกษียณ' },
});

// t=type l=label a=amount c=หมวดอาชีพที่ได้เงิน ins=ประกันที่คุ้มครอง n=จำนวน o=ผลการหมุน
const SEGMENT_DEFS = [
  {
    id: 'start', row: 0, title: 'จุดเริ่มต้น', icon: '🚩', ages: [18, 18],
    spaces: [{ t: 'start', l: 'เริ่มต้นชีวิต' }],
    next: ['college', 'work'],
  },
  {
    id: 'college', row: 1, title: 'ชีวิตมหาวิทยาลัย', icon: '🎓', ages: [18, 22],
    fork: { label: 'เรียนมหาวิทยาลัย', desc: `กู้ค่าเทอม ${RULES.collegeLoans} สัญญา แต่ได้ปริญญา เลือกอาชีพเงินเดือนสูงได้` },
    spaces: [
      { t: 'action', l: 'กิจกรรมรับน้อง' },
      { t: 'pay', l: 'ซื้อตำราเรียน', a: 5000, c: 'education' },
      { t: 'life', l: 'ได้เพื่อนสนิทตลอดชีวิต' },
      { t: 'collect', l: 'ทำงานพาร์ทไทม์', a: 10000 },
      { t: 'action', l: 'ชมรมดนตรี' },
      { t: 'pay', l: 'ทัศนศึกษาต่างประเทศ', a: 10000, c: 'entertainment' },
      { t: 'lifeBuy', l: 'ค่ายอาสาพัฒนาชนบท', a: 5000, n: 1, c: 'education' },
      { t: 'action', l: 'สอบปลายภาค' },
      { t: 'graduation', l: 'รับปริญญา', stop: true },
    ],
    next: ['early'],
  },
  {
    id: 'work', row: 1, title: 'เริ่มทำงานทันที', icon: '💼', ages: [18, 22],
    fork: { label: 'เริ่มทำงานเลย', desc: 'ไม่มีหนี้ เลือกอาชีพที่ไม่ต้องใช้ปริญญา และได้เงินเดือนเร็วกว่า' },
    spaces: [
      { t: 'collect', l: 'ค่าจ้างวันแรก', a: 5000 },
      { t: 'action', l: 'ปรับตัวกับที่ทำงาน' },
      { t: 'payday', l: 'เงินเดือนแรก' },
      { t: 'pay', l: 'ค่าเช่าหอพัก', a: 5000, c: 'home' },
      { t: 'action' },
    ],
    next: ['early'],
  },
  {
    id: 'early', row: 2, title: 'วัยเริ่มต้นทำงาน', icon: '🚀', ages: [23, 30],
    spaces: [
      { t: 'payday' },
      { t: 'action' },
      { t: 'pay', l: 'ซื้อรถคันแรก', a: 20000, c: 'shopping' },
      { t: 'life', l: 'ปลูกป่าวันสิ่งแวดล้อม' },
      { t: 'pay', l: 'รถเฉี่ยวชน', a: 15000, c: 'car', ins: 'auto' },
      { t: 'action' },
      { t: 'promotion' },
      { t: 'payday' },
      { t: 'lifeBuy', l: 'เที่ยวญี่ปุ่นกับเพื่อน', a: 30000, n: 1, c: 'entertainment' },
      { t: 'tax' },
      { t: 'action' },
      { t: 'compete', l: 'ประกวดวงดนตรีออฟฟิศ', a: 30000 },
      { t: 'pay', l: 'ใบสั่งจราจร', a: 5000, c: 'fine' },
      { t: 'payday' },
      { t: 'action' },
      { t: 'marriage', l: 'งานแต่งงาน', stop: true },
    ],
    next: ['family', 'career'],
  },
  {
    id: 'family', row: 3, title: 'เส้นทางครอบครัว', icon: '👨‍👩‍👧', ages: [30, 38],
    fork: { label: 'ทางครอบครัว', desc: 'มีลูก สัตว์เลี้ยง และบัตรความสุขมากมาย (ถ้ายังโสดจะไม่ได้ลูก)' },
    spaces: [
      { t: 'baby', l: 'ลูกคนแรกเกิด!', n: 1 },
      { t: 'pet', l: 'รับเลี้ยงน้องหมา', a: RULES.petCost },
      { t: 'payday' },
      { t: 'life', l: 'ปิกนิกครอบครัว' },
      { t: 'baby', l: 'ได้ลูกแฝด!', n: 2 },
      { t: 'pay', l: 'พาลูกไปหาหมอฟัน', a: 10000, c: 'medical', ins: 'health' },
      { t: 'action' },
      { t: 'baby', l: 'ลูกคนเล็กเกิด', n: 1 },
      { t: 'payday' },
      { t: 'pay', l: 'ค่าเทอมอนุบาล', a: 15000, c: 'education' },
      { t: 'life', l: 'ครอบครัวเที่ยวทะเล' },
    ],
    next: ['home'],
  },
  {
    id: 'career', row: 3, title: 'เส้นทางสายอาชีพ', icon: '📊', ages: [30, 38],
    fork: { label: 'ทางสายอาชีพ', desc: 'ทางสั้นกว่า เลื่อนตำแหน่งและรายได้พิเศษมากกว่า' },
    spaces: [
      { t: 'promotion' },
      { t: 'action' },
      { t: 'payday' },
      { t: 'collect', l: 'ปิดดีลใหญ่ ได้คอมมิชชั่น', a: 30000 },
      { t: 'pay', l: 'สัมมนาผู้บริหาร', a: 10000, c: 'education' },
      { t: 'lawsuit', l: 'มีคนลอกผลงาน ฟ้องเลย!', a: 40000 },
      { t: 'payday' },
      { t: 'action' },
    ],
    next: ['home'],
  },
  {
    id: 'home', row: 4, title: 'สร้างเนื้อสร้างตัว', icon: '🏡', ages: [38, 45],
    spaces: [
      { t: 'house', l: 'ถึงเวลามีบ้าน', stop: true },
      { t: 'pay', l: 'ตกแต่งบ้านใหม่', a: 10000, c: 'home' },
      { t: 'payday' },
      { t: 'action' },
      { t: 'pay', l: 'น้ำท่วมบ้าน!', a: 40000, c: 'home', ins: 'home', needHouse: true },
      { t: 'lifeBuy', l: 'บริจาคสร้างโรงเรียน', a: 25000, n: 1 },
      { t: 'spinToWin', l: 'หมุนชิงโชคงานวัด' },
      { t: 'payday' },
      { t: 'action' },
      { t: 'realEstate', l: 'มหกรรมบ้านและคอนโด' },
      { t: 'tax' },
      { t: 'gamble', l: 'ลงทุนกองทุนรวม', o: [[1, 3, -20000, 'ตลาดซบเซา ขาดทุน'], [4, 7, 10000, 'ได้ผลตอบแทนเล็กน้อย'], [8, 10, 40000, 'กองทุนปันผลงาม']] },
      { t: 'action' },
      { t: 'everyonePays', l: 'งานขึ้นบ้านใหม่', a: 5000 },
      { t: 'nightSchool', l: 'จุดเปลี่ยนวัยกลางคน', stop: true },
    ],
    next: ['risky', 'safe'],
  },
  {
    id: 'risky', row: 5, title: 'ทางเสี่ยงโชค', icon: '🎢', ages: [45, 55],
    fork: { label: 'ทางเสี่ยง', desc: 'สั้นกว่า ได้เยอะหรือเสียหนัก ใจถึงพึ่งได้!' },
    spaces: [
      { t: 'gamble', l: 'เปิดร้านกาแฟของตัวเอง', o: [[1, 4, -50000, 'ร้านเจ๊ง!'], [5, 7, 30000, 'ขายดีพอตัว'], [8, 10, 100000, 'กลายเป็นร้านดังในโซเชียล']] },
      { t: 'action' },
      { t: 'payday' },
      { t: 'gamble', l: 'เทรดหุ้นซิ่ง', o: [[1, 5, -60000, 'ติดดอย!'], [6, 8, 40000, 'ทำกำไรได้'], [9, 10, 150000, 'หุ้นเด้งสุดตัว']] },
      { t: 'life', l: 'พิชิตยอดเขาเอเวอเรสต์', n: 2 },
      { t: 'pay', l: 'อุบัติเหตุดำน้ำลึก', a: 40000, c: 'medical', ins: 'health' },
      { t: 'gamble', l: 'ขายธุรกิจ', o: [[1, 3, 0, 'ยังไม่มีคนซื้อ'], [4, 8, 80000, 'ขายได้ราคาดี'], [9, 10, 200000, 'นักลงทุนต่างชาติประมูลแย่งกัน']] },
    ],
    next: ['late'],
  },
  {
    id: 'safe', row: 5, title: 'ทางปลอดภัย', icon: '🛤️', ages: [45, 55],
    fork: { label: 'ทางปลอดภัย', desc: 'ยาวกว่าแต่มั่นคง มีวันเงินเดือนมากกว่า' },
    spaces: [
      { t: 'payday' },
      { t: 'collect', l: 'ดอกเบี้ยเงินฝากประจำ', a: 10000 },
      { t: 'action' },
      { t: 'life', l: 'ปลูกผักสวนครัว' },
      { t: 'pay', l: 'ตรวจสุขภาพประจำปี', a: 10000, c: 'medical', ins: 'health' },
      { t: 'payday' },
      { t: 'promotion' },
      { t: 'holiday', l: 'วันหยุดพักผ่อน' },
      { t: 'action' },
    ],
    next: ['late'],
  },
  {
    id: 'late', row: 6, title: 'วัยใกล้เกษียณ', icon: '🌇', ages: [55, 65],
    spaces: [
      { t: 'payday' },
      { t: 'action' },
      { t: 'pay', l: 'ผ่าตัดหัวใจ', a: 50000, c: 'medical', ins: 'health' },
      { t: 'lifeBuy', l: 'พาพ่อแม่เที่ยวยุโรป', a: 40000, n: 1, c: 'entertainment' },
      { t: 'lawsuit', l: 'เพื่อนบ้านทำรถพัง ฟ้อง!', a: 30000 },
      { t: 'payday' },
      { t: 'compete', l: 'แข่งกอล์ฟการกุศล', a: 50000 },
      { t: 'realEstate', l: 'นายหน้าอสังหาฯ มาเสนอ' },
      { t: 'action' },
      { t: 'tax' },
      { t: 'payday' },
      { t: 'life', l: 'เขียนหนังสืออัตชีวประวัติ' },
      { t: 'spinToWin', l: 'ลุ้นรางวัลใหญ่' },
      { t: 'action' },
      { t: 'everyonePays', l: 'งานเลี้ยงเกษียณ', a: 10000 },
      { t: 'retire', l: 'เกษียณอายุ', stop: true },
    ],
    next: [],
  },
];

function buildBoard() {
  const spaces = {};
  const segments = {};
  for (const def of SEGMENT_DEFS) {
    const ids = def.spaces.map((_, i) => `${def.id}-${i}`);
    segments[def.id] = {
      id: def.id, row: def.row, title: def.title, icon: def.icon, ages: def.ages,
      fork: def.fork || null, spaceIds: ids, next: def.next,
    };
    def.spaces.forEach((s, i) => {
      const info = TYPE_INFO[s.t];
      if (!info) throw new Error(`ไม่รู้จักประเภทช่อง ${s.t}`);
      const [a0, a1] = def.ages;
      const age = def.spaces.length > 1 ? Math.round(a0 + ((a1 - a0) * i) / (def.spaces.length - 1)) : a0;
      spaces[ids[i]] = {
        id: ids[i], seg: def.id, index: i, type: s.t,
        label: s.l || info.label || info.name,
        icon: s.i || info.icon,
        amount: s.a ?? null,
        category: s.c || null,
        insurance: s.ins || null,
        needHouse: !!s.needHouse,
        count: s.n ?? null,
        outcomes: s.o || null,
        stop: !!s.stop,
        age,
        next: [],
      };
    });
    ids.forEach((id, i) => {
      if (i < ids.length - 1) spaces[id].next = [ids[i + 1]];
    });
  }
  for (const def of SEGMENT_DEFS) {
    const last = segments[def.id].spaceIds[segments[def.id].spaceIds.length - 1];
    spaces[last].next = def.next.map((segId) => segments[segId].spaceIds[0]);
  }
  return { spaces, segments };
}

const BUILT = buildBoard();

export const SPACES = Object.freeze(BUILT.spaces);
export const SEGMENTS = Object.freeze(BUILT.segments);
export const START_SPACE_ID = 'start-0';
export const RETIRE_SPACE_ID = SEGMENTS.late.spaceIds[SEGMENTS.late.spaceIds.length - 1];

// แถวสำหรับวาดกระดาน: segment ที่อยู่แถวเดียวกันคือทางแยกที่วิ่งคู่ขนานกัน
export const BOARD_ROWS = (() => {
  const rows = [];
  for (const def of SEGMENT_DEFS) {
    (rows[def.row] ||= []).push(SEGMENTS[def.id]);
  }
  return rows;
})();

export function getSpace(id) {
  return SPACES[id] || null;
}

export function firstSpaceOf(segId) {
  return SEGMENTS[segId].spaceIds[0];
}

export function forkOption(spaceId) {
  const seg = SEGMENTS[SPACES[spaceId].seg];
  return {
    id: spaceId,
    segment: seg.id,
    label: seg.fork?.label || seg.title,
    desc: seg.fork?.desc || '',
    icon: seg.icon,
    length: seg.spaceIds.length,
  };
}

function perkNote(category) {
  if (!category) return '';
  const career = perkOwnerCareer(category);
  return career ? ` • เงินเข้ากระเป๋า${career.name}ถ้ามีผู้เล่นอาชีพนี้` : ` • หมวด${PERKS[category]?.name || ''}`;
}

// คำอธิบายช่อง ใช้แสดงเป็น tooltip บนหน้าเว็บ
export function describeSpace(space) {
  const fm = formatMoney;
  switch (space.type) {
    case 'start': return 'จุดเริ่มต้นชีวิต เลือกว่าจะเรียนต่อหรือทำงานเลย';
    case 'payday': return `ผ่าน: รับเงินเดือน • หยุดตรงนี้พอดี: รับเงินเดือน + โบนัส ${Math.round(RULES.paydayLandBonus * 100)}% (มีลูกต้องจ่ายค่าเลี้ยงดูคนละ ${fm(RULES.childUpkeep)})`;
    case 'action': return 'จั่วการ์ดชีวิต 1 ใบ';
    case 'life': return `รับบัตรความสุข ${space.count || 1} ใบ`;
    case 'lifeBuy': return `เลือกได้: จ่าย ${fm(space.amount)} เพื่อรับบัตรความสุข ${space.count || 1} ใบ${perkNote(space.category)}`;
    case 'collect': return `รับเงิน ${fm(space.amount)}`;
    case 'pay': {
      let text = `จ่าย ${fm(space.amount)}`;
      if (space.needHouse) text += ' (เฉพาะคนที่มีบ้าน)';
      if (space.insurance) text += ` • มี${INSURANCE[space.insurance].name}ไม่ต้องจ่าย`;
      return text + perkNote(space.category);
    }
    case 'tax': return `จ่ายภาษี ${Math.round(RULES.taxRate * 100)}% ของเงินเดือน${perkNote('tax')}`;
    case 'promotion': return 'เลื่อนตำแหน่ง เงินเดือนขึ้น 1 ขั้น (ถ้าตำแหน่งสูงสุดแล้ว รับโบนัสแทน)';
    case 'baby': return `ถ้าแต่งงานแล้ว ได้ลูก ${space.count} คน และบัตรความสุขคนละ 1 ใบ`;
    case 'pet': return `รับเลี้ยงสัตว์ จ่าย ${fm(space.amount || RULES.petCost)} รับบัตรความสุข 1 ใบ`;
    case 'marriage': return 'ช่องหยุด! เลือกแต่งงาน (รับของขวัญจากทุกคน + บัตรความสุข) หรือครองโสด';
    case 'graduation': return 'ช่องหยุด! รับปริญญาและเลือกอาชีพที่ต้องใช้ปริญญา';
    case 'house': return 'ช่องหยุด! เลือกซื้อบ้าน 1 หลัง หรือจะยังไม่ซื้อก็ได้';
    case 'realEstate': return 'ซื้อบ้านเพิ่ม หรือขายบ้านที่มีอยู่ (หมุนวงล้อกำหนดราคาขาย)';
    case 'spinToWin': return `ซื้อเลขได้สูงสุด ${RULES.spinToWin.maxNumbers} ตัว ตัวละ ${fm(RULES.spinToWin.cost)} ถ้าหมุนออกเลขที่เลือก รับ ${fm(RULES.spinToWin.prize)}`;
    case 'compete': return `ผู้เล่นทุกคนหมุนแข่งกัน คนที่ได้เลขสูงสุดรับ ${fm(space.amount)}`;
    case 'lawsuit': return `เลือกผู้เล่นหนึ่งคนให้จ่ายคุณ ${fm(space.amount)} (จ่ายค่าทนาย ${fm(RULES.lawsuitFee)})`;
    case 'gamble': return space.outcomes.map(([a, b, amt, text]) => `${a === b ? a : `${a}–${b}`}: ${text}${amt ? ` (${amt > 0 ? '+' : ''}${fm(amt)})` : ''}`).join(' • ');
    case 'nightSchool': return `ช่องหยุด! เรียนปริญญาโทภาคค่ำ (${fm(RULES.nightSchoolCost)}) เปลี่ยนงาน หรือทำงานเดิมต่อ`;
    case 'holiday': return 'พักผ่อนสบาย ๆ ไม่มีอะไรเกิดขึ้น';
    case 'everyonePays': return `ผู้เล่นทุกคนให้เงินคุณคนละ ${fm(space.amount)}`;
    case 'retire': return 'ช่องหยุด! เกษียณอายุ ขายบ้าน คืนเงินกู้ และเลือกที่พักหลังเกษียณ';
    default: return '';
  }
}
