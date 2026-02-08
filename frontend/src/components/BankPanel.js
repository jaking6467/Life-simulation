// src/components/BankPanel.js
import React, { useState } from 'react';

function BankPanel({ bankAccounts, money, onDeposit, onWithdraw }) {
  const [activeAccount, setActiveAccount] = useState('SAVINGS');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('deposit'); // deposit, withdraw

  const accountTypes = {
    SAVINGS: {
      name: "บัญชีออมทรัพย์",
      icon: "🏦",
      interestRate: 1,
      description: "ดอกเบี้ย 1% ต่อสัปดาห์",
      withdrawFee: 10
    },
    FIXED: {
      name: "บัญชีฝากประจำ",
      icon: "💎",
      interestRate: 3,
      description: "ดอกเบี้ย 3% ต่อสัปดาห์ (ล็อค 28 วัน)",
      lockPeriod: 28
    },
    CURRENT: {
      name: "บัญชีกระแสรายวัน",
      icon: "💳",
      interestRate: 0,
      description: "ไม่มีดอกเบี้ย, ถอนได้ไม่จำกัด",
      monthlyFee: 50
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('กรุณาใส่จำนวนเงินที่ถูกต้อง');
      return;
    }

    if (action === 'deposit') {
      onDeposit(activeAccount, amountNum);
    } else {
      onWithdraw(activeAccount, amountNum);
    }
    
    setAmount('');
  };

  const getTotalBalance = () => {
    if (!bankAccounts) return 0;
    return Object.values(bankAccounts).reduce((sum, acc) => sum + (acc.balance || 0), 0);
  };

  const formatMoney = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return Math.round(num).toLocaleString();
  };

  const currentAccount = bankAccounts?.[activeAccount] || { balance: 0, interestEarned: 0 };
  const accountInfo = accountTypes[activeAccount];

  return (
    <div className="bank-panel">
      <div className="panel-header">
        <h3>🏦 ธนาคาร</h3>
        <div className="total-summary">
          <div>💰 เงินสด: {formatMoney(money)} ฿</div>
          <div>🏦 เงินฝากทั้งหมด: {formatMoney(getTotalBalance())} ฿</div>
        </div>
      </div>

      {/* Account Selection */}
      <div className="account-tabs">
        {Object.keys(accountTypes).map(type => (
          <button
            key={type}
            className={`account-tab ${activeAccount === type ? 'active' : ''}`}
            onClick={() => setActiveAccount(type)}
          >
            <span className="icon">{accountTypes[type].icon}</span>
            <span className="name">{accountTypes[type].name}</span>
            <span className="balance">{formatMoney(bankAccounts?.[type]?.balance || 0)} ฿</span>
          </button>
        ))}
      </div>

      {/* Account Details */}
      <div className="account-details">
        <h4>{accountInfo.icon} {accountInfo.name}</h4>
        <p className="description">{accountInfo.description}</p>
        
        <div className="account-stats">
          <div className="stat-row">
            <span>ยอดคงเหลือ:</span>
            <strong>{formatMoney(currentAccount.balance)} ฿</strong>
          </div>
          
          {activeAccount !== 'CURRENT' && (
            <div className="stat-row">
              <span>ดอกเบี้ยที่ได้รับ:</span>
              <strong className="interest">{formatMoney(currentAccount.interestEarned || 0)} ฿</strong>
            </div>
          )}
          
          {accountInfo.withdrawFee && (
            <div className="stat-row fee-info">
              <span>ค่าธรรมเนียมถอน:</span>
              <span>{accountInfo.withdrawFee} ฿/ครั้ง</span>
            </div>
          )}
          
          {accountInfo.monthlyFee && (
            <div className="stat-row fee-info">
              <span>ค่าบำรุงรายเดือน:</span>
              <span>{accountInfo.monthlyFee} ฿</span>
            </div>
          )}
          
          {activeAccount === 'FIXED' && currentAccount.lockDate && (
            <div className="stat-row warning">
              <span>⚠️ หมายเหตุ:</span>
              <span>ถอนก่อนกำหนดปรับ 50% ของดอกเบี้ย</span>
            </div>
          )}
        </div>

        <div className="interest-calculator">
          <h5>📊 คำนวณดอกเบี้ย</h5>
          {accountInfo.interestRate > 0 ? (
            <div className="calculator">
              <p>
                ถ้าฝาก <strong>1,000 ฿</strong> จะได้ดอกเบี้ย <strong>{accountInfo.interestRate * 10} ฿</strong> ต่อสัปดาห์
              </p>
              <p>
                ถ้าฝาก <strong>10,000 ฿</strong> จะได้ดอกเบี้ย <strong>{accountInfo.interestRate * 100} ฿</strong> ต่อสัปดาห์
              </p>
            </div>
          ) : (
            <p>บัญชีนี้ไม่มีดอกเบี้ย</p>
          )}
        </div>
      </div>

      {/* Transaction Form */}
      <div className="transaction-form">
        <div className="action-tabs">
          <button
            className={`action-tab ${action === 'deposit' ? 'active' : ''}`}
            onClick={() => setAction('deposit')}
          >
            ฝากเงิน
          </button>
          <button
            className={`action-tab ${action === 'withdraw' ? 'active' : ''}`}
            onClick={() => setAction('withdraw')}
          >
            ถอนเงิน
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>จำนวนเงิน:</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ใส่จำนวนเงิน"
              min="1"
              step="1"
            />
          </div>

          <div className="quick-amounts">
            <button type="button" onClick={() => setAmount('100')}>+100</button>
            <button type="button" onClick={() => setAmount('500')}>+500</button>
            <button type="button" onClick={() => setAmount('1000')}>+1000</button>
            <button type="button" onClick={() => setAmount('5000')}>+5000</button>
            {action === 'deposit' && money > 0 && (
              <button type="button" onClick={() => setAmount((money || 0).toString())}>ทั้งหมด</button>
            )}
            {action === 'withdraw' && currentAccount.balance > 0 && (
              <button type="button" onClick={() => setAmount(currentAccount.balance.toString())}>ทั้งหมด</button>
            )}
          </div>

          {action === 'deposit' && amount && (
            <div className="transaction-preview">
              <p>จะฝากเงิน: <strong>{formatMoney(parseFloat(amount))} ฿</strong></p>
              <p>เงินสดคงเหลือ: <strong>{formatMoney(money - parseFloat(amount))} ฿</strong></p>
            </div>
          )}

          {action === 'withdraw' && amount && (
            <div className="transaction-preview">
              <p>จะถอนเงิน: <strong>{formatMoney(parseFloat(amount))} ฿</strong></p>
              {accountInfo.withdrawFee && (
                <p className="fee">ค่าธรรมเนียม: <strong>{accountInfo.withdrawFee} ฿</strong></p>
              )}
              <p>จะได้รับ: <strong>{formatMoney(parseFloat(amount))} ฿</strong></p>
            </div>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              (action === 'deposit' && parseFloat(amount) > (money || 0)) ||
              (action === 'withdraw' && parseFloat(amount) > currentAccount.balance)
            }
          >
            {action === 'deposit' ? '💰 ฝากเงิน' : '💸 ถอนเงิน'}
          </button>
        </form>
      </div>

      {/* Tips */}
      <div className="bank-tips">
        <h5>💡 เคล็ดลับ</h5>
        <ul>
          <li>บัญชีออมทรัพย์เหมาะกับเก็บเงินระยะสั้น</li>
          <li>บัญชีฝากประจำให้ดอกเบี้ยสูง แต่ล็อคเงิน 28 วัน</li>
          <li>ดอกเบี้ยจ่ายทุก 7 วัน (ทุกวันอาทิตย์)</li>
          <li>เก็บเงินไว้ในธนาคารเพื่อป้องกันโดนโกงหรือเหตุการณ์ไม่คาดฝัน</li>
        </ul>
      </div>
    </div>
  );
}

export default BankPanel;