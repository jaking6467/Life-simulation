import { useEffect, useState } from 'react';
import { SLOT_COUNT, downloadSave, formatSavedAt, weekText, writeSlot } from '../lib/saves.js';
import { SaveSummary, useSaves } from './SaveSummary.jsx';

// หน้าต่าง 💾 ในเกม: ออฟไลน์บันทึกลงช่องได้ 3 ช่อง ทั้งออฟไลน์/ออนไลน์ดาวน์โหลดไฟล์เซฟได้
export function SaveMenu({ room, send, onClose }) {
  const { auto, slots } = useSaves();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ขอข้อมูลเซฟของเกมปัจจุบัน (ออนไลน์ขอจากเซิร์ฟเวอร์) — ถ้าไม่สำเร็จ App แสดงข้อความแจ้งเตือนให้แล้ว
  const fetchSave = async () => {
    setBusy(true);
    try {
      const res = await send('room:export');
      return res?.ok ? res.save : null;
    } finally {
      setBusy(false);
    }
  };

  const saveToSlot = async (i) => {
    const old = slots[i];
    if (old && !window.confirm(`บันทึกทับช่อง ${i + 1}?\nเซฟเดิม: ${weekText(old.summary)} · บันทึกเมื่อ ${formatSavedAt(old.summary.savedAt)}`)) return;
    const save = await fetchSave();
    if (!save) return;
    setMessage(
      writeSlot(i, save)
        ? { tone: 'good', text: `บันทึกลงช่อง ${i + 1} แล้ว` }
        : { tone: 'bad', text: '❌ บันทึกไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม — ดาวน์โหลดไฟล์เซฟเก็บไว้แทนได้' },
    );
  };

  const download = async () => {
    const save = await fetchSave();
    if (!save) return;
    try {
      downloadSave(save);
      setMessage({ tone: 'good', text: 'ดาวน์โหลดไฟล์เซฟแล้ว' });
    } catch {
      setMessage({ tone: 'bad', text: '❌ ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง' });
    }
  };

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal save-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="บันทึกเกม">
        <h3>บันทึกเกม</h3>

        {room.offline ? (
          <>
            <p className="save-auto-note">
              เกมบันทึกอัตโนมัติทุกครั้งที่มีคนเล่น{auto && auto.summary.code === room.code ? ` (ล่าสุด ${formatSavedAt(auto.summary.savedAt)})` : ''} — กดออกแล้วกลับมาเล่นต่อได้จากหน้าแรก
            </p>
            <p className="muted small">อยากเก็บไว้หลายจุด (เช่น ก่อนตัดสินใจเรื่องใหญ่) บันทึกลงช่องด้านล่างได้</p>
            <ul className="save-slots">
              {Array.from({ length: SLOT_COUNT }, (_, i) => {
                const entry = slots[i];
                return (
                  <li key={i} className={`save-slot${entry ? '' : ' is-empty'}`}>
                    <div className="save-slot-body">
                      <b className="save-slot-name">ช่อง {i + 1}</b>
                      {entry ? <SaveSummary summary={entry.summary} /> : <span className="muted small">ว่าง</span>}
                    </div>
                    <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => saveToSlot(i)}>
                      บันทึกลงช่องนี้
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="save-auto-note">เกมออนไลน์บันทึกบนเซิร์ฟเวอร์ให้อัตโนมัติ</p>
            <ul className="save-notes">
              <li>
                เน็ตหลุด เผลอปิดหน้าเว็บ หรือเซิร์ฟเวอร์รีสตาร์ต? เปิดเว็บนี้อีกครั้งบน<b>เครื่องและเบราว์เซอร์เดิม</b> ก็กลับเข้าห้อง <b>{room.code}</b> ได้ทันที
                (ระหว่างนั้นระบบจะเล่นแทนให้ก่อน)
              </li>
              <li>ถ้าทุกคนออกจากห้องนานเกิน 10 นาที ห้องจะถูกปิด — ดาวน์โหลดไฟล์เซฟเก็บไว้ แล้วเปิดเล่นต่อแบบออฟไลน์ได้</li>
            </ul>
          </>
        )}

        <div className="save-download">
          <button type="button" className="btn" disabled={busy} onClick={download}>
            ดาวน์โหลดไฟล์เซฟ
          </button>
          <span className="muted small">
            {room.offline
              ? 'ย้ายไปเล่นต่อเครื่องอื่นได้: หน้าแรก → เล่นต่อ → เปิดไฟล์เซฟ'
              : 'ไฟล์นี้เปิดเล่นต่อแบบออฟไลน์ได้ (ทุกคนผลัดกันเล่นบนเครื่องเดียว): หน้าแรก → 📂 เปิดไฟล์เซฟ'}
          </span>
        </div>

        {message && (
          <p className={`save-message is-${message.tone}`} role="status">
            {message.text}
          </p>
        )}

        <div className="btn-row center">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
