// การเชื่อมต่อออนไลน์ผ่าน socket.io
import { io } from 'socket.io-client';

// ถ้าไม่ตั้งค่า จะเชื่อมต่อกับเซิร์ฟเวอร์เดียวกับหน้าเว็บ (เช่นตอน backend เสิร์ฟหน้าเว็บเอง)
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.REACT_APP_SOCKET_URL || undefined;

export function createOnlineConnection(clientId) {
  const socket = io(SERVER_URL, {
    auth: { clientId },
    reconnectionDelayMax: 5000,
    timeout: 8000,
  });
  const statusListeners = new Set();
  let status = 'connecting';
  const setStatus = (s) => {
    status = s;
    statusListeners.forEach((cb) => cb(s));
  };
  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', () => setStatus('disconnected'));
  socket.on('connect_error', () => setStatus('error'));
  socket.io.on('reconnect_attempt', () => {
    if (status !== 'error') setStatus('connecting');
  });

  return {
    kind: 'online',
    request(event, payload = {}) {
      return new Promise((resolve) => {
        if (!socket.connected) {
          resolve({ ok: false, error: 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองเล่นแบบออฟไลน์ก่อนได้' });
          return;
        }
        socket.timeout(10000).emit(event, payload, (err, res) => {
          resolve(err ? { ok: false, error: 'เซิร์ฟเวอร์ไม่ตอบสนอง' } : res || { ok: false, error: 'ไม่มีการตอบกลับ' });
        });
      });
    },
    on(event, cb) {
      socket.on(event, cb);
      return () => socket.off(event, cb);
    },
    onStatus(cb) {
      statusListeners.add(cb);
      cb(status);
      return () => statusListeners.delete(cb);
    },
    start() {},
    close() {
      socket.disconnect();
    },
  };
}
