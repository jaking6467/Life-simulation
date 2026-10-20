import { useEffect, useState } from 'react';
import { evaluateCoach, loadTutorial, saveTutorial, setTutorialEnabled } from '../lib/coach.js';
import '../styles/tutorial.css';

// ผู้ช่วยมือใหม่: เก็บการตั้งค่า/ความคืบหน้า แล้วคำนวณคำแนะนำของผู้เล่นที่กำลังเล่น (ที่นั่งของเรา)
// คืน highlight (อาคารบนแผนที่) และ highlightAction (ปุ่มกิจกรรม) ให้ GameScreen ส่งต่อ
export function useCoach({ view, room, myIds }) {
  const gameId = `${room?.offline ? 'off' : 'on'}:${room?.code || ''}`;
  const [settings, setSettings] = useState(() => {
    const s = loadTutorial();
    // autoOff: เพิ่งเรียนจบในเกมนี้ → เกมถัดไปปิดเอง แต่เกมนี้ยังเปิดอยู่
    return { ...s, autoOff: false, idleTurn: null, game: s.game?.id === gameId ? s.game : { id: gameId, seats: {} } };
  });
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    saveTutorial({ ...settings, enabled: settings.autoOff ? false : settings.enabled });
  }, [settings]);

  const current = view?.players?.find((p) => p.id === view.currentPlayerId) || null;
  const me = current && myIds.includes(current.id) ? current : null;
  const away = !!(me && room?.seats?.find((s) => s.id === me.id)?.away);
  const phase = view?.phase?.type;
  const active = !!(settings.enabled && me && view.status === 'playing' && (phase === 'week' || phase === 'choice') && !away);
  const stored = me ? settings.game.seats[me.id] : null;
  const seat = stored || (me ? { steps: {}, startWeek: view.week, finished: !!settings.done } : null);

  let guide = null;
  if (active) {
    try {
      guide = evaluateCoach({ view, me, seat, dismissedTips: settings.dismissedTips, hidden, showIdle: settings.idleTurn === view.turn });
    } catch (err) {
      console.warn('coach', err);
      guide = null;
    }
  }

  // จำขั้นที่ทำสำเร็จแล้ว (ถาวรต่อผู้เล่น) และสถานะเรียนจบ
  const seatId = me?.id;
  const needCreate = !!guide && !stored;
  const autoDone = guide?.autoDone || [];
  const finishing = !!guide?.allDone && !seat?.finished;
  const syncKey = guide ? `${seatId}|${needCreate}|${autoDone.join(',')}|${finishing}|${view.turn}` : '';
  useEffect(() => {
    if (!syncKey || (!needCreate && !autoDone.length && !finishing)) return;
    const turn = view.turn;
    setSettings((s) => {
      const prev = s.game.seats[seatId] || seat;
      const next = { ...prev, steps: { ...prev.steps } };
      for (const id of autoDone) next.steps[id] = true;
      let { done, autoOff } = s;
      if (finishing && !prev.finished) {
        next.finished = true;
        next.finishedTurn = turn;
        if (!s.done) {
          done = true;
          autoOff = true;
        }
      }
      return { ...s, done, autoOff, game: { ...s.game, seats: { ...s.game.seats, [seatId]: next } } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const updateSeat = (fn) => {
    if (!seatId) return;
    setSettings((s) => {
      const prev = s.game.seats[seatId] || seat;
      return { ...s, game: { ...s.game, seats: { ...s.game.seats, [seatId]: fn(prev) } } };
    });
  };
  const turn = view?.turn;

  return {
    enabled: !!settings.enabled,
    guide,
    seatName: myIds.length > 1 && me ? me.name : null,
    collapsed: !!settings.collapsed,
    highlight: guide?.highlight || null,
    highlightAction: guide?.highlightAction || null,
    toggle: () => setSettings((s) => ({ ...s, enabled: !s.enabled, autoOff: false, idleTurn: s.enabled ? null : turn })),
    toggleCollapsed: () => setSettings((s) => ({ ...s, collapsed: !s.collapsed })),
    next: () => updateSeat((p) => ({ ...p, steps: { ...p.steps, welcome: true } })),
    skipStep: (id) => updateSeat((p) => ({ ...p, steps: { ...p.steps, [id]: true } })),
    restart: () => updateSeat(() => ({ steps: {}, startWeek: view.week, finished: false })),
    // ปิดคำแนะนำ = นับว่าข้ามพื้นฐานแล้ว (เปิดใหม่ได้ที่ปุ่ม 🧭)
    close: () => {
      setSettings((s) => ({ ...s, enabled: false, autoOff: false, done: true }));
      updateSeat((p) => ({ ...p, finishSeen: true }));
    },
    keepTips: () => {
      setSettings((s) => ({ ...s, enabled: true, autoOff: false }));
      updateSeat((p) => ({ ...p, finishSeen: true }));
    },
    hideTip: (id) => setHidden((h) => ({ ...h, [`${turn}:${id}`]: true })),
    dismissAdv: (id) => {
      setSettings((s) => ({ ...s, dismissedTips: [...new Set([...s.dismissedTips, id])] }));
      setHidden((h) => ({ ...h, [`${turn}:adv`]: true }));
    },
  };
}

function scrollToAction() {
  const el = document.querySelector('.act-btn.is-coach, .btn-end.is-coach');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function GoButton({ item, canMove, busy, onMove, primary = true }) {
  if (!item?.go) return null;
  const { id, hours, ok } = item.go;
  return (
    <button type="button" className={`btn btn-sm ${primary ? 'btn-primary' : 'coach-go-mini'}`} disabled={!canMove || busy || !ok} onClick={() => onMove(id)}>
      {primary ? 'พาไปเลย' : 'ไป'} · {hours} ชม.
    </button>
  );
}

// การ์ดผู้ช่วย วางไว้เหนือแผงเทิร์น (มือถือ: อยู่ใต้แผนที่ ไม่บังแผนที่หรือปุ่มกิจกรรม)
export function Coach({ coach, canMove, busy, onMove }) {
  const g = coach?.guide;
  if (!g) return null;
  const { step, tip, adv, finish, idle } = g;
  if (!step && !tip && !adv && !finish && !idle) return null;

  const steps = g.mode === 'steps' && !finish;
  const collapsed = coach.collapsed;
  const kicker = steps ? (g.stepNo ? `ขั้นที่ ${g.stepNo}/${g.total}` : 'ผู้ช่วยมือใหม่') : finish ? 'เรียนจบแล้ว!' : 'เคล็ดลับ';
  const peek = finish ? 'คุณรู้พื้นฐานครบแล้ว' : step?.title || (tip ? tip.text : adv ? `${adv.icon} ${adv.title}` : 'ทุกอย่างเรียบร้อยดี');
  const showGo = (item) => item?.go && !item.lowTime;
  const actHere = coach.highlightAction && (step?.here || step?.action?.action === 'endTurn');

  return (
    <section className={`coach${collapsed ? ' is-collapsed' : ''}${busy ? ' is-busy' : ''}`} aria-label="ผู้ช่วยมือใหม่" aria-live="polite">
      <div className="coach-head">
        <button type="button" className="coach-headbtn" onClick={coach.toggleCollapsed} aria-expanded={!collapsed} title={collapsed ? 'ขยายคำแนะนำ' : 'ย่อคำแนะนำ'}>
          <span className="coach-logo" aria-hidden="true">
            🧭
          </span>
          <span className="coach-kicker">
            {coach.seatName ? `${coach.seatName} · ` : ''}
            {kicker}
          </span>
          {steps && g.dots.length > 0 && (
            <span className="coach-dots" aria-hidden="true">
              {g.dots.map((d) => (
                <span key={d.id} className={`coach-dot${d.done ? ' is-done' : ''}${d.current ? ' is-current' : ''}`} />
              ))}
            </span>
          )}
          {collapsed && <span className="coach-peek">{peek}</span>}
          <span className="coach-chev" aria-hidden="true">
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
        <button type="button" className="coach-x" onClick={coach.close} aria-label="ปิดคำแนะนำ" title="ปิดคำแนะนำ (เปิดใหม่ได้ที่เมนู ⋯)">
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="coach-body">
          {finish && (
            <div className="coach-step coach-finish">
              <span className="coach-step-icon" aria-hidden="true">
                🎉
              </span>
              <div className="coach-step-main">
                <b className="coach-step-title">เก่งมาก! รู้พื้นฐานครบแล้ว</b>
                <p className="coach-text">จำไว้: กินทุกสัปดาห์ · อาบน้ำ · ทำงานเก็บเงิน · เรียนเพิ่มวุฒิ · ฝากเงินกันขโมย</p>
                <p className="coach-why">อยากให้ผู้ช่วยคอยเตือนเรื่องสำคัญและบอกเคล็ดลับขั้นสูงต่อไหม?</p>
                <div className="coach-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={coach.keepTips}>
                    เปิดเคล็ดลับไว้
                  </button>
                  <button type="button" className="btn btn-sm" onClick={coach.close}>
                    ปิดคำแนะนำ
                  </button>
                </div>
              </div>
            </div>
          )}

          {step && (
            <div className={`coach-step${step.lowTime ? ' is-low' : ''}`}>
              <span className="coach-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <div className="coach-step-main">
                <b className="coach-step-title">{step.title}</b>
                <p className="coach-text">{step.text}</p>
                {step.note && <p className="coach-note">{step.note}</p>}
                {step.why && <p className="coach-why">{step.why}</p>}
                <div className="coach-actions">
                  {step.next && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={coach.next}>
                      เข้าใจแล้ว
                    </button>
                  )}
                  {showGo(step) && <GoButton item={step} canMove={canMove} busy={busy} onMove={onMove} />}
                  {actHere && (
                    <button type="button" className="btn btn-sm" onClick={scrollToAction}>
                      ดูปุ่ม
                    </button>
                  )}
                  {step.id !== 'choice' && !step.next && !step.lowTime && (
                    <button type="button" className="link-btn coach-skip" onClick={() => coach.skipStep(step.id)}>
                      ข้ามขั้นนี้
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tip && (
            <div className={`coach-tip tone-${tip.tone}`} role={tip.tone === 'bad' ? 'alert' : undefined}>
              <span className="coach-tip-icon" aria-hidden="true">
                {tip.icon}
              </span>
              <span className="coach-tip-text">{tip.text}</span>
              {showGo(tip) && <GoButton item={tip} canMove={canMove} busy={busy} onMove={onMove} primary={false} />}
              <button type="button" className="coach-tip-x" onClick={() => coach.hideTip(tip.id)} aria-label="ซ่อนเคล็ดลับนี้" title="ซ่อนในตานี้">
                ✕
              </button>
            </div>
          )}

          {adv && (
            <div className="coach-adv">
              <div className="coach-adv-head">
                <span className="coach-adv-tag">ขั้นสูง</span>
                <b>
                  {adv.icon} {adv.title}
                </b>
              </div>
              <p className="coach-text">{adv.text}</p>
              <div className="coach-actions">
                {showGo(adv) && <GoButton item={adv} canMove={canMove} busy={busy} onMove={onMove} primary={false} />}
                <button type="button" className="link-btn coach-skip" onClick={() => coach.dismissAdv(adv.id)}>
                  รู้แล้ว ไม่ต้องบอกอีก
                </button>
              </div>
            </div>
          )}

          {idle && (
            <p className="coach-idle">
              {!tip && !adv && <>ผู้ช่วยเปิดอยู่ จะเตือนเมื่อมีเรื่องสำคัญ · </>}
              <button type="button" className="link-btn" onClick={coach.restart}>
                สอนพื้นฐานใหม่
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// สวิตช์ในหน้าแรก
export function TutorialToggle() {
  const [on, setOn] = useState(() => loadTutorial().enabled);
  return (
    <label className="coach-switch">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          setTutorialEnabled(e.target.checked);
        }}
      />
      <span>
        เปิดคำแนะนำสำหรับมือใหม่
        <small>สอนทีละขั้นในเกม: กิน หางาน ทำงาน อาบน้ำ เรียน</small>
      </span>
    </label>
  );
}
