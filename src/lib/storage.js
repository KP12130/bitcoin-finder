import { STORAGE_KEYS, GAME_CONFIG, VIP_CONFIG } from './constants';
import { supabase, isDbEnabled } from './supabase';

/**
 * Safe JSON parse with fallback
 */
function safeGet(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

// --- Balance ---
export function getBalance() {
  return safeGet(STORAGE_KEYS.BALANCE, null);
}

export function setBalance(amount) {
  safeSet(STORAGE_KEYS.BALANCE, amount);
}

export function isInitialized() {
  return safeGet(STORAGE_KEYS.INITIALIZED, false);
}

export function initializePlayer() {
  if (!isInitialized()) {
    setBalance(GAME_CONFIG.STARTING_BALANCE);
    safeSet(STORAGE_KEYS.INITIALIZED, true);
    setStats(getDefaultStats());
    setAchievements([]);
    setGameHistory([]);
    initializeLeaderboard();
  }
}

// --- Game History ---
export function getGameHistory() {
  return safeGet(STORAGE_KEYS.HISTORY, []);
}

export function setGameHistory(history) {
  safeSet(STORAGE_KEYS.HISTORY, history);
}

export function addGameResult(result) {
  const history = getGameHistory();
  const timestamp = Date.now();
  const newResult = {
    ...result,
    timestamp,
  };
  history.unshift(newResult);
  // Keep only last N games
  if (history.length > GAME_CONFIG.MAX_HISTORY) {
    history.length = GAME_CONFIG.MAX_HISTORY;
  }
  setGameHistory(history);

  // Sync to database if enabled
  if (isDbEnabled()) {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('game_results')
          .insert({
            user_id: session.user.id,
            game_type: result.gameType || 'mining',
            bet: result.bet,
            payout: result.payout,
            multiplier: parseFloat(result.multiplier) || 0,
            won: result.won,
            secret_number: String(result.secretNumber || ''),
            matched_guess: String(result.matchedGuess || ''),
          })
          .then(({ error }) => {
            if (error) console.error('Error syncing game result:', error);
          });
      }
    });
  }
}

// --- Stats ---
export function getDefaultStats() {
  return {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalBet: 0,
    totalWon: 0,
    totalLost: 0,
    biggestWin: 0,
    biggestLoss: 0,
    highestBet: 0,
    currentStreak: 0,
    maxWinStreak: 0,
    peakBalance: GAME_CONFIG.STARTING_BALANCE,
    timesBankrupt: 0,
    yoloWins: 0,
    maxLoginStreak: 0,
    profitHistory: [],
  };
}

export function getStats() {
  return safeGet(STORAGE_KEYS.STATS, getDefaultStats());
}

export function setStats(stats) {
  safeSet(STORAGE_KEYS.STATS, stats);
}

export function updateStats(gameResult) {
  const stats = getStats();
  
  // Track old VIP tier before wager increases
  const oldVipTier = getVIPTier(stats.totalBet);

  stats.totalGames++;

  if (gameResult.bet > stats.highestBet) {
    stats.highestBet = gameResult.bet;
  }

  stats.totalBet += gameResult.bet;

  if (gameResult.won) {
    stats.totalWins++;
    stats.totalWon += gameResult.payout;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxWinStreak) {
      stats.maxWinStreak = stats.currentStreak;
    }
    const profit = gameResult.payout - gameResult.bet;
    if (profit > stats.biggestWin) {
      stats.biggestWin = profit;
    }
    if (gameResult.guessCount === 1) {
      stats.yoloWins++;
    }
  } else {
    stats.totalLosses++;
    stats.totalLost += gameResult.bet;
    if (gameResult.bet > stats.biggestLoss) {
      stats.biggestLoss = gameResult.bet;
    }
    stats.currentStreak = 0;
  }

  const currentBalance = getBalance();
  if (currentBalance > stats.peakBalance) {
    stats.peakBalance = currentBalance;
  }

  if (currentBalance <= 0) {
    stats.timesBankrupt++;
  }

  // Track profit over time (keep last 100 data points)
  const netProfit = stats.totalWon - stats.totalBet;
  stats.profitHistory.push({ game: stats.totalGames, profit: netProfit });
  if (stats.profitHistory.length > 100) {
    stats.profitHistory.shift();
  }

  // Accrue rakeback automatically based on VIP tier
  const vipTier = getVIPTier(stats.totalBet);
  if (vipTier.rakebackPct > 0) {
    const rakebackEarned = (gameResult.bet * vipTier.rakebackPct) / 100;
    accrueRakeback(rakebackEarned);
  }

  // Trigger VIP level up event if player crossed a tier boundary
  if (vipTier.id !== oldVipTier.id && vipTier.minWager > oldVipTier.minWager) {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vip-level-up', { detail: vipTier }));
      }, 500); // 500ms delay to let the active game round finish its chimes/animations first
    }
  }

  setStats(stats);
  return stats;
}

// --- Profile ---
export function getDefaultProfile() {
  return {
    username: 'Guest_Satoshi',
    avatarId: 'miner',
    avatarEmoji: '⛏️',
  };
}

export function getProfile() {
  return safeGet(STORAGE_KEYS.PROFILE, getDefaultProfile());
}

export function setProfile(profile) {
  safeSet(STORAGE_KEYS.PROFILE, profile);
}

