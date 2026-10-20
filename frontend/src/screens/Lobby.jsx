import { useState } from 'react';
import { ChatPanel } from '../components/ChatPanel.jsx';
import { Rules } from '../components/Rules.jsx';
import { initials } from '../lib/game.js';

const TURN_OPTIONS = [
  [0, 'ไม่จำกัดเวลา'],
  [30, '30 วินาที'],
  [45, '45 วินาที'],
  [60, '60 วินาที'],
  [90, '90 วินาที'],
  [120, '2 นาที'],
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
            <h2>{room.offline ? '📱 ห้องเล่นออฟไลน์' : '🌐 ห้องรอเล่น'}</h2>
            {!room.offline && (
              <p>
                รหัสห้อง <b className="room-code">{room.code}</b>{' '}
                <button type="button" className="btn btn-sm" onClick={copyLink}>
                  {copied ? 'คัดลอกแล้ว ✓' : '🔗 คัดลอกลิงก์ชวนเพื่อน'}
                </button>
              </p>
            )}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            ออกจากห้อง
          </button>
        </header>

        <h3>
          ผู้เล่น ({room.seats.length}/{room.options.maxPlayers})
        </h3>
        <ul className="seats">
          {room.seats.map((s) => (
            <li key={s.id} className="seat" style={{ '--pc': s.color }}>
              <span className="avatar" style={{ background: s.color }}>{initials(s.name)}</span>
              <span className="grow">
                <b>{s.name}</b> {s.isHost && <span title="เจ้าของห้อง">👑</span>}{' '}
                {room.you.includes(s.id) && <span className="tag tag-me">คุณ</span>} {s.isBot && <span className="tag">บอท</span>}{' '}
                {s.local && <span className="tag">เครื่องนี้</span>} {!s.connected && <span className="tag tag-bad">หลุด</span>}
              </span>
              <span className={`ready${s.ready || s.isHost ? ' is-ready' : ''}`}>{s.isHost ? 'เจ้าของห้อง' : s.ready ? 'พร้อม ✓' : 'ยังไม่พร้อม'}</span>
              {room.isHost && !s.isHost && (
                <button type="button" className="icon-btn" onClick={() => send('room:removeSeat', { seatId: s.id })} aria-label={`นำ ${s.name} ออก`}>
                  ✕
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} className="seat is-empty">
              ที่ว่าง — {room.offline ? 'เพิ่มบอทหรือผู้เล่นในเครื่องนี้' : room.isHost ? 'รอเพื่อนเข้าห้อง หรือเพิ่มบอท' : 'รอผู้เล่น'}
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
              <input value={localName} onChange={(e) => setLocalName(e.target.value)} maxLength={16} placeholder="ชื่อผู้เล่นอีกคนในเครื่องนี้" aria-label="ชื่อผู้เล่นในเครื่องนี้" />
              <button type="submit" className="btn">
                👥 เพิ่มผู้เล่นในเครื่องนี้
              </button>
            </form>
          </div>
        )}

        <div className="lobby-options">
          <h3>⚙️ ตั้งค่าเกม {!room.isHost && <small className="muted">(เจ้าของห้องเป็นคนตั้ง)</small>}</h3>
          <label>
            <span>จำนวนผู้เล่นสูงสุด</span>
            <select disabled={!room.isHost} value={room.options.maxPlayers} onChange={(e) => setOpt({ maxPlayers: Number(e.target.value) })}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} คน
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>เวลาตัดสินใจแต่ละครั้ง</span>
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
              <option value={1}>ปกติ</option>
              <option value={2}>เร็ว ×2</option>
            </select>
          </label>
          {!room.offline && (
            <label className="check">
              <input type="checkbox" disabled={!room.isHost} checked={room.options.isPublic} onChange={(e) => setOpt({ isPublic: e.target.checked })} />
              <span>ให้คนที่กด "จับคู่ด่วน" เข้าห้องนี้ได้</span>
            </label>
          )}
        </div>

        <div className="lobby-actions">
          {room.isHost ? (
            <button type="button" className="btn btn-primary btn-lg" disabled={room.seats.length < 2 || notReady.length > 0} onClick={() => send('room:start')}>
              ▶ เริ่มเกม
            </button>
          ) : (
            <button type="button" className={`btn btn-lg${me?.ready ? '' : ' btn-primary'}`} onClick={() => send('room:ready', { ready: !me?.ready })}>
              {me?.ready ? 'ยกเลิกพร้อม' : '✓ พร้อมเล่น'}
            </button>
          )}
          <p className="muted small">{status}</p>
        </div>

        {!room.offline && (
          <div className="lobby-chat">
            <h3>💬 แชท</h3>
            <ChatPanel chat={chat} onSend={(text) => send('chat:send', { text })} compact />
          </div>
        )}

        <button type="button" className="link-btn" onClick={() => setShowRules((s) => !s)} aria-expanded={showRules}>
          {showRules ? 'ซ่อนวิธีเล่น ▲' : '📖 วิธีเล่น ▼'}
        </button>
        {showRules && <Rules />}
      </div>
    </div>
  );
}
