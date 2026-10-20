import { useEffect } from 'react';
import { SCORE_CATEGORIES, formatMoney } from '../lib/game.js';

// การ์ดเหตุการณ์ (ข่าวทั้งเมือง / เรื่องให้ตัดสินใจ / หมดสติ / โดนแกล้ง) แสดงให้ทุกคนเห็นพร้อมกัน
export function EventCard({ card, onClose }) {
  if (!card) return null;
  const kind = card.type === 'globalEvent' ? 'ข่าวทั้งเมือง' : card.who || '';
  return (
    <div className="card-overlay" onClick={onClose} role="presentation">
      <div className={`life-card${card.type === 'globalEvent' ? ' is-global' : ''}`} role="dialog" aria-label={card.name}>
        {kind && <div className="life-card-top">{kind}</div>}
        <div className="life-card-icon" aria-hidden="true">
          {card.icon}
        </div>
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
    <div className="modal-back sheet-back" onClick={onClose} role="presentation">
      <div className="modal weekend" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="สรุปสุดสัปดาห์">
        <p className="weekend-kicker">จบสัปดาห์ที่ {data.week}</p>
        <h2 className="weekend-who">
          {data.who} <b>+{data.points}</b> <span>คะแนน</span>
        </h2>
        <div className="weekend-cats">
          {SCORE_CATEGORIES.map((c) => (
            <div key={c.id} className="wc" title={`${c.name} (เต็ม ${c.max})`}>
              <span className="wc-icon" aria-hidden="true">
                {c.icon}
              </span>
              <b>{data.breakdown[c.id]}</b>
              <small>{c.name}</small>
            </div>
          ))}
        </div>
        <p className="weekend-delta">
          <span>สุขภาพ {sign(d.health)}</span>
          <span>ความสุข {sign(d.happiness)}</span>
          <span>ความสะอาด {sign(d.hygiene)}</span>
          <span className={d.money < 0 ? 'is-bad' : 'is-good'}>
            เงิน {d.money >= 0 ? '+' : ''}
            {formatMoney(d.money)}
          </span>
        </p>
        {data.event && (
          <div className="weekend-event">
            <span aria-hidden="true">{data.event.icon}</span>
            <span>
              <b>{data.event.name}</b> {data.event.text}
            </span>
          </div>
        )}
        {data.notes.length > 0 && (
          <ul className="weekend-notes">
            {data.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          ตกลง
        </button>
      </div>
    </div>
  );
}

const sign = (n) => `${n > 0 ? '+' : ''}${n || 0}`;

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.slice(-2).map((t) => (
        <div key={t.id} className={`toast tone-${t.tone || 'info'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
