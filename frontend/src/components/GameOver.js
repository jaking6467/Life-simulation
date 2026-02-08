// src/components/GameOver.js
import React from 'react';

function GameOver({ rankings, playerId, onBackToLobby }) {
  const myRank = rankings.find(r => r.playerId === playerId);

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏅';
  };

  const getRankMessage = (rank) => {
    if (rank === 1) return 'ชนะเลิศ! 🎉';
    if (rank === 2) return 'รองชนะเลิศอันดับ 1';
    if (rank === 3) return 'รองชนะเลิศอันดับ 2';
    return 'เข้าร่วมแข่งขัน';
  };

  return (
    <div className="game-over">
      <div className="game-over-container">
        <h1>🎮 จบเกม!</h1>

        <div className="my-result">
          <div className="result-medal">{getMedalEmoji(myRank?.rank)}</div>
          <div className="result-rank">อันดับที่ {myRank?.rank}</div>
          <div className="result-message">{getRankMessage(myRank?.rank)}</div>
          <div className="result-score">คะแนน: <strong>{myRank?.score}</strong></div>
          {myRank?.prize > 0 && (
            <div className="result-prize">🎁 รางวัล: {myRank.prize} บาท</div>
          )}
        </div>

        <div className="final-rankings">
          <h3>🏆 อันดับสุดท้าย</h3>
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>ผู้เล่น</th>
                <th>คะแนน</th>
                <th>เงิน</th>
                <th>ความสุข</th>
                <th>ความรู้</th>
                <th>สุขภาพ</th>
                <th>รางวัล</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map(player => (
                <tr key={player.playerId} className={player.playerId === playerId ? 'my-row' : ''}>
                  <td>{getMedalEmoji(player.rank)}</td>
                  <td>
                    {player.username}
                    {player.playerId === playerId && ' (คุณ)'}
                    {!player.alive && ' 💀'}
                  </td>
                  <td><strong>{player.score}</strong></td>
                  <td>{Math.round(player.finalStats.money)}</td>
                  <td>{Math.round(player.finalStats.happiness)}</td>
                  <td>{Math.round(player.finalStats.knowledge)}</td>
                  <td>{Math.round(player.finalStats.health)}</td>
                  <td>{player.prize > 0 ? `${player.prize} 💰` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn-primary btn-large" onClick={onBackToLobby}>
          กลับไปหน้าหลัก
        </button>
      </div>
    </div>
  );
}

export default GameOver;
