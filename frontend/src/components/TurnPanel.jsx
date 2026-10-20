import { useEffect, useMemo, useRef, useState } from 'react';
import { CHOICE_EVENT_BY_ID, LOCATION_BY_ID, formatMoney, turnsUntil } from '../lib/game.js';
import { matchAction } from '../lib/coach.js';

// แผงเทิร์น: ใครกำลังเล่น เวลาที่เหลือ และกิจกรรมของอาคารที่ยืนอยู่
// highlightAction (ไม่บังคับ): { action, params } ปุ่มที่ผู้ช่วยมือใหม่แนะนำ ('endTurn' = ปุ่มจบสัปดาห์)
export function TurnPanel({ view, room, myIds, act, busy, deadline, turnSeconds, ticker, onComeBack, highlightAction = null }) {
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const finished = view.status === 'finished';
  const mineTurn = !!current && myIds.includes(current.id);
  const seat = room.seats.find((s) => s.id === current?.id);
  const away = mineTurn && seat?.away;
  const canAct = mineTurn && !busy && !away && !finished;
  const multiLocal = myIds.length > 1;
  const title = finished ? 'จบเกมแล้ว' : mineTurn ? (multiLocal ? `ตาของ ${current.name}` : 'ตาของคุณ') : `ตาของ ${current?.name || ''}`;

  return (
    <section className={`turn-panel${mineTurn && !finished ? ' is-mine' : ''}`} style={{ '--pc': current?.color || 'var(--muted)' }}>
      <header className="turn-head">
        <div className="turn-title">
          {!finished && <span className="turn-dot" aria-hidden="true" />}
          {title}
        </div>
        {!finished && current && (
          <div className={`turn-hours${current.hoursLeft <= 8 ? ' is-low' : ''}`} title="เวลาที่เหลือในสัปดาห์นี้">
            <b>{current.hoursLeft}</b>/{current.hoursMax} ชม.
          </div>
        )}
      </header>
      {!finished && current && <HoursBar left={current.hoursLeft} max={current.hoursMax} />}
      {!finished && deadline && <Countdown deadline={deadline} total={turnSeconds} />}

      {canAct && view.phase.type === 'choice' && <ChoicePanel view={view} act={act} />}
      {canAct && view.phase.type === 'week' && <LocationPanel view={view} me={current} act={act} multiLocal={multiLocal} highlightAction={highlightAction} />}
      {mineTurn && busy && !finished && <p className="turn-note">กำลังแสดงผล…</p>}
      {away && !finished && (
        <div className="away-box">
          <span>ระบบกำลังเล่นแทน เพราะไม่ได้กดในเวลาที่กำหนด</span>
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
      <div className="decision-head">
        <span className="decision-icon" aria-hidden="true">
          {ev.icon}
        </span>
        <div>
          <h3>{ev.name}</h3>
          <p>{ev.text}</p>
        </div>
      </div>
      <div className="opts">
        {view.phase.options.map((o, i) => (
          <button key={o.id} type="button" className={`opt${i === view.phase.options.length - 1 ? ' opt-ghost' : ''}`} onClick={() => act({ type: 'choose', value: o.id })}>
            <span className="opt-title">{o.label}</span>
            <span className="opt-desc">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationPanel({ view, me, act, multiLocal, highlightAction }) {
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
    if (me.hoursLeft > 8 && !window.confirm(`ยังเหลือเวลา ${me.hoursLeft} ชม. จบสัปดาห์เลยไหม?`)) return;
    act({ type: 'endTurn' });
  };

  return (
    <div className="loc-panel" ref={ref}>
      <div className="place">
        <span className="place-icon" aria-hidden="true">
          {loc.icon}
        </span>
        <div className="place-text">
          <b>{loc.name}</b>
          <small>{loc.desc}</small>
        </div>
      </div>
      {multiLocal && <p className="turn-note">ส่งเครื่องให้ {me.name} เล่นได้เลย</p>}
      {!me.ate && <p className="notice-line tone-warn">ยังไม่ได้กินอะไรสัปดาห์นี้ — ไก่ทอด ภัตตาคาร หรือทำกินที่บ้าน</p>}
      {me.love && me.love.affection < 30 && !me.weekActs?.date && (
        <p className="notice-line tone-bad">
          ความรักกับ{me.love.name}เหลือ {me.love.affection} — ไปเดตหรือใช้เวลาด้วยกัน ไม่งั้นอาจเลิกกัน
        </p>
      )}

      {groups.length === 0 && <p className="turn-note">ที่นี่ไม่มีอะไรให้ทำ แตะอาคารบนแผนที่เพื่อเดินไปที่อื่น</p>}
      {groups.map(([group, list]) => (
        <div key={group} className="act-group">
          <h4>{group}</h4>
          <div className="acts">
            {list.map((a) => (
              <button
                key={`${a.action}:${JSON.stringify(a.params)}`}
                type="button"
                className={`act-btn${matchAction(a, highlightAction) ? ' is-coach' : ''}`}
                disabled={a.disabled}
                onClick={() => act({ type: 'act', action: a.action, params: a.params })}
                title={a.reason || a.desc}
              >
                <span className="act-icon" aria-hidden="true">
                  {a.icon}
                </span>
                <span className="act-body">
                  <span className="act-label">{a.label}</span>
                  <span className="act-desc">{a.disabled ? a.reason : a.desc}</span>
                </span>
                <span className="act-cost">
                  {a.hours > 0 && <span className="act-hours">{a.hours} ชม.</span>}
                  {a.cost > 0 && <span className="act-money">{formatMoney(a.cost)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button type="button" className="link-btn more-link" onClick={() => setShowDisabled((s) => !s)}>
          {showDisabled ? 'ซ่อนตัวเลือกที่ยังทำไม่ได้' : `ดูตัวเลือกที่ยังทำไม่ได้ (${hiddenCount})`}
        </button>
      )}

      <div className="turn-dock">
        <button type="button" className={`btn btn-end${highlightAction?.action === 'endTurn' ? ' is-coach' : ''}`} onClick={endWeek}>
          จบสัปดาห์
          <small>เหลือ {me.hoursLeft} ชม.</small>
        </button>
      </div>
    </div>
  );
}

function Waiting({ view, myIds, current, ticker }) {
  const left = turnsUntil(view, myIds);
  const recent = ticker.filter((t) => t.playerId === current?.id).slice(-3);
  return (
    <div className="waiting">
      <p>
        <b style={{ color: current?.color }}>{current?.name}</b> กำลังเล่นสัปดาห์นี้
        {left ? <span className="muted"> · {left === 1 ? 'คุณเล่นต่อจากนี้' : `อีก ${left} ตาถึงคุณ`}</span> : null}
      </p>
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
    <div className={`meter${left <= 8 ? ' is-low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={left} aria-label="เวลาที่เหลือในสัปดาห์">
      <span style={{ width: `${pct}%` }} />
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
      <span className="countdown-text">เวลาเล่นเหลือ {shown} วิ</span>
      <span className="countdown-track">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
