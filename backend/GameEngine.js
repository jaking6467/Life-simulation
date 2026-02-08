// GameEngine.js - ระบบหลักของเกม
class GameEngine {
  constructor() {
    this.games = new Map(); // gameId -> Game
    this.TURN_DURATION = 30000; // 30 วินาที
    this.MAX_DAYS = 30; // 30 วัน
  }

  createGame(gameId, players) {
    const game = {
      id: gameId,
      currentDay: 1,
      status: 'waiting', // waiting, playing, finished
      players: new Map(),
      turnTimer: null,
      winners: [],
      globalEvents: []
    };

    // สร้างผู้เล่น
    players.forEach(player => {
      game.players.set(player.id, this.createPlayer(player));
    });

    this.games.set(gameId, game);
    return game;
  }

  createPlayer(playerData) {
    return {
      id: playerData.id,
      username: playerData.username,
      money: 1000,
      happiness: 50,
      energy: 100,
      knowledge: 10,
      health: 100,
      stress: 0,
      job: 'employee', // employee, freelancer, student
      level: 1,
      inventory: [],
      currentAction: null,
      history: [],
      alive: true,
      totalScore: 0
    };
  }

  startGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) return null;

    game.status = 'playing';
    return game;
  }

  // เลือกกิจกรรม
  selectAction(gameId, playerId, action) {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') return false;

    const player = game.players.get(playerId);
    if (!player || !player.alive) return false;

    player.currentAction = action;
    return true;
  }

  // ประมวลผลเทิร์น
  processTurn(gameId) {
    const game = this.games.get(gameId);
    if (!game) return null;

    const results = {
      day: game.currentDay,
      playerResults: [],
      globalEvents: [],
      gameOver: false
    };

    // 1. ประมวลผลกิจกรรมของแต่ละคน
    game.players.forEach((player, playerId) => {
      if (!player.alive) return;

      const actionResult = this.executeAction(player, player.currentAction);
      
      // 2. เหตุการณ์สุ่มส่วนตัว
      const randomEvent = this.triggerRandomEvent(player);
      
      // 3. ตรวจสอบเงื่อนไขแพ้
      this.checkDefeatConditions(player);
      
      // 4. คำนวณคะแนน
      player.totalScore = this.calculateScore(player);

      results.playerResults.push({
        playerId,
        username: player.username,
        action: actionResult,
        event: randomEvent,
        newStats: {
          money: player.money,
          happiness: player.happiness,
          energy: player.energy,
          knowledge: player.knowledge,
          health: player.health,
          stress: player.stress
        },
        alive: player.alive,
        score: player.totalScore
      });

      // เคลียร์ action
      player.currentAction = null;
    });

    // 5. เหตุการณ์ทั่วโลก (Global Event)
    if (Math.random() < 0.15) { // 15% chance
      const globalEvent = this.triggerGlobalEvent(game);
      results.globalEvents.push(globalEvent);
    }

    // 6. เพิ่มวัน
    game.currentDay++;

    // 7. ตรวจสอบจบเกม
    if (game.currentDay > this.MAX_DAYS || this.countAlivePlayers(game) <= 1) {
      game.status = 'finished';
      results.gameOver = true;
      results.rankings = this.calculateRankings(game);
    }

    return results;
  }

  // ดำเนินการกิจกรรม
  executeAction(player, action) {
    if (!action) {
      // ไม่ทำอะไร = พักผ่อน
      player.energy = Math.min(100, player.energy + 20);
      player.stress = Math.max(0, player.stress - 10);
      return { name: 'พักผ่อน', success: true };
    }

    const actions = {
      work: () => {
        const income = player.job === 'employee' ? 100 : 
                      player.job === 'freelancer' ? 150 : 50;
        player.money += income;
        player.energy -= 30;
        player.stress += 15;
        return { name: 'ทำงาน', income, success: true };
      },
      study: () => {
        player.knowledge += 10;
        player.energy -= 20;
        player.money -= 30;
        return { name: 'เรียนหนังสือ', knowledge: 10, success: player.money >= 0 };
      },
      travel: () => {
        const cost = 200;
        if (player.money >= cost) {
          player.happiness += 30;
          player.money -= cost;
          player.stress -= 20;
          return { name: 'ไปเที่ยว', success: true };
        }
        return { name: 'ไปเที่ยว', success: false, reason: 'เงินไม่พอ' };
      },
      exercise: () => {
        player.health += 15;
        player.energy -= 25;
        player.happiness += 10;
        return { name: 'ออกกำลังกาย', success: true };
      },
      sleep: () => {
        player.energy = 100;
        player.stress -= 25;
        return { name: 'นอนหลับ', success: true };
      },
      invest: () => {
        const cost = 500;
        if (player.money >= cost) {
          const gain = Math.random() > 0.5 ? 300 : -200;
          player.money += gain;
          return { name: 'ลงทุน', gain, success: true };
        }
        return { name: 'ลงทุน', success: false, reason: 'เงินไม่พอ' };
      },
      hackOpponent: () => {
        // ฟีเจอร์ปั่นเกม
        const cost = 300;
        if (player.money >= cost) {
          player.money -= cost;
          return { name: 'แฮกคู่แข่ง', success: true, hacked: true };
        }
        return { name: 'แฮกคู่แข่ง', success: false };
      },
      spreadRumor: () => {
        const cost = 200;
        if (player.money >= cost) {
          player.money -= cost;
          return { name: 'ปล่อยข่าวลือ', success: true, rumor: true };
        }
        return { name: 'ปล่อยข่าวลือ', success: false };
      }
    };

    const result = actions[action] ? actions[action]() : { name: 'Unknown', success: false };
    
    // จำกัดค่าสเตตัส
    player.money = Math.max(0, player.money);
    player.happiness = Math.max(0, Math.min(100, player.happiness));
    player.energy = Math.max(0, Math.min(100, player.energy));
    player.knowledge = Math.max(0, Math.min(100, player.knowledge));
    player.health = Math.max(0, Math.min(100, player.health));
    player.stress = Math.max(0, Math.min(100, player.stress));

    return result;
  }

  // เหตุการณ์สุ่ม
  triggerRandomEvent(player) {
    const chance = Math.random();
    
    if (chance < 0.05) { // 5% - ถูกหวย
      player.money += 1000;
      return { type: 'lottery', message: '🎉 ถูกหวย! +1000 บาท' };
    } else if (chance < 0.10) { // 5% - ป่วย
      player.health -= 30;
      player.money -= 200;
      return { type: 'sick', message: '🤒 ป่วย! -30 HP, -200 บาท' };
    } else if (chance < 0.15) { // 5% - โบนัส
      player.money += 300;
      return { type: 'bonus', message: '💰 ได้โบนัส! +300 บาท' };
    } else if (chance < 0.18) { // 3% - โดนโกง
      player.money -= 400;
      return { type: 'scam', message: '😱 โดนโกง! -400 บาท' };
    }
    
    return null;
  }

  // เหตุการณ์ทั่วโลก
  triggerGlobalEvent(game) {
    const events = [
      {
        name: 'เศรษฐกิจตกต่ำ',
        effect: (player) => { player.money *= 0.8; },
        message: '📉 เศรษฐกิจตกต่ำ! เงินทุกคนลด 20%'
      },
      {
        name: 'เทศกาลความสุข',
        effect: (player) => { player.happiness += 20; },
        message: '🎊 เทศกาลความสุข! ทุกคน +20 ความสุข'
      },
      {
        name: 'โรคระบาด',
        effect: (player) => { player.health -= 20; player.money -= 100; },
        message: '🦠 โรคระบาด! -20 HP, -100 บาท'
      }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    
    game.players.forEach(player => {
      if (player.alive) {
        event.effect(player);
      }
    });

    return event;
  }

  // ตรวจสอบเงื่อนไขแพ้
  checkDefeatConditions(player) {
    if (player.money < 0 || player.health <= 0 || player.stress >= 100) {
      player.alive = false;
    }
  }

  // คำนวณคะแนน
  calculateScore(player) {
    if (!player.alive) return 0;
    
    return Math.floor(
      (player.money * 2) +
      (player.happiness * 1.5) +
      (player.knowledge * 2) +
      (player.health * 1)
    );
  }

  // นับผู้เล่นที่ยังเล่นอยู่
  countAlivePlayers(game) {
    let count = 0;
    game.players.forEach(player => {
      if (player.alive) count++;
    });
    return count;
  }

  // คำนวณอันดับ
  calculateRankings(game) {
    const rankings = [];
    
    game.players.forEach((player, playerId) => {
      rankings.push({
        playerId,
        username: player.username,
        score: player.totalScore,
        alive: player.alive,
        finalStats: {
          money: player.money,
          happiness: player.happiness,
          knowledge: player.knowledge,
          health: player.health
        }
      });
    });

    rankings.sort((a, b) => b.score - a.score);
    
    return rankings.map((player, index) => ({
      ...player,
      rank: index + 1,
      prize: index === 0 ? 1000 : index === 1 ? 500 : index === 2 ? 250 : 0
    }));
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  deleteGame(gameId) {
    this.games.delete(gameId);
  }
}

module.exports = GameEngine;