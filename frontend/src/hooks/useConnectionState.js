import { useEffect, useMemo, useState } from 'react';
import { GameFeed } from '../lib/feed.js';

// เก็บสถานะห้อง แชท และคิวอัปเดตเกมของการเชื่อมต่อหนึ่งช่องทาง
export function useConnectionState(conn, onNotice) {
  const [status, setStatus] = useState(conn ? 'connecting' : 'idle');
  const [room, setRoom] = useState(null);
  const [chat, setChat] = useState([]);
  const [hasGame, setHasGame] = useState(false);
  const feed = useMemo(() => new GameFeed(), [conn]);

  useEffect(() => {
    setRoom(null);
    setChat([]);
    setHasGame(false);
    if (!conn) {
      setStatus('idle');
      return undefined;
    }
    const offs = [
      conn.onStatus(setStatus),
      conn.on('room', (r) => {
        setRoom(r);
        if (!r) {
          feed.reset();
          setHasGame(false);
          setChat([]);
        }
      }),
      conn.on('game', (g) => {
        if (!g) {
          feed.reset();
          setHasGame(false);
          return;
        }
        feed.push(g);
        setHasGame(true);
      }),
      conn.on('chat', (m) => setChat((list) => [...list.slice(-99), m])),
      conn.on('chatHistory', (list) => setChat(Array.isArray(list) ? list : [])),
      conn.on('notice', (n) => n?.text && onNotice?.(n.text)),
    ];
    conn.start();
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, feed]);

  return { status, room, chat, hasGame, feed };
}
