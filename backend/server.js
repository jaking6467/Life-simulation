// server.js - UPDATED VERSION with Advanced Systems Support
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const AdvancedGameEngine = require('./AdvancedGameEngine');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ระบบจัดการห้อง
const gameEngine = new AdvancedGameEngine();
const lobbies = new Map(); // lobbyId -> Lobby
const waitingPlayers = []; // ผู้เล่นรอจับคู่

// Lobby Structure
class Lobby {
  constructor(id, maxPlayers = 4) {
    this.id = id;
    this.players = [];
    this.maxPlayers = maxPlayers;
    this.status = 'waiting'; // waiting, starting, playing
    this.gameId = null;
    this.turnTimer = null;
  }

  addPlayer(player) {
    if (this.players.length < this.maxPlayers) {
      this.players.push(player);
      return true;
    }
    return false;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  getPlayers() {
    return this.players.map(p => ({
      id: p.id,
      username: p.username,
      ready: p.ready || false
    }));
  }
}

// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`✅ ผู้เล่นเชื่อมต่อ: ${socket.id}`);

  // ลงทะเบียนผู้เล่น
  socket.on('register', (data) => {
    socket.username = data.username || `Player_${socket.id.substring(0, 4)}`;
    socket.emit('registered', {
      playerId: socket.id,
      username: socket.username
    });
  });

  // หาเกม (Quick Match)
  socket.on('findGame', () => {
    const player = {
      id: socket.id,
      username: socket.username,
      socket: socket
    };

    waitingPlayers.push(player);
    socket.emit('searching', { message: 'กำลังหาเกม...' });

    // ถ้ามีผู้เล่นครบ 4 คน
    if (waitingPlayers.length >= 4) {
      const players = waitingPlayers.splice(0, 4);
      const lobbyId = uuidv4();
      const lobby = new Lobby(lobbyId);

      players.forEach(p => {
        lobby.addPlayer(p);
        p.socket.join(lobbyId);
        p.socket.lobbyId = lobbyId;
      });

      lobbies.set(lobbyId, lobby);

      io.to(lobbyId).emit('lobbyFound', {
        lobbyId: lobbyId,
        players: lobby.getPlayers()
      });

      // เริ่มเกมอัตโนมัติหลัง 5 วินาที
      setTimeout(() => {
        startGame(lobbyId);
      }, 5000);
    }
  });

