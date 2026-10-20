import { useMemo } from 'react';
import { LOCATIONS, JOBS, GLOBAL_EVENT_BY_ID, gridPosition, initials, locationName } from '../lib/game.js';

// แผนที่เมือง: อาคาร 18 หลังรอบถนนวงแหวน ตรงกลางเป็นข้อมูลสัปดาห์และผู้เล่นปัจจุบัน
// แตะอาคาร 1 ครั้งเพื่อดูข้อมูล แตะซ้ำ (หรือกดปุ่มเดินไป) เพื่อเดินทาง
export function CityMap({ view, tokens, myIds, canMove, selected, onSelect, onMove }) {
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const mineTurn = !!current && myIds.includes(current.id);
  const me = view.players.find((p) => myIds.includes(p.id)) || null;
  const viewer = mineTurn ? current : me;

  const positions = useMemo(() => {
    const map = {};
    for (const p of view.players) {
      const pos = tokens[p.id] || p.location;
      (map[pos] ||= []).push(p);
    }
    return map;
  }, [view.players, tokens]);

  const event = view.global.eventId ? GLOBAL_EVENT_BY_ID[view.global.eventId] : null;
  const sel = selected ? LOCATIONS.find((l) => l.id === selected) : null;
  const selTravel = sel ? view.travel[sel.id] : null;

  return (
    <div className="city">
      {LOCATIONS.map((loc, i) => {
        const { col, row } = gridPosition(i);
        const here = positions[loc.id] || [];
        const travel = canMove ? view.travel[loc.id] : null;
        const isHome = viewer && viewer.housing === loc.id;
        const isJob = viewer && JOBS[viewer.job]?.location === loc.id;
        const lucky = viewer?.role === 'mystic' && viewer.horoscope?.lucky === loc.id;
        const unlucky = viewer?.role === 'mystic' && viewer.horoscope?.unlucky === loc.id;
        const closed = view.global.closed === loc.id;
        const isCurrentSpot = current && (tokens[current.id] || current.location) === loc.id;
        return (
          <button
            key={loc.id}
            type="button"
            className={`bldg b-${loc.id}${selected === loc.id ? ' is-selected' : ''}${isCurrentSpot ? ' is-here' : ''}${closed ? ' is-closed' : ''}${travel && !travel.ok ? ' is-far' : ''}`}
            style={{ gridColumn: col, gridRow: row }}
            onClick={() => (selected === loc.id && canMove && travel?.ok ? onMove(loc.id) : onSelect(loc.id))}
            title={`${loc.name} — ${loc.desc}`}
          >
            <span className="bldg-badges">
              {isHome && <span title="บ้านของคุณ">🏠</span>}
              {isJob && <span title="ที่ทำงานของคุณ">💼</span>}
              {lucky && <span title="ดวงบอกว่าที่นี่นำโชค">🍀</span>}
              {unlucky && <span title="ดวงบอกว่าที่นี่อัปมงคล">💀</span>}
              {closed && <span title="ปิดชั่วคราว">🚧</span>}
            </span>
            <span className="bldg-icon">{loc.icon}</span>
            <span className="bldg-name">{loc.name}</span>
            {travel && <span className={`bldg-cost${travel.ok ? '' : ' is-bad'}`}>🚶 {travel.hours} ชม.</span>}
            {here.length > 0 && (
              <span className="bldg-tokens">
                {here.map((p) => (
                  <span key={p.id} className={`token${p.id === view.currentPlayerId ? ' is-active' : ''}${myIds.includes(p.id) ? ' is-mine' : ''}`} style={{ background: p.color }} title={p.name}>
                    {initials(p.name)}
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}

      <div className="city-center">
        <div className="city-week">
          สัปดาห์ที่ <b>{view.week}</b> / {view.maxWeeks}
        </div>
        {event && (
          <div className="city-event" title={event.text}>
            {event.icon} <b>{event.name}</b>
            <small>
              {event.text}
              {view.global.closed ? ` (${locationName(view.global.closed)})` : ''}
            </small>
          </div>
        )}
        {sel ? (
          <div className="city-sel">
            <div className="city-sel-head">
              <span className="city-sel-icon">{sel.icon}</span>
              <div>
                <b>{sel.name}</b>
                <p>{sel.desc}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => onSelect(null)} aria-label="ปิด">
                ✕
              </button>
            </div>
            {canMove && selTravel && sel.id !== current?.location && (
              <button type="button" className="btn btn-primary" disabled={!selTravel.ok} onClick={() => onMove(sel.id)}>
                {selTravel.ok ? `🚶 เดินไปที่นี่ (${selTravel.hours} ชม.)` : view.global.closed === sel.id ? 'ปิดชั่วคราว' : `เวลาไม่พอ (ต้องใช้ ${selTravel.hours} ชม.)`}
              </button>
            )}
          </div>
        ) : (
          current && (
            <div className="city-now" style={{ '--pc': current.color }}>
              <span className="avatar" style={{ background: current.color }}>{initials(current.name)}</span>
              <div>
                <b>{mineTurn ? (myIds.length > 1 ? `ตาของ ${current.name}` : 'ตาของคุณ!') : `ตาของ ${current.name}`}</b>
                <small>📍 {locationName(tokens[current.id] || current.location)}</small>
              </div>
              <HoursRing left={current.hoursLeft} max={current.hoursMax} />
            </div>
          )
        )}
        {canMove && !sel && <p className="city-hint">แตะอาคารเพื่อดูข้อมูล แตะซ้ำเพื่อเดินไป</p>}
      </div>
    </div>
  );
}

export function HoursRing({ left, max }) {
  const pct = max ? Math.max(0, Math.min(1, left / max)) : 0;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className={`hours-ring${left <= 8 ? ' is-low' : ''}`} title={`เหลือเวลา ${left} จาก ${max} ชั่วโมง`}>
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} className="hr-bg" />
        <circle cx="28" cy="28" r={r} className="hr-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="hr-text">
        <b>{left}</b>
        <small>ชม.</small>
      </span>
    </span>
  );
}
