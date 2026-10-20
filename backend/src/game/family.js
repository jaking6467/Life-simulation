// family.js — ความรัก แต่งงาน และลูก
// หาคู่ที่สวน → ไปเดต (ภัตตาคาร / โรงหนัง / สวน) ให้ความรักเพิ่ม → ขอแต่งงานที่วัด → มีลูกที่โรงพยาบาล
// ความรักลดลงทุกสัปดาห์ ยิ่งไม่มีเวลาให้ยิ่งลดเร็ว ถ้าหมดก็เลิกกัน
// แต่งงานแล้วคู่ชีวิตช่วยหารายได้ทุกสัปดาห์ ลูกมีค่าเลี้ยงดูและอยากให้ใช้เวลาด้วยที่บ้าน

import { RULES } from './rules.js';
import { addStats, clamp, currentMods, gainCash, log, notify, one, payBill, statText } from './core.js';
import { nextRandom, randInt } from './rng.js';
import { formatMoney as fm } from './format.js';

export const PARTNER_NAMES = ['น้ำฝน', 'ต้นข้าว', 'มะปราง', 'ภูผา', 'ใบเตย', 'กันต์', 'พลอย', 'ธาม', 'แพรว', 'ไอซ์', 'ฟ้าใส', 'เมฆ', 'ข้าวหอม', 'นาวา', 'ปาย', 'ตะวัน'];
export const KID_NAMES = ['น้องข้าวปั้น', 'น้องมะลิ', 'น้องโอปอ', 'น้องต้นกล้า', 'น้องขนมปัง', 'น้องส้มโอ', 'น้องกะทิ', 'น้องภูมิ'];

// สถานที่เดต: style ตรงกับสิ่งที่คู่เดตชอบ ความรักเพิ่มอีก 6
export const DATE_SPOTS = Object.freeze({
  restaurant: { style: 'dinner', name: 'ดินเนอร์ริมน้ำ', hours: 3, cost: 900, affection: 14, happiness: 8, eats: true },
  arcade: { style: 'movie', name: 'ดูหนังด้วยกัน', hours: 3, cost: 600, affection: 12, happiness: 8 },
  park: { style: 'picnic', name: 'ปิกนิกในสวน', hours: 3, cost: 200, affection: 10, happiness: 6 },
});
export const DATE_STYLES = Object.freeze({ dinner: 'ดินเนอร์หรู ๆ', movie: 'ดูหนัง', picnic: 'ปิกนิกในสวน' });
const LIKED_BONUS = 6;
const F = RULES.family;

const loveMod = (state) => currentMods(state).love || 1;

export function meetChance(p, state) {
  const chance = 0.25 + p.stats.hygiene / 400 + p.stats.happiness / 400 + p.clothes.tier * 0.07 + (p.vehicle === 'car' ? 0.05 : 0);
  return Math.min(0.9, chance * (state ? loveMod(state) : 1));
}

function newPartner(state, p) {
  const used = new Set(Object.values(state.players).flatMap((x) => [x.name, x.love?.name].filter(Boolean)));
  const pool = PARTNER_NAMES.filter((n) => !used.has(n));
  const names = pool.length ? pool : PARTNER_NAMES;
  const styles = Object.keys(DATE_STYLES);
  return {
    name: names[randInt(state, 0, names.length - 1)],
    likes: styles[randInt(state, 0, styles.length - 1)],
    income: randInt(state, 8, 25) * 100,
    affection: F.startAffection,
    stage: 'dating',
    weeks: 0,
  };
}

const together = (p) => (p.weekActs.date || 0) + (p.weekActs.familyTime || 0) > 0;

