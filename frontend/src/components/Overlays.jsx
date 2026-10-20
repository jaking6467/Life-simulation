import { CARDS } from '../lib/game.js';

// การ์ดชีวิตที่เพิ่งจั่ว แสดงให้ทุกคนเห็นพร้อมกัน
export function CardOverlay({ card, onClose }) {
  if (!card) return null;
  const data = CARDS[card.cardId];
  if (!data) return null;
  return (
    <div className="card-overlay" onClick={onClose} role="presentation">
      <div className="life-card" role="dialog" aria-label={data.title}>
        <div className="life-card-top">🃏 การ์ดชีวิต · {card.name}</div>
        <div className="life-card-icon">{data.icon}</div>
        <h3>{data.title}</h3>
        <p>{data.text}</p>
      </div>
    </div>
  );
}

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
