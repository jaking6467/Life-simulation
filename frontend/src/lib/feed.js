// คิวอัปเดตเกมจากเซิร์ฟเวอร์ หน้าจอจะเล่นแอนิเมชันทีละอัปเดตตามลำดับ ไม่ตกหล่น
export class GameFeed {
  constructor() {
    this.queue = [];
    this.latest = null;
    this.listeners = new Set();
    this.generation = 0;
  }

  push(update) {
    const item = { ...update, receivedAt: Date.now() };
    if (item.full) this.queue = [];
    this.latest = item;
    this.queue.push(item);
    this.listeners.forEach((cb) => cb());
  }

  reset() {
    this.queue = [];
    this.latest = null;
    this.generation++;
    this.listeners.forEach((cb) => cb());
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
