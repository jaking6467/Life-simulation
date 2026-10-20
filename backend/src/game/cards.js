// cards.js — การ์ดแกล้งและการ์ดช่วยเหลือ
// ซื้อที่ตู้เกม & โรงหนัง เก็บไว้ในมือได้ 3 ใบ ใช้ได้จากทุกที่ (ไม่เสียเวลา) สัปดาห์ละ 1 ใบ
// การ์ดแกล้งมีผลตอนเริ่มตาถัดไปของเป้าหมาย เครื่องรางจากวัดกันได้ 1 ครั้งต่อ 1 อัน

import { RULES } from './rules.js';
import { addPoints, addStats, emit, log, notify, one, others, statText } from './core.js';
import { demandPrice, demandText, bumpDemand } from './market.js';

// effect: health/happiness/hygiene (เปลี่ยนค่าสถานะ), hours (เวลาสัปดาห์หน้า), wage (คูณค่าแรงสัปดาห์หน้า)
export const CARD_LIST = [
  { id: 'rumor', name: 'ปล่อยข่าวลือ', icon: '🗣️', price: 800, kind: 'prank', desc: 'เป้าหมายความสุข -12 ตอนเริ่มตาถัดไป', effect: { happiness: -12 } },
  { id: 'stink', name: 'ระเบิดเหม็น', icon: '🦨', price: 600, kind: 'prank', desc: 'เป้าหมายความสะอาด -25 ตอนเริ่มตาถัดไป', effect: { hygiene: -25 } },
  { id: 'spam', name: 'โทรขายประกันทั้งวัน', icon: '📞', price: 1000, kind: 'prank', desc: 'เป้าหมายเสียเวลา 6 ชม. ในสัปดาห์ถัดไป', effect: { hours: -6 } },
  { id: 'sabotage', name: 'จ้างคนแย่งคิวงาน', icon: '🕴️', price: 1500, kind: 'prank', desc: 'เป้าหมายได้ค่าแรง -25% ทั้งสัปดาห์ถัดไป (ต้องมีงาน)', effect: { wage: 0.75 }, needsJob: true },
  { id: 'gift', name: 'ส่งของขวัญ', icon: '🎁', price: 1000, kind: 'help', desc: 'เพื่อนความสุข +10 ทันที คุณได้ +2 คะแนนจากความใจดี', effect: { happiness: 10 }, points: 2 },
];
export const CARDS = Object.freeze(Object.fromEntries(CARD_LIST.map((c) => [c.id, c])));

const cardKey = (id) => `card:${id}`;
const cardPrice = (state, c) => demandPrice(state, cardKey(c.id), c.price);

