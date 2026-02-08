// src/components/PlayerStats.js
import React from 'react';

function PlayerStats({ username, stats, isMe = false }) {
  if (!stats) return null;

  const getStatColor = (value, type) => {
    if (type === 'stress') {
      if (value >= 80) return '#ff4444';
      if (value >= 50) return '#ff9800';
      return '#4caf50';
    } else {
      if (value >= 70) return '#4caf50';
      if (value >= 30) return '#ff9800';
      return '#ff4444';
    }
  };

  const statItems = [
    { key: 'money', label: '💰 เงิน', value: stats.money, max: null, suffix: ' บาท' },
    { key: 'happiness', label: '😊 ความสุข', value: stats.happiness, max: 100 },
    { key: 'energy', label: '⚡ พลังงาน', value: stats.energy, max: 100 },
    { key: 'knowledge', label: '🧠 ความรู้', value: stats.knowledge, max: 100 },
    { key: 'health', label: '❤️ สุขภาพ', value: stats.health, max: 100 },
    { key: 'stress', label: '😵 ความเครียด', value: stats.stress, max: 100 }
  ];

  return (
    <div className={`player-stats ${isMe ? 'my-stats' : ''}`}>
      <div className="stats-header">
        <h3>{username} {isMe && '(คุณ)'}</h3>
        {stats.job && <span className="job-badge">{stats.job}</span>}
      </div>

      <div className="stats-list">
        {statItems.map(item => (
          <div key={item.key} className="stat-item">
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">
              {item.max ? (
                <>
                  <div className="stat-bar">
                    <div 
                      className="stat-bar-fill"
                      style={{
                        width: `${Math.min(100, (item.value / item.max) * 100)}%`,
                        backgroundColor: getStatColor(item.value, item.key)
                      }}
                    />
                  </div>
                  <span className="stat-number">{Math.round(item.value)}/{item.max}</span>
                </>
              ) : (
                <span className="stat-number">{Math.round(item.value)}{item.suffix}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlayerStats;
