import { useState } from 'react';
import { Rules } from '../components/Rules.jsx';
import { SavedGames } from '../components/SavedGames.jsx';
import { TutorialToggle } from '../components/Coach.jsx';

const STATUS_TEXT = {
  connected: { text: 'ออนไลน์', tone: 'good' },
  connecting: { text: 'กำลังเชื่อมต่อ…', tone: 'warn' },
  disconnected: { text: 'หลุดการเชื่อมต่อ', tone: 'bad' },
  error: { text: 'เชื่อมต่อไม่ได้', tone: 'bad' },
  idle: { text: 'ไม่ได้เชื่อมต่อ', tone: 'bad' },
};

export function Home({ name, setName, onlineStatus, onCreate, onJoin, onQuick, onOffline, onLoadSave, onNotice, initialCode }) {
  const [code, setCode] = useState(initialCode || '');
  const [showRules, setShowRules] = useState(false);
  const online = onlineStatus === 'connected';
  const nameOk = name.trim().length > 0;
  const st = STATUS_TEXT[onlineStatus] || STATUS_TEXT.idle;

  return (
    <div className="home">
      <div className="home-card">
        <div className="logo" aria-hidden="true">🏙️</div>
        <h1>เส้นทางชีวิต</h1>
        <p className="tagline">
          เกมจำลองชีวิตแนว Walk of Life ผลัดกันเล่นคนละสัปดาห์ 2–4 คน — เดินไปทั่วเมือง ทำงาน เรียน กิน นอน อาบน้ำ แต่งบ้าน ลงทุน ใครใช้ชีวิตได้ดีที่สุดคือผู้ชนะ!
        </p>

        <label className="field">
          <span>ชื่อของคุณ</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="เช่น น้องมิ้นท์" autoFocus={!name} />
        </label>
        <TutorialToggle />

        <SavedGames onLoad={onLoadSave} onError={onNotice} />

        <section className="home-section">
          <h2>
            🌐 เล่นออนไลน์กับเพื่อน <span className={`pill pill-${st.tone}`}>{st.text}</span>
          </h2>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!online || !nameOk} onClick={onCreate}>
              สร้างห้องใหม่
            </button>
            <button type="button" className="btn" disabled={!online || !nameOk} onClick={onQuick}>
              ⚡ จับคู่ด่วน
            </button>
          </div>
          <form
            className="join-row"
            onSubmit={(e) => {
              e.preventDefault();
              onJoin(code.trim());
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="รหัสห้อง 5 ตัว" maxLength={5} aria-label="รหัสห้อง" />
            <button type="submit" className="btn" disabled={!online || !nameOk || code.trim().length < 5}>
              เข้าห้อง
            </button>
          </form>
          {!online && (
            <p className="muted small">
              {onlineStatus === 'connecting' ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์…' : 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — เล่นแบบออฟไลน์ได้เลย'}
            </p>
          )}
        </section>

        <section className="home-section">
          <h2>📱 เล่นบนเครื่องนี้</h2>
          <p className="muted small">เล่นกับบอท หรือผลัดกันเล่นหลายคนบนเครื่องเดียวกัน ไม่ต้องใช้อินเทอร์เน็ต</p>
          <button type="button" className="btn btn-secondary" disabled={!nameOk} onClick={onOffline}>
            เริ่มเล่นออฟไลน์
          </button>
        </section>

        <button type="button" className="link-btn" onClick={() => setShowRules((s) => !s)} aria-expanded={showRules}>
          {showRules ? 'ซ่อนวิธีเล่น ▲' : '📖 วิธีเล่น ▼'}
        </button>
        {showRules && <Rules />}
      </div>
    </div>
  );
}
