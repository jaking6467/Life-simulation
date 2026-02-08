// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://life-simulation-git-main-jelaytamoons-projects.vercel.app/';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // เก็บ listener ไว้
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      
      // ลบ listener
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }

  // Game Actions
  register(username) {
    this.emit('register', { username });
  }

  findGame() {
    this.emit('findGame');
  }

  cancelSearch() {
    this.emit('cancelSearch');
  }

  createRoom(maxPlayers = 4) {
    this.emit('createRoom', { maxPlayers });
  }

  joinRoom(lobbyId) {
    this.emit('joinRoom', { lobbyId });
  }

  ready() {
    this.emit('ready');
  }

  selectAction(action) {
    this.emit('selectAction', { action });
  }

  leaveRoom() {
    this.emit('leaveRoom');
  }

  // Stock Market
  buyStock(symbol, shares) {
    this.emit('buyStock', { symbol, shares });
  }

  sellStock(symbol, shares) {
    this.emit('sellStock', { symbol, shares });
  }

  getStockPrices() {
    this.emit('getStockPrices');
  }

  // Career
  chooseCareer(career) {
    this.emit('chooseCareer', { career });
  }

  promoteCareer() {
    this.emit('promoteCareer');
  }

  getCareers() {
    this.emit('getCareers');
  }

  // Banking
  depositBank(accountType, amount) {
    this.emit('depositBank', { accountType, amount });
  }

  withdrawBank(accountType, amount) {
    this.emit('withdrawBank', { accountType, amount });
  }
}

const socketService = new SocketService();

export default socketService;
