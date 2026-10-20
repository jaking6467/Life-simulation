// การ์ดชีวิต — จั่วเมื่อหยุดที่ช่อง 🃏
//
// รูปแบบผลของการ์ด (eff):
//   { k:'collect', a }                    รับเงิน
//   { k:'pay', a, c, ins, needHouse }     จ่ายเงิน (c = หมวดของอาชีพที่ได้รับเงิน, ins = ประกันที่คุ้มครอง)
//   { k:'life', n }                       รับบัตรความสุข
//   { k:'promotion' } / { k:'demotion' }  เลื่อน/ลดตำแหน่ง
//   { k:'gamble', o:[[min,max,amount,text]] } หมุนวัดดวง
//   { k:'everyonePays', a } / { k:'payEveryone', a }
//   { k:'extraSpin' } / { k:'skipTurn' }
//   { k:'perChild', a, c } / { k:'perStock', a } / { k:'perHouse', a }
//   { k:'salaryBonus', x }                รับเงินเท่ากับเงินเดือน × x
//   { k:'pet', a }                        รับเลี้ยงสัตว์ (จ่าย a) + บัตรความสุข
//   { k:'compete', a } / { k:'lawsuit', a } / { k:'loseJob' }
//   { k:'choice', options:[{ id, label, desc, eff }] }
//   { k:'multi', list:[...] }

const skip = (label, desc) => ({ id: 'no', label, desc, eff: { k: 'none' } });

