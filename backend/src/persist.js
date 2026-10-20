// persist.js — บันทึกห้องเกมออนไลน์ลงไฟล์ เซิร์ฟเวอร์รีสตาร์ตแล้วผู้เล่นกลับมาเล่นต่อได้
// - เขียนแบบ atomic: เขียนไฟล์ชั่วคราวให้เสร็จก่อนแล้วค่อย rename ทับ ไฟล์จริงไม่มีวันเขียนค้างครึ่ง ๆ
// - เขียนเฉพาะเมื่อมีอะไรเปลี่ยน (markDirty) และไม่บ่อยกว่าทุก intervalMs
// - ไฟล์อ่านไม่ได้: เก็บไว้เป็น .bad (ไม่ลบทิ้ง) แล้วเริ่มใหม่

import fs from 'node:fs';
import path from 'node:path';

export function writeFileAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

// อ่านไฟล์เซฟ: คืน { data } ถ้าอ่านได้, { data: null } ถ้ายังไม่มีไฟล์, หรือ { data: null, error } ถ้าไฟล์เสีย
export function readJsonFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { data: null };
    return { data: null, error: err };
  }
  try {
    return { data: JSON.parse(text) };
  } catch (err) {
    return { data: null, error: err };
  }
}

// เก็บไฟล์ที่ใช้ไม่ได้ไว้ดูภายหลัง (file.bad) แทนการลบทิ้ง
export function keepBadFile(file, { copy = false } = {}) {
  const bad = `${file}.bad`;
  try {
    if (copy) fs.copyFileSync(file, bad);
    else fs.renameSync(file, bad);
    return bad;
  } catch {
    return null;
  }
}

export function createPersistence({ file, snapshot, intervalMs = 10000, log = console }) {
  let dirty = false;
  let timer = null;

  const persistence = {
    file,
    get dirty() {
      return dirty;
    },
    markDirty() {
      dirty = true;
    },
    // อ่านไฟล์ตอนเริ่มเซิร์ฟเวอร์ — ไม่โยน error
    load() {
      const { data, error } = readJsonFile(file);
      if (error) {
        const bad = keepBadFile(file);
        log.error(`💾 อ่านไฟล์เซฟ ${file} ไม่ได้ (${error.message}) — เริ่มใหม่${bad ? ` เก็บไฟล์เดิมไว้ที่ ${bad}` : ''}`);
        return null;
      }
      return data;
    },
    // เขียนลงไฟล์ถ้ามีอะไรเปลี่ยน (force = เขียนเลยแม้ไม่มีอะไรเปลี่ยน) คืน true ถ้าเขียนแล้ว
    flush(force = false) {
      if (!dirty && !force) return false;
      dirty = false;
      try {
        writeFileAtomic(file, JSON.stringify(snapshot()));
        return true;
      } catch (err) {
        dirty = true; // ลองใหม่รอบหน้า
        log.error(`💾 บันทึกห้องลง ${file} ไม่สำเร็จ:`, err.message);
        return false;
      }
    },
    start() {
      if (timer) return;
      timer = setInterval(() => persistence.flush(), intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
  return persistence;
}