export const familyActions = [
  {
    id: 'meet', icon: '💘', group: 'ความรัก', at: ['park'],
    variants: (state, p) => one({ label: 'ทำความรู้จักคนใหม่', desc: `ลุ้นเจอคนที่ใช่ (โอกาส ${Math.round(meetChance(p, state) * 100)}% ยิ่งสะอาด มีความสุข แต่งตัวดี ยิ่งง่าย)`, hours: F.meetHours }),
    check: (state, p) => {
      if (p.love) return `คุณมี${p.love.name}แล้วนะ!`;
      if (p.weekActs.meet) return 'สัปดาห์นี้ลองไปแล้ว ไว้สัปดาห์หน้า';
      if (p.stats.hygiene < 40) return 'ตัวเหม็นเกินไป ไม่มีใครอยากคุยด้วย';
      return null;
    },
    run: (state, p, params, { boost }) => {
      if (nextRandom(state) < Math.min(0.95, meetChance(p, state) * boost)) {
        p.love = newPartner(state, p);
        p.c.partners++;
        addStats(state, p, { happiness: 8 });
        log(state, p.id, `💘 ${p.name} เริ่มคบกับ${p.love.name}!`, 'good');
        notify(state, p.id, '💘', `${p.name} เริ่มคบกับ${p.love.name}!`, 'good');
        return `เจอ${p.love.name}! ถูกคอกันมาก (ชอบ${DATE_STYLES[p.love.likes]})`;
      }
      addStats(state, p, { happiness: -1 });
      return 'ยังไม่เจอคนที่ใช่ ลองใหม่สัปดาห์หน้า';
    },
  },
  {
    id: 'date', icon: '💑', group: 'ความรัก', at: Object.keys(DATE_SPOTS),
    variants: (state, p) => {
      if (!p.love) return [];
      const spot = DATE_SPOTS[p.location];
      const liked = p.love.likes === spot.style;
      return one({
        label: `${spot.name}กับ${p.love.name}`,
        desc: `ความรัก +${Math.round((spot.affection + (liked ? LIKED_BONUS : 0)) * loveMod(state))}${liked ? ' (ของโปรด!)' : ''} ความสุข +${spot.happiness}${spot.eats ? ' • นับเป็นมื้ออาหาร' : ''}`,
        hours: spot.hours,
        cost: spot.cost,
      });
    },
    check: (state, p) => ((p.weekActs.date || 0) >= F.datesPerWeek ? `เดตได้สัปดาห์ละ ${F.datesPerWeek} ครั้ง` : null),
    run: (state, p, params, { boost }) => {
      const spot = DATE_SPOTS[p.location];
      const gain = Math.round((spot.affection + (p.love.likes === spot.style ? LIKED_BONUS : 0)) * boost * loveMod(state));
      p.love.affection = clamp(p.love.affection + gain);
      if (spot.eats) p.ate = true;
      p.c.dates++;
      const d = addStats(state, p, { happiness: spot.happiness }, boost);
      return `${spot.name}กับ${p.love.name} ความรัก +${gain} (${statText(d)})`;
    },
  },
  {
    id: 'propose', icon: '💍', group: 'ความรัก', at: ['temple'],
    variants: (state, p) => (p.love?.stage === 'dating' ? one({ label: `ขอ${p.love.name}แต่งงาน`, desc: `จัดงานแต่งที่วัด • ต้องคบกัน ${F.proposeWeeks} สัปดาห์ และความรัก ${F.proposeAffection}+ • คู่ชีวิตช่วยหารายได้ทุกสัปดาห์`, hours: 4, cost: F.weddingCost }) : []),
    check: (state, p) => {
      if (p.love.weeks < F.proposeWeeks) return `ต้องคบกันอย่างน้อย ${F.proposeWeeks} สัปดาห์ (ตอนนี้ ${p.love.weeks})`;
      if (p.love.affection < F.proposeAffection) return `ความรักต้อง ${F.proposeAffection} ขึ้นไป (ตอนนี้ ${p.love.affection})`;
      return null;
    },
    run: (state, p) => {
      p.love.stage = 'married';
      p.love.affection = clamp(p.love.affection + 10);
      p.c.married = true;
      addStats(state, p, { happiness: 20 });
      log(state, p.id, `💒 ${p.name} แต่งงานกับ${p.love.name}! ยินดีด้วย`, 'good');
      notify(state, p.id, '💒', `${p.name} แต่งงานกับ${p.love.name}!`, 'good');
      return `แต่งงานกับ${p.love.name}แล้ว! 💒`;
    },
  },
  {
    id: 'haveBaby', icon: '👶', group: 'ครอบครัว', at: ['hospital'],
    variants: (state, p) => (p.love?.stage === 'married' ? one({ label: 'มีลูกน้อย', desc: `ความสุข +15 • ค่าเลี้ยงดู ${fm(F.kidWeekly)}/สัปดาห์ • ลูกอยากให้ใช้เวลาด้วยที่บ้าน`, hours: 4, cost: F.babyCost }) : []),
    check: (state, p) => {
      if (p.kids.length >= F.maxKids) return `มีลูกครบ ${F.maxKids} คนแล้ว`;
      if (p.love.affection < F.babyAffection) return `ความรักต้อง ${F.babyAffection} ขึ้นไป`;
      return null;
    },
    run: (state, p) => {
      const used = new Set(Object.values(state.players).flatMap((x) => x.kids.map((k) => k.name)));
      const pool = KID_NAMES.filter((n) => !used.has(n));
      const name = (pool.length ? pool : KID_NAMES)[randInt(state, 0, (pool.length || KID_NAMES.length) - 1)];
      p.kids.push({ name, born: state.week });
      addStats(state, p, { happiness: 15 });
      log(state, p.id, `👶 ${p.name} กับ${p.love.name}ได้ต้อนรับ${name}!`, 'good');
      notify(state, p.id, '👶', `${p.name} มีลูกแล้ว: ${name}`, 'good');
      return `ยินดีต้อนรับ${name}! 👶`;
    },
  },
  {
    id: 'familyTime', icon: '🏡', group: 'ครอบครัว', at: 'home',
    variants: (state, p) => {
      if (!p.love && !p.kids.length) return [];
      const who = [p.love?.name, p.kids.length ? `ลูก ${p.kids.length} คน` : null].filter(Boolean).join(' และ');
      return one({ label: `ใช้เวลากับครอบครัว`, desc: `อยู่กับ${who} • ความรัก +10 ความสุข +${6 + 2 * p.kids.length}`, hours: 3 });
    },
    check: (state, p) => (p.weekActs.familyTime ? 'สัปดาห์นี้ใช้เวลากับครอบครัวแล้ว' : null),
    run: (state, p, params, { boost }) => {
      if (p.love) p.love.affection = clamp(p.love.affection + Math.round(10 * boost));
      const d = addStats(state, p, { happiness: 6 + 2 * p.kids.length }, boost);
      return `ใช้เวลากับครอบครัวอย่างอบอุ่น (${statText(d)})`;
    },
  },
];

