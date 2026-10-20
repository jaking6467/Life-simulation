import { BUSINESSES, COURSES, HOMES, JOBS, ROLES, SCORE_CATEGORIES, formatMoney } from '../lib/game.js';

const MEDALS = ['🥇', '🥈', '🥉', '🏅'];

export function Results({ view, myIds, isHost, onRematch, onLeave, onClose }) {
  const results = view.results || [];
  const mine = results.find((r) => myIds.includes(r.playerId));
  return (
    <div className="modal-back" role="presentation">
      <div className="modal results" role="dialog" aria-label="ผลการแข่งขัน">
        <h2>🏁 จบเกม {view.maxWeeks} สัปดาห์!</h2>
        {mine && <p className="results-mine">{mine.rank === 1 ? '🎉 ยินดีด้วย คุณใช้ชีวิตได้ดีที่สุด!' : `คุณได้อันดับที่ ${mine.rank}`}</p>}
        <ol className="results-list">
          {results.map((r) => {
            const role = ROLES[r.role];
            return (
              <li key={r.playerId} className={`result${myIds.includes(r.playerId) ? ' is-mine' : ''}`} style={{ '--pc': r.color }}>
                <div className="result-head">
                  <span className="result-medal">{MEDALS[r.rank - 1] || r.rank}</span>
                  <b className="result-name">
                    {r.name} <small className="muted">{role.icon} {role.name}</small>
                  </b>
                  <span className="result-total">{r.score} คะแนน</span>
                </div>
                <div className="result-cats">
                  {SCORE_CATEGORIES.map((c) => (
                    <span key={c.id} title={c.name}>
                      {c.icon} {r.breakdown[c.id]}
                    </span>
                  ))}
                  <span title="ภารกิจของบทบาท">🏅 {r.questPoints}</span>
                  {r.bonusPoints > 0 && <span title="โบนัสพิเศษ">✨ {r.bonusPoints}</span>}
                </div>
                <div className="result-meta muted">
                  💰 ทรัพย์สินสุทธิ {formatMoney(r.netWorth)}
                  {r.job ? ` · 💼 ${JOBS[r.job].title}` : ' · ว่างงาน'}
                  {r.education.length ? ` · 🎓 ${r.education.map((id) => COURSES[id].icon).join('')}` : ''}
                  {` · ภารกิจสำเร็จ ${r.quests.length}/3`}
                  {r.love ? ` · ${r.love.stage === 'married' ? '💍' : '💑'} ${r.love.name}` : ''}
                  {r.kids ? ` 👶×${r.kids}` : ''}
                  {r.owned ? ` · 🔑 ${HOMES[r.owned].name}` : ''}
                  {r.businesses?.length ? ` · 🏪 ${r.businesses.map((b) => BUSINESSES[b.id].icon).join('')}` : ''}
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
            ดูเมือง
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            ออกจากห้อง
          </button>
        </div>
      </div>
    </div>
  );
}
