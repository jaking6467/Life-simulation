// AdvancedGameEngine.js - Life Simulation Game ฉบับสมบูรณ์
class AdvancedGameEngine {
  constructor() {
    this.games = new Map();
    this.TURN_DURATION = 30000; // 30 วินาที = 1 วัน
    this.MAX_DAYS = 100;
    this.INTEREST_INTERVAL = 7; // จ่ายดอกเบี้ยทุก 7 วัน
  }

  // ==================== INITIALIZATION ====================
  
  createGame(gameId, players) {
    const game = {
      id: gameId,
      currentDay: 1,
      status: 'waiting',
      players: new Map(),
      
      // ระบบตลาด
      stocks: this.initializeStocks(),
      crypto: this.initializeCrypto(),
      goldPrice: 30000,
      
      // ระบบอาชีพ
      careers: this.initializeCareers(),
      
      // เศรษฐกิจ
      economy: 'normal' // normal, boom, recession
    };

    players.forEach(player => {
      game.players.set(player.id, this.createPlayer(player));
    });

    this.games.set(gameId, game);
    return game;
  }

  createPlayer(playerData) {
    return {
      // ข้อมูลพื้นฐาน
      id: playerData.id,
      username: playerData.username,
      alive: true,
      
      // สถิติหลัก
      money: 850,
      happiness: 50,
      energy: 100,
      knowledge: 10,
      health: 100,
      stress: 0,
      
      // ธนาคาร
      bankAccounts: {
        SAVINGS: { balance: 0, interestEarned: 0 },
        FIXED: { balance: 0, interestEarned: 0, lockDate: null },
        CURRENT: { balance: 0 }
      },
      
      // อาชีพ
      career: null,
      careerLevel: 0,
      workDays: 0,
      
      // ลงทุน
      portfolio: {}, // หุ้น
      cryptoWallet: {}, // คริปโต
      goldOwned: 0,
      goldAvgPrice: 0,
      
      // ที่พัก & พาหนะ
      housing: null,
      vehicle: null,
      
      // อื่นๆ
      relationships: { family: 50, friends: [], partner: null },
      inventory: [],
      totalScore: 0
    };
  }

  // ==================== หุ้น (20 ตัว) ====================
  
