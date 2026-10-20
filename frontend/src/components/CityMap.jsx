import { useMemo } from 'react';
import { LOCATIONS, JOBS, BUSINESSES, GLOBAL_EVENT_BY_ID, gridPosition, initials, locationName } from '../lib/game.js';

// แผนที่เมือง: อาคาร 18 หลังรอบถนนวงแหวน ตรงกลางเป็นข้อมูลสัปดาห์และอาคารที่เลือก
// แตะอาคาร 1 ครั้งเพื่อดูข้อมูล แตะซ้ำ (หรือกดปุ่มเดินไป) เพื่อเดินทาง
// highlight (ไม่บังคับ): รหัสอาคารที่ผู้ช่วยมือใหม่แนะนำให้ไป (หรือ array) จะเรืองแสงบนแผนที่
export function CityMap({ view, tokens, myIds, canMove, selected, onSelect, onMove, highlight = null }) {
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
        const marks = [];
        if (viewer?.housing === loc.id) marks.push(['🏠', 'บ้านของคุณ']);
        if (viewer && JOBS[viewer.job]?.location === loc.id) marks.push(['💼', 'ที่ทำงานของคุณ']);
        if (viewer?.businesses?.some((b) => BUSINESSES[b.id].location === loc.id)) marks.push(['🏪', 'ธุรกิจของคุณ']);
        if (viewer?.role === 'mystic' && viewer.horoscope?.lucky === loc.id) marks.push(['🍀', 'ดวงบอกว่าที่นี่นำโชค']);
        if (viewer?.role === 'mystic' && viewer.horoscope?.unlucky === loc.id) marks.push(['💀', 'ดวงบอกว่าที่นี่อัปมงคล']);
        const closed = view.global.closed === loc.id;
        if (closed) marks.push(['🚧', 'ปิดชั่วคราว']);
        const isCurrentSpot = current && (tokens[current.id] || current.location) === loc.id;
        const coach = Array.isArray(highlight) ? highlight.includes(loc.id) : highlight === loc.id;
        return (
          <button
            key={loc.id}
            type="button"
            className={`bldg b-${loc.id}${selected === loc.id ? ' is-selected' : ''}${isCurrentSpot ? ' is-here' : ''}${closed ? ' is-closed' : ''}${travel && !travel.ok ? ' is-far' : ''}${coach ? ' is-coach' : ''}`}
            style={{ gridColumn: col, gridRow: row }}
            onClick={() => (selected === loc.id && canMove && travel?.ok ? onMove(loc.id) : onSelect(loc.id))}
            title={`${loc.name} — ${loc.desc}`}
            aria-label={`${loc.name}${travel ? ` เดิน ${travel.hours} ชม.` : ''}`}
          >
            {marks.length > 0 && (
              <span className="bldg-badges">
                {marks.map(([icon, label]) => (
                  <span key={label} title={label}>
                    {icon}
                  </span>
                ))}
              </span>
            )}
            {coach && (
              <span className="bldg-coach-pin" aria-hidden="true">
                👇
              </span>
            )}
            <span className="bldg-icon" aria-hidden="true">
              {loc.icon}
            </span>
            <span className="bldg-name">{loc.short || loc.name}</span>
            {travel && <span className={`bldg-cost${travel.ok ? '' : ' is-bad'}`}>{travel.hours} ชม.</span>}
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
        {event && !sel && (
          <div className="city-event" title={event.text}>
            <span aria-hidden="true">{event.icon}</span>
            <span>
              <b>{event.name}</b>
              <small>
                {event.text}
                {view.global.closed ? ` (${locationName(view.global.closed)})` : ''}
              </small>
            </span>
          </div>
        )}
        {sel ? (
          <div className="city-sel">
            <div className="city-sel-head">
              <span className="city-sel-icon" aria-hidden="true">
                {sel.icon}
              </span>
              <div>
                <b>{sel.name}</b>
                <p>{sel.desc}</p>
              </div>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => onSelect(null)} aria-label="ปิด">
                ✕
              </button>
            </div>
            {canMove && selTravel && sel.id !== current?.location && (
              <button type="button" className="btn btn-primary btn-block" disabled={!selTravel.ok} onClick={() => onMove(sel.id)}>
                {selTravel.ok ? `เดินไปที่นี่ · ${selTravel.hours} ชม.` : view.global.closed === sel.id ? 'ปิดชั่วคราว' : `เวลาไม่พอ (ต้องใช้ ${selTravel.hours} ชม.)`}
              </button>
            )}
          </div>
        ) : (
          current && (
            <div className="city-now" style={{ '--pc': current.color }}>
              <span className="avatar" style={{ background: current.color }}>
                {initials(current.name)}
              </span>
              <div>
                <b>{mineTurn ? (myIds.length > 1 ? `ตาของ ${current.name}` : 'ตาของคุณ') : `ตาของ ${current.name}`}</b>
                <small>{locationName(tokens[current.id] || current.location)}</small>
              </div>
            </div>
          )
        )}
        {canMove && !sel && <p className="city-hint">แตะอาคารเพื่อดู แตะซ้ำเพื่อเดินไป</p>}
      </div>
    </div>
  );
}
