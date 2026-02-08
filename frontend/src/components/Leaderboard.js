// src/components/Leaderboard.js
import React from 'react';

function Leaderboard({ players, currentPlayerId }) {
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  const getMedalEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <div className="leaderboard">
      <h3>🏆 อันดับคะแนน</h3>
      
      <div className="leaderboard-list">
        {sortedPlayers.map((player, index) => (
          <div 
            key={player.id}
            className={`leaderboard-item ${player.id === currentPlayerId ? 'current-player' : ''} ${!player.alive ? 'dead' : ''}`}
          >
            <div className="player-rank">
              {getMedalEmoji(index)}
            </div>
            
            <div className="player-info">
              <div className="player-name">
                {player.username}
                {player.id === currentPlayerId && ' (คุณ)'}
                {!player.alive && ' 💀'}
              </div>
              <div className="player-mini-stats">
                💰 {Math.round(player.stats?.money || 0)} |
                😊 {Math.round(player.stats?.happiness || 0)} |
                ❤️ {Math.round(player.stats?.health || 0)}
              </div>
            </div>
            
            <div className="player-score">
              <strong>{Math.round(player.score || 0)}</strong>
              <span className="score-label">คะแนน</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Leaderboard;
