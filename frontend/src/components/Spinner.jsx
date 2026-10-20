import { useEffect, useRef, useState } from 'react';
import { TIMING, SPIN_PURPOSE } from '../lib/game.js';

const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#9775fa', '#f783ac', '#e599f7'];
const mod = (a, n) => ((a % n) + n) % n;

function wedgePath(i) {
  const r = 96;
  const a0 = ((i * 36 - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * 36 - 90) * Math.PI) / 180;
  return `M0,0 L${(r * Math.cos(a0)).toFixed(2)},${(r * Math.sin(a0)).toFixed(2)} A${r},${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)},${(r * Math.sin(a1)).toFixed(2)} Z`;
}

// วงล้อ 1–10: หมุนไปหยุดที่เลขที่เซิร์ฟเวอร์สุ่มได้
export function Spinner({ spin, canSpin, onSpin, speed = 1, color }) {
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(true);
  const lastKey = useRef(null);
  const duration = Math.round(((spin?.purpose === 'move' ? TIMING.spin : TIMING.subSpin) * 0.85) / speed);

  useEffect(() => {
    if (!spin || spin.key === lastKey.current) return undefined;
    lastKey.current = spin.key;
    const turns = spin.purpose === 'move' ? 5 : 3;
    const center = (spin.value - 1) * 36 + 18;
    const jitter = (spin.key * 7) % 17 - 8;
    setRotation((prev) => {
      const base = prev + 360 * turns;
      return base + mod(-center - base, 360) + jitter;
    });
    setSettled(false);
    const t = setTimeout(() => setSettled(true), duration);
    return () => clearTimeout(t);
  }, [spin, duration]);

  return (
    <div className={`spinner${canSpin ? ' can-spin' : ''}`} style={{ '--accent': color || '#ff7a59' }}>
      <div className="spinner-pointer" aria-hidden="true" />
      <div className="spinner-wheel" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}>
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle r="99" fill="#fff" />
          {COLORS.map((c, i) => (
            <path key={i} d={wedgePath(i)} fill={c} stroke="#fff" strokeWidth="2" />
          ))}
          {COLORS.map((_, i) => {
            const mid = ((i * 36 + 18 - 90) * Math.PI) / 180;
            const x = 70 * Math.cos(mid);
            const y = 70 * Math.sin(mid);
            return (
              <text key={i} x={x} y={y} transform={`rotate(${i * 36 + 18} ${x} ${y})`} className="spinner-num" textAnchor="middle" dominantBaseline="central">
                {i + 1}
              </text>
            );
          })}
        </svg>
      </div>
      <button type="button" className="spinner-hub" disabled={!canSpin} onClick={onSpin} aria-label={canSpin ? 'หมุนวงล้อ' : 'ผลการหมุน'}>
        {canSpin ? 'หมุน!' : settled && spin ? spin.value : '…'}
      </button>
      <div className="spinner-caption" aria-live="polite">
        {spin ? (
          settled ? (
            <>
              <b>{spin.name}</b> {SPIN_PURPOSE[spin.purpose] || 'หมุน'}ได้ <b className="big">{spin.value}</b>
            </>
          ) : (
            <>
              <b>{spin.name}</b> กำลัง{SPIN_PURPOSE[spin.purpose] || 'หมุน'}…
            </>
          )
        ) : (
          'วงล้อแห่งโชคชะตา'
        )}
      </div>
    </div>
  );
}
