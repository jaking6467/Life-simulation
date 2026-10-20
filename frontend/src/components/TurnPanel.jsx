import { useEffect, useMemo, useRef, useState } from 'react';
import { CHOICE_EVENT_BY_ID, LOCATION_BY_ID, formatMoney, locationName, phaseText, turnsUntil } from '../lib/game.js';

export function TurnPanel({ view, room, myIds, act, busy, deadline, turnSeconds, ticker, onComeBack }) {
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const finished = view.status === 'finished';
  const mineTurn = !!current && myIds.includes(current.id);
  const seat = room.seats.find((s) => s.id === current?.id);
  const away = mineTurn && seat?.away;
  const canAct = mineTurn && !busy && !away && !finished;
  const multiLocal = myIds.length > 1;

  return (
    <section className={`turn-panel${mineTurn && !finished ? ' is-mine' : ''}`} style={{ '--pc': current?.color || '#999' }}>
      <header className="turn-head">
        <div className="turn-title">
          {finished ? '🏁 จบเกมแล้ว' : mineTurn ? <>🎯 ตาของ{multiLocal ? ` ${current.name}` : 'คุณ'}!</> : <>⏳ ตาของ <b>{current?.name}</b></>}
        </div>
        {!finished && current && (
          <div className="turn-sub">
            สัปดาห์ที่ {view.week}/{view.maxWeeks} · 📍 {locationName(current.location)} · {phaseText(view.phase)}
          </div>
        )}
        {!finished && current && <HoursBar left={current.hoursLeft} max={current.hoursMax} />}
        {!finished && deadline && <Countdown deadline={deadline} total={turnSeconds} />}
      </header>

      {canAct && view.phase.type === 'choice' && <ChoicePanel view={view} act={act} />}
      {canAct && view.phase.type === 'week' && <LocationPanel view={view} me={current} act={act} multiLocal={multiLocal} />}
      {mineTurn && busy && !finished && <p className="hint muted">กำลังแสดงผล…</p>}
      {away && !finished && (
        <div className="away-box">
          <span>🤖 ระบบกำลังเล่นแทนคุณ เพราะไม่ได้กดในเวลาที่กำหนด</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onComeBack}>
            กลับมาเล่นเอง
          </button>
        </div>
      )}
      {!mineTurn && !finished && <Waiting view={view} myIds={myIds} current={current} ticker={ticker} />}
    </section>
  );
}

function ChoicePanel({ view, act }) {
  const ev = CHOICE_EVENT_BY_ID[view.phase.eventId];
  return (
    <div className="decision">
      <h3>
        {ev.icon} {ev.name}
      </h3>
      <p className="decision-hint">{ev.text}</p>
      <div className="opts">
        {view.phase.options.map((o, i) => (
          <button key={o.id} type="button" className={`opt${i === view.phase.options.length - 1 ? ' opt-ghost' : ''}`} onClick={() => act({ type: 'choose', value: o.id })}>
            <span className="opt-body">
              <span className="opt-title">{o.label}</span>
              <span className="opt-desc">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationPanel({ view, me, act, multiLocal }) {
  const loc = LOCATION_BY_ID[me.location];
  const [showDisabled, setShowDisabled] = useState(false);
  const ref = useRef(null);
  // มาถึงที่ใหม่: เลื่อนให้เห็นกิจกรรมของที่นั่น (สำคัญบนมือถือที่แผนที่อยู่ด้านบน)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [me.location]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const a of view.actions) {
      if (a.disabled && !showDisabled && !(a.action === 'work' || a.action === 'attend')) continue;
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group).push(a);
    }
    return [...map.entries()];
  }, [view.actions, showDisabled]);
  const hiddenCount = view.actions.filter((a) => a.disabled && a.action !== 'work' && a.action !== 'attend').length;

  const endWeek = () => {
    if (me.hoursLeft > 8 && !window.confirm(`ยังเหลือเวลาอีก ${me.hoursLeft} ชม. จะจบสัปดาห์เลยไหม?`)) return;
    act({ type: 'endTurn' });
  };

  return (
    <div className="loc-panel" ref={ref}>
      <div className="loc-head">
        <span className="loc-icon">{loc.icon}</span>
        <div>
          <b>{loc.name}</b>
          <p>{loc.desc}</p>
        </div>
      </div>
      {multiLocal && <p className="hint">ส่งเครื่องให้ <b>{me.name}</b> เล่นได้เลย</p>}
      {!me.ate && <p className="warn-line">🍽️ สัปดาห์นี้ยังไม่ได้กินอะไร! (ไก่ทอด ภัตตาคาร หรือทำกินเองที่บ้าน)</p>}

      {groups.length === 0 && <p className="muted hint">ที่นี่ไม่มีอะไรให้ทำ แตะอาคารบนแผนที่เพื่อเดินไปที่อื่น</p>}
      {groups.map(([group, list]) => (
        <div key={group} className="act-group">
          <h4>{group}</h4>
          <div className="acts">
            {list.map((a) => (
              <button
                key={`${a.action}:${JSON.stringify(a.params)}`}
                type="button"
                className="act-btn"
                disabled={a.disabled}
                onClick={() => act({ type: 'act', action: a.action, params: a.params })}
                title={a.reason || a.desc}
              >
                <span className="act-icon">{a.icon}</span>
                <span className="act-body">
                  <span className="act-label">{a.label}</span>
                  <span className="act-desc">{a.disabled ? `⚠️ ${a.reason}` : a.desc}</span>
                </span>
                <span className="act-cost">
                  {a.hours > 0 && <span className="chip">⏱ {a.hours} ชม.</span>}
                  {a.cost > 0 && <span className="chip chip-money">{formatMoney(a.cost)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button type="button" className="link-btn" onClick={() => setShowDisabled((s) => !s)}>
          {showDisabled ? 'ซ่อนตัวเลือกที่ยังทำไม่ได้' : `ดูตัวเลือกที่ยังทำไม่ได้ (${hiddenCount})`}
        </button>
      )}

      <button type="button" className="btn btn-end" onClick={endWeek}>
        🌙 จบสัปดาห์ (ส่งตาให้คนถัดไป)
      </button>
    </div>
  );
}

function Waiting({ view, myIds, current, ticker }) {
  const left = turnsUntil(view, myIds);
  const recent = ticker.filter((t) => t.playerId === current?.id).slice(-3);
  return (
    <div className="waiting">
      <p>
        รอ <b style={{ color: current?.color }}>{current?.name}</b> ใช้ชีวิตให้จบสัปดาห์ก่อน
      </p>
      {left ? <p className="muted">{left === 1 ? 'คุณเป็นคนถัดไป เตรียมวางแผนได้เลย!' : `อีก ${left} ตาจะถึงคุณ`}</p> : null}
      {recent.length > 0 && (
        <ul className="ticker">
          {recent.map((t) => (
            <li key={t.id}>{t.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HoursBar({ left, max }) {
  const pct = max ? Math.max(0, Math.min(100, (left / max) * 100)) : 0;
  return (
    <div className={`hours-bar${left <= 8 ? ' is-low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={left} aria-label="เวลาที่เหลือในสัปดาห์">
      <div className="hours-fill" style={{ width: `${pct}%` }} />
      <span>⏳ เหลือเวลา {left}/{max} ชม.</span>
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
    <div className={`countdown${shown <= 15 ? ' is-low' : ''}`} role="timer" aria-label={`เหลือเวลาจริง ${shown} วินาที`}>
      <div className="countdown-bar" style={{ width: `${pct}%` }} />
      <span>⏱ เวลาเล่นจริงเหลือ {shown} วินาที</span>
    </div>
  );
}
