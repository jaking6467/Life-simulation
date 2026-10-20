import { useEffect, useRef, useState } from 'react';
import { TIMING, formatMoney } from '../lib/game.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let keySeq = 0;

// เล่นแอนิเมชันของแต่ละอัปเดต (หมุนวงล้อ → เดินทีละช่อง → เปิดการ์ด) แล้วค่อยแสดงสถานะใหม่
// ถ้าอัปเดตค้างในคิวหลายอัน (เช่นสลับแท็บไปนาน) จะเล่นเร็วขึ้นเพื่อตามให้ทัน
export function usePlayback(feed, { speed = 1, myIds = [] } = {}) {
  const [snapshot, setSnapshot] = useState(() => toSnapshot(feed.latest));
  const [spin, setSpin] = useState(null);
  const [card, setCard] = useState(null);
  const [tokens, setTokens] = useState({});
  const [toasts, setToasts] = useState([]);
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
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3200);
    };

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
          case 'spin':
            setSpin({ key: ++keySeq, ...ev, name: names[ev.playerId] });
            await sleep((ev.purpose === 'move' ? TIMING.spin : TIMING.subSpin) * factor);
            break;
          case 'move':
            for (const spaceId of ev.path) {
              if (cancelled) return;
              setTokens((t) => ({ ...t, [ev.playerId]: spaceId }));
              await sleep(TIMING.step * factor);
            }
            break;
          case 'card':
            setCard({ key: ++keySeq, ...ev, name: names[ev.playerId] });
            await sleep(TIMING.card * factor);
            setCard(null);
            break;
          case 'retire':
            await sleep(TIMING.retire * factor);
            break;
          case 'money':
            if (mine) toast(`${ev.amount > 0 ? '+' : ''}${formatMoney(ev.amount)} · ${ev.reason}`, ev.amount > 0 ? 'good' : 'bad');
            break;
          case 'life':
            if (mine) toast(`⭐ ได้บัตรความสุข ${ev.count} ใบ`, 'good');
            break;
          case 'insured':
            if (mine) toast('🛡️ ประกันจ่ายแทนให้แล้ว!', 'good');
            break;
          case 'loan':
            if (mine && ev.auto) toast(`🏦 กู้ธนาคารอัตโนมัติ ${ev.count} สัญญา`, 'bad');
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

  return { ...snapshot, spin, card, tokens, toasts, busy, dismissCard: () => setCard(null) };
}

function toSnapshot(u) {
  if (!u) return { view: null, deadline: null, turnSeconds: 0 };
  return {
    view: u.view,
    deadline: u.deadlineIn != null ? u.receivedAt + u.deadlineIn : null,
    turnSeconds: u.turnSeconds || 0,
  };
}
