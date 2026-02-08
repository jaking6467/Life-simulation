import React, { useState, useEffect } from 'react';
import socket from '../services/socket';

import StockPanel from '../components/StockPanel';
import CareerPanel from '../components/CareerPanel';
import BankPanel from '../components/BankPanel';
import PlayerStats from '../components/PlayerStats';
import ActionPanel from '../components/ActionPanel';
import TurnTimer from '../components/TurnTimer';
import EventLog from '../components/EventLog';
import Leaderboard from '../components/Leaderboard';
import GameOver from '../components/GameOver';

function GamePage({ playerId, username, gameData, onBackToLobby }) {

  // ===== GAME STATE =====
  const [currentDay, setCurrentDay] = useState(1);
  const [maxDays] = useState(100);
  const [timeLeft, setTimeLeft] = useState(30);
  const [myStats, setMyStats] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null);
  const [events, setEvents] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [rankings, setRankings] = useState([]);

  // ===== EXTRA SYSTEM =====
  const [stocks, setStocks] = useState({});
  const [careers, setCareers] = useState({});
  const [activePanel, setActivePanel] = useState('game');

  // ===============================
  // INITIAL LOAD + SOCKET EVENTS
  // ===============================
  useEffect(() => {
    if (!gameData) return;

    const myPlayer = gameData.players.find(p => p.id === playerId);
    setMyStats(myPlayer?.stats || null);
    setAllPlayers(gameData.players);
    
    // Load initial stocks and careers from gameData
    if (gameData.stocks) setStocks(gameData.stocks);
    if (gameData.careers) setCareers(gameData.careers);

    // ===== TURN START =====
    socket.on('turnStart', (data) => {
      console.log('Turn started:', data);
      setCurrentDay(data.day);
      setTimeLeft(Math.floor(data.timeLimit / 1000));
      setSelectedAction(null);
    });

    // ===== TURN RESULT =====
    socket.on('turnResult', (data) => {
      console.log('Turn result:', data);

      const myResult = data.playerResults.find(r => r.playerId === playerId);
      if (myResult && myResult.newStats) {
        setMyStats(myResult.newStats);
      }

      setAllPlayers(prev =>
        prev.map(player => {
          const result = data.playerResults.find(r => r.playerId === player.id);
          if (!result) return player;

          return {
            ...player,
            stats: result.newStats,
            alive: result.alive !== undefined ? result.alive : true,
            score: result.score || 0
          };
        })
      );

      // ===== EVENT LOG =====
      const newEvents = [];

      data.playerResults.forEach(result => {
        if (result.action) {
          newEvents.push({
            type: 'action',
            player: result.username,
            message: result.action.name || result.action,
            isMe: result.playerId === playerId
          });
        }

        if (result.event) {
          newEvents.push({
            type: 'event',
            player: result.username,
            message: result.event.message,
            isMe: result.playerId === playerId
          });
        }

        if (result.alive === false) {
          newEvents.push({
            type: 'death',
            player: result.username,
            message: '💀 ล้มละลาย!',
            isMe: result.playerId === playerId
          });
        }
      });

      if (data.globalEvents?.length > 0) {
        data.globalEvents.forEach(event => {
          newEvents.push({
            type: 'global',
            message: event.message
          });
        });
      }

      setEvents(prev => [...newEvents, ...prev].slice(0, 20));
    });

    // ===== GAME OVER =====
    socket.on('gameOver', (data) => {
      console.log('Game over:', data);
      setGameOver(true);
      setRankings(data.rankings || []);
    });

    // ===== ACTION SELECTED =====
    socket.on('actionSelected', (data) => {
      console.log('Action selected:', data);
      setSelectedAction(data.action);
    });

    // ===== STOCK EVENTS =====
    socket.on('stockPricesUpdate', (data) => {
      console.log('Stock prices updated:', data);
      setStocks(data);
    });

    socket.on('stockTradeResult', (data) => {
      console.log('Stock trade result:', data);
      if (data.success) {
        alert(`✅ ${data.type === 'buy' ? 'ซื้อ' : 'ขาย'}หุ้นสำเร็จ!`);
        // Request fresh stock prices
        socket.getStockPrices();
      } else {
        alert(`❌ ${data.reason || 'ทำรายการไม่สำเร็จ'}`);
      }
    });

    // ===== CAREER EVENTS =====
    socket.on('careersData', (data) => {
      console.log('Careers data:', data);
      setCareers(data);
    });

    socket.on('careerChosen', (data) => {
      console.log('Career chosen:', data);
      alert(`✅ เลือกอาชีพสำเร็จ!`);
    });

    socket.on('promotionResult', (data) => {
      console.log('Promotion result:', data);
      if (data.success) {
        alert(`🎉 เลื่อนตำแหน่งเป็น ${data.newTitle}!`);
      } else {
        alert(`❌ ${data.reason || 'ไม่สามารถเลื่อนตำแหน่งได้'}`);
      }
    });

    // ===== BANK EVENTS =====
    socket.on('bankTransactionResult', (data) => {
      console.log('Bank transaction result:', data);
      if (data.success) {
        alert(`✅ ทำรายการสำเร็จ!`);
      } else {
        alert(`❌ ${data.reason || 'ทำรายการไม่สำเร็จ'}`);
      }
    });

    // Request initial data
    socket.getStockPrices();
    socket.getCareers();

    return () => {
      socket.removeAllListeners('turnStart');
      socket.removeAllListeners('turnResult');
      socket.removeAllListeners('gameOver');
      socket.removeAllListeners('actionSelected');
      socket.removeAllListeners('stockPricesUpdate');
      socket.removeAllListeners('stockTradeResult');
      socket.removeAllListeners('careersData');
      socket.removeAllListeners('careerChosen');
      socket.removeAllListeners('promotionResult');
      socket.removeAllListeners('bankTransactionResult');
    };

  }, [gameData, playerId]);

  // ===============================
  // TIMER
  // ===============================
  useEffect(() => {
    if (timeLeft > 0 && !gameOver && !selectedAction) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameOver, selectedAction]);

  // ===============================
  // HANDLERS
  // ===============================
  const handleSelectAction = (action) => {
    console.log('Selecting action:', action);
    socket.selectAction(action);
  };

  const handleBuyStock = (symbol, shares) => {
    console.log('Buying stock:', symbol, shares);
    socket.buyStock(symbol, shares);
  };

  const handleSellStock = (symbol, shares) => {
    console.log('Selling stock:', symbol, shares);
    socket.sellStock(symbol, shares);
  };

  const handleChooseCareer = (career) => {
    console.log('Choosing career:', career);
    socket.chooseCareer(career);
  };

  const handlePromote = () => {
    console.log('Requesting promotion');
    socket.promoteCareer();
  };

  const handleDeposit = (accountType, amount) => {
    console.log('Depositing:', accountType, amount);
    socket.depositBank(accountType, amount);
  };

  const handleWithdraw = (accountType, amount) => {
    console.log('Withdrawing:', accountType, amount);
    socket.withdrawBank(accountType, amount);
  };

  // ===============================
  // GAME OVER SCREEN
  // ===============================
  if (gameOver) {
    return (
      <GameOver
        rankings={rankings}
        playerId={playerId}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  // ===============================
  // MAIN UI
  // ===============================
  return (
    <div className="game-page">

      {/* TABS */}
      <div className="game-tabs">
        <button 
          className={activePanel === 'game' ? 'active' : ''}
          onClick={() => setActivePanel('game')}
        >
          🎮 เกม
        </button>
        <button 
          className={activePanel === 'stocks' ? 'active' : ''}
          onClick={() => setActivePanel('stocks')}
        >
          📈 หุ้น
        </button>
        <button 
          className={activePanel === 'career' ? 'active' : ''}
          onClick={() => setActivePanel('career')}
        >
          💼 อาชีพ
        </button>
        <button 
          className={activePanel === 'bank' ? 'active' : ''}
          onClick={() => setActivePanel('bank')}
        >
          🏦 ธนาคาร
        </button>
      </div>

      {/* GAME PANEL */}
      {activePanel === 'game' && (
        <>
          <div className="game-header">
            <h2>🎮 Life Simulation</h2>
            <div>วันที่ {currentDay} / {maxDays}</div>
          </div>

          <div className="game-content">
            <div className="left-panel">
              <PlayerStats username={username} stats={myStats} isMe />
              <TurnTimer timeLeft={timeLeft} selectedAction={selectedAction} />
              <ActionPanel
                onSelectAction={handleSelectAction}
                selectedAction={selectedAction}
                disabled={!!selectedAction}
                stats={myStats}
              />
            </div>

            <div className="center-panel">
              <Leaderboard
                players={allPlayers}
                currentPlayerId={playerId}
              />
            </div>

            <div className="right-panel">
              <EventLog events={events} />
            </div>
          </div>
        </>
      )}

      {/* STOCK PANEL */}
      {activePanel === 'stocks' && (
        <StockPanel
          stocks={stocks}
          portfolio={myStats?.portfolio}
          money={myStats?.money || 0}
          onBuyStock={handleBuyStock}
          onSellStock={handleSellStock}
        />
      )}

      {/* CAREER PANEL */}
      {activePanel === 'career' && (
        <CareerPanel
          careers={careers}
          currentCareer={myStats?.career}
          currentLevel={myStats?.careerLevel}
          playerStats={myStats}
          onChooseCareer={handleChooseCareer}
          onPromote={handlePromote}
        />
      )}

      {/* BANK PANEL */}
      {activePanel === 'bank' && (
        <BankPanel
          bankAccounts={myStats?.bankAccounts}
          money={myStats?.money || 0}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
        />
      )}

    </div>
  );
}

export default GamePage;