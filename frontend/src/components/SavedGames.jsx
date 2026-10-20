import { useRef } from 'react';
import { clearSlot, readSaveFile, weekText } from '../lib/saves.js';
import { SaveSummary, useSaves } from './SaveSummary.jsx';

// หน้าแรก: "💾 เล่นต่อ" — เกมล่าสุด (บันทึกอัตโนมัติ) ช่องบันทึก และเปิดไฟล์เซฟ
// ถ้ายังไม่มีเซฟในเครื่อง แสดงแค่ปุ่มเปิดไฟล์เซฟเล็ก ๆ
export function SavedGames({ onLoad, onError }) {
  const { auto, slots } = useSaves();
  const fileRef = useRef(null);
  const filled = slots.map((entry, i) => ({ entry, i })).filter((x) => x.entry);
  const hasSaves = !!auto || filled.length > 0;

  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onLoad(await readSaveFile(file));
    } catch (err) {
      onError?.(err.message || 'เปิดไฟล์เซฟไม่ได้');
    }
  };

  const remove = (i, entry) => {
    if (window.confirm(`ลบเซฟช่อง ${i + 1} (${weekText(entry.summary)})? ลบแล้วกู้คืนไม่ได้`)) clearSlot(i);
  };

  const fileInput = <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={openFile} data-testid="save-file-input" />;
  const openButton = (
    <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
      เปิดไฟล์เซฟ
    </button>
  );

  if (!hasSaves) {
    return (
      <p className="save-open-line muted small">
        มีไฟล์เซฟเก็บไว้? {openButton}
        {fileInput}
      </p>
    );
  }

  return (
    <section className="home-section saved-games">
      <h2>เล่นต่อ</h2>
      {auto && (
        <div className="save-continue">
          <button type="button" className="btn btn-primary" onClick={() => onLoad(auto.save)}>
            {auto.summary.status === 'finished' ? 'ดูผลเกมล่าสุด' : '▶ เล่นต่อเกมล่าสุด'}
          </button>
          <SaveSummary summary={auto.summary} />
        </div>
      )}
      {filled.length > 0 && (
        <ul className="save-slots">
          {filled.map(({ entry, i }) => (
            <li key={i} className="save-slot">
              <div className="save-slot-body">
                <b className="save-slot-name">ช่อง {i + 1}</b>
                <SaveSummary summary={entry.summary} />
              </div>
              <div className="save-slot-actions">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onLoad(entry.save)}>
                  โหลด
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(i, entry)} aria-label={`ลบเซฟช่อง ${i + 1}`}>
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {openButton}
      {fileInput}
    </section>
  );
}