  // ยกเลิกการหา
  socket.on('cancelSearch', () => {
    const index = waitingPlayers.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
      socket.emit('searchCancelled');
    }
  });

  // สร้างห้องเอง
  socket.on('createRoom', (data) => {
    const lobbyId = uuidv4();
    const lobby = new Lobby(lobbyId, data.maxPlayers || 4);

    const player = {
      id: socket.id,
      username: socket.username,
      ready: false,
      socket: socket
    };

    lobby.addPlayer(player);
    lobbies.set(lobbyId, lobby);

    socket.join(lobbyId);
    socket.lobbyId = lobbyId;

    socket.emit('roomCreated', {
      lobbyId: lobbyId,
      players: lobby.getPlayers()
    });
  });

  // เข้าห้อง
  socket.on('joinRoom', (data) => {
    const lobby = lobbies.get(data.lobbyId);
    
    if (!lobby) {
      socket.emit('error', { message: 'ไม่พบห้อง' });
      return;
    }

    if (lobby.isFull()) {
      socket.emit('error', { message: 'ห้องเต็ม' });
      return;
    }

    const player = {
      id: socket.id,
      username: socket.username,
      ready: false,
      socket: socket
    };

    lobby.addPlayer(player);
    socket.join(data.lobbyId);
    socket.lobbyId = data.lobbyId;

    io.to(data.lobbyId).emit('playerJoined', {
      players: lobby.getPlayers()
    });
  });

  // พร้อม
  socket.on('ready', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = true;
      
      io.to(socket.lobbyId).emit('playerReady', {
        players: lobby.getPlayers()
      });

      // ถ้าทุกคนพร้อม
      const allReady = lobby.players.every(p => p.ready);
      if (allReady && lobby.players.length >= 2) {
        startGame(socket.lobbyId);
      }
    }
  });

  // เลือกกิจกรรม
  socket.on('selectAction', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;

    const success = gameEngine.selectAction(lobby.gameId, socket.id, data.action);
    
    if (success) {
      socket.emit('actionSelected', { action: data.action });
      
      // ตรวจสอบว่าทุกคนเลือกแล้วหรือยัง
      checkAllActionsSelected(lobby);
    }
  });

  // ========== ADVANCED SYSTEMS HANDLERS ==========

  // === STOCK MARKET ===
  socket.on('buyStock', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.buyStock(player, data.symbol, data.shares);
    socket.emit('stockTradeResult', result);
    
    // ส่งราคาหุ้นอัพเดทให้ทุกคน
    io.to(socket.lobbyId).emit('stockPricesUpdate', gameEngine.stocks);
  });

  socket.on('sellStock', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.sellStock(player, data.symbol, data.shares);
    socket.emit('stockTradeResult', result);
    
    io.to(socket.lobbyId).emit('stockPricesUpdate', gameEngine.stocks);
  });

  socket.on('getStockPrices', () => {
    socket.emit('stockPricesUpdate', gameEngine.stocks);
  });

  // === CAREER SYSTEM ===
  socket.on('chooseCareer', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    player.career = data.career;
    player.careerLevel = 1;
    const careerPath = gameEngine.careerPaths[data.career];
    if (careerPath) {
      player.careerTitle = careerPath.levels[0].title;
      player.baseSalary = careerPath.levels[0].salary;
    }
    
    socket.emit('careerChosen', { career: data.career });
  });

  socket.on('promoteCareer', () => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player || !player.career) {
      socket.emit('promotionResult', { success: false, reason: 'ยังไม่ได้เลือกสายงาน' });
      return;
    }
    
    const result = gameEngine.promotePlayer(player, player.career);
    socket.emit('promotionResult', result);
  });

  socket.on('getCareers', () => {
    socket.emit('careersData', gameEngine.careerPaths);
  });

  // === BANKING SYSTEM ===
  socket.on('depositBank', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.depositToBank(player, data.amount, data.accountType);
    socket.emit('bankTransactionResult', result);
  });

  socket.on('withdrawBank', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.withdrawFromBank(player, data.amount, data.accountType);
    socket.emit('bankTransactionResult', result);
  });

  // === EDUCATION SYSTEM ===
  socket.on('enrollCourse', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.enrollCourse(player, data.courseId);
    socket.emit('courseEnrollResult', result);
  });

  socket.on('getCourses', () => {
    socket.emit('coursesData', gameEngine.courses);
  });

  // === PROPERTY SYSTEM ===
  socket.on('buyProperty', (data) => {
    const lobby = lobbies.get(socket.lobbyId);
    if (!lobby || !lobby.gameId) return;
    
    const game = gameEngine.getGame(lobby.gameId);
    if (!game) return;
    
    const player = game.players.get(socket.id);
    if (!player) return;
    
    const result = gameEngine.buyProperty(player, data.propertyType);
    socket.emit('propertyPurchaseResult', result);
  });

  socket.on('getProperties', () => {
    socket.emit('propertiesData', gameEngine.properties);
  });

  // ========== END ADVANCED SYSTEMS ==========

  // ออกจากห้อง
  socket.on('leaveRoom', () => {
    handlePlayerLeave(socket);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ ผู้เล่นออก: ${socket.id}`);
    handlePlayerLeave(socket);
    
    // ลบจาก waiting queue
    const index = waitingPlayers.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
  });
});

// ฟังก์ชันเริ่มเกม
function startGame(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || lobby.status === 'playing') return;

  lobby.status = 'playing';

  // ✅ แก้ไข: ใช้ createGame ถูกต้อง
  const playerList = lobby.players.map(p => ({
    id: p.id,
    username: p.username
  }));

  const gameId = gameEngine.createGame(playerList);
  lobby.gameId = gameId;

  const game = gameEngine.getGame(gameId);
  if (!game) {
    console.error('Failed to create game!');
    return;
  }

  io.to(lobbyId).emit('gameStarted', {
    gameId: gameId,
    players: Array.from(game.players.values()).map(p => ({
      id: p.id,
      username: p.username,
      stats: {
        money: p.money,
        happiness: p.happiness,
        energy: p.energy,
        knowledge: p.knowledge,
        health: p.health,
        stress: p.stress,
        job: p.job,
        portfolio: p.portfolio || {},
        bankAccounts: p.bankAccounts || {},
        career: p.career,
        careerLevel: p.careerLevel,
        careerTitle: p.careerTitle
      }
    })),
    stocks: gameEngine.stocks,
    careers: gameEngine.careerPaths,
    courses: gameEngine.courses,
    properties: gameEngine.properties
  });

  // เริ่มเทิร์น
  startTurn(lobbyId);
}

// เริ่มเทิร์น
function startTurn(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.gameId) return;

  const game = gameEngine.getGame(lobby.gameId);
  if (!game || game.status !== 'playing') return;

  io.to(lobbyId).emit('turnStart', {
    day: game.currentDay,
    maxDays: gameEngine.MAX_DAYS,
    timeLimit: gameEngine.TURN_DURATION
  });

  // ตั้งเวลา
  lobby.turnTimer = setTimeout(() => {
    processTurn(lobbyId);
  }, gameEngine.TURN_DURATION);
}

// ตรวจสอบว่าทุกคนเลือกแล้ว
function checkAllActionsSelected(lobby) {
  const game = gameEngine.getGame(lobby.gameId);
  if (!game) return;

  let allSelected = true;
  game.players.forEach(player => {
    if (player.alive && !player.currentAction) {
      allSelected = false;
    }
  });

  if (allSelected) {
    // ทุกคนเลือกแล้ว ประมวลผลทันที
    clearTimeout(lobby.turnTimer);
    processTurn(lobby.id);
  }
}

// ประมวลผลเทิร์น
function processTurn(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.gameId) return;

  const results = gameEngine.processTurn(lobby.gameId);
  
  if (!results) {
    console.error('processTurn returned null!');
    return;
  }
  
  io.to(lobbyId).emit('turnResult', results);

  if (results.gameOver) {
    // จบเกม
    setTimeout(() => {
      io.to(lobbyId).emit('gameOver', {
        rankings: results.rankings
      });
      
      // ทำความสะอาด
      gameEngine.deleteGame(lobby.gameId);
      lobby.status = 'finished';
    }, 3000);
  } else {
    // เทิร์นถัดไป
    setTimeout(() => {
      startTurn(lobbyId);
    }, 5000);
  }
}

// จัดการผู้เล่นออก
function handlePlayerLeave(socket) {
  if (!socket.lobbyId) return;

  const lobby = lobbies.get(socket.lobbyId);
  if (!lobby) return;

  lobby.removePlayer(socket.id);

  if (lobby.players.length === 0) {
    // ห้องว่าง ลบห้อง
    if (lobby.turnTimer) clearTimeout(lobby.turnTimer);
    if (lobby.gameId) gameEngine.deleteGame(lobby.gameId);
    lobbies.delete(socket.lobbyId);
  } else {
    // แจ้งผู้เล่นคนอื่น
    io.to(socket.lobbyId).emit('playerLeft', {
      playerId: socket.id,
      players: lobby.getPlayers()
    });
  }
}

// API สำหรับดูสถานะ
app.get('/api/status', (req, res) => {
  res.json({
    activeGames: gameEngine.games.size,
    activeLobbyies: lobbies.size,
    waitingPlayers: waitingPlayers.length
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Advanced Systems: Stock Market, Career, Banking, Education, Property`);
});
