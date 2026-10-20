import { useState } from 'react';
import { INSURANCE, RULES, formatMoney } from '../lib/game.js';

// จัดการการเงินก่อนหมุน: เงินกู้ ประกัน และใบหุ้น
export function FinancePanel({ view, me, act }) {
  const [open, setOpen] = useState(false);
  const [stockPick, setStockPick] = useState(null);
  const owners = Object.fromEntries(view.players.map((p) => [p.id, p]));

  return (
    <div className={`finance${open ? ' is-open' : ''}`}>
      <button type="button" className="finance-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>💼 จัดการการเงินก่อนหมุน</span>
        <span className="finance-summary">
          หนี้ {me.loans} • ประกัน {Object.values(me.insurance).filter(Boolean).length}/3 • หุ้น {me.stocks.length}
        </span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="finance-body">
          <section>
            <h4>🏦 เงินกู้ธนาคาร</h4>
            <p className="muted">กู้สัญญาละ {formatMoney(RULES.loanAmount)} คืน {formatMoney(RULES.loanRepay)} • หนี้ที่เหลือจะถูกหักตอนจบเกม</p>
            <div className="btn-row">
              <button type="button" className="btn btn-sm" onClick={() => act({ type: 'takeLoan', count: 1 })}>
                กู้ +{formatMoney(RULES.loanAmount)}
              </button>
              <button type="button" className="btn btn-sm" disabled={!me.loans || me.cash < RULES.loanRepay} onClick={() => act({ type: 'repayLoan', count: 1 })}>
                คืน 1 สัญญา (-{formatMoney(RULES.loanRepay)})
              </button>
            </div>
          </section>

          <section>
            <h4>🛡️ ประกัน <small className="muted">ซื้อครั้งเดียว คุ้มครองตลอดเกม</small></h4>
            {Object.values(INSURANCE).map((ins) => {
              const owned = me.insurance[ins.id];
              const needHouse = ins.id === 'home' && !me.houses.length;
              return (
                <div key={ins.id} className="ins-row">
                  <span className="ins-icon">{ins.icon}</span>
                  <span className="grow">
                    <b>{ins.name}</b>
                    <small className="muted"> คุ้มครอง{ins.covers}</small>
                  </span>
                  {owned ? (
                    <span className="chip chip-good">มีแล้ว ✓</span>
                  ) : (
                    <button type="button" className="btn btn-sm" disabled={needHouse || me.cash < ins.price} onClick={() => act({ type: 'buyInsurance', kind: ins.id })}>
                      {needHouse ? 'ต้องมีบ้าน' : formatMoney(ins.price)}
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <h4>📈 ใบหุ้น <small className="muted">ใบละ {formatMoney(RULES.stockPrice)} (สูงสุด {RULES.maxStocks} ใบ)</small></h4>
            <p className="muted">ทุกครั้งที่ใครก็ตามหมุนเดินได้เลขของใบหุ้น คุณรับปันผล {formatMoney(RULES.stockPayout)}</p>
            <div className="stock-grid">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const owner = owners[view.stockOwners[n]];
                return (
                  <button
                    key={n}
                    type="button"
                    className={`stock${owner ? ' is-owned' : ''}${owner?.id === me.id ? ' is-mine' : ''}${stockPick === n ? ' is-picked' : ''}`}
                    style={owner ? { '--owner': owner.color } : undefined}
                    disabled={!!owner || me.stocks.length >= RULES.maxStocks}
                    title={owner ? `เจ้าของ: ${owner.name}` : 'ว่าง'}
                    onClick={() => setStockPick(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {stockPick && !view.stockOwners[stockPick] && (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={me.cash < RULES.stockPrice}
                  onClick={() => {
                    act({ type: 'buyStock', number: stockPick });
                    setStockPick(null);
                  }}
                >
                  ซื้อหุ้นเลข {stockPick} ({formatMoney(RULES.stockPrice)})
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setStockPick(null)}>
                  ยกเลิก
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
