import { CAREERS, HOUSES, INSURANCE, careerTitle, formatMoney, initials, netWorth, playerAge, playerStage } from '../lib/game.js';

export function PlayerList({ view, seats, myIds }) {
  const seatById = Object.fromEntries((seats || []).map((s) => [s.id, s]));
  return (
    <div className="player-list">
      {view.order.map((id, i) => {
        const p = view.players.find((x) => x.id === id);
        return (
          <PlayerCard
            key={id}
            player={p}
            order={i + 1}
            seat={seatById[id]}
            isCurrent={view.currentPlayerId === id}
            isMine={myIds.includes(id)}
          />
        );
      })}
    </div>
  );
}

function PlayerCard({ player: p, order, seat, isCurrent, isMine }) {
  const career = CAREERS[p.career];
  const ins = Object.keys(INSURANCE).filter((k) => p.insurance[k]);
  return (
    <article className={`pcard${isCurrent ? ' is-current' : ''}${p.retired ? ' is-retired' : ''}${isMine ? ' is-mine' : ''}`} style={{ '--pc': p.color }}>
      <header className="pcard-head">
        <span className="avatar" style={{ background: p.color }}>{initials(p.name)}</span>
        <div className="pcard-name">
          <b>{p.name}</b>
          <span className="pcard-tags">
            {isMine && <span className="tag tag-me">คุณ</span>}
            {seat?.isBot && <span className="tag">บอท</span>}
            {seat?.local && <span className="tag">เครื่องนี้</span>}
            {seat?.away && <span className="tag tag-warn">ระบบเล่นแทน</span>}
            {seat && !seat.connected && <span className="tag tag-bad">หลุด</span>}
            {p.skipTurns > 0 && <span className="tag tag-bad">ข้ามตา</span>}
            {p.retired && <span className="tag tag-good">เกษียณ #{p.retireRank}</span>}
          </span>
        </div>
        <span className="pcard-order" title="ลำดับการเล่น">{isCurrent ? '▶' : order}</span>
      </header>

      <div className="pcard-money">
        <span className="cash">{formatMoney(p.cash)}</span>
        {p.loans > 0 && <span className="debt">หนี้ {p.loans} สัญญา</span>}
      </div>

      <div className="pcard-career">
        {career ? (
          <>
            <span>{career.icon}</span>
            <span className="grow">
              {careerTitle(p)} <small>({career.name})</small>
            </span>
            <span className="salary">{formatMoney(p.salary)}</span>
          </>
        ) : (
          <span className="muted">{p.started ? (p.education === 'college' ? '🎓 กำลังเรียนมหาวิทยาลัย' : 'กำลังหางาน') : 'ยังไม่เริ่มเส้นทาง'}</span>
        )}
      </div>

      <div className="pcard-icons">
        {p.degree && <span title="มีปริญญา">🎓</span>}
        {p.married && <span title="แต่งงานแล้ว">💍</span>}
        {p.children > 0 && <span title="ลูก">👶×{p.children}</span>}
        {p.pets > 0 && <span title="สัตว์เลี้ยง">🐾×{p.pets}</span>}
        {p.houses.map((h) => (
          <span key={h.id} title={HOUSES[h.id].name}>{HOUSES[h.id].icon}</span>
        ))}
        <span title="บัตรความสุข (มูลค่าเปิดเผยตอนจบเกม)">⭐×{p.lifeTileCount}</span>
        {p.stocks.length > 0 && <span title="ใบหุ้น">📈{p.stocks.join(',')}</span>}
        {ins.map((k) => (
          <span key={k} className="ins" title={INSURANCE[k].name}>🛡️{INSURANCE[k].icon}</span>
        ))}
      </div>

      <footer className="pcard-foot">
        <span>อายุ ~{playerAge(p)} · {playerStage(p)}</span>
        <span title="ทรัพย์สินสุทธิโดยประมาณ (ไม่รวมบัตรความสุข)">สุทธิ ≈ {formatMoney(netWorth(p))}</span>
      </footer>
    </article>
  );
}
