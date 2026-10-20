import { useEffect, useState } from 'react';
import { ROLES } from '../lib/game.js';
import { formatSavedAt, readAutosave, readSlots, subscribeSaves, weekText } from '../lib/saves.js';
import '../styles/save.css';

// รายการเซฟในเครื่องนี้ (อัปเดตเองเมื่อบันทึก/ลบ)
export function useSaves() {
  const read = () => ({ auto: readAutosave(), slots: readSlots() });
  const [saves, setSaves] = useState(read);
  useEffect(() => subscribeSaves(() => setSaves(read())), []);
  return saves;
}

// ข้อมูลย่อของเซฟ: สัปดาห์ ผู้เล่น (ไอคอนบทบาท) และเวลาที่บันทึก
export function SaveSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="save-summary">
      <div className="save-summary-top">
        <span className="chip">{weekText(summary)}</span>
        <span className="muted small">{formatSavedAt(summary.savedAt)}</span>
      </div>
      <div className="save-players">
        {(summary.players || []).map((p) => (
          <span key={p.id} className="save-player" style={{ '--pc': p.color }} title={`${p.name} · ${p.score} คะแนน`}>
            {p.isBot ? '🤖' : ROLES[p.role]?.icon || '🙂'} {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
