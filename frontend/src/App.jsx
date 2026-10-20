import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createOnlineConnection } from './net/online.js';
import { createOfflineConnection } from './net/offline.js';
import { useConnectionState } from './hooks/useConnectionState.js';
import { getClientId, load, save } from './lib/storage.js';
import { unfinishedAutosave, isSameSave, weekText } from './lib/saves.js';
import { Home } from './screens/Home.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { GameScreen } from './screens/GameScreen.jsx';

let onlineConnection = null;
function getOnlineConnection() {
  onlineConnection ||= createOnlineConnection(getClientId());
  return onlineConnection;
}

function readRoomParam() {
  try {
    return (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 5);
  } catch {
    return '';
  }
}

function writeRoomParam(code) {
  try {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  } catch {
    /* ไม่เป็นไร */
  }
}

export default function App() {
  const [name, setNameState] = useState(() => load('ls.name', ''));
  const [muted, setMutedState] = useState(() => !!load('ls.muted', false));
  const [notice, setNotice] = useState(null);
  const [initialCode] = useState(readRoomParam);

  const setName = (v) => {
    setNameState(v);
    save('ls.name', v);
  };
  const setMuted = (fn) =>
    setMutedState((m) => {
      const v = typeof fn === 'function' ? fn(m) : fn;
      save('ls.muted', v);
      return v;
    });

  const showNotice = useCallback((text) => setNotice({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const online = useMemo(getOnlineConnection, []);
  const [offline, setOffline] = useState(null);
  const on = useConnectionState(online, showNotice);
  const off = useConnectionState(offline, showNotice);
  const active = offline && off.room ? { conn: offline, ...off } : { conn: online, ...on };

  // เริ่มโหมดออฟไลน์: สร้างห้องใหม่ หรือโหลดเกมจากเซฟ ({ save })
  const offlineIntent = useRef(null);
  const startOffline = (intent = null) => {
    offlineIntent.current = intent;
    offline?.close();
    setOffline(createOfflineConnection());
  };

  // เกมที่เล่นค้างไว้จะถูกแทนที่ด้วยเกมใหม่/เกมที่โหลด — ถามก่อน (ยกเว้นกำลังโหลดเกมนั้นเอง)
  const confirmReplaceAutosave = (nextSave = null) => {
    const auto = unfinishedAutosave();
    if (!auto || (nextSave && isSameSave(auto.summary, nextSave))) return true;
    const who = auto.summary.players.map((p) => p.name).join(', ');
    return window.confirm(
      `มีเกมที่เล่นค้างไว้ (${weekText(auto.summary)} · ${who})\n` +
        `${nextSave ? 'ถ้าโหลดเซฟนี้' : 'ถ้าเริ่มเกมใหม่'} เกมที่ค้างไว้จะถูกแทนที่ (ถ้าอยากเก็บไว้ ให้กดยกเลิก แล้วเข้าไปบันทึกลงช่องก่อน)\n\n` +
        `${nextSave ? 'โหลดเซฟนี้เลยไหม?' : 'เริ่มเกมใหม่เลยไหม?'}`,
    );
  };

  // สร้าง/โหลดห้องออฟไลน์หลังจากเริ่มฟังข้อความแล้ว (effect ของ hook ด้านบนทำงานก่อน)
  const offlineHadRoom = useRef(false);
  useEffect(() => {
    if (!offline) return;
    offlineHadRoom.current = false;
    const intent = offlineIntent.current;
    offlineIntent.current = null;
    const req = intent?.save
      ? offline.request('room:load', { save: intent.save })
      : offline.request('room:create', { name: name.trim() || 'ผู้เล่น' });
    req.then((res) => {
      if (res.ok) return;
      showNotice(res.error);
      if (intent?.save) {
        offline.close();
        setOffline((cur) => (cur === offline ? null : cur));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);
  useEffect(() => {
    if (!offline) return;
    if (off.room) offlineHadRoom.current = true;
    else if (offlineHadRoom.current) {
      offline.close();
      setOffline(null);
    }
  }, [offline, off.room]);

  useEffect(() => {
    if (active.conn === online) writeRoomParam(on.room?.code || null);
  }, [active.conn, online, on.room?.code]);

  const send = useCallback(
    async (event, payload) => {
      const res = await active.conn.request(event, payload);
      if (res && !res.ok && res.error) showNotice(res.error);
      return res;
    },
    [active.conn, showNotice],
  );

  const onlineRequest = (event, payload) =>
    online.request(event, { name: name.trim(), ...payload }).then((res) => {
      if (!res.ok) showNotice(res.error);
    });

  let screen;
  if (!active.room) {
    screen = (
      <Home
        name={name}
        setName={setName}
        onlineStatus={on.status}
        initialCode={initialCode}
        onCreate={() => onlineRequest('room:create', { options: {} })}
        onQuick={() => onlineRequest('room:quick', {})}
        onJoin={(code) => onlineRequest('room:join', { code })}
        onOffline={() => confirmReplaceAutosave() && startOffline()}
        onLoadSave={(s) => confirmReplaceAutosave(s) && startOffline({ save: s })}
        onNotice={showNotice}
      />
    );
  } else if (active.room.status === 'lobby') {
    screen = <Lobby room={active.room} chat={active.chat} send={send} onLeave={() => send('room:leave')} />;
  } else {
    screen = (
      <GameScreen
        key={`${active.conn.kind}-${active.room.code}`}
        room={active.room}
        feed={active.feed}
        chat={active.chat}
        send={send}
        onLeave={() => send('room:leave')}
        muted={muted}
        setMuted={setMuted}
      />
    );
  }

  const reconnecting = active.room && !active.room.offline && on.status !== 'connected';

  return (
    <>
      {screen}
      {reconnecting && <div className="conn-banner">📡 การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่…</div>}
      {notice && (
        <div className="notice" role="alert" key={notice.id}>
          {notice.text}
        </div>
      )}
    </>
  );
}