export const cardActions = [
  {
    id: 'buyCard', icon: '🃏', group: 'การ์ดแกล้ง & ช่วยเหลือ', at: ['arcade'],
    variants: (state) =>
      CARD_LIST.map((c) => ({ params: { cardId: c.id }, label: `${c.icon} การ์ด${c.name}`, desc: `${c.desc}${demandText(state, cardKey(c.id))}`, hours: 0, cost: cardPrice(state, c) })),
    check: (state, p) => (p.cards.length >= RULES.cards.hand ? `ถือการ์ดได้สูงสุด ${RULES.cards.hand} ใบ` : null),
    run: (state, p, { cardId }) => {
      p.cards.push(cardId);
      bumpDemand(state, cardKey(cardId));
      return `ซื้อการ์ด${CARDS[cardId].name} (มี ${p.cards.length} ใบ)`;
    },
  },
  {
    id: 'buyAmulet', icon: '🧿', group: 'วัด', at: ['temple'],
    variants: (state, p) => one({ label: 'บูชาเครื่องรางกันภัย', desc: `กันการ์ดแกล้งได้ 1 ครั้ง (มี ${p.amulets}/${RULES.cards.amuletMax})`, hours: 1, cost: RULES.cards.amuletPrice }),
    check: (state, p) => (p.amulets >= RULES.cards.amuletMax ? `มีเครื่องรางครบ ${RULES.cards.amuletMax} อันแล้ว` : null),
    run: (state, p) => {
      p.amulets++;
      return `บูชาเครื่องรางกันภัย (มี ${p.amulets} อัน)`;
    },
  },
  {
    id: 'playCard', icon: '🃏', group: 'การ์ดในมือ', at: 'any',
    variants: (state, p) => {
      const list = [];
      for (const cardId of [...new Set(p.cards)]) {
        const c = CARDS[cardId];
        for (const t of others(state, p)) {
          const verb = c.kind === 'help' ? 'ให้' : 'ใส่';
          list.push({ params: { cardId, target: t.id }, label: `${c.icon} ${c.name}${verb} ${t.name}`, desc: c.desc, hours: 0, cost: 0 });
        }
      }
      return list;
    },
    check: (state, p, v) => {
      const c = CARDS[v.params.cardId];
      const t = state.players[v.params.target];
      if ((p.weekActs.playCard || 0) >= RULES.cards.perWeek) return `ใช้การ์ดได้สัปดาห์ละ ${RULES.cards.perWeek} ใบ`;
      if (c.needsJob && !t.job) return `${t.name} ยังไม่มีงานทำ`;
      if (c.kind === 'prank' && t.pending.length >= RULES.cards.maxPending) return `${t.name} โดนแกล้งรออยู่เยอะแล้ว`;
      return null;
    },
    run: (state, p, { cardId, target }) => {
      const c = CARDS[cardId];
      const t = state.players[target];
      p.cards.splice(p.cards.indexOf(cardId), 1);
      if (c.kind === 'help') {
        const d = addStats(state, t, c.effect);
        addPoints(p, c.points);
        p.c.gifts++;
        log(state, p.id, `🎁 ${p.name} ส่งของขวัญให้ ${t.name} (${statText(d)}) ได้ +${c.points} คะแนน`, 'good');
        notify(state, t.id, c.icon, `${p.name} ส่งของขวัญให้ ${t.name}!`, 'good');
        return `ส่งของขวัญให้ ${t.name} แล้ว (+${c.points} คะแนน)`;
      }
      t.pending.push({ cardId, from: p.id, fromName: p.name });
      p.c.pranks++;
      log(state, p.id, `${c.icon} ${p.name} ใช้การ์ด${c.name}ใส่ ${t.name}!`, 'bad');
      notify(state, t.id, c.icon, `${p.name} ใช้การ์ด${c.name}ใส่ ${t.name}! (มีผลตาถัดไป)`, 'bad');
      return `ใช้การ์ด${c.name}ใส่ ${t.name} (มีผลตอนเริ่มตาของเขา)`;
    },
  },
];

// เริ่มตาของผู้เล่น: การ์ดแกล้งที่รออยู่มีผล (เครื่องรางกันได้)
export function applyPendingCards(state, p) {
  if (!p.pending.length) return;
  const lines = [];
  for (const { cardId, fromName } of p.pending) {
    const c = CARDS[cardId];
    if (p.amulets > 0) {
      p.amulets--;
      lines.push(`🧿 เครื่องรางกันการ์ด${c.name}ของ ${fromName} ไว้ได้!`);
      log(state, p.id, `🧿 เครื่องรางของ ${p.name} กันการ์ด${c.name}จาก ${fromName} ได้`, 'good');
      continue;
    }
    const e = c.effect;
    const parts = [];
    const d = addStats(state, p, e);
    if (Object.keys(d).length) parts.push(statText(d));
    if (e.hours) {
      const lost = Math.min(-e.hours, Math.max(0, p.hoursLeft - 1));
      p.hoursLeft -= lost;
      p.hoursMax -= lost;
      parts.push(`เวลาสัปดาห์นี้ -${lost} ชม.`);
    }
    if (e.wage) {
      p.weekMods.wage = (p.weekMods.wage || 1) * e.wage;
      parts.push(`ค่าแรงสัปดาห์นี้ ×${e.wage}`);
    }
    p.c.pranked++;
    lines.push(`${c.icon} ${fromName} ใช้การ์ด${c.name}: ${parts.join(', ')}`);
    log(state, p.id, `${c.icon} ${p.name} โดนการ์ด${c.name}จาก ${fromName} (${parts.join(', ')})`, 'bad');
  }
  p.pending = [];
  emit(state, { type: 'event', kind: 'prank', playerId: p.id, icon: '🃏', name: 'โดนแกล้ง!', text: lines.join(' • ') });
}

export function cardPriceFor(state, cardId) {
  return cardPrice(state, CARDS[cardId]);
}
