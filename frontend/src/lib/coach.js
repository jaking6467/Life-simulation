// ผู้ช่วยมือใหม่ (โค้ช): สอนเล่นทีละขั้นในเกมแรก + เคล็ดลับเตือนตามสถานการณ์
// คำนวณจาก view สาธารณะของผู้เล่นที่กำลังเล่นเท่านั้น ไม่แก้สถานะเกม
// ฟิลด์ของระบบใหม่ (คู่รัก กิจการ บ้าน ประกัน การ์ด) อ่านแบบ optional ทั้งหมด ไม่มีก็ไม่พัง
import { JOBS, COURSES, LOCATION_BY_ID, CLOTHES, RULES, SCORE_CATEGORIES, formatMoney } from './game.js';
import { load, save } from './storage.js';

export const TUTORIAL_KEY = 'ls.tutorial';

// ---------- การตั้งค่า (localStorage) ----------
// { enabled, done, dismissedTips, collapsed, game: { id, seats: { [playerId]: { steps, startWeek, finished, finishedTurn, finishSeen } } } }
export function loadTutorial() {
  const raw = load(TUTORIAL_KEY, null);
  const s = raw && typeof raw === 'object' ? raw : {};
  const game = s.game && typeof s.game === 'object' && typeof s.game.id === 'string' && s.game.seats && typeof s.game.seats === 'object' ? s.game : null;
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
    done: !!s.done,
    dismissedTips: Array.isArray(s.dismissedTips) ? s.dismissedTips.filter((x) => typeof x === 'string').slice(-60) : [],
    collapsed: !!s.collapsed,
    game,
  };
}

export function saveTutorial(s) {
  save(TUTORIAL_KEY, {
    enabled: !!s.enabled,
    done: !!s.done,
    dismissedTips: s.dismissedTips || [],
    collapsed: !!s.collapsed,
    game: s.game || null,
  });
}

// สวิตช์ในหน้าแรก: เปิดใหม่หลังเคยเรียนจบแล้ว = เริ่มสอนพื้นฐานใหม่ในเกมถัดไป
export function setTutorialEnabled(on) {
  const s = loadTutorial();
  saveTutorial(on && s.done ? { ...s, enabled: true, done: false, game: null } : { ...s, enabled: !!on });
}

// ---------- ตัวช่วย ----------
const fm = formatMoney;
const place = (id) => {
  const l = LOCATION_BY_ID[id];
  return l ? `${l.icon} ${l.name}` : '';
};
const safe = (fn) => {
  try {
    return !!fn();
  } catch {
    return false;
  }
};

// เดินไปที่นั่นได้ไหม ใช้กี่ชั่วโมง (อยู่ที่นั่นแล้ว = 0)
function reach(view, me, id) {
  if (!id || !LOCATION_BY_ID[id]) return null;
  if (me.location === id) return { id, hours: 0, ok: true, here: true };
  const t = view.travel?.[id];
  if (!t) return { id, hours: Infinity, ok: false, here: false };
  return { id, hours: t.hours, ok: !!t.ok, here: false };
}

function nearest(view, me, ids) {
  let best = null;
  for (const id of ids) {
    const r = reach(view, me, id);
    if (r?.ok && (!best || r.hours < best.hours)) best = r;
  }
  return best?.id || ids[0];
}

export function matchAction(a, spec) {
  if (!spec || !a || a.action !== spec.action) return false;
  return Object.entries(spec.params || {}).every(([k, v]) => a.params?.[k] === v);
}

const findAction = (view, spec) => (view.actions || []).find((a) => matchAction(a, spec)) || null;
const here = (me, id) => me.location === id;
const tap = (label) => `กด “${label}” ด้านล่างได้เลย 👇`;

function entryJob() {
  return JOBS.fryCook || Object.values(JOBS).find((j) => !Object.keys(j.req || {}).length) || null;
}

function firstCourse() {
  return COURSES.highschool || Object.values(COURSES).find((c) => !c.prereq) || null;
}

