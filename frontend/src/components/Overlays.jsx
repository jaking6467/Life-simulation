import { useEffect } from 'react';
import { SCORE_CATEGORIES, formatMoney } from '../lib/game.js';

// การ์ดเหตุการณ์ (เหตุการณ์ทั้งเมือง / เรื่องให้ตัดสินใจ / หมดสติ) แสดงให้ทุกคนเห็นพร้อมกัน
export function EventCard({ card, onClose }) {
  if (!card) return null;
  const kind = card.type === 'globalEvent' ? 'ข่าวทั้งเมือง' : card.kind === 'choice' || card.kind === 'prank' ? `เรื่องของ ${card.who}` : card.who || '';
  return (
    <div className="card-overlay" onClick={onClose} role="presentation">
      <div className={`life-card${card.type === 'globalEvent' ? ' is-global' : ''}`} role="dialog" aria-label={card.name}>
        <div className="life-card-top">{kind}</div>
        <div className="life-card-icon">{card.icon}</div>
        <h3>{card.name}</h3>
        <p>{card.text}</p>
      </div>
    </div>
  );
}

// สรุปสุดสัปดาห์ของเรา: คะแนนที่ได้ในแต่ละหมวด และเรื่องที่เกิดขึ้น
export function WeekendCard({ data, onClose }) {
  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [data, onClose]);
  if (!data) return null;
  const d = data.delta || {};
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal weekend" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="สรุปสุดสัปดาห์">
        <h2>🌙 จบสัปดาห์ที่ {data.week}</h2>
        <p className="weekend-who">{data.who} ได้ <b>+{data.points}</b> คะแนน</p>
        <div className="weekend-cats">
          {SCORE_CATEGORIES.map((c) => (
            <div key={c.id} className="wc">
              <span>{c.icon}</span>
              <b>{data.breakdown[c.id]}</b>
              <small>
                {c.name} (เต็ม {c.max})
              </small>
            </div>
          ))}
        </div>
        {data.event && (
          <div className="weekend-event">
            {data.event.icon} <b>{data.event.name}</b> — {data.event.text}
          </div>
        )}
        <ul className="weekend-notes">
          {data.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <p className="weekend-delta">
          ❤️ {sign(d.health)} · 😊 {sign(d.happiness)} · 🧼 {sign(d.hygiene)} · 💰 {d.money >= 0 ? '+' : ''}
          {formatMoney(d.money)}
        </p>
        <div className="btn-row center">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}

const sign = (n) => `${n > 0 ? '+' : ''}${n || 0}`;

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast tone-${t.tone || 'info'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
