// src/components/TurnTimer.js
import React from 'react';

function TurnTimer({ timeLeft, selectedAction }) {
  const getTimerColor = () => {
    if (timeLeft <= 5) return '#ff4444';
    if (timeLeft <= 10) return '#ff9800';
    return '#4caf50';
  };

  const percentage = (timeLeft / 30) * 100;

  return (
    <div className="turn-timer">
      <div className="timer-label">
        {selectedAction ? '✅ รอผู้เล่นอื่น...' : '⏰ เวลาคิด'}
      </div>
      
      <div className="timer-display">
        <div 
          className="timer-circle"
          style={{
            background: `conic-gradient(${getTimerColor()} ${percentage}%, #ddd ${percentage}%)`
          }}
        >
          <div className="timer-inner">
            <span className="timer-number">{timeLeft}</span>
            <span className="timer-unit">วินาที</span>
          </div>
        </div>
      </div>

      {!selectedAction && timeLeft <= 10 && (
        <div className="timer-warning">
          ⚠️ เลือกเร็ว!
        </div>
      )}
    </div>
  );
}

export default TurnTimer;
