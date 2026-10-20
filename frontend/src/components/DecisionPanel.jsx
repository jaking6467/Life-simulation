import { useEffect, useRef, useState } from 'react';
import {
  AVERAGE_TILE_VALUE,
  CARDS,
  CAREERS,
  HOUSES,
  PERKS,
  RULES,
  formatMoney,
  formatShort,
  netWorth,
} from '../lib/game.js';

function Option({ icon, title, children, onClick, tone, badge, disabled }) {
  return (
    <button type="button" className={`opt${tone ? ` opt-${tone}` : ''}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="opt-icon">{icon}</span>}
      <span className="opt-body">
        <span className="opt-title">
          {title}
          {badge && <span className="chip">{badge}</span>}
        </span>
        {children && <span className="opt-desc">{children}</span>}
      </span>
    </button>
  );
}

const loansNeeded = (cash, cost) => Math.max(0, Math.ceil((cost - cash) / RULES.loanAmount));

function LoanNote({ cash, cost }) {
  const n = loansNeeded(cash, cost);
  return n > 0 ? <span className="warn-text">เงินไม่พอ ต้องกู้เพิ่ม {n} สัญญา</span> : null;
}

const CAREER_REASON = {
  start: 'เลือกอาชีพแรกของคุณ',
  graduation: '🎓 ยินดีด้วย! เลือกอาชีพสำหรับบัณฑิต',
  nightSchool: '🌙 จบปริญญาโท เลือกอาชีพใหม่ (เริ่มที่ขั้นที่ 2)',
  switch: 'เลือกงานใหม่ (เริ่มที่ขั้นแรก)',
  layoff: '📦 หางานใหม่ (เริ่มที่ขั้นแรก)',
};

export function DecisionPanel({ view, me, act }) {
  const ph = view.phase;
  const choose = (value) => act({ type: 'choose', value });

  switch (ph.type) {
    case 'chooseStart':
      return (
        <Panel title="เลือกเส้นทางชีวิต" hint="ตัดสินใจครั้งสำคัญครั้งแรก!">
          <Option icon="🎓" title="เรียนมหาวิทยาลัย" onClick={() => choose('college')}>
            กู้ค่าเทอม {RULES.collegeLoans} สัญญา (ต้องคืน {formatMoney(RULES.collegeLoans * RULES.loanRepay)}) • ได้ปริญญา เลือกอาชีพเงินเดือนสูงอย่างแพทย์ ทนาย วิศวกร • เส้นทางยาวกว่า
          </Option>
          <Option icon="💼" title="เริ่มทำงานเลย" onClick={() => choose('work')}>
            ไม่มีหนี้ • เลือกอาชีพได้ทันที (ตำรวจ เชฟ นักกีฬา ฯลฯ) • ได้เงินเดือนเร็วกว่า
          </Option>
        </Panel>
      );

    case 'chooseCareer':
      return (
        <Panel title={CAREER_REASON[ph.reason] || 'เลือกอาชีพ'} hint="อาชีพไม่ซ้ำกันในเกม และได้รับเงินเมื่อคนอื่นจ่ายค่าใช้จ่ายหมวดของอาชีพนั้น">
          {ph.options.map((id) => {
            const c = CAREERS[id];
            const level = ph.reason === 'nightSchool' ? 1 : 0;
            return (
              <Option key={id} icon={c.icon} title={c.name} badge={c.degree ? 'ต้องมีปริญญา' : null} onClick={() => choose(id)}>
                เงินเดือน {formatShort(c.salaries[level])} → {formatShort(c.salaries[c.salaries.length - 1])}
                {c.variable && ' (ผันผวน)'} • {c.titles[level]} → {c.titles[c.titles.length - 1]}
                <br />
                {PERKS[c.perk].icon} รับเงินเมื่อคนอื่นจ่ายหมวด{PERKS[c.perk].name}
                {c.note && (
                  <>
                    <br />
                    <i>{c.note}</i>
                  </>
                )}
              </Option>
            );
          })}
        </Panel>
      );

    case 'choosePath':
      return (
        <Panel title="ทางแยก! เลือกเส้นทาง" hint={`เหลืออีก ${ph.remaining} ช่องที่ต้องเดิน`}>
          {ph.options.map((o) => (
            <Option key={o.id} icon={o.icon} title={o.label} badge={`${o.length} ช่อง`} onClick={() => choose(o.id)}>
              {o.desc}
            </Option>
          ))}
        </Panel>
      );

    case 'marriage':
      return (
        <Panel title="💒 งานแต่งงาน" hint="แต่งงานแล้วจะมีลูกได้ในเส้นทางครอบครัว">
          <Option icon="💍" title="แต่งงาน" onClick={() => choose('marry')}>
            จ่ายค่างานเลี้ยง {formatMoney(RULES.weddingCost)} • ผู้เล่นทุกคนหมุนใส่ซอง {formatShort(RULES.giftTable[0][2])}–{formatShort(RULES.giftTable[2][2])} • รับบัตรความสุข 1 ใบ • ลูกมีค่าเลี้ยงดูคนละ {formatMoney(RULES.childUpkeep)} ทุกครั้งที่เงินเดือนออก
          </Option>
          <Option icon="🧍" title="ครองโสด" onClick={() => choose('single')}>
            รับ {formatMoney(RULES.singleBonus)} ทันที • ไม่มีลูก ไม่มีค่าเลี้ยงดู
          </Option>
        </Panel>
      );

    case 'buyHouse':
      return (
        <Panel title="🏠 ถึงเวลามีบ้าน" hint="ตอนเกษียณจะขายบ้านโดยหมุนวงล้อ: 1–5 ได้ราคาต่ำ, 6–10 ได้ราคาสูง">
          {ph.options.map((id) => (
            <HouseOption key={id} id={id} cash={me.cash} onClick={() => choose(id)} />
          ))}
          <Option icon="🚫" title="ยังไม่ซื้อ" tone="ghost" onClick={() => choose('skip')}>
            เก็บเงินไว้ก่อน (ซื้อได้อีกที่ช่องตลาดอสังหาฯ)
          </Option>
        </Panel>
      );

    case 'realEstate':
      return (
        <Panel title="🏘️ ตลาดอสังหาฯ" hint="ซื้อบ้านเพิ่ม หรือขายบ้านที่มีอยู่ (หมุนกำหนดราคา)">
          {ph.options.map((id) => (
            <HouseOption key={id} id={id} cash={me.cash} onClick={() => choose({ action: 'buy', houseId: id })} />
          ))}
          {me.houses.map((h) => {
            const house = HOUSES[h.id];
            return (
              <Option key={h.id} icon={house.icon} title={`ขาย${house.name}`} tone="sell" onClick={() => choose({ action: 'sell', houseId: h.id })}>
                ซื้อมา {formatMoney(h.price)} • ขายได้ {formatMoney(house.sellLow)} (1–5) หรือ {formatMoney(house.sellHigh)} (6–10)
              </Option>
            );
          })}
          <Option icon="👋" title="ผ่านไปก่อน" tone="ghost" onClick={() => choose({ action: 'skip' })} />
        </Panel>
      );

    case 'lifeBuy':
      return (
        <Panel title={`🎁 ${ph.label}`} hint={`บัตรความสุขมีมูลค่า ${formatShort(20000)}–${formatShort(100000)} (เฉลี่ยราว ${formatShort(AVERAGE_TILE_VALUE)}) เปิดเผยตอนจบเกม`}>
          <Option icon="⭐" title={`จ่าย ${formatMoney(ph.amount)} รับบัตรความสุข ${ph.count} ใบ`} onClick={() => choose('buy')}>
            <LoanNote cash={me.cash} cost={ph.amount} />
          </Option>
          <Option icon="👋" title="ไม่เป็นไร" tone="ghost" onClick={() => choose('skip')} />
        </Panel>
      );

    case 'spinToWin':
      return <SpinToWin ph={ph} me={me} choose={choose} />;

    case 'lawsuit':
      return (
        <Panel title={`⚖️ ${ph.label}`} hint={`ผู้ถูกฟ้องต้องจ่ายคุณ ${formatMoney(ph.amount)} • คุณจ่ายค่าทนาย ${formatMoney(RULES.lawsuitFee)}`}>
          {ph.targets.map((id) => {
            const q = view.players.find((p) => p.id === id);
            return (
              <Option key={id} icon={<span className="dot" style={{ background: q.color }} />} title={`ฟ้อง ${q.name}`} onClick={() => choose(id)}>
                เงินสด {formatMoney(q.cash)}
              </Option>
            );
          })}
        </Panel>
      );

    case 'nightSchool':
      return (
        <Panel title="🌙 จุดเปลี่ยนวัยกลางคน" hint="หลังจากนี้จะต้องเลือกระหว่างทางเสี่ยงกับทางปลอดภัย">
          <Option icon="🎓" title="เรียนปริญญาโทภาคค่ำ" onClick={() => choose('master')}>
            จ่าย {formatMoney(ph.cost)} • ได้ปริญญา • เลือกอาชีพใหม่ที่ต้องใช้ปริญญา เริ่มที่ขั้นที่ 2 <LoanNote cash={me.cash} cost={ph.cost} />
          </Option>
          <Option icon="🔄" title="เปลี่ยนงาน" onClick={() => choose('switch')}>
            ฟรี • เลือกงานใหม่จาก 3 อาชีพ แต่เริ่มที่ขั้นแรก
          </Option>
          <Option icon="🧘" title="ทำงานเดิมต่อ" tone="ghost" onClick={() => choose('stay')}>
            {CAREERS[me.career] ? `${CAREERS[me.career].name} เงินเดือน ${formatMoney(me.salary)}` : ''}
          </Option>
        </Panel>
      );

    case 'retire': {
      const mine = netWorth(me);
      const best = Math.max(...view.players.filter((p) => p.id !== me.id).map(netWorth));
      return (
        <Panel title="🌅 เกษียณอายุ" hint="ระบบจะขายบ้าน (หมุนกำหนดราคา) และคืนเงินกู้ให้อัตโนมัติ">
          <Option icon="🏰" title="คฤหาสน์เศรษฐี" badge="เสี่ยง" onClick={() => choose('estate')}>
            ถ้าตอนจบเกมคุณมีเงินสด (หักหนี้) มากที่สุด รับบัตรความสุข {RULES.estateTiles} ใบ ถ้าไม่ใช่ ไม่ได้อะไร
            <br />
            <span className={mine > best ? 'good-text' : 'warn-text'}>
              ตอนนี้คุณ{mine > best ? 'นำอยู่' : 'ยังตามหลัง'} (ของคุณ ≈ {formatShort(mine)} / สูงสุดของคนอื่น ≈ {formatShort(best)})
            </span>
          </Option>
          <Option icon="🌳" title="บ้านสวนชนบท" badge="ปลอดภัย" onClick={() => choose('country')}>
            รับบัตรความสุข {RULES.countryTiles} ใบทันที ใช้ชีวิตสงบสุข
          </Option>
        </Panel>
      );
    }

    case 'cardChoice': {
      const card = CARDS[ph.cardId];
      return (
        <Panel title={`${card.icon} ${card.title}`} hint={card.text}>
          {ph.options.map((o, i) => (
            <Option key={o.id} title={o.label} tone={i === ph.options.length - 1 ? 'ghost' : null} onClick={() => choose(o.id)}>
              {o.desc}
            </Option>
          ))}
        </Panel>
      );
    }

    default:
      return null;
  }
}

function Panel({ title, hint, children }) {
  const ref = useRef(null);
  // เลื่อนให้เห็นตัวเลือกทันทีที่ถึงเวลาตัดสินใจ
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [title]);
  return (
    <div className="decision" ref={ref}>
      <h3>{title}</h3>
      {hint && <p className="decision-hint">{hint}</p>}
      <div className="opts">{children}</div>
    </div>
  );
}

function HouseOption({ id, cash, onClick }) {
  const h = HOUSES[id];
  return (
    <Option icon={h.icon} title={`${h.name} — ${formatMoney(h.price)}`} onClick={onClick}>
      ขายได้ {formatMoney(h.sellLow)} (1–5) หรือ {formatMoney(h.sellHigh)} (6–10) <LoanNote cash={cash} cost={h.price} />
    </Option>
  );
}

function SpinToWin({ ph, me, choose }) {
  const [picked, setPicked] = useState([]);
  const toggle = (n) =>
    setPicked((list) => (list.includes(n) ? list.filter((x) => x !== n) : list.length < ph.maxNumbers ? [...list, n] : list));
  return (
    <Panel title={`🎡 ${ph.label}`} hint={`เลือกเลขได้สูงสุด ${ph.maxNumbers} ตัว ตัวละ ${formatMoney(ph.cost)} ถ้าวงล้อออกเลขที่เลือก รับ ${formatMoney(ph.prize)}`}>
      <div className="num-grid">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`num${picked.includes(n) ? ' is-on' : ''}`} onClick={() => toggle(n)} aria-pressed={picked.includes(n)}>
            {n}
          </button>
        ))}
      </div>
      <Option icon="🎯" title={picked.length ? `ซื้อเลข ${[...picked].sort((a, b) => a - b).join(', ')} (${formatMoney(picked.length * ph.cost)})` : 'เลือกเลขก่อน'} disabled={!picked.length} onClick={() => choose(picked)}>
        <LoanNote cash={me.cash} cost={picked.length * ph.cost} />
      </Option>
      <Option icon="👋" title="ไม่ร่วมลุ้น" tone="ghost" onClick={() => choose([])} />
    </Panel>
  );
}
