// โหมดออฟไลน์: รันห้องเกมตัวเดียวกับเซิร์ฟเวอร์ไว้ในเบราว์เซอร์เลย
// เล่นกับบอท หรือผลัดกันเล่นหลายคนบนเครื่องเดียวกัน ไม่ต้องต่ออินเทอร์เน็ต
//
// บันทึกอัตโนมัติ: ทุกครั้งที่ห้องเปลี่ยน (หน่วงสั้น ๆ รวบหลายอัปเดตเป็นครั้งเดียว) และทันทีเมื่อสลับแท็บ/ปิดหน้า/กดออก
// - บันทึกเฉพาะตอนเกมเริ่มแล้ว (ห้องรอยังไม่บันทึก จึงไม่ทับเกมเก่าจนกว่าเกมใหม่จะเริ่มจริง)
// - เกมจบแล้วยังเก็บไว้ (รีเฟรชแล้วดูผลได้) ลบเมื่อกดออกจากเกมที่จบแล้ว หรือกดเล่นอีกรอบ
import { RoomManager } from '@game/roomManager.js';
import { readAutosave, writeAutosave, clearAutosave } from '../lib/saves.js';

const LOCAL_ID = 'local-player';
const AUTOSAVE_DELAY_MS = 400;
let warnedStorage = false;

export function createOfflineConnection() {
  const listeners = new Map();
  const deliver = (event, payload) => {
    const set = listeners.get(event);
    if (set) [...set].forEach((cb) => cb(payload));
  };

  let dirty = false;
  let closed = false;
  let saveTimer = null;
  const currentRoom = () => manager.roomOf(LOCAL_ID);
  const autosaveCode = () => readAutosave()?.summary?.code || null;

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    const room = currentRoom();
    if (!room || room.destroyed) return;
    if (room.status === 'lobby') {
      // กดเล่นอีกรอบในห้องเดิม: เซฟของเกมที่จบไปแล้วไม่ต้องเก็บ
      if (autosaveCode() === room.code) clearAutosave();
      return;
    }
    if (!writeAutosave(room.toJSON()) && !warnedStorage) {
      warnedStorage = true;
      deliver('notice', { text: '⚠️ บันทึกเกมอัตโนมัติไม่ได้ (พื้นที่ในเบราว์เซอร์เต็มหรือถูกปิดไว้) — กด 💾 แล้วดาวน์โหลดไฟล์เซฟเก็บไว้แทนได้' });
    }
  };
  const markDirty = () => {
    if (closed) return;
    dirty = true;
    if (!saveTimer) saveTimer = setTimeout(persist, AUTOSAVE_DELAY_MS);
  };

  const manager = new RoomManager({
    offline: true,
    maxRooms: 1,
    onChange: markDirty,
    // คัดลอกข้อมูลก่อนส่ง เพื่อไม่ให้หน้าจอถือ object เดียวกับสถานะเกมจริง
    send: (_clientId, event, payload) => {
      const copy = payload == null ? payload : structuredClone(payload);
      setTimeout(() => deliver(event, copy), 0);
    },
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') persist();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', persist);

  return {
    kind: 'offline',
    request(event, payload = {}) {
      if (event === 'room:leave') {
        // บันทึกสถานะล่าสุดก่อนออก (หลังออก ที่นั่งจะกลายเป็นบอทและห้องถูกปิด)
        persist();
        const room = currentRoom();
        const finishedCode = room?.status === 'finished' ? room.code : null;
        const res = manager.handle(LOCAL_ID, event, payload);
        if (finishedCode && autosaveCode() === finishedCode) clearAutosave();
        return Promise.resolve(res);
      }
      return Promise.resolve(manager.handle(LOCAL_ID, event, payload));
    },
    // ข้อมูลเซฟของเกมที่เล่นอยู่ (null ถ้ายังไม่เริ่มเกม)
    exportSave() {
      const room = currentRoom();
      return room?.game ? room.serialize() : null;
    },
    flushSave: persist,
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => listeners.get(event)?.delete(cb);
    },
    onStatus(cb) {
      cb('connected');
      return () => {};
    },
    start() {
      manager.connect(LOCAL_ID);
    },
    close() {
      persist();
      closed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', persist);
      manager.destroyAll();
      listeners.clear();
    },
  };
}
