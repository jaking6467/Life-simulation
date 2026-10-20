import { useState } from 'react';
import { BUSINESSES, CARDS, CLOTHES, COURSES, DATE_STYLES, FURNITURE, HOMES, INSURANCE, JOBS, PETS, ROLES, STOCKS, VEHICLES, formatMoney, initials, locationName } from '../lib/game.js';

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

function Bar({ label, value, tone }) {
  return (
    <div className={`stat stat-${tone}`} title={`${label} ${value}/100`}>
      <span className="stat-label">{label}</span>
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
  const status = seat?.away ? 'ระบบเล่นแทน' : seat && !seat.connected ? 'หลุด' : null;
  return (
    <article className={`pcard${isCurrent ? ' is-current' : ''}${isMine ? ' is-mine' : ''}`} style={{ '--pc': p.color }}>
      <header className="pcard-head">
        <span className="avatar" style={{ background: p.color }}>
          {initials(p.name)}
        </span>
        <div className="pcard-name">
          <b>
            {p.name}
            {isMine && <span className="tag tag-me">คุณ</span>}
          </b>
          <small>
            {role.icon} {role.name}
            {seat?.isBot ? ' · บอท' : ''}
            {status && <span className="tag tag-warn">{status}</span>}
          </small>
        </div>
        <div className="pcard-score" title={`อันดับ ${rank} · ลำดับการเล่นที่ ${order}`}>
          <b>{p.score}</b>
          <small>{isCurrent ? 'กำลังเล่น' : `อันดับ ${rank}`}</small>
        </div>
      </header>

      <div className="stats">
        <Bar label="สุขภาพ" value={p.stats.health} tone="health" />
        <Bar label="ความสุข" value={p.stats.happiness} tone="happy" />
        <Bar label="ความสะอาด" value={p.stats.hygiene} tone="clean" />
      </div>

      <div className="pcard-meta">
        <span title="เงินสด">{formatMoney(p.cash)}</span>
        {p.savings > 0 && <span title="เงินฝากธนาคาร">ฝาก {formatMoney(p.savings)}</span>}
        {p.loans > 0 && <span className="is-bad">หนี้ {p.loans}</span>}
        <span className="pcard-job" title={job ? `${job.title} ${formatMoney(job.wage)}/ชม.` : 'ยังไม่มีงาน'}>
          {job ? job.title : 'ว่างงาน'}
        </span>
        {p.love && (
          <span title={`ความรัก ${p.love.affection}/100`}>
            {p.love.stage === 'married' ? '💍' : '💑'} {p.love.name}
          </span>
        )}
      </div>

      <button type="button" className="pcard-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          ภารกิจ {done}/{role.quests.length}
          {p.lastWeek ? ` · สัปดาห์ล่าสุด +${p.lastWeek.points}` : ''}
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <Details p={p} view={view} role={role} isMine={isMine} />}
    </article>
  );
}

function Row({ label, children }) {
  return (
    <div className="drow">
      <span className="drow-label">{label}</span>
      <span className="drow-value">{children}</span>
    </div>
  );
}