  initializeStocks() {
    const stocks = {
      // Tech Stocks (6 ตัว)
      TECH: { 
        symbol: 'TECH', 
        name: 'TechCorp', 
        currentPrice: 150, 
        volatility: 0.08,
        basePrice: 150,
        history: []
      },
      CPALL: { 
        symbol: 'CPALL', 
        name: 'CP All', 
        currentPrice: 65, 
        volatility: 0.04,
        basePrice: 65,
        history: []
      },
      PTT: { 
        symbol: 'PTT', 
        name: 'PTT Energy', 
        currentPrice: 35, 
        volatility: 0.05,
        basePrice: 35,
        history: []
      },
      KBANK: { 
        symbol: 'KBANK', 
        name: 'Kasikorn Bank', 
        currentPrice: 140, 
        volatility: 0.03,
        basePrice: 140,
        history: []
      },
      AOT: { 
        symbol: 'AOT', 
        name: 'Airports of Thailand', 
        currentPrice: 68, 
        volatility: 0.06,
        basePrice: 68,
        history: []
      },
      ADVANC: { 
        symbol: 'ADVANC', 
        name: 'Advanced Info', 
        currentPrice: 210, 
        volatility: 0.04,
        basePrice: 210,
        history: []
      },
      
      // Food & Retail (4 ตัว)
      FOOD: { 
        symbol: 'FOOD', 
        name: 'FoodChain Co', 
        currentPrice: 45, 
        volatility: 0.05,
        basePrice: 45,
        history: []
      },
      MEGA: { 
        symbol: 'MEGA', 
        name: 'Mega Retail', 
        currentPrice: 28, 
        volatility: 0.07,
        basePrice: 28,
        history: []
      },
      MAKRO: { 
        symbol: 'MAKRO', 
        name: 'Makro Wholesale', 
        currentPrice: 52, 
        volatility: 0.04,
        basePrice: 52,
        history: []
      },
      CRC: { 
        symbol: 'CRC', 
        name: 'Central Retail', 
        currentPrice: 38, 
        volatility: 0.05,
        basePrice: 38,
        history: []
      },
      
      // Property (3 ตัว)
      AP: { 
        symbol: 'AP', 
        name: 'AP Thailand', 
        currentPrice: 7.5, 
        volatility: 0.06,
        basePrice: 7.5,
        history: []
      },
      LH: { 
        symbol: 'LH', 
        name: 'Land & Houses', 
        currentPrice: 9.2, 
        volatility: 0.05,
        basePrice: 9.2,
        history: []
      },
      SPALI: { 
        symbol: 'SPALI', 
        name: 'Supalai', 
        currentPrice: 18, 
        volatility: 0.06,
        basePrice: 18,
        history: []
      },
      
      // Energy (3 ตัว)
      PTTEP: { 
        symbol: 'PTTEP', 
        name: 'PTT Exploration', 
        currentPrice: 120, 
        volatility: 0.08,
        basePrice: 120,
        history: []
      },
      TOP: { 
        symbol: 'TOP', 
        name: 'Thai Oil', 
        currentPrice: 55, 
        volatility: 0.07,
        basePrice: 55,
        history: []
      },
      BANPU: { 
        symbol: 'BANPU', 
        name: 'Banpu Energy', 
        currentPrice: 8.5, 
        volatility: 0.09,
        basePrice: 8.5,
        history: []
      },
      
      // Healthcare (2 ตัว)
      BH: { 
        symbol: 'BH', 
        name: 'Bumrungrad Hospital', 
        currentPrice: 185, 
        volatility: 0.04,
        basePrice: 185,
        history: []
      },
      BCH: { 
        symbol: 'BCH', 
        name: 'Bangkok Chain Hospital', 
        currentPrice: 18.5, 
        volatility: 0.05,
        basePrice: 18.5,
        history: []
      },
      
      // Transport (2 ตัว)
      BTS: { 
        symbol: 'BTS', 
        name: 'BTS Group', 
        currentPrice: 6.8, 
        volatility: 0.06,
        basePrice: 6.8,
        history: []
      },
      THAI: { 
        symbol: 'THAI', 
        name: 'Thai Airways', 
        currentPrice: 15, 
        volatility: 0.10,
        basePrice: 15,
        history: []
      }
    };

    // สร้าง history เริ่มต้น
    Object.keys(stocks).forEach(symbol => {
      for (let i = 0; i < 10; i++) {
        const change = (Math.random() - 0.5) * stocks[symbol].volatility * 2;
        stocks[symbol].history.push({
          price: stocks[symbol].currentPrice,
          change: change * 100
        });
      }
    });

    return stocks;
  }

  // ==================== คริปโต (15 ตัว) ====================
  
