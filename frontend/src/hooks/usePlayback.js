import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMING } from '../lib/game.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let keySeq = 0;

// เล่นแอนิเมชันของแต่ละอัปเดต (เดินผ่านอาคารทีละหลัง → ทำกิจกรรม → การ์ดเหตุการณ์ → สรุปสุดสัปดาห์)
// แล้วค่อยแสดงสถานะใหม่ ถ้าอัปเดตค้างในคิวหลายอัน (เช่นสลับแท็บไปนาน) จะเล่นเร็วขึ้นเพื่อตามให้ทัน
export function usePlayback(feed, { speed = 1, myIds = [] } = {}) {
  const [snapshot, setSnapshot] = useState(() => toSnapshot(feed.latest));
  const [card, setCard] = useState(null);
  const [weekend, setWeekend] = useState(null);
  const [tokens, setTokens] = useState({});
  const [toasts, setToasts] = useState([]);
  const [ticker, setTicker] = useState([]);
  const [busy, setBusy] = useState(false);
  const speedRef = useRef(speed);
  const mineRef = useRef(myIds);
  speedRef.current = speed;
  mineRef.current = myIds;

  useEffect(() => {
    let cancelled = false;
    let running = false;

    const toast = (text, tone) => {
      const id = ++keySeq;
      setToasts((list) => [...list.slice(-3), { id, text, tone }]);
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
    };
    const tick = (playerId, text) => setTicker((list) => [...list.slice(-5), { id: ++keySeq, playerId, text }]);

    const apply = (u) => {
      setSnapshot(toSnapshot(u));
      setTokens({});
    };

    async function play(u) {
      const factor = (feed.queue.length > 1 ? 0.2 : 1) / (speedRef.current || 1);
      const names = Object.fromEntries((u.view.players || []).map((p) => [p.id, p.name]));
      for (const ev of u.events) {
        if (cancelled) return;
        const mine = mineRef.current.includes(ev.playerId);
        switch (ev.type) {
          case 'move':
            for (const loc of ev.path) {
              if (cancelled) return;
              setTokens((t) => ({ ...t, [ev.playerId]: loc }));
              await sleep(TIMING.step * factor);
            }
            break;
          case 'action':
            tick(ev.playerId, ev.text);
            if (mine) toast(ev.text, 'info');
            await sleep(TIMING.action * factor);
            break;
          case 'event':
          case 'globalEvent':
            setCard({ key: ++keySeq, ...ev, name: ev.name, who: names[ev.playerId] || null });
            await sleep(TIMING.card * factor);
            setCard(null);
            break;
          case 'weekend':
            tick(ev.playerId, `จบสัปดาห์ที่ ${ev.week} ได้ ${ev.points} คะแนน`);
            if (mine) setWeekend({ key: ++keySeq, ...ev, who: names[ev.playerId] });
            await sleep(TIMING.weekend * factor);
            break;
          case 'quest':
            toast(`🏅 ${names[ev.playerId]} ทำภารกิจสำเร็จ +${ev.points} คะแนน`, 'good');
            break;
          case 'lottery':
            toast(`🎟️ ผลลอตเตอรี่: ${ev.text}`, 'info');
            break;
          default:
            break;
        }
      }
      await sleep(TIMING.base * factor);
    }

    async function run() {
      if (running) return;
      running = true;
      while (!cancelled && feed.queue.length) {
        const u = feed.queue.shift();
        if (u.full || !u.events?.length) {
          apply(u);
          continue;
        }
        setBusy(true);
        await play(u);
        if (cancelled) break;
        apply(u);
      }
      if (!cancelled) {
        setBusy(false);
        if (!feed.latest) setSnapshot(toSnapshot(null));
      }
      running = false;
    }

    const unsubscribe = feed.subscribe(run);
    run();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [feed]);

  const dismissCard = useCallback(() => setCard(null), []);
  const dismissWeekend = useCallback(() => setWeekend(null), []);
  return { ...snapshot, card, weekend, tokens, toasts, ticker, busy, dismissCard, dismissWeekend };
}

function toSnapshot(u) {
  if (!u) return { view: null, deadline: null, turnSeconds: 0 };
  return {
    view: u.view,
    deadline: u.deadlineIn != null ? u.receivedAt + u.deadlineIn : null,
    turnSeconds: u.turnSeconds || 0,
  };
}
