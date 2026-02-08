// src/components/StockPanel.js
import React, { useState } from 'react';

function StockPanel({ stocks, portfolio, money, onBuyStock, onSellStock }) {
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeAmount, setTradeAmount] = useState(1);
  const [tab, setTab] = useState('market'); // market, portfolio

  const calculatePortfolioValue = () => {
    if (!portfolio) return 0;
    let total = 0;
    Object.keys(portfolio).forEach(symbol => {
      const stock = stocks[symbol];
      const holding = portfolio[symbol];
      if (stock && holding) {
        total += stock.currentPrice * holding.shares;
      }
    });
    return total;
  };

  const getStockChange = (stock) => {
    if (!stock.history || stock.history.length < 2) return 0;
    const latest = stock.history[stock.history.length - 1];
    return parseFloat(latest.change);
  };

  const handleBuy = () => {
    if (selectedStock && tradeAmount > 0) {
      onBuyStock(selectedStock, tradeAmount);
      setTradeAmount(1);
    }
  };

  const handleSell = () => {
    if (selectedStock && tradeAmount > 0) {
      onSellStock(selectedStock, tradeAmount);
      setTradeAmount(1);
    }
  };

  const formatMoney = (amount) => {
    return Math.round(amount).toLocaleString();
  };

  return (
    <div className="stock-panel">
      <div className="panel-header">
        <h3>📈 ตลาดหุ้น</h3>
        <div className="portfolio-summary">
          <span>💰 เงินสด: {formatMoney(money)} บาท</span>
          <span>📊 มูลค่าพอร์ต: {formatMoney(calculatePortfolioValue())} บาท</span>
        </div>
      </div>

      <div className="tab-buttons">
        <button 
          className={tab === 'market' ? 'active' : ''}
          onClick={() => setTab('market')}
        >
          ตลาด
        </button>
        <button 
          className={tab === 'portfolio' ? 'active' : ''}
          onClick={() => setTab('portfolio')}
        >
          พอร์ตของฉัน
        </button>
      </div>

      {tab === 'market' && (
        <div className="stock-list">
          {Object.keys(stocks).map(symbol => {
            const stock = stocks[symbol];
            const change = getStockChange(stock);
            const owned = portfolio?.[symbol]?.shares || 0;

            return (
              <div 
                key={symbol}
                className={`stock-item ${selectedStock === symbol ? 'selected' : ''}`}
                onClick={() => setSelectedStock(symbol)}
              >
                <div className="stock-info">
                  <div className="stock-header">
                    <strong>{stock.symbol}</strong>
                    <span className="stock-name">{stock.name}</span>
                  </div>
                  <div className="stock-price">
                    <span className="price">{formatMoney(stock.currentPrice)} ฿</span>
                    <span className={`change ${change >= 0 ? 'positive' : 'negative'}`}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </span>
                  </div>
                  {owned > 0 && (
                    <div className="owned">ถือ: {owned} หุ้น</div>
                  )}
                </div>
                
                {/* Mini Chart */}
                {stock.history && stock.history.length > 0 && (
                  <div className="mini-chart">
                    <svg width="100%" height="30">
                      <polyline
                        points={stock.history.map((h, i) => {
                          const x = (i / (stock.history.length - 1)) * 100;
                          const minPrice = Math.min(...stock.history.map(h => h.price));
                          const maxPrice = Math.max(...stock.history.map(h => h.price));
                          const y = 25 - ((h.price - minPrice) / (maxPrice - minPrice)) * 20;
                          return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke={change >= 0 ? '#4caf50' : '#f44336'}
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'portfolio' && (
        <div className="portfolio-list">
          {portfolio && Object.keys(portfolio).length > 0 ? (
            Object.keys(portfolio).map(symbol => {
              const holding = portfolio[symbol];
              const stock = stocks[symbol];
              if (!stock) return null;

              const currentValue = stock.currentPrice * holding.shares;
              const profit = currentValue - holding.totalCost;
              const profitPercent = (profit / holding.totalCost) * 100;

              return (
                <div 
                  key={symbol}
                  className={`portfolio-item ${selectedStock === symbol ? 'selected' : ''}`}
                  onClick={() => setSelectedStock(symbol)}
                >
                  <div className="portfolio-header">
                    <strong>{stock.symbol}</strong>
                    <span>{holding.shares} หุ้น</span>
                  </div>
                  <div className="portfolio-details">
                    <div>ซื้อเฉลี่ย: {formatMoney(holding.avgBuyPrice)} ฿</div>
                    <div>ราคาตอนนี้: {formatMoney(stock.currentPrice)} ฿</div>
                    <div>มูลค่า: {formatMoney(currentValue)} ฿</div>
                    <div className={`profit ${profit >= 0 ? 'positive' : 'negative'}`}>
                      {profit >= 0 ? 'กำไร' : 'ขาดทุน'}: {formatMoney(Math.abs(profit))} ฿ 
                      ({profitPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-portfolio">
              ยังไม่มีหุ้นในพอร์ต
            </div>
          )}
        </div>
      )}

      {selectedStock && (
        <div className="trade-panel">
          <h4>ซื้อ/ขาย {stocks[selectedStock].symbol}</h4>
          
          <div className="trade-controls">
            <label>จำนวน:</label>
            <input 
              type="number" 
              min="1" 
              value={tradeAmount}
              onChange={(e) => setTradeAmount(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="trade-info">
            <div>ราคา/หุ้น: {formatMoney(stocks[selectedStock].currentPrice)} ฿</div>
            <div>ค่าซื้อทั้งหมด: {formatMoney(stocks[selectedStock].currentPrice * tradeAmount * 1.01)} ฿</div>
            <div className="fee-note">(รวมค่าธรรมเนียม 1%)</div>
          </div>

          <div className="trade-buttons">
            <button 
              className="buy-btn"
              onClick={handleBuy}
              disabled={money < stocks[selectedStock].currentPrice * tradeAmount * 1.01}
            >
              🟢 ซื้อ
            </button>
            <button 
              className="sell-btn"
              onClick={handleSell}
              disabled={!portfolio?.[selectedStock] || portfolio[selectedStock].shares < tradeAmount}
            >
              🔴 ขาย
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockPanel;
