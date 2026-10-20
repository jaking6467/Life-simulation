// เซฟเกมในเบราว์เซอร์: บันทึกอัตโนมัติ 1 ช่อง + ช่องบันทึกเอง 3 ช่อง + ไฟล์เซฟ (.json)
// localStorage อาจใช้ไม่ได้หรือเต็ม จึงครอบ try/catch ทุกครั้ง และบอกผลสำเร็จ/ไม่สำเร็จกลับไป
//
// แต่ละช่องเก็บ { v, summary, save } — save คือข้อมูลห้องจาก Room.serialize() (ตรวจสอบจริงตอนโหลดในตัวเกม)
// summary คือข้อมูลย่อไว้แสดงในรายการ (สัปดาห์ ผู้เล่น เวลาที่บันทึก) ไม่ต้องอ่านเซฟทั้งก้อน

const AUTO_KEY = 'ls.save.auto';
const SLOT_KEYS = ['ls.save.slot1', 'ls.save.slot2', 'ls.save.slot3'];
const ENTRY_VERSION = 1;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const SLOT_COUNT = SLOT_KEYS.length;

// แจ้งหน้าจอเมื่อรายการเซฟเปลี่ยน (เช่น บันทึกลงช่อง / ลบ)
const listeners = new Set();
export function subscribeSaves(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function changed() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* ไม่เป็นไร */
    }
  });
}

export function summarize(save) {
  const g = save && typeof save.game === 'object' ? save.game : null;
  const seats = Array.isArray(save?.seats) ? save.seats : [];
  const ids = g && Array.isArray(g.order) ? g.order : seats.map((s) => s?.id);
  const players = ids.map((id) => {
    const p = (g?.players && g.players[id]) || {};
    const seat = seats.find((s) => s?.id === id) || {};
    return {
      id,
      name: String(p.name || seat.name || 'ผู้เล่น'),
      role: typeof p.role === 'string' ? p.role : null,
      color: typeof (p.color || seat.color) === 'string' ? p.color || seat.color : '#888888',
      isBot: !seat.clientId,
      score: Number(p.score) || 0,
    };
  });
  return {
    code: typeof save?.code === 'string' ? save.code : null,
    status: save?.status || null,
    week: Number(g?.week) || 0,
    maxWeeks: Number(g?.maxWeeks) || 0,
    players,
    savedAt: Number(save?.savedAt) || Date.now(),
  };
}

function validSummary(s) {
  return (
    !!s &&
    typeof s === 'object' &&
    Number.isFinite(s.week) &&
    Number.isFinite(s.maxWeeks) &&
    Number.isFinite(s.savedAt) &&
    Array.isArray(s.players) &&
    s.players.every((p) => p && typeof p === 'object' && typeof p.name === 'string')
  );
}

function readEntry(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || !entry.save || typeof entry.save !== 'object') return null;
    return { summary: validSummary(entry.summary) ? entry.summary : summarize(entry.save), save: entry.save };
  } catch {
    return null;
  }
}

// คืน true ถ้าบันทึกสำเร็จ — save อาจเป็นข้อมูลที่อ้างอิงสถานะจริง (toJSON) จึงแปลงเป็นข้อความทันที
function writeEntry(key, save) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: ENTRY_VERSION, summary: summarize(save), save }));
    changed();
    return true;
  } catch {
    return false;
  }
}

function removeEntry(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ไม่เป็นไร */
  }
  changed();
}

export const readAutosave = () => readEntry(AUTO_KEY);
export const writeAutosave = (save) => writeEntry(AUTO_KEY, save);
export const clearAutosave = () => removeEntry(AUTO_KEY);

export const readSlots = () => SLOT_KEYS.map(readEntry);
export const writeSlot = (i, save) => (SLOT_KEYS[i] ? writeEntry(SLOT_KEYS[i], save) : false);
export const clearSlot = (i) => SLOT_KEYS[i] && removeEntry(SLOT_KEYS[i]);

// เกมที่ยังเล่นไม่จบในช่องบันทึกอัตโนมัติ (ใช้เตือนก่อนเริ่ม/โหลดเกมอื่นทับ)
export function unfinishedAutosave() {
  const auto = readAutosave();
  return auto && auto.summary.status === 'playing' ? auto : null;
}

export function isSameSave(a, b) {
  return !!a && !!b && a.code === b.code && Number(a.savedAt) === Number(b.savedAt);
}

export function formatSavedAt(ts) {
  try {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function weekText(summary) {
  if (summary.status === 'finished') return `🏁 จบเกมแล้ว (${summary.maxWeeks} สัปดาห์)`;
  return `สัปดาห์ ${summary.week}/${summary.maxWeeks}`;
}

export function saveFileName(save) {
  return `life-sim-save-week${Number(save?.game?.week) || 0}.json`;
}

export function downloadSave(save) {
  const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = saveFileName(save);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// อ่านไฟล์เซฟที่ผู้เล่นเลือก — โยน Error ข้อความภาษาไทยถ้าใช้ไม่ได้ (ตรวจละเอียดอีกครั้งตอนโหลดเข้าเกม)
export async function readSaveFile(file) {
  if (!file) throw new Error('ไม่ได้เลือกไฟล์');
  if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์ใหญ่เกินไป ไม่น่าใช่ไฟล์เซฟของเกมนี้');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('เปิดไฟล์ไม่ได้ — ไฟล์นี้ไม่ใช่ไฟล์เซฟ (.json) ของเกมเส้นทางชีวิต');
  }
  // รองรับทั้งไฟล์ที่ดาวน์โหลดจากเกม และข้อมูลช่องเซฟที่คัดลอกมาจากเบราว์เซอร์
  const save = data && typeof data === 'object' && data.save && typeof data.save === 'object' ? data.save : data;
  if (!save || typeof save !== 'object' || !('saveVersion' in save)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์เซฟของเกมเส้นทางชีวิต');
  return save;
}
