import { useState } from 'react';
import { CLOTHES, COURSES, FURNITURE, HOMES, JOBS, PETS, ROLES, STOCKS, VEHICLES, formatMoney, initials, locationName } from '../lib/game.js';

export function PlayerList({ view, seats, myIds }) {
  const seatById = Object.fromEntries((seats || []).map((s) => [s.id, s]));
  const ranked = [...view.players].sort((a, b) => b.score - a.score);
  const rankOf = Object.fromEntries(ranked.map((p, i) => [p.id, i + 1]));
  return (
    <div className="player-list">
      {view.order.map((id, i) => {
        const p = view.players.find((x) => x.id === id);
        return (
          <PlayerCard
            key={id}
            player={p}
            view={view}
            order={i + 1}
            rank={rankOf[id]}
            seat={seatById[id]}
            isCurrent={view.currentPlayerId === id}
            isMine={myIds.includes(id)}
          />
        );
      })}
    </div>
  );
}

function Bar({ label, icon, value, tone }) {
  return (
    <div className={`stat stat-${tone}`} title={`${label} ${value}/100`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-track">
        <span className="stat-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="stat-num">{value}</span>
    </div>
  );
}

function PlayerCard({ player: p, view, order, rank, seat, isCurrent, isMine }) {
  const [open, setOpen] = useState(false);
  const role = ROLES[p.role];
  const job = JOBS[p.job];
  const done = role.quests.filter((q) => p.quests[q.id]).length;
  return (
    <article className={`pcard${isCurrent ? ' is-current' : ''}${isMine ? ' is-mine' : ''}`} style={{ '--pc': p.color }}>
      <header className="pcard-head">
        <span className="avatar" style={{ background: p.color }}>{initials(p.name)}</span>
        <div className="pcard-name">
          <b>{p.name}</b>
          <span className="pcard-tags">
            <span className="tag tag-role" title={role.desc}>
              {role.icon} {role.name}
            </span>
            {isMine && <span className="tag tag-me">คุณ</span>}
            {seat?.isBot && <span className="tag">บอท</span>}
            {seat?.local && <span className="tag">เครื่องนี้</span>}
            {seat?.away && <span className="tag tag-warn">ระบบเล่นแทน</span>}
            {seat && !seat.connected && <span className="tag tag-bad">หลุด</span>}
          </span>
        </div>
        <div className="pcard-score" title={`อันดับ ${rank} • ลำดับการเล่น ${order}`}>
          <b>{p.score}</b>
          <small>{isCurrent ? '▶ กำลังเล่น' : `อันดับ ${rank}`}</small>
        </div>
      </header>

      <div className="pcard-money">
        <span className="cash" title="เงินสด">💵 {formatMoney(p.cash)}</span>
        {p.savings > 0 && <span className="savings" title="เงินฝากธนาคาร">🏦 {formatMoney(p.savings)}</span>}
        {p.loans > 0 && <span className="debt">หนี้ {p.loans} สัญญา</span>}
      </div>

      <div className="stats">
        <Bar label="สุขภาพ" icon="❤️" value={p.stats.health} tone="health" />
        <Bar label="ความสุข" icon="😊" value={p.stats.happiness} tone="happy" />
        <Bar label="ความสะอาด" icon="🧼" value={p.stats.hygiene} tone="clean" />
      </div>

      <div className="pcard-line">
        💼 {job ? <>{job.title} <small className="muted">({formatMoney(job.wage)}/ชม.)</small></> : <span className="muted">ว่างงาน</span>}
      </div>
      <div className="pcard-line">
        🎓 {p.education.completed.length ? p.education.completed.map((id) => COURSES[id].icon).join(' ') : <span className="muted">ยังไม่มีวุฒิ</span>}
        {p.education.enrolled && (
          <small className="muted">
            {' '}
            · กำลังเรียน{COURSES[p.education.enrolled].name} {p.education.progress}/{COURSES[p.education.enrolled].sessions}
          </small>
        )}
      </div>
      <div className="pcard-icons">
        <span title={HOMES[p.housing].name}>{p.housing === 'condo' ? '🏙️' : '🏚️'}</span>
        {p.furniture.map((id) => (
          <span key={id} title={FURNITURE[id].name}>{FURNITURE[id].icon}</span>
        ))}
        {p.vehicle && <span title={VEHICLES[p.vehicle].name}>{VEHICLES[p.vehicle].icon}</span>}
        {p.pets.map((id) => (
          <span key={id} title={PETS[id].name}>{PETS[id].icon}</span>
        ))}
        <span title={`เสื้อผ้า: ${CLOTHES[p.clothes.tier].name}${p.clothes.tier ? ` (เหลือ ${p.clothes.weeksLeft} สัปดาห์)` : ''}`}>{CLOTHES[p.clothes.tier].icon || '🩹'}</span>
        {isCurrent && <span title={p.ate ? 'กินแล้วสัปดาห์นี้' : 'ยังไม่ได้กิน'}>{p.ate ? '🍽️✓' : '🍽️✗'}</span>}
      </div>
      <footer className="pcard-foot">
        <span>📍 {locationName(p.location)}</span>
        <span title="ทรัพย์สินสุทธิ (เงินสด + เงินฝาก + หุ้น + ของ − หนี้)">สุทธิ {formatMoney(p.netWorth)}</span>
      </footer>
      <button type="button" className="pcard-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🏅 ภารกิจ {done}/{role.quests.length} {p.lastWeek ? `· สัปดาห์ล่าสุด +${p.lastWeek.points}` : ''} {open ? '▲' : '▼'}
      </button>
      {open && <Details p={p} view={view} role={role} />}
    </article>
  );
}

function Details({ p, view, role }) {
  const stocks = Object.entries(p.stocks).filter(([, n]) => n > 0);
  return (
    <div className="pcard-details">
      <ul className="quests">
        {role.quests.map((q) => (
          <li key={q.id} className={p.quests[q.id] ? 'is-done' : ''}>
            {p.quests[q.id] ? '✅' : '⬜'} {q.text} <b>+{q.points}</b>
          </li>
        ))}
      </ul>
      <p className="muted small">{role.perks.join(' • ')}</p>
      {p.role === 'mystic' && p.horoscope && (
        <p className="small">
          🔮 ดวงสัปดาห์นี้: นำโชคที่ <b>{locationName(p.horoscope.lucky)}</b>
          {p.horoscope.used ? ' (ทำตามแล้ว ✓)' : ''} · อัปมงคลที่ {locationName(p.horoscope.unlucky)}
        </p>
      )}
      {p.role === 'influencer' && <p className="small">📱 ผู้ติดตาม {p.followers.toLocaleString('en-US')} คน</p>}
      {p.artworks.length > 0 && <p className="small">🖼️ ภาพที่ยังไม่ขาย: {p.artworks.map((a) => `"${a.title}" (${formatMoney(a.value)})`).join(', ')}</p>}
      {p.finds.length > 0 && <p className="small">🧺 ของที่คุ้ยเจอ: {p.finds.map((f) => f.name).join(', ')}</p>}
      {stocks.length > 0 && (
        <p className="small">
          📈 หุ้น: {stocks.map(([sym, n]) => `${STOCKS[sym].icon} ${n} หน่วย (${formatMoney(view.stocks[sym].price * n)})`).join(', ')}
        </p>
      )}
      <p className="small muted">
        🛒 ของสด {p.groceries} มื้อ · 🎟️ ลอตเตอรี่ {p.tickets} ใบ · ⭐ ประสบการณ์ทำงาน {p.xp} ชม.
      </p>
      {p.weeklyPreview && (
        <p className="small muted">
          ถ้าจบสัปดาห์ตอนนี้จะได้ประมาณ <b>{p.weeklyPreview.total}</b> คะแนน
        </p>
      )}
    </div>
  );
}