function studyFee(view, me, c) {
  const a = findAction(view, { action: 'enroll', params: { courseId: c.id } });
  if (a) return a.cost;
  let fee = c.fee;
  if (me.role === 'scholar') fee *= 0.7;
  if (me.job && JOBS[me.job]?.location === 'uni') fee *= 0.5;
  return Math.round(fee / 100) * 100;
}

const WHY_EAT = 'ต้องกินอย่างน้อย 1 มื้อต่อสัปดาห์ ไม่งั้นสุขภาพกับความสุขลด และสัปดาห์หน้าเวลาหายไป 10 ชม.';

// ---------- ขั้นตอนพื้นฐาน ----------
// done: ทำสำเร็จแล้ว (จำไว้ถาวรต่อผู้เล่น) · wait: ยังไม่ถึงเวลา (ข้ามไปขั้นถัดไปก่อน) · build: ข้อความ + เป้าหมาย
const STEPS = [
  {
    id: 'welcome',
    done: (me) => me.hoursLeft < me.hoursMax,
    build: (me) => ({
      icon: '👋',
      title: 'ยินดีต้อนรับสู่เส้นทางชีวิต!',
      text: `1 ตา = 1 สัปดาห์ มีเวลา ${me.hoursMax} ชม. แตะอาคารเพื่อดู แตะซ้ำเพื่อเดินไป (การเดินก็ใช้เวลา)`,
      why: 'จะพาทำทีละขั้น: กิน → หางาน → ทำงาน → เรียน → จบสัปดาห์',
      next: true,
    }),
  },
  {
    id: 'eat',
    done: (me) => !!me.ate,
    build: (me, view) => {
      if (here(me, me.housing) && me.groceries > 0) {
        return { icon: '🍳', title: 'หาอะไรกินก่อน', target: me.housing, action: { action: 'cook' }, hours: 1, text: tap('ทำอาหารกินเอง'), why: WHY_EAT };
      }
      if (here(me, 'restaurant')) {
        return { icon: '🍜', title: 'หาอะไรกินก่อน', target: 'restaurant', action: { action: 'dine' }, hours: 2, text: tap('ทานอาหารริมน้ำ'), why: WHY_EAT };
      }
      const target = view.global?.closed === 'cluckers' ? 'restaurant' : 'cluckers';
      const label = target === 'cluckers' ? 'กินไก่ทอดชุดใหญ่' : 'ทานอาหารริมน้ำ';
      return {
        icon: target === 'cluckers' ? '🍗' : '🍜',
        title: 'หาอะไรกินก่อน',
        target,
        action: { action: target === 'cluckers' ? 'eatFast' : 'dine' },
        hours: target === 'cluckers' ? 1 : 2,
        text: here(me, target) ? tap(label) : `ไปที่ ${place(target)} แล้วกด “${label}”`,
        why: WHY_EAT,
      };
    },
  },
  {
    id: 'job',
    done: (me) => !!me.job,
    build: (me, view) => {
      const job = entryJob();
      let spec = job ? { action: 'apply', params: { jobId: job.id } } : { action: 'apply' };
      let label = job ? job.title : 'งานที่ไม่ต้องใช้วุฒิ';
      if (here(me, 'jobs')) {
        const a = findAction(view, spec);
        if (!a || a.disabled) {
          const alt = (view.actions || []).find((x) => x.action === 'apply' && !x.disabled);
          if (alt) {
            spec = { action: 'apply', params: alt.params };
            label = alt.label;
          }
        } else label = a.label;
      }
      return {
        icon: '💼',
        title: 'หางานทำ',
        target: 'jobs',
        action: spec,
        hours: 1,
        text: here(me, 'jobs') ? `สมัคร “${label}” ด้านล่างได้เลย 👇` : `ไปที่ ${place('jobs')} แล้วสมัคร “${label}”`,
        why: job?.location === 'cluckers' ? 'งานแรกไม่ต้องใช้วุฒิ แถมทำที่ร้านไก่ทอดได้กินฟรีด้วย มีวุฒิแล้วค่อยเปลี่ยนงานที่ดีกว่า' : 'งานแรกไม่ต้องใช้วุฒิ มีวุฒิและประสบการณ์แล้วค่อยเปลี่ยนงานที่ดีกว่า',
      };
    },
  },
  {
    id: 'work',
    done: (me) => (me.xp || 0) > 0 || (me.c?.shifts || 0) > 0,
    build: (me, view) => {
      const job = JOBS[me.job];
      if (!job) {
        return { icon: '🔨', title: 'ไปทำงานกะแรก', target: 'jobs', action: { action: 'apply' }, hours: 1, text: `ต้องมีงานก่อน — ไปสมัครที่ ${place('jobs')}`, why: 'ทำงานได้ค่าจ้าง + ชั่วโมงประสบการณ์' };
      }
      const at = here(me, job.location);
      const a = at ? findAction(view, { action: 'work' }) : null;
      return {
        icon: '🔨',
        title: 'ไปทำงานกะแรก',
        target: job.location,
        action: { action: 'work' },
        hours: 2,
        text: at
          ? a?.disabled
            ? `ตอนนี้ยังทำงานไม่ได้: ${a.reason}`
            : `กด “ทำงาน: ${job.title}” ด้านล่าง 👇 (1 กะ ≈ 8 ชม.)`
          : `ไปที่ทำงาน ${place(job.location)} (อาคารที่มี 💼 บนแผนที่) แล้วกด “ทำงาน”`,
        why: 'ได้ค่าจ้าง + ชั่วโมงประสบการณ์ ยิ่งทำมาก ยิ่งเลื่อนไปงานที่ดีกว่าได้',
      };
    },
  },
  {
    id: 'shower',
    done: (me) => !!(me.weekActs?.shower || me.weekActs?.gymShower) || (me.stats?.hygiene ?? 0) >= 95,
    wait: (me) => ((me.stats?.hygiene ?? 0) >= 70 ? `ตอนนี้ยังสะอาดอยู่ (${me.stats.hygiene}) จะอาบเลยหรือไว้ทีหลังก็ได้` : null),
    build: (me) => {
      const atGym = here(me, 'gym');
      const target = atGym ? 'gym' : me.housing;
      const label = atGym ? 'อาบน้ำที่ฟิตเนส' : 'อาบน้ำแต่งตัว';
      return {
        icon: '🚿',
        title: 'อาบน้ำให้สะอาด',
        target,
        action: { action: atGym ? 'gymShower' : 'shower' },
        hours: 1,
        text: here(me, target) ? tap(label) : `กลับบ้าน ${place(me.housing)} (อาคารที่มี 🏠) แล้วกด “${label}”`,
        why: `ความสะอาด ${me.stats?.hygiene ?? '?'} ลดลง 20 ทุกสัปดาห์ — ต่ำกว่า 30 สัมภาษณ์งานไม่ผ่าน ต่ำกว่า 20 เข้างานไม่ได้`,
      };
    },
  },
  {
    id: 'study',
    done: (me) => !!me.education?.enrolled || (me.education?.completed?.length || 0) > 0,
    wait: (me, view) => {
      const c = firstCourse();
      if (!c) return null;
      const fee = studyFee(view, me, c);
      return me.cash < fee ? `ค่าเทอม ${fm(fee)} แต่มีเงินสด ${fm(me.cash)} — ทำงานเก็บเงินก่อนแล้วค่อยมา` : null;
    },
    build: (me, view) => {
      const c = firstCourse();
      const fee = c ? studyFee(view, me, c) : 0;
      const at = here(me, 'uni');
      return {
        icon: '🎓',
        title: 'ลงเรียนเพิ่มวุฒิ',
        target: 'uni',
        action: c ? { action: 'enroll', params: { courseId: c.id } } : { action: 'enroll' },
        hours: 0,
        text: at ? `ลงทะเบียน “${c?.icon || ''} ${c?.name || 'หลักสูตรแรก'}” ด้านล่าง 👇 (${fm(fee)})` : `ไปที่ ${place('uni')} ลงทะเบียน “${c?.name || 'หลักสูตรแรก'}” (${fm(fee)})`,
        why: `แล้วกด “เข้าเรียน” ให้ครบ ${c?.sessions || 3} คาบ ได้วุฒิไปสมัครงานเงินดี + ได้คะแนนการศึกษาทุกสัปดาห์`,
      };
    },
  },
  {
    id: 'endWeek',
    done: (me, view, seat) => view.week > (seat?.startWeek ?? view.week),
    build: (me) => {
      const h = me.hoursLeft;
      const more = [];
      if (me.job && h >= 4) more.push('ทำงานเพิ่ม');
      if (me.education?.enrolled && h >= 6) more.push('เข้าเรียน');
      more.push('นอนพัก');
      return {
        icon: '🌙',
        title: 'จบสัปดาห์',
        action: { action: 'endTurn' },
        text: h >= 8 ? `ยังเหลือ ${h} ชม. — จะ${more.join(' / ')}ก่อนก็ได้ แล้วกด “จบสัปดาห์” ด้านล่าง` : 'กด “จบสัปดาห์” ด้านล่าง เพื่อส่งตาให้คนถัดไป',
        why: `สุดสัปดาห์หักค่าเช่าให้อัตโนมัติ แล้วให้คะแนนตาม${SCORE_CATEGORIES.map((c) => c.name).join(' ')}`,
      };
    },
  },
];

