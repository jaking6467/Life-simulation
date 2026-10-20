import { CAREERS, HOUSES, formatMoney, formatShort } from '../lib/game.js';

const MEDALS = ['🥇', '🥈', '🥉', '🏅'];

export function Results({ view, myIds, isHost, onRematch, onLeave, onClose }) {
  const results = view.results || [];
  const mine = results.find((r) => myIds.includes(r.playerId));
  return (
    <div className="modal-back" role="presentation">
      <div className="modal results" role="dialog" aria-label="ผลการแข่งขัน">
        <h2>🏁 จบเกม!</h2>
        {mine && (
          <p className="results-mine">
            {mine.rank === 1 ? '🎉 ยินดีด้วย คุณชนะ!' : `คุณได้อันดับที่ ${mine.rank}`}
          </p>
        )}
        <ol className="results-list">
          {results.map((r) => {
            const c = CAREERS[r.career];
            return (
              <li key={r.playerId} className={`result${myIds.includes(r.playerId) ? ' is-mine' : ''}`} style={{ '--pc': r.color }}>
                <div className="result-head">
                  <span className="result-medal">{MEDALS[r.rank - 1] || r.rank}</span>
                  <b className="result-name">{r.name}</b>
                  <span className="result-total">{formatMoney(r.total)}</span>
                </div>
                <div className="result-break">
                  <span>💵 เงินสด {formatMoney(r.cash)}</span>
                  {r.debt > 0 && <span className="bad-text">🏦 หนี้ -{formatMoney(r.debt)}</span>}
                  <span>⭐ บัตรความสุข {r.tiles.length} ใบ = {formatMoney(r.tilesTotal)}</span>
                </div>
                <div className="result-tiles" aria-label="มูลค่าบัตรความสุข">
                  {r.tiles.map((v, i) => (
                    <span key={i} className="tile-chip" style={{ animationDelay: `${i * 80}ms` }}>
                      {formatShort(v)}
                    </span>
                  ))}
                </div>
                <div className="result-meta muted">
                  {c ? `${c.icon} ${c.titles[r.salaryLevel]}` : ''}
                  {r.degree ? ' · 🎓' : ''}
                  {r.married ? ' · 💍' : ' · โสด'}
                  {r.children ? ` · 👶×${r.children}` : ''}
                  {r.pets ? ` · 🐾×${r.pets}` : ''}
                  {r.soldHouses.length ? ` · ขายบ้าน ${r.soldHouses.map((h) => HOUSES[h.id].icon).join('')}` : ''}
                  {` · เกษียณที่${r.retireChoice === 'estate' ? 'คฤหาสน์เศรษฐี' : 'บ้านสวน'} (คนที่ ${r.retireRank})`}
                  {` · เงินเดือนออก ${r.stats.paydays} ครั้ง`}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="btn-row center">
          {isHost ? (
            <button type="button" className="btn btn-primary" onClick={onRematch}>
              🔁 เล่นอีกรอบ
            </button>
          ) : (
            <span className="muted">รอเจ้าของห้องเริ่มรอบใหม่…</span>
          )}
          <button type="button" className="btn" onClick={onClose}>
            ดูกระดาน
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            ออกจากห้อง
          </button>
        </div>
      </div>
    </div>
  );
}
