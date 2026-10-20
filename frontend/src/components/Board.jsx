import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_ROWS, SPACES, describeSpace, formatShort, initials } from '../lib/game.js';

// กระดานแบ่งเป็นช่วงชีวิต ทางแยกแสดงเป็นสองเส้นทางคู่กัน
export function Board({ players, tokens, focusPlayerId, myIds }) {
  const ref = useRef(null);
  const [info, setInfo] = useState(null);

  const positions = useMemo(() => {
    const map = {};
    for (const p of players) {
      const pos = tokens[p.id] || p.position;
      (map[pos] ||= []).push(p);
    }
    return map;
  }, [players, tokens]);

  const focus = players.find((p) => p.id === focusPlayerId);
  const focusSpace = focus ? tokens[focus.id] || focus.position : null;

  useEffect(() => {
    const box = ref.current;
    if (!box || !focusSpace) return;
    const el = box.querySelector(`[data-space="${focusSpace}"]`);
    if (!el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top + 40 || r.bottom > b.bottom - 40) {
      box.scrollTo({ top: box.scrollTop + (r.top - b.top) - b.height / 2 + r.height / 2, behavior: 'smooth' });
    }
  }, [focusSpace]);

  return (
    <div className="board-wrap">
      <div className="board" ref={ref}>
        {BOARD_ROWS.map((row, i) => (
          <div key={i} className={`board-row${row.length > 1 ? ' is-fork' : ''}`}>
            {i > 0 && <div className="board-arrow" aria-hidden="true">{row.length > 1 ? '↙ ทางแยก ↘' : '↓'}</div>}
            <div className="board-row-segs">
              {row.map((seg) => (
                <section key={seg.id} className={`segment seg-${seg.id}`}>
                  <header className="segment-head">
                    <span className="segment-icon">{seg.icon}</span>
                    <span className="segment-title">{seg.title}</span>
                    <span className="segment-age">อายุ {seg.ages[0] === seg.ages[1] ? seg.ages[0] : `${seg.ages[0]}–${seg.ages[1]}`}</span>
                  </header>
                  <div className="tiles">
                    {seg.spaceIds.map((id, idx) => (
                      <Tile
                        key={id}
                        space={SPACES[id]}
                        index={idx}
                        occupants={positions[id] || []}
                        focusId={focusPlayerId}
                        myIds={myIds}
                        onClick={() => setInfo(SPACES[id])}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>
      {info && (
        <div className="tile-info" role="dialog" aria-label={info.label}>
          <span className="tile-info-icon">{info.icon}</span>
          <div>
            <b>{info.label}</b>
            {info.stop && <span className="chip chip-stop">ช่องหยุด</span>}
            <p>{describeSpace(info)}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setInfo(null)} aria-label="ปิด">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Tile({ space, occupants, focusId, myIds, onClick }) {
  const amount = space.amount != null && space.type !== 'pet' ? space.amount : null;
  const sign = space.type === 'pay' || space.type === 'lifeBuy' ? '-' : '+';
  return (
    <button
      type="button"
      className={`tile t-${space.type}${space.stop ? ' is-stop' : ''}${occupants.some((p) => p.id === focusId) ? ' is-focus' : ''}`}
      data-space={space.id}
      onClick={onClick}
      title={`${space.label} — ${describeSpace(space)}`}
    >
      <span className="tile-icon">{space.icon}</span>
      <span className="tile-label">{space.label}</span>
      {amount != null && <span className="tile-amount">{sign}{formatShort(amount)}</span>}
      {space.stop && <span className="tile-stop">หยุด</span>}
      {occupants.length > 0 && (
        <span className="tile-tokens">
          {occupants.map((p) => (
            <span
              key={p.id}
              className={`token${p.id === focusId ? ' is-active' : ''}${myIds.includes(p.id) ? ' is-mine' : ''}`}
              style={{ background: p.color }}
              title={p.name}
            >
              {initials(p.name)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