export const STEP_COUNT = STEPS.length;

// ---------- เคล็ดลับตามสถานการณ์ (เรียงจากสำคัญสุด) ----------
const RELAX_ACTION = { park: 'walkPark', temple: 'meditate', arcade: 'playArcade' };

function foodOption(view, me) {
  const opts = [];
  if (me.groceries > 0) opts.push({ target: me.housing, action: { action: 'cook' }, hours: 1, cost: 0 });
  opts.push({ target: 'cluckers', action: { action: 'eatFast' }, hours: 1, cost: 120 });
  opts.push({ target: 'restaurant', action: { action: 'dine' }, hours: 2, cost: 450 });
  let best = null;
  for (const o of opts) {
    const r = reach(view, me, o.target);
    if (!r?.ok || r.hours + o.hours > me.hoursLeft) continue;
    const a = r.here ? findAction(view, o.action) : null;
    if ((a ? a.cost : o.cost) > me.cash || a?.disabled) continue;
    if (!best || r.hours < best.r.hours) best = { ...o, r };
  }
  return best;
}

function contextTips(view, me, steps) {
  const s = me.stats || {};
  const h = me.hoursLeft;
  const tips = [];
  const home = me.housing;

  if (!me.ate && h < 15) {
    const food = foodOption(view, me);
    tips.push(
      food
        ? { id: 'hunger', relates: 'eat', tone: 'bad', icon: '🍽️', text: `ยังไม่ได้กินเลย เหลือเวลา ${h} ชม.! รีบไปกินที่ ${place(food.target)} ก่อนจบสัปดาห์`, target: food.target, action: food.action }
        : { id: 'hunger', relates: 'eat', tone: 'bad', icon: '🍽️', text: 'ยังไม่ได้กินเลย และหาอาหารไม่ทันแล้ว สัปดาห์หน้าเวลาจะหาย 10 ชม. — ครั้งหน้ากินตั้งแต่ต้นสัปดาห์นะ' },
    );
  }
  if (s.happiness < 15) {
    const t = nearest(view, me, ['park', 'temple', 'arcade', home]);
    tips.push({ id: 'burnout', tone: 'bad', icon: '😵', text: `หมดไฟแล้ว (ความสุข ${s.happiness}) ทำงาน/เรียนไม่ได้ — เดินเล่นที่สวน (ฟรี) ทำสมาธิที่วัด หรือนอนพักที่บ้าน`, target: t, action: { action: RELAX_ACTION[t] || 'rest' } });
  }
  if (s.hygiene < 20) {
    const t = nearest(view, me, [home, 'gym']);
    tips.push({ id: 'filthy', relates: 'shower', tone: 'bad', icon: '🧼', text: `ตัวเหม็นจนเข้างานไม่ได้ (ความสะอาด ${s.hygiene}) — อาบน้ำที่บ้านหรือฟิตเนสก่อน`, target: t, action: { action: t === 'gym' ? 'gymShower' : 'shower' } });
  }
  if (s.health < 25) {
    const t = nearest(view, me, ['hospital', home]);
    tips.push({ id: 'health', tone: 'bad', icon: '❤️', text: `สุขภาพเหลือ ${s.health} ถ้าถึง 0 ต้องนอนโรงพยาบาล เสียเงินก้อนใหญ่ — ตรวจสุขภาพที่โรงพยาบาล หรือนอนพักที่บ้าน`, target: t, action: { action: t === 'hospital' ? 'checkup' : 'rest' } });
  }
  if (s.happiness >= 15 && s.happiness < 30) {
    const t = nearest(view, me, ['park', 'arcade', 'temple']);
    tips.push({ id: 'sad', tone: 'warn', icon: '😟', text: `ความสุขเหลือ ${s.happiness} ใกล้หมดไฟแล้ว — เดินเล่นที่สวน (ฟรี) ดูหนังที่ตู้เกม หรือนั่งสมาธิที่วัด`, target: t, action: { action: RELAX_ACTION[t] } });
  }
  if (s.hygiene >= 20 && s.hygiene < 35) {
    const t = nearest(view, me, [home, 'gym']);
    tips.push({ id: 'dirty', relates: 'shower', tone: 'warn', icon: '🧼', text: `ความสะอาดเหลือ ${s.hygiene} — ต่ำกว่า 30 สัมภาษณ์งานไม่ผ่าน ต่ำกว่า 20 เข้างานไม่ได้ ไปอาบน้ำกันเถอะ`, target: t, action: { action: t === 'gym' ? 'gymShower' : 'shower' } });
  }
  const clothes = me.clothes || {};
  if (clothes.tier === 0) {
    tips.push({ id: 'clothes', tone: 'warn', icon: '👕', text: `ไม่มีเสื้อผ้าดี ๆ ใส่ งานหลายที่ไม่รับ — ซื้อ${CLOTHES[1]?.name || 'ชุดใหม่'}ที่ห้างสรรพสินค้า`, target: 'mall', action: { action: 'buyClothes', params: { tier: 1 } } });
  } else if (clothes.tier > 0 && clothes.weeksLeft <= 1) {
    tips.push({ id: 'clothes', tone: 'warn', icon: '👕', text: `${CLOTHES[clothes.tier]?.name || 'เสื้อผ้า'}จะขาดหลังสัปดาห์นี้ — แวะซื้อชุดใหม่ที่ห้างสรรพสินค้า`, target: 'mall', action: { action: 'buyClothes', params: { tier: clothes.tier } } });
  }
  if (me.cash >= 6000 && !me.furniture?.includes('robot')) {
    tips.push({ id: 'cash', tone: 'warn', icon: '💰', text: `พกเงินสด ${fm(me.cash)} เสี่ยงโดนขโมยตอนสุดสัปดาห์ — ฝากธนาคารไว้ ปลอดภัยแถมได้ดอกเบี้ย`, target: 'bank', action: { action: 'deposit', params: { amount: 'keep' } } });
  }
  if (!me.job && view.week >= 2) {
    const job = entryJob();
    tips.push({ id: 'nojob', relates: 'job', tone: 'warn', icon: '💼', text: `ยังไม่มีงานเลย — ไปสมัครที่ศูนย์จัดหางาน${job ? ` “${job.title}” ไม่ต้องใช้วุฒิ` : ''}`, target: 'jobs', action: job ? { action: 'apply', params: { jobId: job.id } } : { action: 'apply' } });
  }
  // สัปดาห์ที่แล้วไม่ได้กิน (เวลาสัปดาห์นี้ลดลง) หรือยังเรียนพื้นฐานอยู่ → เตือนเบา ๆ ให้กินก่อน
  const base = me.role === 'senior' ? 50 : RULES.hoursPerWeek;
  const starved = me.hoursMax < base;
  if (!me.ate && h >= 15 && view.week >= 2 && (steps || starved)) {
    const food = foodOption(view, me);
    const text = starved ? `สัปดาห์ที่แล้วไม่ได้กิน เวลาเลยเหลือ ${me.hoursMax} ชม. — สัปดาห์นี้กินก่อนเลย (${place(food?.target)})` : `อย่าลืมกินอย่างน้อย 1 มื้อในสัปดาห์นี้ด้วยนะ (${place(food?.target)})`;
    if (food) tips.push({ id: 'meal', relates: 'eat', tone: starved ? 'warn' : 'info', icon: '🍽️', text, target: food.target, action: food.action });
  }
  const enrolled = me.education?.enrolled;
  if (enrolled && !(me.weekActs?.attend || me.weekActs?.studyOnline) && h <= 30) {
    const online = me.furniture?.includes('computer');
    const t = online ? nearest(view, me, ['uni', home]) : 'uni';
    const r = reach(view, me, t);
    if (r?.ok && r.hours + 6 <= h) {
      tips.push({ id: 'class', relates: 'study', tone: 'info', icon: '📖', text: `ลงเรียน${COURSES[enrolled]?.name || ''}ไว้แล้ว อย่าลืมเข้าเรียนสัปดาห์นี้`, target: t, action: { action: t === 'uni' ? 'attend' : 'studyOnline' } });
    }
  }
  return tips;
}

