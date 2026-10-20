import { useState } from 'react';
import { ChatPanel } from '../components/ChatPanel.jsx';
import { Rules } from '../components/Rules.jsx';
import { BOT_LEVEL_TEXT, ROLE_LIST, ROLES, RULES, initials } from '../lib/game.js';

const TURN_OPTIONS = [
  [0, 'ไม่จำกัด'],
  [60, '1 นาที'],
  [90, '1.5 นาที'],
  [120, '2 นาที'],
  [180, '3 นาที'],
  [300, '5 นาที'],
];

export function Lobby({ room, chat, send, onLeave }) {
  const [localName, setLocalName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const me = room.seats.find((s) => room.you.includes(s.id) && !s.local);
  const empty = Math.max(0, room.options.maxPlayers - room.seats.length);
  const notReady = room.seats.filter((s) => !s.isBot && !s.local && !s.isHost && !s.ready);
  const setOpt = (patch) => send('room:options', { options: { ...room.options, ...patch } });

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('คัดลอกลิงก์นี้ส่งให้เพื่อน', url);
    }
  };

  let status = '';
  if (room.seats.length < 2) status = 'ต้องมีผู้เล่นอย่างน้อย 2 คน (เพิ่มบอทได้)';
  else if (notReady.length) status = `รอ ${notReady.map((s) => s.name).join(', ')} กดพร้อม`;
  else status = room.isHost ? 'ทุกคนพร้อมแล้ว กดเริ่มเกมได้เลย!' : 'รอเจ้าของห้องกดเริ่มเกม';

  return (
    <div className="lobby">
      <div className="lobby-card">
        <header className="lobby-head">
          <div>
            <h2>{room.offline ? 'ห้องเล่นออฟไลน์' : 'ห้องรอเล่น'}</h2>
            {!room.offline && (
              <p className="lobby-code">
                รหัสห้อง <b className="room-code">{room.code}</b>
                <button type="button" className="btn btn-sm" onClick={copyLink}>
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์ชวนเพื่อน'}
                </button>
              </p>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onLeave}>
            ออก
          </button>
        </header>

        <h3 className="section-title">
          ผู้เล่น <span className="muted">{room.seats.length}/{room.options.maxPlayers}</span>
        </h3>
        <ul className="seats">
          {room.seats.map((s) => (
            <li key={s.id} className="seat" style={{ '--pc': s.color }}>
              <span className="avatar" style={{ background: s.color }}>
                {initials(s.name)}
              </span>
              <span className="seat-main">
                <span className="seat-name">
                  <b>{s.name}</b>
                  {s.isHost && <span className="tag">เจ้าของห้อง</span>}
                  {room.you.includes(s.id) && <span className="tag tag-me">คุณ</span>}
                  {s.isBot && <span className="tag">บอท</span>}
                  {s.local && <span className="tag">เครื่องนี้</span>}
                  {!s.connected && <span className="tag tag-bad">หลุด</span>}
                  {!s.isHost && !s.isBot && !s.local && <span className={`tag${s.ready ? ' tag-good' : ''}`}>{s.ready ? 'พร้อม' : 'ยังไม่พร้อม'}</span>}
                </span>
                <RolePicker room={room} seat={s} send={send} />
              </span>
              {room.isHost && !s.isHost && (
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => send('room:removeSeat', { seatId: s.id })} aria-label={`นำ ${s.name} ออก`}>
                  ✕
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} className="seat is-empty">
              {room.offline ? 'ที่ว่าง — เพิ่มบอทหรือผู้เล่นในเครื่องนี้' : room.isHost ? 'ที่ว่าง — รอเพื่อนหรือเพิ่มบอท' : 'ที่ว่าง'}
            </li>
          ))}
        </ul>

        {room.isHost && empty > 0 && (
          <div className="lobby-add">
            <button type="button" className="btn" onClick={() => send('room:addBot')}>
              🤖 เพิ่มบอท
            </button>
            <form
              className="join-row"
              onSubmit={(e) => {
                e.preventDefault();
                send('room:addLocal', { name: localName });
                setLocalName('');
              }}
            >
              <input value={localName} onChange={(e) => setLocalName(e.target.value)} maxLength={16} placeholder="ชื่อเพื่อนที่เล่นเครื่องนี้" aria-label="ชื่อผู้เล่นในเครื่องนี้" />
              <button type="submit" className="btn">
                เพิ่มคน
              </button>
            </form>
          </div>
        )}

        <div className="lobby-options">
          <h3 className="section-title">
            ตั้งค่าเกม {!room.isHost && <small className="muted">(เจ้าของห้องเป็นคนตั้ง)</small>}
          </h3>
          <div className="options-grid">
            <label>
              <span>ความยาวเกม</span>
              <select disabled={!room.isHost} value={room.options.weeks} onChange={(e) => setOpt({ weeks: Number(e.target.value) })}>
                {RULES.weeksOptions.map((w) => (
                  <option key={w} value={w}>
                    {w} สัปดาห์
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>ความเก่งของบอท</span>
              <select disabled={!room.isHost} value={room.options.botLevel || 'normal'} onChange={(e) => setOpt({ botLevel: e.target.value })}>
                {Object.entries(BOT_LEVEL_TEXT).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>เวลาต่อตา</span>
              <select disabled={!room.isHost} value={room.options.turnSeconds} onChange={(e) => setOpt({ turnSeconds: Number(e.target.value) })}>
                {TURN_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>ความเร็วแอนิเมชัน</span>
              <select disabled={!room.isHost} value={room.options.speed} onChange={(e) => setOpt({ speed: Number(e.target.value) })}>
                <option value={1}>ช้า</option>
                <option value={2}>ปกติ</option>
                <option value={3}>เร็ว</option>
              </select>
            </label>
            <label>
              <span>ผู้เล่นสูงสุด</span>
              <select disabled={!room.isHost} value={room.options.maxPlayers} onChange={(e) => setOpt({ maxPlayers: Number(e.target.value) })}>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} คน
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">{BOT_LEVEL_HINT[room.options.botLevel || 'normal']}</p>
          {!room.offline && (
            <label className="check">
              <input type="checkbox" disabled={!room.isHost} checked={room.options.isPublic} onChange={(e) => setOpt({ isPublic: e.target.checked })} />
              <span>ให้คนที่กด "จับคู่ด่วน" เข้าห้องนี้ได้</span>
            </label>
          )}
        </div>

        <div className="lobby-actions">
          {room.isHost ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={room.seats.length < 2 || notReady.length > 0} onClick={() => send('room:start')}>
              ▶ เริ่มเกม
            </button>
          ) : (
            <button type="button" className={`btn btn-lg btn-block${me?.ready ? '' : ' btn-primary'}`} onClick={() => send('room:ready', { ready: !me?.ready })}>
              {me?.ready ? 'ยกเลิกพร้อม' : '✓ พร้อมเล่น'}
            </button>
          )}
          <p className="muted small">{status}</p>
        </div>

        <RoleGuide />

        {!room.offline && (
          <div className="lobby-chat">
            <h3 className="section-title">แชท</h3>
            <ChatPanel chat={chat} onSend={(text) => send('chat:send', { text })} compact />
          </div>
        )}

        <button type="button" className="link-btn" onClick={() => setShowRules((s) => !s)} aria-expanded={showRules}>
          {showRules ? 'ซ่อนวิธีเล่น' : 'วิธีเล่น'}
        </button>
        {showRules && <Rules />}
      </div>
    </div>
  );
}

const BOT_LEVEL_HINT = {
  easy: 'บอทง่าย: เล่นชิล ๆ ไม่ลงทุน ไม่แกล้งใคร',
  normal: 'บอทปกติ: ใช้ชีวิตครบทุกด้าน มีครอบครัว เปิดธุรกิจเล็ก ๆ',
  hard: 'บอทยาก: วางแผนเก่ง ลงทุนเป็น ชอบแกล้งคนที่นำอยู่',
};

function RolePicker({ room, seat, send }) {
  const mine = room.you.includes(seat.id) || (seat.isBot && room.isHost);
  const taken = new Set(room.seats.filter((x) => x.id !== seat.id).map((x) => x.role));
  if (!mine) {
    const r = ROLES[seat.role];
    return <span className="role-chip">{r ? `${r.icon} ${r.name}` : 'สุ่มบทบาท'}</span>;
  }
  return (
    <select className="role-select" value={seat.role} onChange={(e) => send('room:role', { seatId: seat.id, role: e.target.value })} aria-label={`บทบาทของ ${seat.name}`}>
      <option value="random">🎲 สุ่มบทบาท</option>
      {ROLE_LIST.map((r) => (
        <option key={r.id} value={r.id} disabled={taken.has(r.id)}>
          {r.icon} {r.name}
        </option>
      ))}
    </select>
  );
}

function RoleGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="role-guide">
      <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'ซ่อนรายละเอียดบทบาท' : 'ดูบทบาททั้ง 8 แบบ'}
      </button>
      {open && (
        <div className="roles-grid">
          {ROLE_LIST.map((r) => (
            <div key={r.id} className="role-card">
              <b>
                {r.icon} {r.name}
              </b>
              <p className="muted">{r.desc}</p>
              <ul>
                {r.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <p className="small muted">ภารกิจ: {r.quests.map((q) => `${q.text} (+${q.points})`).join(' · ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
