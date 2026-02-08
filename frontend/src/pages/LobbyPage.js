// src/pages/LobbyPage.js
import React, { useState } from 'react';
import socket from '../services/socket';

function LobbyPage({ username, playerId, lobbyData, setLobbyData }) {
  const [searching, setSearching] = useState(false);
  const [lobbyId, setLobbyId] = useState('');

  const handleQuickMatch = () => {
    setSearching(true);
    socket.findGame();
  };

  const handleCancelSearch = () => {
    setSearching(false);
    socket.cancelSearch();
  };

  const handleCreateRoom = () => {
    socket.createRoom(4);
  };

  const handleJoinRoom = () => {
    if (lobbyId.trim()) {
      socket.joinRoom(lobbyId.trim());
    }
  };

  const handleReady = () => {
    socket.ready();
  };

  const handleLeaveRoom = () => {
    socket.leaveRoom();
    setLobbyData(null);
  };

  const isPlayerReady = (player) => player.ready;
  const currentPlayer = lobbyData?.players?.find(p => p.id === playerId);

  /* =======================
     อยู่ในห้องแล้ว
  ======================= */
  if (lobbyData) {
    return (
      <div className="lobby-page">
        <div className="lobby-container">

          <h2 className="section-title">
            <img src="https://cdn-icons-png.flaticon.com/512/619/619153.png" alt="room" className="title-icon" />
            ห้องรอ
          </h2>

          <p className="lobby-id">
            รหัสห้อง: <strong>{lobbyData.lobbyId}</strong>
          </p>

          <div className="players-list">
            <h3>ผู้เล่น ({lobbyData.players.length}/4)</h3>

            {lobbyData.players.map(player => (
              <div key={player.id} className="player-item">
                <span className="player-name">
                  {player.username} {player.id === playerId && '(คุณ)'}
                </span>

                <span className={`player-status ${isPlayerReady(player) ? 'ready' : 'waiting'}`}>
                  <img
                    src={
                      isPlayerReady(player)
                        ? "https://cdn-icons-png.flaticon.com/512/845/845646.png"
                        : "https://cdn-icons-png.flaticon.com/512/565/565655.png"
                    }
                    alt="status"
                    className="status-icon"
                  />
                  {isPlayerReady(player) ? 'พร้อม' : 'รอ'}
                </span>
              </div>
            ))}
          </div>

          <div className="lobby-actions">
            {!currentPlayer?.ready ? (
              <button className="btn-ready" onClick={handleReady}>
                <img src="https://cdn-icons-png.flaticon.com/512/845/845646.png" alt="ready" className="btn-icon" />
                พร้อม
              </button>
            ) : (
              <p className="waiting-text">กำลังรอผู้เล่นคนอื่น...</p>
            )}

            <button className="btn-leave" onClick={handleLeaveRoom}>
              ออกจากห้อง
            </button>
          </div>

          <div className="lobby-tip">
            เมื่อทุกคนกดพร้อม เกมจะเริ่มทันที!
          </div>
        </div>
      </div>
    );
  }

  /* =======================
     หน้า Lobby หลัก
  ======================= */
  return (
    <div className="lobby-page">
      <div className="lobby-container">

        <h1 className="main-title">
          <img src="https://cdn-icons-png.flaticon.com/512/686/686589.png" alt="game" className="title-icon" />
          Life Simulation
        </h1>

        <p className="welcome">
          ยินดีต้อนรับ, <strong>{username}</strong>!
        </p>

        {!searching ? (
          <div className="menu-options">

            <button className="btn-primary btn-large" onClick={handleQuickMatch}>
              <img src="https://cdn-icons-png.flaticon.com/512/1828/1828817.png" alt="quick" className="btn-icon" />
              เข้าเกมด่วน
            </button>

            <div className="divider">หรือ</div>

            <button className="btn-secondary" onClick={handleCreateRoom}>
              <img src="https://cdn-icons-png.flaticon.com/512/619/619153.png" alt="room" className="btn-icon" />
              สร้างห้อง
            </button>

            <div className="join-room">
              <input
                type="text"
                placeholder="ใส่รหัสห้อง"
                value={lobbyId}
                onChange={(e) => setLobbyId(e.target.value)}
              />
              <button onClick={handleJoinRoom} disabled={!lobbyId.trim()}>
                เข้าห้อง
              </button>
            </div>

          </div>
        ) : (
          <div className="searching-container">
            <div className="spinner"></div>
            <p>
              <img src="https://cdn-icons-png.flaticon.com/512/622/622669.png" alt="search" className="btn-icon" />
              กำลังหาผู้เล่น...
            </p>
            <button className="btn-cancel" onClick={handleCancelSearch}>
              ยกเลิก
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default LobbyPage;
