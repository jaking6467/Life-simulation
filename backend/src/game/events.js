// เหตุการณ์ในเกม
// - globalEvents: สุ่มตอนต้นสัปดาห์ มีผลกับทุกคนตลอดสัปดาห์นั้น
// - choiceEvents: สุ่มตอนเริ่มตาของผู้เล่น ให้เลือกทางใดทางหนึ่ง
// - weekendEvents: สุ่มตอนจบสัปดาห์ของผู้เล่น (เรื่องไม่คาดฝันในชีวิต)
//
// eff (ผลของเหตุการณ์): money, hours (เวลาในสัปดาห์นี้), health, happiness, hygiene, xp, points,
//   groceries, pet, overtime (ชั่วโมงทำโอที), gamble: [{ chance, money, text }], fromOthers (เงินจากผู้เล่นอื่นคนละ)

export const GLOBAL_EVENTS = [
  { id: 'heatwave', icon: '🥵', name: 'คลื่นความร้อน', text: 'อากาศร้อนจัด! ความสะอาดลดลง 2 เท่าตอนจบสัปดาห์', mods: { hygieneDecay: 2 } },
  { id: 'sports', icon: '🏟️', name: 'มหกรรมกีฬาโลก', text: 'ทั้งเมืองคึกคัก! ตู้เกม & โรงหนังลดราคา 30% และให้ความสุขเพิ่ม 50%', mods: { entertainment: 1.5, entertainmentPrice: 0.7 } },
  { id: 'boom', icon: '📈', name: 'เศรษฐกิจบูม', text: 'ทุกที่จ้างงานคึกคัก ค่าแรงทุกงาน +20% และหุ้นมีแนวโน้มขึ้น', mods: { wage: 1.2, stockDrift: 0.05 } },
  { id: 'recession', icon: '📉', name: 'เศรษฐกิจถดถอย', text: 'บริษัทรัดเข็มขัด ค่าแรงทุกงาน -15% และหุ้นมีแนวโน้มลง', mods: { wage: 0.85, stockDrift: -0.05 } },
  { id: 'monster', icon: '🦖', name: 'สัตว์ประหลาดยักษ์ตีกัน!', text: 'ก็อตซิลล่าตีกับหุ่นยักษ์กลางเมือง! สถานที่หนึ่งปิดชั่วคราวทั้งสัปดาห์', mods: { closeRandom: true } },
  { id: 'songkran', icon: '💦', name: 'เทศกาลสงกรานต์', text: 'สาดน้ำคลายร้อน ทุกคนความสุข +10 และความสะอาด +20 ตอนเริ่มตา', mods: { startEffect: { happiness: 10, hygiene: 20 } } },
  { id: 'pm25', icon: '😷', name: 'ฝุ่น PM2.5 วิกฤต', text: 'อากาศแย่มาก ทุกคนสุขภาพ -8 ตอนเริ่มตา', mods: { startEffect: { health: -8 } } },
  { id: 'flood', icon: '🌊', name: 'น้ำท่วมถนน', text: 'ถนนน้ำท่วมขัง การเดินทางแต่ละครั้งใช้เวลาเพิ่ม 1 ชม. (ยกเว้นคนมีรถยนต์)', mods: { travelExtra: 1 } },
  { id: 'sale', icon: '🏷️', name: 'มิดเยียร์เซล', text: 'ห้างและร้านเฟอร์นิเจอร์ลดราคา 25%', mods: { shopPrice: 0.75 } },
  { id: 'crime', icon: '🦹', name: 'โจรชุกชุม', text: 'ระวังเงินในกระเป๋า! โอกาสโดนขโมยเพิ่มเป็น 2 เท่า', mods: { theft: 2 } },
];