const CARD_LIST = [
  // ----- รับเงิน -----
  { id: 'inherit', icon: '💌', title: 'มรดกไม่คาดฝัน', text: 'ญาติห่าง ๆ ทิ้งมรดกไว้ให้คุณ', eff: { k: 'collect', a: 50000 } },
  { id: 'lotto', icon: '🎟️', title: 'ถูกหวยเลขท้าย', text: 'ซื้อเลขวันเกิดแม่ ถูกเลขท้าย 2 ตัว!', eff: { k: 'collect', a: 20000 } },
  { id: 'gold', icon: '🥇', title: 'ทองขึ้นราคา', text: 'ขายทองที่เก็บไว้ได้กำไร', eff: { k: 'collect', a: 15000 } },
  { id: 'taxRefund', icon: '💸', title: 'ได้เงินคืนภาษี', text: 'ยื่นภาษีออนไลน์ ได้เงินคืนเร็วทันใจ', eff: { k: 'collect', a: 10000 } },
  { id: 'yearBonus', icon: '💰', title: 'โบนัสปลายปี', text: 'บริษัทกำไรดี แจกโบนัสเท่ากับเงินเดือน 1 เดือน', eff: { k: 'salaryBonus', x: 1 }, copies: 2 },
  { id: 'sideHustle', icon: '🧺', title: 'ขายของออนไลน์', text: 'ลองไลฟ์ขายของช่วงวันหยุด หมุนดูว่าขายได้แค่ไหน', eff: { k: 'gamble', o: [[1, 3, 5000, 'ขายได้นิดหน่อย'], [4, 7, 15000, 'ขายดีพอใช้'], [8, 10, 30000, 'ของหมดเกลี้ยง!']] } },
  { id: 'found', icon: '🔍', title: 'เก็บกระเป๋าได้แล้วคืนเจ้าของ', text: 'เจ้าของซึ้งใจ ให้รางวัลคนดี', eff: { k: 'multi', list: [{ k: 'collect', a: 5000 }, { k: 'life', n: 1 }] } },

  // ----- ค่าปรับ / รถ -----
  { id: 'speeding', icon: '🚓', title: 'ขับรถเร็วเกินกำหนด', text: 'โดนกล้องจับความเร็ว', eff: { k: 'pay', a: 5000, c: 'fine' } },
  { id: 'noParking', icon: '🅿️', title: 'จอดในที่ห้ามจอด', text: 'โดนล็อกล้อ ต้องจ่ายค่าปรับ', eff: { k: 'pay', a: 4000, c: 'fine' } },
  { id: 'noHelmet', icon: '⛑️', title: 'ไม่สวมหมวกกันน็อก', text: 'ด่านตรวจหน้าปากซอย', eff: { k: 'pay', a: 3000, c: 'fine' } },
  { id: 'carCrash', icon: '🚗', title: 'รถโดนชนท้าย', text: 'คู่กรณีหนีไป ต้องซ่อมเอง (ประกันรถคุ้มครอง)', eff: { k: 'pay', a: 30000, c: 'car', ins: 'auto' } },
  { id: 'flatTire', icon: '🛞', title: 'ยางรถแตกกลางทาง', text: 'เรียกช่างมาเปลี่ยนยางด่วน', eff: { k: 'pay', a: 5000, c: 'car' } },
  { id: 'carService', icon: '🔧', title: 'เช็กระยะรถ', text: 'ถึงรอบเปลี่ยนถ่ายน้ำมันเครื่องและผ้าเบรก', eff: { k: 'pay', a: 8000, c: 'car' } },

  // ----- สุขภาพ -----
  { id: 'flu', icon: '🤒', title: 'ไข้หวัดใหญ่', text: 'ป่วยหนักต้องนอนโรงพยาบาล (ประกันสุขภาพคุ้มครอง)', eff: { k: 'pay', a: 15000, c: 'medical', ins: 'health' } },
  { id: 'brokenLeg', icon: '🦴', title: 'ขาหัก', text: 'เตะฟุตบอลกับเพื่อนแล้วล้ม ต้องพักฟื้น ข้ามตาถัดไป', eff: { k: 'multi', list: [{ k: 'pay', a: 25000, c: 'medical', ins: 'health' }, { k: 'skipTurn' }] } },
  { id: 'foodPoison', icon: '🤢', title: 'อาหารเป็นพิษ', text: 'ส้มตำร้านใหม่ไม่ค่อยสะอาด', eff: { k: 'pay', a: 8000, c: 'medical', ins: 'health' } },
  { id: 'dentist', icon: '🦷', title: 'ผ่าฟันคุด', text: 'ปวดฟันจนนอนไม่หลับ', eff: { k: 'pay', a: 10000, c: 'medical', ins: 'health' } },

  // ----- ไอที -----
  { id: 'phoneBroke', icon: '📱', title: 'มือถือตกน้ำ', text: 'ต้องซื้อเครื่องใหม่ด่วน', eff: { k: 'pay', a: 15000, c: 'tech' } },
  { id: 'laptop', icon: '💻', title: 'โน้ตบุ๊กพัง', text: 'งานด่วนรอไม่ได้ ต้องซื้อเครื่องใหม่', eff: { k: 'pay', a: 20000, c: 'tech' } },
  {
    id: 'smartHome', icon: '🤖', title: 'บ้านอัจฉริยะ', text: 'มีโปรติดตั้งกล้องและระบบไฟอัตโนมัติ',
    eff: { k: 'choice', options: [
      { id: 'buy', label: 'ติดตั้งเลย', desc: 'จ่าย ฿20,000 (หมวดไอที) รับบัตรความสุข 1 ใบ', eff: { k: 'multi', list: [{ k: 'pay', a: 20000, c: 'tech' }, { k: 'life', n: 1 }] } },
      skip('ไว้ก่อน', 'ประหยัดเงินไว้ก่อน'),
    ] },
  },

  // ----- ลงทุน (เลือกได้) -----
  {
    id: 'crypto', icon: '🪙', title: 'เพื่อนชวนลงทุนคริปโต', text: '"เหรียญนี้ไปดวงจันทร์แน่นอน!"',
    eff: { k: 'choice', options: [
      { id: 'invest', label: 'ลงทุน ฿30,000', desc: 'หมุน: 1–6 เสียหมด, 7–9 กำไร ฿30,000, 10 กำไร ฿120,000', eff: { k: 'gamble', o: [[1, 6, -30000, 'เหรียญดิ่งเหว เสียเงินลงทุน'], [7, 9, 30000, 'ราคาขึ้น 2 เท่า'], [10, 10, 120000, 'ไปดวงจันทร์จริง ๆ!']] } },
      skip('ปฏิเสธ', 'ไม่เสี่ยงดีกว่า'),
    ] },
  },
  {
    id: 'startup', icon: '🚀', title: 'ร่วมหุ้นสตาร์ทอัพ', text: 'เพื่อนสมัยเรียนกำลังระดมทุนรอบแรก',
    eff: { k: 'choice', options: [
      { id: 'invest', label: 'ลงทุน ฿50,000', desc: 'หมุน: 1–5 เสียหมด, 6–8 กำไร ฿50,000, 9–10 กำไร ฿150,000', eff: { k: 'gamble', o: [[1, 5, -50000, 'สตาร์ทอัพปิดตัว เสียเงินลงทุน'], [6, 8, 50000, 'ถูกซื้อกิจการ ได้กำไร'], [9, 10, 150000, 'กลายเป็นยูนิคอร์น!']] } },
      skip('ไม่ลงทุน', 'ขอดูไปก่อน'),
    ] },
  },
  { id: 'scam', icon: '📞', title: 'แก๊งคอลเซ็นเตอร์', text: 'มีคนโทรมาอ้างว่าเป็นเจ้าหน้าที่... หมุนดูว่ารู้ทันไหม', eff: { k: 'gamble', o: [[1, 3, -30000, 'หลงเชื่อโอนเงินไป'], [4, 10, 0, 'รู้ทันมิจฉาชีพ วางสายทันที!']] } },
  { id: 'dividend', icon: '💹', title: 'บริษัทจ่ายปันผล', text: 'รับ ฿15,000 ต่อใบหุ้นที่คุณถือ', eff: { k: 'perStock', a: 15000 } },
  { id: 'stockDip', icon: '📉', title: 'ตลาดหุ้นผันผวน', text: 'เสีย ฿10,000 ต่อใบหุ้นที่คุณถือ', eff: { k: 'perStock', a: -10000 } },

  // ----- งาน -----
  { id: 'promo', icon: '📈', title: 'ผลงานโดดเด่น', text: 'หัวหน้าเสนอชื่อคุณเลื่อนตำแหน่ง', eff: { k: 'promotion' }, copies: 2 },
  {
    id: 'onlineCourse', icon: '🧑‍💻', title: 'คอร์สพัฒนาตัวเอง', text: 'คอร์สออนไลน์ช่วยให้ทำงานเก่งขึ้น',
    eff: { k: 'choice', options: [
      { id: 'learn', label: 'ลงเรียน', desc: 'จ่าย ฿15,000 (หมวดการศึกษา) แล้วเลื่อนตำแหน่งทันที', eff: { k: 'multi', list: [{ k: 'pay', a: 15000, c: 'education' }, { k: 'promotion' }] } },
      skip('ไว้ก่อน', 'ช่วงนี้ไม่มีเวลาเรียน'),
    ] },
  },
  { id: 'demote', icon: '📉', title: 'หัวหน้าใหม่ไม่ปลื้ม', text: 'ถูกลดตำแหน่งลง 1 ขั้น', eff: { k: 'demotion' } },
  { id: 'layoff', icon: '📦', title: 'บริษัทปรับโครงสร้าง', text: 'ถูกเลิกจ้าง! ต้องหางานใหม่ (เริ่มที่ขั้นแรก)', eff: { k: 'loseJob' } },

  // ----- สังคม / ผู้เล่นอื่น -----
  { id: 'birthday', icon: '🎂', title: 'วันเกิดของคุณ!', text: 'เพื่อน ๆ ทุกคนให้ของขวัญคนละ ฿5,000', eff: { k: 'everyonePays', a: 5000 } },
  { id: 'souvenir', icon: '🎁', title: 'ของฝากจากต่างประเทศ', text: 'ซื้อของฝากให้ผู้เล่นทุกคน คนละ ฿3,000', eff: { k: 'payEveryone', a: 3000 } },
  { id: 'sue', icon: '⚖️', title: 'ฟ้องเรียกค่าเสียหาย', text: 'เลือกผู้เล่นหนึ่งคนให้จ่ายคุณ ฿40,000', eff: { k: 'lawsuit', a: 40000 } },
  { id: 'cooking', icon: '🍳', title: 'ประกวดทำอาหาร', text: 'ทุกคนหมุน คนที่ได้เลขสูงสุดรับ ฿40,000', eff: { k: 'compete', a: 40000 } },
  { id: 'marathon', icon: '🏅', title: 'มาราธอนประจำปี', text: 'ทุกคนหมุน คนที่ได้เลขสูงสุดรับ ฿30,000', eff: { k: 'compete', a: 30000 } },

  // ----- ใช้จ่าย -----
  { id: 'treat', icon: '🍲', title: 'เลี้ยงหมูกระทะทั้งแก๊ง', text: 'ฉลองความสำเร็จกับเพื่อน ๆ', eff: { k: 'pay', a: 12000, c: 'food' } },
  { id: 'buffet', icon: '🍣', title: 'บุฟเฟต์โรงแรมหรู', text: 'ฉลองวันครบรอบ', eff: { k: 'pay', a: 8000, c: 'food' } },
  { id: 'friendWedding', icon: '💒', title: 'งานแต่งเพื่อนสนิท', text: 'ใส่ซองช่วยงาน', eff: { k: 'pay', a: 5000, c: 'food' } },
  { id: 'gym', icon: '🏋️', title: 'สมัครฟิตเนสรายปี', text: 'ปีนี้ต้องฟิตให้ได้!', eff: { k: 'pay', a: 12000, c: 'sport' } },
  { id: 'golf', icon: '⛳', title: 'ออกรอบกอล์ฟกับลูกค้า', text: 'ค่ากรีนฟีและแคดดี้', eff: { k: 'pay', a: 10000, c: 'sport' } },
  { id: 'charityRun', icon: '🏃', title: 'วิ่งการกุศล', text: 'ค่าสมัคร ฿5,000 แต่ได้ช่วยโรงพยาบาล', eff: { k: 'multi', list: [{ k: 'pay', a: 5000, c: 'sport' }, { k: 'life', n: 1 }] } },
  { id: 'streaming', icon: '📺', title: 'สมัครสตรีมมิ่งทั้งปี', text: 'ดูซีรีส์แบบไม่มีโฆษณา', eff: { k: 'pay', a: 5000, c: 'entertainment' } },
  {
    id: 'concert', icon: '🎤', title: 'คอนเสิร์ตศิลปินในดวงใจ', text: 'บัตรใกล้หมดแล้ว!',
    eff: { k: 'choice', options: [
      { id: 'go', label: 'กดบัตรเลย', desc: 'จ่าย ฿10,000 (หมวดบันเทิง) รับบัตรความสุข 1 ใบ', eff: { k: 'multi', list: [{ k: 'pay', a: 10000, c: 'entertainment' }, { k: 'life', n: 1 }] } },
      skip('ดูไลฟ์เอา', 'ประหยัดไว้ก่อน'),
    ] },
  },
  {
    id: 'familyTrip', icon: '🚐', title: 'ทริปเที่ยวเชียงใหม่', text: 'ชวนครอบครัวไปกินลมหนาว',
    eff: { k: 'choice', options: [
      { id: 'go', label: 'ไปเที่ยว', desc: 'จ่าย ฿20,000 (หมวดอาหาร) รับบัตรความสุข 1 ใบ', eff: { k: 'multi', list: [{ k: 'pay', a: 20000, c: 'food' }, { k: 'life', n: 1 }] } },
      skip('อยู่บ้าน', 'พักผ่อนอยู่บ้านก็ได้'),
    ] },
  },
  { id: 'shopping', icon: '🛍️', title: 'โปรลดราคา 11.11', text: 'เผลอกดสั่งของจนเพลิน', eff: { k: 'pay', a: 10000, c: 'shopping' } },
  { id: 'lostWallet', icon: '👛', title: 'กระเป๋าสตางค์หาย', text: 'ทำบัตรใหม่และเสียเงินสดในกระเป๋า', eff: { k: 'pay', a: 7000 } },
  { id: 'audit', icon: '🧾', title: 'สรรพากรตรวจภาษี', text: 'ยื่นภาษีย้อนหลังไม่ครบ', eff: { k: 'pay', a: 15000, c: 'tax' } },
  { id: 'will', icon: '📜', title: 'ทำพินัยกรรม', text: 'จ้างทนายร่างพินัยกรรมให้รัดกุม', eff: { k: 'pay', a: 8000, c: 'legal' } },
  { id: 'contract', icon: '📝', title: 'ตรวจสัญญาเช่า', text: 'จ้างทนายตรวจสัญญาก่อนเซ็น', eff: { k: 'pay', a: 5000, c: 'legal' } },
  { id: 'tutor', icon: '🔤', title: 'เรียนพิเศษภาษาอังกฤษ', text: 'เตรียมสอบวัดระดับ', eff: { k: 'pay', a: 8000, c: 'education' } },
  { id: 'renovate', icon: '🛠️', title: 'ซ่อมแซมห้องครัว', text: 'ท่อน้ำรั่วจนต้องรื้อใหม่', eff: { k: 'pay', a: 10000, c: 'home' } },

  // ----- บ้าน -----
  { id: 'rent', icon: '🏘️', title: 'ปล่อยเช่าบ้าน', text: 'รับค่าเช่า ฿20,000 ต่อบ้านที่คุณมี', eff: { k: 'perHouse', a: 20000 } },
  { id: 'termite', icon: '🐜', title: 'ปลวกขึ้นบ้าน', text: 'ต้องกำจัดปลวกและซ่อมแซม (ประกันบ้านคุ้มครอง)', eff: { k: 'pay', a: 25000, c: 'home', ins: 'home', needHouse: true } },
  { id: 'storm', icon: '⛈️', title: 'พายุฤดูร้อน', text: 'หลังคาบ้านปลิว! (ประกันบ้านคุ้มครอง)', eff: { k: 'pay', a: 40000, c: 'home', ins: 'home', needHouse: true } },

  // ----- ครอบครัว / ความสุข -----
  { id: 'volunteer', icon: '🤝', title: 'จิตอาสาช่วยน้ำท่วม', text: 'ความใจดีของคุณได้รับการตอบแทน', eff: { k: 'life', n: 1 } },
  { id: 'grandma', icon: '👵', title: 'ดูแลคุณยาย', text: 'ได้ใช้เวลาอันมีค่ากับครอบครัว', eff: { k: 'life', n: 1 } },
  { id: 'cat', icon: '🐱', title: 'แมวจรมาขออยู่ด้วย', text: 'รับเลี้ยงน้องแมว จ่ายค่าวัคซีน ฿3,000', eff: { k: 'pet', a: 3000 } },
  { id: 'schoolFees', icon: '🎒', title: 'เปิดเทอมแล้ว', text: 'จ่ายค่าอุปกรณ์การเรียน ฿5,000 ต่อลูก 1 คน', eff: { k: 'perChild', a: -5000, c: 'education' } },
  { id: 'scholarship', icon: '🏆', title: 'ลูกได้ทุนเรียนดี', text: 'รับ ฿10,000 ต่อลูก 1 คน', eff: { k: 'perChild', a: 10000 } },

  // ----- จังหวะเกม -----
  { id: 'vacation', icon: '🏖️', title: 'ลาพักร้อน', text: 'ชาร์จพลังเต็มที่! ได้หมุนอีกครั้ง', eff: { k: 'extraSpin' } },
];

export const CARDS = Object.freeze(Object.fromEntries(CARD_LIST.map((c) => [c.id, c])));

export function buildCardDeck() {
  const deck = [];
  for (const card of CARD_LIST) {
    for (let i = 0; i < (card.copies || 1); i++) deck.push(card.id);
  }
  return deck;
}