// สุดสัปดาห์: ความรักลดลง รายได้คู่ชีวิต ค่าเลี้ยงลูก
export function familyWeekly(state, p, notes) {
  const L = p.love;
  if (L) {
    L.weeks++;
    const spent = together(p);
    const decay = (L.stage === 'married' ? F.decayMarried : F.decayDating) + (spent ? 0 : F.neglect);
    L.affection = clamp(L.affection - decay);
    if (L.stage === 'married') {
      gainCash(state, p, L.income);
      payBill(state, p, F.household, 'ค่าใช้จ่ายในบ้าน');
      notes.push(`💑 ${L.name}ช่วยหารายได้ +${fm(L.income)} (ค่าใช้จ่ายในบ้าน ${fm(F.household)})`);
    }
    if (L.affection <= 0) {
      if (L.stage === 'married') {
        payBill(state, p, F.divorceCost, 'ค่าหย่า');
        addStats(state, p, { happiness: F.divorceHappiness });
        notes.push(`💔 ${L.name}ขอหย่า! เสียค่าหย่า ${fm(F.divorceCost)} ความสุข ${F.divorceHappiness}`);
        log(state, p.id, `💔 ${p.name} หย่ากับ${L.name}`, 'bad');
      } else {
        addStats(state, p, { happiness: F.breakupHappiness });
        notes.push(`💔 ${L.name}ขอเลิก เพราะไม่มีเวลาให้กันเลย ความสุข ${F.breakupHappiness}`);
        log(state, p.id, `💔 ${p.name} เลิกกับ${L.name}`, 'bad');
      }
      p.c.breakups++;
      p.love = null;
    } else if (!spent) {
      notes.push(`💔 สัปดาห์นี้ไม่ได้ใช้เวลากับ${L.name}เลย ความรักลด ${decay} (เหลือ ${L.affection})`);
    }
  }
  if (p.kids.length) {
    const cost = F.kidWeekly * p.kids.length;
    payBill(state, p, cost, 'ค่าเลี้ยงลูก');
    notes.push(`👶 ค่าเลี้ยงลูก ${fm(cost)}`);
    if (!p.weekActs.familyTime) {
      addStats(state, p, { happiness: -3 * p.kids.length });
      notes.push(`🧸 ลูก ๆ คิดถึง ไม่ได้อยู่ด้วยกันเลยสัปดาห์นี้ ความสุข -${3 * p.kids.length}`);
    }
  }
}

export function familyPoints(p) {
  let pts = 0;
  if (p.love) pts += (p.love.stage === 'married' ? 3 : 1) + (p.love.affection >= 60 ? 1 : 0);
  pts += Math.min(2, p.kids.length);
  return Math.min(6, pts);
}

export function changeAffection(p, delta) {
  if (p.love && delta) p.love.affection = clamp(p.love.affection + delta);
}