function Details({ p, view, role, isMine }) {
  const stocks = Object.entries(p.stocks).filter(([, n]) => n > 0);
  const L = p.love;
  const items = [
    ...p.furniture.map((id) => FURNITURE[id]),
    ...(p.vehicle ? [VEHICLES[p.vehicle]] : []),
    ...p.pets.map((id) => PETS[id]),
  ];
  return (
    <div className="pcard-details">
      <ul className="quests">
        {role.quests.map((q) => (
          <li key={q.id} className={p.quests[q.id] ? 'is-done' : ''}>
            <span aria-hidden="true">{p.quests[q.id] ? '✓' : '○'}</span> {q.text} <b>+{q.points}</b>
          </li>
        ))}
      </ul>
      <p className="perks">{role.perks.join(' · ')}</p>

      <Row label="ที่อยู่">
        {HOMES[p.housing].name}
        {p.owned === p.housing ? ' (ของตัวเอง)' : ' (เช่า)'} · ตอนนี้อยู่{locationName(p.location)}
      </Row>
      <Row label="การศึกษา">
        {p.education.completed.length ? p.education.completed.map((id) => COURSES[id].name).join(', ') : 'ยังไม่มีวุฒิ'}
        {p.education.enrolled && ` · กำลังเรียน${COURSES[p.education.enrolled].name} ${p.education.progress}/${COURSES[p.education.enrolled].sessions}`}
      </Row>
      {(L || p.kids.length > 0) && (
        <Row label="ครอบครัว">
          {L && `${L.stage === 'married' ? 'แต่งงานกับ' : 'คบกับ'}${L.name} (ความรัก ${L.affection}) · ชอบ${DATE_STYLES[L.likes]}`}
          {L?.stage === 'married' && ` · ช่วยหารายได้ ${formatMoney(L.income)}/สัปดาห์`}
          {p.kids.length > 0 && ` · ลูก: ${p.kids.map((k) => k.name).join(', ')}`}
        </Row>
      )}
      {p.owned && (
        <Row label="บ้าน">
          {HOMES[p.owned].name} มูลค่า {formatMoney(p.homeValue)}
          {p.mortgage ? ` · หนี้บ้าน ${formatMoney(p.mortgage.remaining)} (ผ่อน ${formatMoney(p.mortgage.payment)}/สัปดาห์)` : ' · ผ่อนหมดแล้ว'}
        </Row>
      )}
      {p.businesses.length > 0 && (
        <Row label="ธุรกิจ">
          {p.businesses
            .map((b) => `${BUSINESSES[b.id].name} ระดับ ${b.level}${b.lastProfit != null ? ` (${b.lastProfit >= 0 ? '+' : ''}${formatMoney(b.lastProfit)})` : ''}`)
            .join(', ')}
        </Row>
      )}
      {Object.keys(p.insurance).length > 0 && <Row label="ประกัน">{Object.keys(p.insurance).map((id) => INSURANCE[id].name).join(', ')}</Row>}
      {stocks.length > 0 && (
        <Row label="หุ้น">{stocks.map(([sym, n]) => `${STOCKS[sym].name} ${n} (${formatMoney(view.stocks[sym].price * n)})`).join(', ')}</Row>
      )}
      {items.length > 0 && (
        <Row label="ของ">
          {items.map((it) => (
            <span key={it.id} title={it.name} className="item-icon">
              {it.icon}
            </span>
          ))}
        </Row>
      )}
      <Row label="เสื้อผ้า">
        {CLOTHES[p.clothes.tier].name}
        {p.clothes.tier ? ` (เหลือ ${p.clothes.weeksLeft} สัปดาห์)` : ''}
      </Row>
      {(p.cards.length > 0 || p.amulets > 0) && (
        <Row label="การ์ด">
          {isMine ? p.cards.map((c) => CARDS[c].name).join(', ') || '-' : `${p.cards.length} ใบ`}
          {p.amulets > 0 && ` · เครื่องราง ${p.amulets}`}
        </Row>
      )}
      {p.role === 'mystic' && p.horoscope && (
        <Row label="ดวง">
          นำโชค{locationName(p.horoscope.lucky)}
          {p.horoscope.used ? ' ✓' : ''} · อัปมงคล{locationName(p.horoscope.unlucky)}
        </Row>
      )}
      {p.role === 'influencer' && <Row label="ผู้ติดตาม">{p.followers.toLocaleString('en-US')} คน</Row>}
      {p.artworks.length > 0 && <Row label="ภาพวาด">{p.artworks.map((a) => `${a.title} (${formatMoney(a.value)})`).join(', ')}</Row>}
      {p.finds.length > 0 && <Row label="ของเก่า">{p.finds.map((f) => f.name).join(', ')}</Row>}
      <Row label="อื่น ๆ">
        ของสด {p.groceries} มื้อ · ลอตเตอรี่ {p.tickets} ใบ · ประสบการณ์ {p.xp} ชม. · คุณสมบัติงาน {p.merit}
      </Row>
      <Row label="ทรัพย์สิน">{formatMoney(p.netWorth)}</Row>
      {p.weeklyPreview && <p className="perks">ถ้าจบสัปดาห์ตอนนี้จะได้ประมาณ {p.weeklyPreview.total} คะแนน</p>}
    </div>
  );
}
