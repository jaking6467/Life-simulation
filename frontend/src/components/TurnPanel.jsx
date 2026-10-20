import { useEffect, useState } from 'react';
import { Spinner } from './Spinner.jsx';
import { DecisionPanel } from './DecisionPanel.jsx';
import { FinancePanel } from './FinancePanel.jsx';
import { formatMoney, phaseText, turnsUntil } from '../lib/game.js';

export function TurnPanel({ view, room, myIds, act, busy, spin, speed, deadline, turnSeconds, onComeBack }) {
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const finished = view.status === 'finished';
  const mineTurn = !!current && myIds.includes(current.id);
  const seat = room.seats.find((s) => s.id === current?.id);
  const away = mineTurn && seat?.away;
  const canAct = mineTurn && !busy && !away && !finished;
  const canSpin = canAct && view.phase.type === 'spin';
  const multiLocal = myIds.length > 1;

  // กด Space หรือ Enter เพื่อหมุนวงล้อได้ (ถ้าไม่ได้พิมพ์อยู่ในช่องข้อความ)
  useEffect(() => {
    if (!canSpin) return undefined;
    const onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      e.preventDefault();
      act({ type: 'spin' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSpin, act]);

  // ตอนเพิ่งเปิดหน้า (ยังไม่มีแอนิเมชัน) ให้วงล้อแสดงผลการหมุนล่าสุด
  const shownSpin =
    spin ||
    (view.lastSpin
      ? { key: 0, ...view.lastSpin, purpose: 'move', name: view.players.find((p) => p.id === view.lastSpin.playerId)?.name }
      : null);

  return (
    <section className={`turn-panel${mineTurn && !finished ? ' is-mine' : ''}`} style={{ '--pc': current?.color || '#999' }}>
      <header className="turn-head">
        <div className="turn-title">
          {finished ? (
            '🏁 จบเกมแล้ว'
          ) : mineTurn ? (
            <>🎯 ตาของ{multiLocal ? ` ${current.name}` : 'คุณ'}!</>
          ) : (
            <>
              ⏳ ตาของ <b>{current?.name}</b>
            </>
          )}
        </div>
        {!finished && <div className="turn-sub">{phaseText(view.phase)}</div>}
        {!finished && deadline && <Countdown deadline={deadline} total={turnSeconds} />}
      </header>

      <Spinner spin={shownSpin} canSpin={canSpin} onSpin={() => act({ type: 'spin' })} speed={speed} color={current?.color} />

      {canSpin && (
        <>
          <p className="spin-hint">
            กดปุ่ม <b>หมุน!</b> กลางวงล้อ (หรือกด Space) เพื่อเดิน {multiLocal && <>— ส่งเครื่องให้ <b>{current.name}</b></>}
          </p>
          <FinancePanel view={view} me={current} act={act} />
        </>
      )}
      {canAct && view.phase.type !== 'spin' && <DecisionPanel view={view} me={current} act={act} />}
      {mineTurn && busy && !finished && <p className="spin-hint muted">กำลังแสดงผล…</p>}
      {away && !finished && (
        <div className="away-box">
          <span>🤖 ระบบกำลังเล่นแทนคุณ เพราะไม่ได้กดในเวลาที่กำหนด</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onComeBack}>
            กลับมาเล่นเอง
          </button>
        </div>
      )}
      {!mineTurn && !finished && <Waiting view={view} myIds={myIds} current={current} />}
    </section>
  );
}

function Waiting({ view, myIds, current }) {
  const left = turnsUntil(view, myIds);
  const me = view.players.find((p) => myIds.includes(p.id));
  return (
    <div className="waiting">
      <p>
        รอ <b style={{ color: current?.color }}>{current?.name}</b> เล่นให้จบตาก่อน
      </p>
      {me?.retired ? (
        <p className="muted">คุณเกษียณแล้ว 🌅 รอผู้เล่นคนอื่นเกษียณให้ครบ (ใบหุ้นยังจ่ายปันผลให้คุณอยู่)</p>
      ) : left ? (
        <p className="muted">{left === 1 ? 'คุณเป็นคนถัดไป เตรียมตัว!' : `อีก ${left} ตาจะถึงคุณ`}</p>
      ) : null}
      {me && <p className="muted">เงินสดของคุณ {formatMoney(me.cash)}</p>}
    </div>
  );
}

function Countdown({ deadline, total }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const shown = total ? Math.min(left, total) : left;
  const pct = total ? Math.min(100, (shown / total) * 100) : 100;
  return (
    <div className={`countdown${shown <= 10 ? ' is-low' : ''}`} role="timer" aria-label={`เหลือเวลา ${shown} วินาที`}>
      <div className="countdown-bar" style={{ width: `${pct}%` }} />
      <span>⏱ {shown} วิ</span>
    </div>
  );
}