  initializeCrypto() {
    return {
      // Major Coins (5 ตัว)
      BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        currentPrice: 45000, 
        volatility: 0.15,
        basePrice: 45000,
        history: [],
        category: 'major'
      },
      ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        currentPrice: 2800, 
        volatility: 0.18,
        basePrice: 2800,
        history: [],
        category: 'major'
      },
      BNB: { 
        symbol: 'BNB', 
        name: 'Binance Coin', 
        currentPrice: 320, 
        volatility: 0.20,
        basePrice: 320,
        history: [],
        category: 'major'
      },
      SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        currentPrice: 98, 
        volatility: 0.25,
        basePrice: 98,
        history: [],
        category: 'major'
      },
      ADA: { 
        symbol: 'ADA', 
        name: 'Cardano', 
        currentPrice: 0.52, 
        volatility: 0.22,
        basePrice: 0.52,
        history: [],
        category: 'major'
      },
      
      // Mid Caps (5 ตัว)
      DOT: { 
        symbol: 'DOT', 
        name: 'Polkadot', 
        currentPrice: 7.2, 
        volatility: 0.28,
        basePrice: 7.2,
        history: [],
        category: 'mid'
      },
      MATIC: { 
        symbol: 'MATIC', 
        name: 'Polygon', 
        currentPrice: 0.88, 
        volatility: 0.30,
        basePrice: 0.88,
        history: [],
        category: 'mid'
      },
      LINK: { 
        symbol: 'LINK', 
        name: 'Chainlink', 
        currentPrice: 14.5, 
        volatility: 0.27,
        basePrice: 14.5,
        history: [],
        category: 'mid'
      },
      UNI: { 
        symbol: 'UNI', 
        name: 'Uniswap', 
        currentPrice: 6.8, 
        volatility: 0.32,
        basePrice: 6.8,
        history: [],
        category: 'mid'
      },
      AVAX: { 
        symbol: 'AVAX', 
        name: 'Avalanche', 
        currentPrice: 38, 
        volatility: 0.35,
        basePrice: 38,
        history: [],
        category: 'mid'
      },
      
      // Small Caps / Meme (5 ตัว - เสี่ยงสูง)
      DOGE: { 
        symbol: 'DOGE', 
        name: 'Dogecoin', 
        currentPrice: 0.082, 
        volatility: 0.40,
        basePrice: 0.082,
        history: [],
        category: 'meme'
      },
      SHIB: { 
        symbol: 'SHIB', 
        name: 'Shiba Inu', 
        currentPrice: 0.000010, 
        volatility: 0.45,
        basePrice: 0.000010,
        history: [],
        category: 'meme'
      },
      PEPE: { 
        symbol: 'PEPE', 
        name: 'Pepe Coin', 
        currentPrice: 0.0000012, 
        volatility: 0.50,
        basePrice: 0.0000012,
        history: [],
        category: 'meme'
      },
      MOON: { 
        symbol: 'MOON', 
        name: 'MoonShot', 
        currentPrice: 0.0015, 
        volatility: 0.60,
        basePrice: 0.0015,
        history: [],
        category: 'small'
      },
      ROCKET: { 
        symbol: 'ROCKET', 
        name: 'RocketFuel', 
        currentPrice: 0.025, 
        volatility: 0.55,
        basePrice: 0.025,
        history: [],
        category: 'small'
      }
    };
  }

  // ==================== อาชีพ ====================
  
  initializeCareers() {
    return {
      FOOD: {
        name: 'อาหารและเครื่องดื่ม',
        icon: '🍔',
        levels: [
          { id: 1, title: 'พนักงานเสิร์ฟ', salary: 50, requirements: {} },
          { id: 2, title: 'หัวหน้าพนักงาน', salary: 80, requirements: { workDays: 7, knowledge: 15 } },
          { id: 3, title: 'ผู้จัดการร้าน', salary: 150, requirements: { workDays: 21, knowledge: 30, money: 500 } },
          { id: 4, title: 'เจ้าของร้าน', salary: 300, requirements: { workDays: 42, knowledge: 50, money: 5000 } }
        ]
      },
      TECH: {
        name: 'เทคโนโลยี',
        icon: '💻',
        levels: [
          { id: 1, title: 'Intern Developer', salary: 50, requirements: { knowledge: 20 } },
          { id: 2, title: 'Junior Developer', salary: 150, requirements: { workDays: 10, knowledge: 40 } },
          { id: 3, title: 'Senior Developer', salary: 300, requirements: { workDays: 28, knowledge: 60 } },
          { id: 4, title: 'Tech Lead', salary: 500, requirements: { workDays: 49, knowledge: 80, money: 3000 } }
        ]
      },
      BUSINESS: {
        name: 'ธุรกิจ',
        icon: '💼',
        levels: [
          { id: 1, title: 'พนักงานขาย', salary: 70, requirements: {} },
          { id: 2, title: 'Account Manager', salary: 120, requirements: { workDays: 14, knowledge: 25 } },
          { id: 3, title: 'Sales Director', salary: 250, requirements: { workDays: 35, knowledge: 50, money: 2000 } },
          { id: 4, title: 'CEO', salary: 600, requirements: { workDays: 56, knowledge: 75, money: 10000 } }
        ]
      },
      FINANCE: {
        name: 'การเงิน',
        icon: '💰',
        levels: [
          { id: 1, title: 'Teller', salary: 60, requirements: { knowledge: 15 } },
          { id: 2, title: 'Financial Analyst', salary: 140, requirements: { workDays: 14, knowledge: 40 } },
          { id: 3, title: 'Portfolio Manager', salary: 280, requirements: { workDays: 35, knowledge: 65 } },
          { id: 4, title: 'Investment Banker', salary: 550, requirements: { workDays: 56, knowledge: 85, money: 8000 } }
        ]
      },
      FITNESS: {
        name: 'ฟิตเนส',
        icon: '🏋️',
        levels: [
          { id: 1, title: 'Gym Staff', salary: 45, requirements: { health: 70 } },
          { id: 2, title: 'Personal Trainer', salary: 100, requirements: { workDays: 10, health: 80, knowledge: 30 } },
          { id: 3, title: 'Head Trainer', salary: 200, requirements: { workDays: 28, health: 90, knowledge: 50 } },
          { id: 4, title: 'Gym Owner', salary: 400, requirements: { workDays: 49, health: 95, money: 10000 } }
        ]
      }
    };
  }

  // ==================== ประมวลผลเทิร์น ====================
  
  processTurn(gameId) {
    const game = this.games.get(gameId);
    if (!game) return null;

    const results = {
      day: game.currentDay,
      playerResults: [],
      globalEvents: [],
      gameOver: false
    };

    // อัพเดทราคา
    this.updateStockPrices(game);
    this.updateCryptoPrices(game);
    this.updateGoldPrice(game);

    // ประมวลผลผู้เล่น
    game.players.forEach((player, playerId) => {
      if (!player.alive) return;

      // ลดพลังงาน/สุขภาพ
      player.energy = Math.max(0, player.energy - 10);
      player.happiness = Math.max(0, player.happiness - 2);
      
      // ค่าใช้จ่ายรายวัน
      this.processDaily expenses(player);
      
      // ดอกเบี้ย (ทุก 7 วัน)
      if (game.currentDay % this.INTEREST_INTERVAL === 0) {
        this.processInterest(player);
      }
      
      // ทำงาน
      if (player.career) {
        this.processWork(player, game);
      }
      
      // เหตุการณ์สุ่ม
      const randomEvent = this.triggerRandomEvent(player, game);
      
      // ตรวจสอบแพ้
      this.checkDefeatConditions(player);
      
      // คะแนน
      player.totalScore = this.calculateScore(player);

      results.playerResults.push({
        playerId,
        username: player.username,
        event: randomEvent,
        newStats: this.getPlayerStats(player),
        alive: player.alive,
        score: player.totalScore
      });
    });

    // เหตุการณ์โลก
    if (Math.random() < 0.12) {
      const globalEvent = this.triggerGlobalEvent(game);
      if (globalEvent) results.globalEvents.push(globalEvent);
    }

    game.currentDay++;

    // จบเกม
    if (game.currentDay > this.MAX_DAYS || this.countAlivePlayers(game) <= 0) {
      game.status = 'finished';
      results.gameOver = true;
      results.rankings = this.calculateRankings(game);
    }

    return results;
  }

  // ==================== ฟังก์ชันช่วย ====================
  
  getPlayerStats(player) {
    return {
      money: Math.round(player.money),
      happiness: player.happiness,
      energy: player.energy,
      knowledge: player.knowledge,
      health: player.health,
      stress: player.stress,
      bankAccounts: player.bankAccounts,
      career: player.career,
      careerLevel: player.careerLevel,
      workDays: player.workDays,
      portfolio: player.portfolio,
      cryptoWallet: player.cryptoWallet,
      goldOwned: player.goldOwned,
      housing: player.housing,
      vehicle: player.vehicle
    };
  }

  processDailyExpenses(player) {
    let expenses = 0;
    
    // ค่าที่พัก
    if (player.housing === 'RENT') expenses += 70; // 2000/28 วัน
    else if (player.housing === 'CONDO') expenses += 280;
    else if (player.housing === 'HOUSE') expenses += 500;
    
    // ค่ายานพาหนะ
    if (player.vehicle === 'MOTORCYCLE') expenses += 20;
    else if (player.vehicle === 'CAR') expenses += 100;
    else if (player.vehicle === 'LUXURY_CAR') expenses += 300;
    
    // ค่าอาหาร (ขั้นต่ำ)
    expenses += 150 / 3; // 50 บาทต่อวัน
    
    player.money -= expenses;
  }

  processInterest(player) {
    // ออมทรัพย์ 1%
    const savingsInterest = player.bankAccounts.SAVINGS.balance * 0.01;
    player.bankAccounts.SAVINGS.balance += savingsInterest;
    player.bankAccounts.SAVINGS.interestEarned += savingsInterest;
    
    // ฝากประจำ 3%
    const fixedInterest = player.bankAccounts.FIXED.balance * 0.03;
    player.bankAccounts.FIXED.balance += fixedInterest;
    player.bankAccounts.FIXED.interestEarned += fixedInterest;
  }

  processWork(player, game) {
    const career = game.careers[player.career];
    if (!career) return;
    
    const level = career.levels.find(l => l.id === player.careerLevel);
    if (!level) return;
    
    player.money += level.salary;
    player.workDays++;
    player.energy -= 25;
    player.stress += 10;
    player.knowledge += 1;
  }

  // ==================== อัพเดทราคา ====================
  
  updateStockPrices(game) {
    Object.keys(game.stocks).forEach(symbol => {
      const stock = game.stocks[symbol];
      const economyMultiplier = game.economy === 'boom' ? 1.5 : game.economy === 'recession' ? 0.5 : 1;
      const change = (Math.random() - 0.48) * stock.volatility * 2 * economyMultiplier;
      
      stock.currentPrice *= (1 + change);
      stock.currentPrice = Math.max(stock.basePrice * 0.3, stock.currentPrice);
      stock.currentPrice = Math.min(stock.basePrice * 3, stock.currentPrice);
      
      stock.history.push({
        price: stock.currentPrice,
        change: change * 100
      });
      
      if (stock.history.length > 30) stock.history.shift();
    });
  }

  updateCryptoPrices(game) {
    Object.keys(game.crypto).forEach(symbol => {
      const crypto = game.crypto[symbol];
      const change = (Math.random() - 0.5) * crypto.volatility * 2;
      
      crypto.currentPrice *= (1 + change);
      crypto.currentPrice = Math.max(crypto.basePrice * 0.1, crypto.currentPrice);
      crypto.currentPrice = Math.min(crypto.basePrice * 10, crypto.currentPrice);
      
      crypto.history = crypto.history || [];
      crypto.history.push({
        price: crypto.currentPrice,
        change: change * 100
      });
      
      if (crypto.history.length > 30) crypto.history.shift();
    });
  }

  updateGoldPrice(game) {
    const change = (Math.random() - 0.5) * 0.03;
    game.goldPrice *= (1 + change);
    game.goldPrice = Math.max(20000, Math.min(50000, game.goldPrice));
  }

  // ==================== เหตุการณ์สุ่ม ====================
  
  triggerRandomEvent(player, game) {
    const rand = Math.random();
    
    if (rand < 0.02) {
      player.money += 1000;
      return { type: 'lottery', message: '🎉 ถูกหวย! +1000 บาท' };
    } else if (rand < 0.05) {
      player.health -= 20;
      player.money -= 300;
      return { type: 'sick', message: '🤒 ป่วย! -20 HP, -300 บาท' };
    } else if (rand < 0.08) {
      player.money += 200;
      return { type: 'bonus', message: '💰 โบนัสพิเศษ! +200 บาท' };
    } else if (rand < 0.10) {
      const loss = Math.min(player.money * 0.3, 500);
      player.money -= loss;
      return { type: 'scam', message: `😱 โดนหลอก! -${Math.round(loss)} บาท` };
    }
    
    return null;
  }

  triggerGlobalEvent(game) {
    const events = [
      {
        name: 'เศรษฐกิจบูม',
        effect: (game) => { 
          game.economy = 'boom';
          game.players.forEach(p => p.happiness += 10);
        },
        message: '📈 เศรษฐกิจบูม! ตลาดหุ้นร้อนแรง'
      },
      {
        name: 'เศรษฐกิจถดถอย',
        effect: (game) => { 
          game.economy = 'recession';
          game.players.forEach(p => p.stress += 15);
        },
        message: '📉 เศรษฐกิจถดถอย! ตลาดหุ้นร่วง'
      },
      {
        name: 'Bitcoin Moon',
        effect: (game) => { 
          game.crypto.BTC.currentPrice *= 1.3;
          game.crypto.ETH.currentPrice *= 1.2;
        },
        message: '🚀 Bitcoin พุ่ง! คริปโตขึ้นทั่วบอร์ด'
      },
      {
        name: 'Crypto Crash',
        effect: (game) => { 
          Object.keys(game.crypto).forEach(symbol => {
            game.crypto[symbol].currentPrice *= 0.7;
          });
        },
        message: '💥 คริปโตดิ่ง! ตลาดคริปโตร่วงหนัก'
      }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    event.effect(game);
    return event;
  }

  // ==================== ธุรกรรม ====================
  
  // หุ้น
  buyStock(gameId, playerId, symbol, shares) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    const stock = game.stocks[symbol];
    
    if (!stock || !player) return { success: false, reason: 'ไม่พบข้อมูล' };
    
    const cost = stock.currentPrice * shares * 1.01; // + ค่าธรรมเนียม 1%
    if (player.money < cost) return { success: false, reason: 'เงินไม่พอ' };
    
    player.money -= cost;
    
    if (!player.portfolio[symbol]) {
      player.portfolio[symbol] = { shares: 0, avgBuyPrice: 0, totalCost: 0 };
    }
    
    const holding = player.portfolio[symbol];
    holding.totalCost += cost;
    holding.shares += shares;
    holding.avgBuyPrice = holding.totalCost / holding.shares;
    
    return { success: true, type: 'buy' };
  }

  sellStock(gameId, playerId, symbol, shares) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    const stock = game.stocks[symbol];
    const holding = player.portfolio[symbol];
    
    if (!stock || !player || !holding) return { success: false, reason: 'ไม่พบข้อมูล' };
    if (holding.shares < shares) return { success: false, reason: 'หุ้นไม่พอ' };
    
    const revenue = stock.currentPrice * shares * 0.99; // - ค่าธรรมเนียม 1%
    player.money += revenue;
    
    holding.shares -= shares;
    holding.totalCost -= (holding.avgBuyPrice * shares);
    
    if (holding.shares === 0) {
      delete player.portfolio[symbol];
    }
    
    return { success: true, type: 'sell' };
  }

  // คริปโต
  buyCrypto(gameId, playerId, symbol, amount) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    const crypto = game.crypto[symbol];
    
    if (!crypto || !player) return { success: false, reason: 'ไม่พบข้อมูล' };
    
    const cost = crypto.currentPrice * amount * 1.02; // + ค่าธรรมเนียม 2%
    if (player.money < cost) return { success: false, reason: 'เงินไม่พอ' };
    
    player.money -= cost;
    
    if (!player.cryptoWallet[symbol]) {
      player.cryptoWallet[symbol] = { amount: 0, avgBuyPrice: 0, totalCost: 0 };
    }
    
    const wallet = player.cryptoWallet[symbol];
    wallet.totalCost += cost;
    wallet.amount += amount;
    wallet.avgBuyPrice = wallet.totalCost / wallet.amount;
    
    return { success: true, type: 'buy' };
  }

  sellCrypto(gameId, playerId, symbol, amount) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    const crypto = game.crypto[symbol];
    const wallet = player.cryptoWallet[symbol];
    
    if (!crypto || !player || !wallet) return { success: false, reason: 'ไม่พบข้อมูล' };
    if (wallet.amount < amount) return { success: false, reason: 'คริปโตไม่พอ' };
    
    const revenue = crypto.currentPrice * amount * 0.98; // - ค่าธรรมเนียม 2%
    player.money += revenue;
    
    wallet.amount -= amount;
    wallet.totalCost -= (wallet.avgBuyPrice * amount);
    
    if (wallet.amount === 0) {
      delete player.cryptoWallet[symbol];
    }
    
    return { success: true, type: 'sell' };
  }

  // ธนาคาร
  depositBank(gameId, playerId, accountType, amount) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    
    if (!player || player.money < amount) return { success: false, reason: 'เงินไม่พอ' };
    
    player.money -= amount;
    player.bankAccounts[accountType].balance += amount;
    
    if (accountType === 'FIXED') {
      player.bankAccounts.FIXED.lockDate = game.currentDay;
    }
    
    return { success: true };
  }

  withdrawBank(gameId, playerId, accountType, amount) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    const account = player.bankAccounts[accountType];
    
    if (!player || account.balance < amount) return { success: false, reason: 'เงินไม่พอ' };
    
    let fee = 0;
    if (accountType === 'SAVINGS') fee = 10;
    else if (accountType === 'FIXED') {
      const daysPassed = game.currentDay - (account.lockDate || 0);
      if (daysPassed < 28) fee = account.interestEarned * 0.5; // ปรับ 50% ดอกเบี้ย
    }
    
    account.balance -= amount;
    player.money += (amount - fee);
    
    return { success: true };
  }

  // อาชีพ
  chooseCareer(gameId, playerId, careerKey) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    
    if (!player || player.career) return { success: false, reason: 'มีอาชีพแล้ว' };
    
    player.career = careerKey;
    player.careerLevel = 1;
    
    return { success: true };
  }

  promoteCareer(gameId, playerId) {
    const game = this.games.get(gameId);
    const player = game.players.get(playerId);
    
    if (!player || !player.career) return { success: false, reason: 'ไม่มีอาชีพ' };
    
    const career = game.careers[player.career];
    const nextLevel = career.levels.find(l => l.id === player.careerLevel + 1);
    
    if (!nextLevel) return { success: false, reason: 'ถึงระดับสูงสุดแล้ว' };
    
    const req = nextLevel.requirements;
    if (req.workDays && player.workDays < req.workDays) return { success: false, reason: 'ทำงานไม่ครบ' };
    if (req.knowledge && player.knowledge < req.knowledge) return { success: false, reason: 'ความรู้ไม่พอ' };
    if (req.money && player.money < req.money) return { success: false, reason: 'เงินไม่พอ' };
    
    player.careerLevel++;
    return { success: true, newTitle: nextLevel.title };
  }

  // ==================== ช่วยเหลือ ====================
  
  checkDefeatConditions(player) {
    if (player.money < -500 || player.health <= 0 || player.stress >= 100) {
      player.alive = false;
    }
  }

  calculateScore(player) {
    if (!player.alive) return 0;
    
    let portfolioValue = 0;
    Object.keys(player.portfolio).forEach(symbol => {
      portfolioValue += player.portfolio[symbol].shares * 100; // ประมาณการ
    });
    
    return Math.floor(
      player.money * 2 +
      player.happiness * 3 +
      player.knowledge * 2 +
      player.health * 1.5 +
      portfolioValue +
      Object.values(player.bankAccounts).reduce((sum, acc) => sum + acc.balance, 0)
    );
  }

  countAlivePlayers(game) {
    let count = 0;
    game.players.forEach(p => { if (p.alive) count++; });
    return count;
  }

  calculateRankings(game) {
    const rankings = [];
    game.players.forEach((player, playerId) => {
      rankings.push({
        playerId,
        username: player.username,
        score: player.totalScore,
        alive: player.alive,
        finalStats: this.getPlayerStats(player)
      });
    });
    
    rankings.sort((a, b) => b.score - a.score);
    
    return rankings.map((p, i) => ({
      ...p,
      rank: i + 1,
      prize: i === 0 ? 1000 : i === 1 ? 500 : i === 2 ? 250 : 0
    }));
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }
}

module.exports = AdvancedGameEngine;