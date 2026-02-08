// src/App.js
import React, { useState, useEffect } from 'react';
import socket from './services/socket';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import './styles/App.css';
import './styles/AdvancedSystems.css';  // เพิ่มบรรทัดนี้

function App() {
  const [currentPage, setCurrentPage] = useState('login'); // login, lobby, game
  const [playerId, setPlayerId] = useState(null);
  const [username, setUsername] = useState('');
  const [lobbyData, setLobbyData] = useState(null);
  const [gameData, setGameData] = useState(null);

  useEffect(() => {
    // เชื่อมต่อ Socket
    socket.connect();

    // ลงทะเบียนสำเร็จ
    socket.on('registered', (data) => {
      setPlayerId(data.playerId);
      setUsername(data.username);
      setCurrentPage('lobby');
    });

    // พบห้องแล้ว
    socket.on('lobbyFound', (data) => {
      setLobbyData(data);
    });

    // ห้องถูกสร้าง
    socket.on('roomCreated', (data) => {
      setLobbyData(data);
    });

    // มีคนเข้าห้อง
    socket.on('playerJoined', (data) => {
      setLobbyData(prev => ({ ...prev, players: data.players }));
    });

    // มีคนพร้อม
    socket.on('playerReady', (data) => {
      setLobbyData(prev => ({ ...prev, players: data.players }));
    });

    // เกมเริ่ม
    socket.on('gameStarted', (data) => {
      setGameData(data);
      setCurrentPage('game');
    });

    // มีคนออก
    socket.on('playerLeft', (data) => {
      setLobbyData(prev => ({ ...prev, players: data.players }));
    });

    // Error
    socket.on('error', (data) => {
      alert(data.message);
    });

    return () => {
      socket.removeAllListeners('registered');
      socket.removeAllListeners('lobbyFound');
      socket.removeAllListeners('roomCreated');
      socket.removeAllListeners('playerJoined');
      socket.removeAllListeners('playerReady');
      socket.removeAllListeners('gameStarted');
      socket.removeAllListeners('playerLeft');
      socket.removeAllListeners('error');
    };
  }, []);

  const handleLogin = (name) => {
    socket.register(name);
  };

  const handleBackToLobby = () => {
    setCurrentPage('lobby');
    setLobbyData(null);
    setGameData(null);
    socket.leaveRoom();
  };

  return (
    <div className="App">
      {currentPage === 'login' && (
        <LoginPage onLogin={handleLogin} />
      )}
      
      {currentPage === 'lobby' && (
        <LobbyPage 
          username={username}
          playerId={playerId}
          lobbyData={lobbyData}
          setLobbyData={setLobbyData}
        />
      )}
      
      {currentPage === 'game' && (
        <GamePage 
          playerId={playerId}
          username={username}
          gameData={gameData}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}

export default App;