// โหมดออฟไลน์: รันห้องเกมตัวเดียวกับเซิร์ฟเวอร์ไว้ในเบราว์เซอร์เลย
// เล่นกับบอท หรือผลัดกันเล่นหลายคนบนเครื่องเดียวกัน ไม่ต้องต่ออินเทอร์เน็ต
import { RoomManager } from '@game/roomManager.js';

const LOCAL_ID = 'local-player';

export function createOfflineConnection() {
  const listeners = new Map();
  const deliver = (event, payload) => {
    const set = listeners.get(event);
    if (set) [...set].forEach((cb) => cb(payload));
  };
  const manager = new RoomManager({
    offline: true,
    maxRooms: 1,
    // คัดลอกข้อมูลก่อนส่ง เพื่อไม่ให้หน้าจอถือ object เดียวกับสถานะเกมจริง
    send: (_clientId, event, payload) => {
      const copy = payload == null ? payload : structuredClone(payload);
      setTimeout(() => deliver(event, copy), 0);
    },
  });

  return {
    kind: 'offline',
    request(event, payload = {}) {
      return Promise.resolve(manager.handle(LOCAL_ID, event, payload));
    },
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
      manager.destroyAll();
      listeners.clear();
    },
  };
}