// --- Ledger ---
export function getLedger() {
  return safeGet(STORAGE_KEYS.LEDGER, []);
}

export function addLedgerEntry(entry) {
  const id = Math.random().toString(36).slice(2, 10).toUpperCase();
  const timestamp = Date.now();
  const newEntry = {
    id,
    timestamp,
    ...entry,
  };

  const ledger = getLedger();
  ledger.unshift(newEntry);
  if (ledger.length > 100) ledger.length = 100;
  safeSet(STORAGE_KEYS.LEDGER, ledger);

  // Sync to database if enabled
  if (isDbEnabled()) {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('ledger')
          .insert({
            id: id,
            user_id: session.user.id,
            type: entry.type,
            amount: entry.amount,
            fee: entry.fee || 0,
            status: entry.status || 'completed',
            label: entry.label,
            txid: entry.txid || null,
            address: entry.address || null,
          })
          .then(({ error }) => {
            if (error) console.error('Error syncing ledger entry:', error);
          });
      }
    });
  }
}

// --- Rakeback ---
export function getRakebackData() {
  return safeGet(STORAGE_KEYS.RAKEBACK, { accrued: 0, lifetime: 0 });
}

export function accrueRakeback(amount) {
  if (!amount || amount <= 0) return;
  const data = getRakebackData();
  data.accrued = Math.floor(data.accrued + amount);
  data.lifetime = Math.floor(data.lifetime + amount);
  safeSet(STORAGE_KEYS.RAKEBACK, data);
}

export function claimRakeback(addBalanceFn) {
  const data = getRakebackData();
  if (data.accrued <= 0) return 0;
  const amount = data.accrued;
  addBalanceFn(amount);
  addLedgerEntry({
    type: 'rakeback',
    amount,
    status: 'completed',
    label: 'Rakeback Claim',
  });
  data.accrued = 0;
  safeSet(STORAGE_KEYS.RAKEBACK, data);
  return amount;
}

// Helper: get current VIP tier from totalBet
export function getVIPTier(totalBet) {
  for (let i = VIP_CONFIG.length - 1; i >= 0; i--) {
    if (totalBet >= VIP_CONFIG[i].minWager) return VIP_CONFIG[i];
  }
  return VIP_CONFIG[0];
}

// --- Achievements ---
export function getAchievements() {
  return safeGet(STORAGE_KEYS.ACHIEVEMENTS, []);
}

export function setAchievements(achievements) {
  safeSet(STORAGE_KEYS.ACHIEVEMENTS, achievements);
}

export function unlockAchievement(id) {
  const achievements = getAchievements();
  if (!achievements.includes(id)) {
    achievements.push(id);
    setAchievements(achievements);
    return true; // newly unlocked
  }
  return false;
}

// --- Daily Reward ---
export function getDailyRewardData() {
  return safeGet(STORAGE_KEYS.DAILY_REWARD, {
    lastClaim: null,
    streak: 0,
  });
}

export function claimDailyReward() {
  const data = getDailyRewardData();
  const now = Date.now();

  // Check if 24h have passed
  if (data.lastClaim && now - data.lastClaim < 24 * 60 * 60 * 1000) {
    return null; // Can't claim yet
  }

  // Check if streak continues (within 48h) or resets
  let streak = data.streak;
  if (data.lastClaim && now - data.lastClaim > 48 * 60 * 60 * 1000) {
    streak = 0; // Streak broken
  }
  streak++;

  const rewardData = {
    lastClaim: now,
    streak,
  };

  safeSet(STORAGE_KEYS.DAILY_REWARD, rewardData);
  return rewardData;
}

// --- Leaderboard ---
const FAKE_PLAYERS = [
  { name: 'SatoshiSniper', profit: 85200, games: 342, winRate: 34.5 },
  { name: 'BlockBreaker', profit: 62100, games: 521, winRate: 28.2 },
  { name: 'CryptoKing99', profit: 54800, games: 198, winRate: 41.0 },
  { name: 'HashHunter', profit: 43500, games: 455, winRate: 31.1 },
  { name: 'MoonMiner', profit: 38900, games: 287, winRate: 35.7 },
  { name: 'DigiDriller', profit: 27600, games: 612, winRate: 25.4 },
  { name: 'NodeRunner', profit: 19200, games: 156, winRate: 38.5 },
  { name: 'BitBlaster', profit: 12800, games: 389, winRate: 29.8 },
  { name: 'ChainChaser', profit: 8400, games: 234, winRate: 32.1 },
  { name: 'TokenTiger', profit: -2300, games: 445, winRate: 22.7 },
];

export function initializeLeaderboard() {
  const existing = safeGet(STORAGE_KEYS.LEADERBOARD, null);
  if (!existing) {
    safeSet(STORAGE_KEYS.LEADERBOARD, FAKE_PLAYERS);
  }
}

export function getLeaderboard() {
  return safeGet(STORAGE_KEYS.LEADERBOARD, FAKE_PLAYERS);
}

export function getPlayerLeaderboardEntry() {
  const stats = getStats();
  return {
    name: 'You',
    profit: stats.totalWon - stats.totalBet,
    games: stats.totalGames,
    winRate: stats.totalGames > 0
      ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1)
      : 0,
    isPlayer: true,
  };
}