export const CHOICE_EVENTS = [
  {
    id: 'party', icon: '🎉', name: 'ปาร์ตี้คืนวันศุกร์', text: 'เพื่อนสนิทชวนไปปาร์ตี้วันเกิดที่ร้านดัง',
    options: [
      { id: 'go', label: 'ไปสิ!', desc: 'เสียเวลา 6 ชม. จ่าย ฿500 ความสุข +15 สุขภาพ -4', eff: { hours: -6, money: -500, happiness: 15, health: -4 } },
      { id: 'no', label: 'ขอตัวก่อน', desc: 'ความสุข -3', eff: { happiness: -3 } },
    ],
  },
  {
    id: 'overtime', icon: '⏰', name: 'หัวหน้าขอให้ทำโอที', text: 'งานด่วนเข้า หัวหน้าขอให้ช่วยทำโอทีเสาร์อาทิตย์', when: (p) => !!p.job,
    options: [
      { id: 'yes', label: 'รับทำโอที', desc: 'เสียเวลา 8 ชม. ได้ค่าแรง 1.5 เท่า ประสบการณ์ +8 ความสุข -6', eff: { overtime: 8, happiness: -6 } },
      { id: 'no', label: 'ปฏิเสธ', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
  {
    id: 'charity', icon: '🤲', name: 'มูลนิธิขอรับบริจาค', text: 'มูลนิธิช่วยเหลือผู้ประสบภัยน้ำท่วมขอรับบริจาค', when: (p) => p.cash >= 1000,
    options: [
      { id: 'give', label: 'บริจาค ฿1,000', desc: 'ความสุข +8 และ +3 คะแนน', eff: { money: -1000, happiness: 8, points: 3 } },
      { id: 'no', label: 'ไว้คราวหน้า', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
  {
    id: 'sick', icon: '🤧', name: 'รู้สึกไม่ค่อยสบาย', text: 'ตื่นมาเจ็บคอ ตัวรุม ๆ',
    options: [
      { id: 'rest', label: 'ลาป่วย นอนพัก', desc: 'เสียเวลา 10 ชม. สุขภาพ +10', eff: { hours: -10, health: 10 } },
      { id: 'push', label: 'ฝืนไปต่อ', desc: 'สุขภาพ -12', eff: { health: -12 } },
    ],
  },
  {
    id: 'investTip', icon: '🤫', name: 'เพื่อนกระซิบหุ้นเด็ด', text: '"เชื่อเราสิ หุ้นตัวนี้กำลังจะพุ่ง!"', when: (p) => p.cash >= 3000,
    options: [
      { id: 'buy', label: 'ลงทุน ฿3,000', desc: 'ลุ้น 50/50: ได้กำไร ฿3,500 หรือขาดทุน ฿2,500', eff: { gamble: [{ chance: 0.5, money: 3500, text: 'หุ้นพุ่งจริง! กำไร' }, { chance: 0.5, money: -2500, text: 'หุ้นดิ่ง ขาดทุน' }] } },
      { id: 'no', label: 'ไม่เชื่อหรอก', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
  {
    id: 'kitten', icon: '🐈', name: 'ลูกแมวหลงทาง', text: 'มีลูกแมวมาร้องหน้าห้องตอนฝนตก', when: (p) => !p.pets.includes('cat'),
    options: [
      { id: 'adopt', label: 'รับเลี้ยง', desc: 'ได้แมวฟรี (ค่าอาหารสัตว์ ฿150/สัปดาห์)', eff: { pet: 'cat', happiness: 5 } },
      { id: 'temple', label: 'พาไปฝากวัด', desc: 'ความสุข +2', eff: { happiness: 2 } },
    ],
  },
  {
    id: 'bossDinner', icon: '🍷', name: 'เจ้านายชวนทานข้าว', text: 'เจ้านายใหญ่ชวนไปทานมื้อค่ำคุยเรื่องงาน', when: (p) => !!p.job,
    options: [
      { id: 'go', label: 'ไปด้วย', desc: 'เสียเวลา 3 ชม. ประสบการณ์ +15 ความสุข +2', eff: { hours: -3, xp: 15, happiness: 2 } },
      { id: 'no', label: 'ติดธุระ', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
  {
    id: 'oldFriend', icon: '👋', name: 'เพื่อนเก่ามาเยี่ยม', text: 'เพื่อนสมัยมัธยมแวะมาหาโดยไม่บอกล่วงหน้า',
    options: [
      { id: 'talk', label: 'คุยกันทั้งคืน', desc: 'เสียเวลา 4 ชม. ความสุข +10', eff: { hours: -4, happiness: 10 } },
      { id: 'no', label: 'ขอตัวไปทำธุระ', desc: 'ความสุข -2', eff: { happiness: -2 } },
    ],
  },
  {
    id: 'freelance', icon: '🧑‍💻', name: 'งานฟรีแลนซ์', text: 'มีคนจ้างทำงานพิเศษช่วงเย็น',
    options: [
      { id: 'take', label: 'รับงาน', desc: 'เสียเวลา 5 ชม. ได้ ฿1,500 ความสุข -3', eff: { hours: -5, money: 1500, happiness: -3 } },
      { id: 'no', label: 'ไม่รับ', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
  {
    id: 'dream', icon: '💤', name: 'ฝันเห็นเลขเด็ด', text: 'เมื่อคืนฝันเห็นงูใหญ่พันตัว... เลขนี้ต้องมา!', when: (p) => p.cash >= 300,
    options: [
      { id: 'buy', label: 'ซื้อลอตเตอรี่ 3 ใบ (฿300)', desc: 'ได้ตั๋วลอตเตอรี่ 3 ใบ ลุ้นงวดถัดไป', eff: { money: -300, tickets: 3 } },
      { id: 'no', label: 'ฝันก็คือฝัน', desc: 'ไม่มีอะไรเกิดขึ้น', eff: {} },
    ],
  },
];

export const WEEKEND_EVENTS = [
  { id: 'flu', icon: '🤒', name: 'เป็นไข้หวัด', text: 'ติดหวัดจากเพื่อนร่วมงาน', eff: { health: -12 } },
  { id: 'bonus', icon: '💰', name: 'โบนัสพิเศษ', text: 'หัวหน้าชมว่าทำงานดี ให้โบนัสพิเศษ', when: (p) => !!p.job && p.weekShifts > 0, eff: { money: 1500 } },
  { id: 'pipe', icon: '🚿', name: 'ท่อน้ำแตก', text: 'ท่อน้ำในห้องแตก ต้องเรียกช่างมาซ่อม', when: (p) => p.housing === 'flat', eff: { money: -1200, happiness: -4 } },
  { id: 'found', icon: '🍀', name: 'เก็บเงินได้', text: 'เจอแบงก์ห้าร้อยตกอยู่ข้างทาง', eff: { money: 500, happiness: 3 } },
  { id: 'rain', icon: '🌧️', name: 'ฝนตกหนัก', text: 'โดนฝนกระหน่ำระหว่างทางกลับบ้าน', when: (p) => p.vehicle !== 'car', eff: { hygiene: -15, happiness: -3 } },
  { id: 'concert', icon: '🎤', name: 'ได้บัตรคอนเสิร์ตฟรี', text: 'ชิงรางวัลจากวิทยุได้บัตรคอนเสิร์ตศิลปินดัง', eff: { happiness: 12 } },
  { id: 'foodPoison', icon: '🤢', name: 'อาหารเป็นพิษ', text: 'ไก่ทอดเมื่อวานท่าจะไม่สด...', when: (p) => p.c.ateFastThisWeek, eff: { health: -12, happiness: -4 } },
  { id: 'tax', icon: '🧾', name: 'สรรพากรเรียกเก็บภาษี', text: 'ยื่นภาษีย้อนหลังไม่ครบ ต้องจ่ายเพิ่ม', when: (p) => p.cash >= 5000, eff: { money: -2000 } },
  { id: 'birthday', icon: '🎂', name: 'วันเกิดของคุณ!', text: 'เพื่อน ๆ ทุกคนให้ของขวัญเป็นเงินคนละ ฿300', eff: { fromOthers: 300, happiness: 6 } },
  { id: 'noise', icon: '🔊', name: 'เพื่อนบ้านเสียงดัง', text: 'ห้องข้าง ๆ เปิดเพลงทั้งคืน นอนไม่หลับ', when: (p) => p.housing === 'flat', eff: { happiness: -8, health: -3 } },
  { id: 'scam', icon: '📞', name: 'แก๊งคอลเซ็นเตอร์', text: 'มีคนโทรมาอ้างเป็นเจ้าหน้าที่ธนาคาร...', when: (p) => p.cash >= 3000, eff: { gamble: [{ chance: 0.35, money: -2500, text: 'หลงเชื่อโอนเงินไป' }, { chance: 0.65, money: 0, text: 'รู้ทัน วางสายทันที' }] } },
  { id: 'compliment', icon: '😍', name: 'มีคนชมว่าแต่งตัวดี', text: 'คนแปลกหน้าชมว่าวันนี้ดูดีมาก', when: (p) => p.clothes.tier >= 2 && p.stats.hygiene >= 60, eff: { happiness: 8 } },
];

export const GLOBAL_EVENT_BY_ID = Object.freeze(Object.fromEntries(GLOBAL_EVENTS.map((e) => [e.id, e])));
export const CHOICE_EVENT_BY_ID = Object.freeze(Object.fromEntries(CHOICE_EVENTS.map((e) => [e.id, e])));
export const WEEKEND_EVENT_BY_ID = Object.freeze(Object.fromEntries(WEEKEND_EVENTS.map((e) => [e.id, e])));