// ---------- เคล็ดลับขั้นสูง (ระบบใหม่) — หลังเรียนพื้นฐานจบ ตั้งแต่สัปดาห์ 3 ----------
const ADVANCED = [
  {
    id: 'adv.love',
    icon: '💕',
    title: 'หาคู่ สร้างครอบครัว',
    text: 'ไปสวน & ตลาดนัด กด “ทำความรู้จัก” แล้วชวนเดตที่ภัตตาคาร ตู้เกม หรือสวน ขอแต่งงานที่วัด มีลูกที่โรงพยาบาล — ได้คะแนนหมวดครอบครัว',
    target: 'park',
    done: (me) => !!(me.love || me.kids?.length || me.weekActs?.meet || me.weekActs?.date),
  },
  {
    id: 'adv.business',
    icon: '🏪',
    title: 'เป็นเจ้าของกิจการ',
    text: 'ซื้อกิจการได้ที่ซูเปอร์มาร์เก็ต ไก่ทอด ห้าง หรืออาคารสำนักงาน แล้วแวะ “ดูแลร้านเอง” สัปดาห์นั้นกำไรเพิ่ม 50%',
    target: 'market',
    done: (me) => (me.businesses?.length || 0) > 0,
  },
  {
    id: 'adv.home',
    icon: '🏡',
    title: 'ซื้อบ้านแทนเช่า',
    text: 'ซื้อบ้านผ่อนที่ธนาคาร (ต้องมีงานหรือธุรกิจ) ดาวน์ 20% แล้วผ่อนเป็นของตัวเอง เลิกจ่ายค่าเช่าทิ้งทุกสัปดาห์',
    target: 'bank',
    done: (me) => !!(me.owned || me.weekActs?.buyHome),
  },
  {
    id: 'adv.insurance',
    icon: '🛡️',
    title: 'ทำประกันไว้อุ่นใจ',
    text: 'ซื้อประกันที่ธนาคาร ช่วยจ่ายตอนป่วยหนักหรือเจอเรื่องร้าย ไม่ต้องควักเงินก้อนใหญ่',
    target: 'bank',
    done: (me) => Object.keys(me.insurance || {}).length > 0 || !!me.weekActs?.buyInsurance,
  },
  {
    id: 'adv.cards',
    icon: '🃏',
    title: 'การ์ดแกล้ง & การ์ดช่วย',
    text: 'ซื้อการ์ดที่ตู้เกม & โรงหนัง แล้วใช้ได้จากทุกที่ กลัวโดนแกล้งก็ไปขอเครื่องรางที่วัดไว้กัน',
    target: 'arcade',
    done: (me) => (me.cards?.length || 0) > 0 || !!me.weekActs?.buyCard,
  },
  {
    id: 'adv.slots',
    icon: '👑',
    title: 'ตำแหน่งงานมีจำกัด',
    text: 'งานระดับสูงมีแค่ 1–2 ที่ ถ้าคุณสมบัติดีกว่าคนที่นั่งอยู่ ท้าชิงตำแหน่งได้ที่ศูนย์จัดหางาน',
    target: 'jobs',
  },
  {
    id: 'adv.prices',
    icon: '📈',
    title: 'ของแย่งกันซื้อ ราคาขึ้น',
    text: 'ของที่หลายคนแห่ซื้อจะแพงขึ้น ซื้อก่อนคนอื่น หรือเลือกของที่ยังไม่ค่อยมีใครซื้อ',
    target: 'mall',
  },
  {
    id: 'adv.vehicle',
    icon: '🚲',
    title: 'มีพาหนะ เดินทางเร็วขึ้น',
    text: 'ซื้อจักรยานที่โชว์รูมรถ เดินทางเร็วขึ้น เหลือเวลาทำงานหรือเรียนมากขึ้น',
    target: 'vehicles',
    done: (me) => !!me.vehicle,
  },
  {
    id: 'adv.computer',
    icon: '🖥️',
    title: 'เรียนออนไลน์ที่บ้าน',
    text: 'ซื้อคอมพิวเตอร์ที่ร้านเฟอร์นิเจอร์ & ไอที แล้วเรียนออนไลน์จากบ้านได้ ไม่ต้องเดินไปมหาวิทยาลัย',
    target: 'furniture',
    done: (me) => !!me.furniture?.includes('computer'),
  },
];

