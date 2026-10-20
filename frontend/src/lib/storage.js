// localStorage อาจใช้ไม่ได้ (โหมดไม่ระบุตัวตน/ถูกบล็อก) จึงครอบ try/catch ทุกครั้ง

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ไม่เป็นไร */
  }
}

function randomId() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

// รหัสประจำเครื่อง ใช้ยืนยันตัวตนกับเซิร์ฟเวอร์ ทำให้รีเฟรชแล้วกลับเข้าห้องเดิมได้
let memoryId = null;
export function getClientId() {
  let id = load('ls.clientId', null);
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = memoryId || randomId();
    memoryId = id;
    save('ls.clientId', id);
  }
  return id;
}
