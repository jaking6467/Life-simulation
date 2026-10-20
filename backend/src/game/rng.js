// ตัวสุ่มแบบกำหนด seed ได้ (mulberry32)
// เก็บสถานะไว้ใน state.rng ทำให้เล่นซ้ำ/ทดสอบได้แน่นอน

export function nextRandom(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state, min, max) {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function shuffle(state, list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// แฮช FNV-1a ใช้สร้างค่าสุ่มคงที่ให้บอท โดยไม่ไปแตะ rng ของเกม
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