const withGo = (view, me, item) => {
  if (!item) return item;
  const r = item.target ? reach(view, me, item.target) : null;
  return { ...item, go: r && !r.here ? r : null, here: !!r?.here };
};

// ---------- ประเมินว่าตอนนี้ควรแนะนำอะไร ----------
// seat: ความคืบหน้าของผู้เล่นคนนี้ · hidden: เคล็ดลับที่ซ่อนไว้ในตานี้ (`${turn}:${id}`)
export function evaluateCoach({ view, me, seat, dismissedTips = [], hidden = {}, showIdle = false }) {
  const out = {
    mode: seat.finished ? 'tips' : 'steps',
    step: null,
    stepNo: 0,
    total: STEPS.length,
    dots: [],
    tip: null,
    adv: null,
    finish: false,
    idle: false,
    highlight: null,
    highlightAction: null,
    autoDone: [],
    allDone: false,
  };

  // การ์ดยินดีด้วย: แสดงในตาที่เรียนจบ จนกว่าจะกดเลือก
  out.finish = !!(seat.finished && !seat.finishSeen && seat.finishedTurn === view.turn);

  if (view.phase?.type === 'choice') {
    if (out.mode === 'steps') {
      out.step = { id: 'choice', icon: '🃏', title: 'มีเรื่องให้ตัดสินใจ', text: 'อ่านตัวเลือกด้านล่าง แล้วเลือก 1 ข้อ — แต่ละข้อได้อย่างเสียอย่าง', why: 'ตัดสินใจเสร็จแล้วถึงจะเริ่มใช้เวลาในสัปดาห์นี้ได้' };
    } else out.idle = !out.finish && showIdle;
    return out;
  }

  let steps = false;
  if (out.mode === 'steps') {
    const done = {};
    for (const s of STEPS) {
      const stored = !!seat.steps?.[s.id];
      const now = !stored && safe(() => s.done(me, view, seat));
      if (now) out.autoDone.push(s.id);
      done[s.id] = stored || now;
    }
    if (!done.welcome && STEPS.some((s) => s.id !== 'welcome' && done[s.id])) {
      done.welcome = true;
      out.autoDone.push('welcome');
    }
    const doneCount = STEPS.filter((s) => done[s.id]).length;
    out.allDone = doneCount === STEPS.length;

    if (out.allDone) {
      out.finish = !seat.finishSeen;
    } else {
      steps = true;
      let pick = null;
      let waiting = null;
      for (const s of STEPS) {
        if (done[s.id]) continue;
        const built = { ...s.build(me, view), id: s.id };
        let reason = s.wait?.(me, view) || null;
        if (!reason && built.target && !here(me, built.target) && view.global?.closed === built.target) reason = `${LOCATION_BY_ID[built.target].name} ปิดชั่วคราวสัปดาห์นี้`;
        if (!reason) {
          pick = built;
          break;
        }
        waiting ||= { ...built, note: reason };
      }
      pick ||= waiting;
      // เวลาไม่พอทำขั้นนี้แล้ว → แนะนำให้จบสัปดาห์ก่อน
      if (pick?.target) {
        const r = reach(view, me, pick.target);
        const need = (r?.here ? 0 : r?.hours ?? 0) + (pick.hours || 0);
        if (r && need > me.hoursLeft) {
          pick = {
            id: pick.id,
            icon: '⏳',
            title: 'เวลาสัปดาห์นี้ไม่พอแล้ว',
            text: `ขั้นต่อไป “${pick.title}” ต้องใช้ราว ${need} ชม. แต่เหลือ ${me.hoursLeft} ชม. — กด “จบสัปดาห์” แล้วค่อยทำต่อสัปดาห์หน้า`,
            action: { action: 'endTurn' },
            lowTime: true,
          };
        }
      }
      out.step = withGo(view, me, pick);
      out.stepNo = doneCount + 1;
    }
    out.dots = STEPS.map((s) => ({ id: s.id, done: done[s.id], current: s.id === out.step?.id }));
  }

  // เคล็ดลับตามสถานการณ์: ทีละข้อ สำคัญสุดก่อน (ไม่ซ้ำกับขั้นที่กำลังสอน)
  const tips = contextTips(view, me, steps).filter((t) => !hidden[`${view.turn}:${t.id}`] && !(out.step && t.relates === out.step.id));
  out.tip = withGo(view, me, tips[0] || null);

  // เคล็ดลับขั้นสูง: หลังจบพื้นฐาน ตั้งแต่สัปดาห์ 3 ตาละไม่เกิน 1 ข้อ
  if (!steps && !out.finish && view.week >= 3 && !hidden[`${view.turn}:adv`]) {
    const pool = ADVANCED.filter((a) => !dismissedTips.includes(a.id) && !(a.done && safe(() => a.done(me))));
    if (pool.length) out.adv = withGo(view, me, pool[(view.week - 3) % pool.length]);
  }

  // เพิ่งกดเปิดผู้ช่วย (โหมดเคล็ดลับ): บอกว่าเปิดอยู่ + ทางลัดเริ่มสอนใหม่
  out.idle = !steps && !out.finish && showIdle;

  // ไฮไลต์: เรื่องด่วนก่อน ไม่งั้นตามขั้นที่สอนอยู่
  // แผนที่: อาคารของเรื่องที่โฟกัส (ถ้าอยู่ที่นั่นแล้วไฮไลต์ปุ่มแทน) ถ้าเรื่องนั้นไม่มีอาคาร ค่อยใช้เคล็ดลับข้อถัดไป
  const focus = (out.tip?.tone === 'bad' && out.tip) || out.step || out.tip || out.adv;
  if (focus?.action && (focus.action.action === 'endTurn' || focus.here)) out.highlightAction = focus.action;
  const mapItem = focus?.target ? focus : [out.tip, out.adv].find((x) => x?.target);
  out.highlight = mapItem?.go ? mapItem.target : null;
  return out;
}
