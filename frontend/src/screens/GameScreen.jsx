import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayback } from '../hooks/usePlayback.js';
import { CityMap } from '../components/CityMap.jsx';
import { PlayerList } from '../components/PlayerList.jsx';
import { TurnPanel } from '../components/TurnPanel.jsx';
import { LogPanel } from '../components/LogPanel.jsx';
import { ChatPanel } from '../components/ChatPanel.jsx';
import { EventCard, WeekendCard, Toasts } from '../components/Overlays.jsx';
import { Results } from '../components/Results.jsx';
import { Rules } from '../components/Rules.jsx';
import { SaveMenu } from '../components/SaveMenu.jsx';
import { chime } from '../lib/sound.js';
import { initials } from '../lib/game.js';

const BASE_TITLE = 'เส้นทางชีวิต — Life Simulation';
// มือถือ: แผนที่และแผงเทิร์นแสดงตลอด แท็บใช้สลับส่วนล่าง
const MOBILE_TABS = [
  ['log', '📜 บันทึก'],
  ['players', '👥 ผู้เล่น'],
  ['chat', '💬 แชท'],
];

export function GameScreen({ room, feed, chat, send, onLeave, muted, setMuted }) {
  const myIds = room.you;
  const playback = usePlayback(feed, { speed: room.options.speed, myIds });
  const { view, card, weekend, tokens, toasts, ticker, busy, deadline, turnSeconds, dismissCard, dismissWeekend } = playback;
  const [tab, setTab] = useState('log');
  const [feedTab, setFeedTab] = useState('log');
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const closeSave = useCallback(() => setShowSave(false), []);
  const [seenChat, setSeenChat] = useState(chat.length);
  const [pendingSeq, setPendingSeq] = useState(null);
  const chimed = useRef('');

  const myTurn = !!view && view.status === 'playing' && myIds.includes(view.currentPlayerId);
  const turnKey = view ? `${view.turn}:${view.currentPlayerId}` : '';

  // แจ้งเตือนเมื่อถึงตาของเรา (เสียง + ชื่อแท็บ)
  useEffect(() => {
    if (myTurn && !busy && chimed.current !== turnKey) {
      chimed.current = turnKey;
      if (!muted) chime();
    }
    document.title = myTurn ? '🔔 ตาของคุณ! — เส้นทางชีวิต' : BASE_TITLE;
  }, [myTurn, busy, turnKey, muted]);
  useEffect(
    () => () => {
      document.title = BASE_TITLE;
    },
    [],
  );

  const chatOpen = feedTab === 'chat' || tab === 'chat';
  useEffect(() => {
    if (chatOpen) setSeenChat(chat.length);
  }, [chatOpen, chat.length]);
  const unread = Math.max(0, chat.length - seenChat);

  useEffect(() => {
    if (view?.status === 'playing') setShowResults(true);
  }, [view?.status]);

  // เปลี่ยนคนเล่นแล้วล้างอาคารที่เลือกไว้
  useEffect(() => {
    setSelected(null);
  }, [turnKey]);

  const closeWeekend = useCallback(() => dismissWeekend(), [dismissWeekend]);

  if (!view) {
    return (
      <div className="loading">
        <div className="spinner-dot" />
        กำลังโหลดเกม…
      </div>
    );
  }

  // คำสั่งในเกมล็อกปุ่มไว้จนกว่าจะได้สถานะใหม่ กันกดซ้ำ
  // แนบ seq ของหน้าจอปัจจุบันไปด้วย ถ้าเกมเปลี่ยนไปแล้วเซิร์ฟเวอร์จะปฏิเสธ
  const act = async (action) => {
    if (pendingSeq === view.seq) return;
    setPendingSeq(view.seq);
    const res = await send('game:action', { action: { ...action, seq: view.seq } });
    if (!res?.ok) setPendingSeq(null);
  };
  const waiting = busy || pendingSeq === view.seq;
  const canMove = myTurn && !waiting && view.phase.type === 'week' && !room.seats.find((s) => s.id === view.currentPlayerId)?.away;

  const move = (to) => {
    setSelected(null);
    act({ type: 'move', to });
  };

  const leave = () => {
    const ask = room.offline
      ? 'ออกจากเกมนี้? เกมบันทึกไว้แล้ว กลับมาเล่นต่อได้จากหน้าแรก (💾 เล่นต่อ)'
      : 'ออกจากเกมนี้? บอทจะเล่นแทนคุณจนจบเกม';
    if (view.status !== 'playing' || window.confirm(ask)) onLeave();
  };

  const feedPanel =
    feedTab === 'chat' ? <ChatPanel chat={chat} onSend={(text) => send('chat:send', { text })} /> : <LogPanel log={view.log} players={view.players} />;

  return (
    <div className="game">
      <header className="topbar">
        <div className="brand">
          🏙️ <span>เส้นทางชีวิต</span>
        </div>
        <div className="topbar-info">
          {!room.offline && <span className="chip">ห้อง {room.code}</span>}
          <span className="chip">
            สัปดาห์ {view.week}/{view.maxWeeks}
          </span>
        </div>
        <div className="order-strip" aria-label="ลำดับการเล่น">
          {view.order.map((id, i) => {
            const p = view.players.find((x) => x.id === id);
            return (
              <span key={id} className={`order-chip${id === view.currentPlayerId ? ' is-current' : ''}`} style={{ '--pc': p.color }} title={`${i + 1}. ${p.name} (${p.score} คะแนน)`}>
                {initials(p.name)}
              </span>
            );
          })}
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => setShowRules(true)} title="วิธีเล่น" aria-label="วิธีเล่น">
            📖
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowSave(true)} title="บันทึกเกม" aria-label="บันทึกเกม">
            💾
          </button>
          <button type="button" className="icon-btn" onClick={() => setMuted((m) => !m)} title={muted ? 'เปิดเสียงแจ้งเตือน' : 'ปิดเสียงแจ้งเตือน'} aria-label="เสียงแจ้งเตือน">
            {muted ? '🔇' : '🔔'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
            ออก
          </button>
        </div>
      </header>

      <div className={`game-grid tab-${tab}`}>
        <aside className="col-left">
          <PlayerList view={view} seats={room.seats} myIds={myIds} />
        </aside>

        <main className="col-main">
          <CityMap view={view} tokens={tokens} myIds={myIds} canMove={canMove} selected={selected} onSelect={setSelected} onMove={move} />
        </main>

        <aside className="col-right">
          <TurnPanel
            view={view}
            room={room}
            myIds={myIds}
            act={act}
            busy={waiting}
            deadline={deadline}
            turnSeconds={turnSeconds}
            ticker={ticker}
            onComeBack={() => send('room:back')}
          />
          <nav className="mobile-tabs" aria-label="เมนู">
            {MOBILE_TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'is-active' : ''}
                onClick={() => {
                  setTab(id);
                  if (id === 'log' || id === 'chat') setFeedTab(id);
                }}
              >
                {label}
                {id === 'chat' && unread > 0 && <span className="badge">{unread}</span>}
              </button>
            ))}
          </nav>
          <section className="feed">
            <div className="feed-tabs">
              <button type="button" className={feedTab === 'log' ? 'is-active' : ''} onClick={() => setFeedTab('log')}>
                📜 บันทึกเหตุการณ์
              </button>
              <button type="button" className={feedTab === 'chat' ? 'is-active' : ''} onClick={() => setFeedTab('chat')}>
                💬 แชท {unread > 0 && <span className="badge">{unread}</span>}
              </button>
            </div>
            <div className="feed-body">{feedPanel}</div>
          </section>
        </aside>
      </div>

      <EventCard card={card} onClose={dismissCard} />
      <WeekendCard data={weekend} onClose={closeWeekend} />
      <Toasts toasts={toasts} />

      {view.status === 'finished' && !busy && showResults && (
        <Results view={view} myIds={myIds} isHost={room.isHost} onRematch={() => send('room:rematch')} onLeave={onLeave} onClose={() => setShowResults(false)} />
      )}
      {view.status === 'finished' && !showResults && (
        <button type="button" className="btn btn-primary results-reopen" onClick={() => setShowResults(true)}>
          🏆 ดูผลอันดับ
        </button>
      )}

      {showSave && <SaveMenu room={room} send={send} onClose={closeSave} />}

      {showRules && (
        <div className="modal-back" onClick={() => setShowRules(false)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="วิธีเล่น">
            <Rules />
            <div className="btn-row center">
              <button type="button" className="btn btn-primary" onClick={() => setShowRules(false)}>
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
