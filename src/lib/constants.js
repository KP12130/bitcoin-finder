// Game Configuration
export const GAME_CONFIG = {
  MIN_NUMBER: 1,
  MAX_NUMBER: 1000,
  MIN_GUESSES: 1,
  MAX_GUESSES: 500,
  HOUSE_EDGE: 0.02,
  STARTING_BALANCE: 0, // $0.00 starting balance
  BAILOUT_AMOUNT: 0,     // $0.00 bailout
  MIN_BET: 0.10,          // $0.10
  MAX_BET: 1000000,       // $1,000,000.00
  DAILY_REWARD_BASE: 0,   // $0.00 daily reward
  REVEAL_DELAY_MS: 80,
  MAX_HISTORY: 50,
};

export const DIFFICULTY_PRESETS = [
  {
    id: 'safe',
    name: 'Safe Mode',
    emoji: '🟢',
    guesses: 250,
    description: '25% chance',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    emoji: '🟡',
    guesses: 100,
    description: '10% chance',
  },
  {
    id: 'risky',
    name: 'Risky',
    emoji: '🔴',
    guesses: 10,
    description: '1% chance',
  },
  {
    id: 'yolo',
    name: 'YOLO',
    emoji: '💀',
    guesses: 1,
    description: '0.1% chance',
  },
];

export const ACHIEVEMENTS = [
  {
    id: 'first_mine',
    name: 'First Mine',
    icon: '🏁',
    description: 'Win your first game',
    condition: (stats) => stats.totalWins >= 1,
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    icon: '💰',
    description: 'Bet $500+ in a single game',
    condition: (stats) => stats.highestBet >= 500,
  },
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    icon: '🔥',
    description: 'Win 3 games in a row',
    condition: (stats) => stats.maxWinStreak >= 3,
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    icon: '💎',
    description: 'Reach $100,000 balance',
    condition: (stats) => stats.peakBalance >= 100000,
  },
  {
    id: 'yolo_master',
    name: 'YOLO Master',
    icon: '💀',
    description: 'Win on 1-guess mode',
    condition: (stats) => stats.yoloWins >= 1,
  },
  {
    id: 'rock_bottom',
    name: 'Rock Bottom',
    icon: '📉',
    description: 'Go bankrupt',
    condition: (stats) => stats.timesBankrupt >= 1,
  },
  {
    id: 'dedicated_miner',
    name: 'Dedicated Miner',
    icon: '🗓️',
    description: '7-day login streak',
    condition: (stats) => stats.maxLoginStreak >= 7,
  },
];

export const STORAGE_KEYS = {
  BALANCE: 'btcfinder_balance',
  HISTORY: 'btcfinder_history',
  STATS: 'btcfinder_stats',
  ACHIEVEMENTS: 'btcfinder_achievements',
  DAILY_REWARD: 'btcfinder_daily_reward',
  LEADERBOARD: 'btcfinder_leaderboard',
  INITIALIZED: 'btcfinder_initialized',
  PROFILE: 'btcfinder_profile',
  LEDGER: 'btcfinder_ledger',
  RAKEBACK: 'btcfinder_rakeback',
};

// Slots Configuration
export const SLOTS_CONFIG = {
  MIN_BET_PER_LINE: 0.01,
  MAX_BET_PER_LINE: 125000.00,  // 8 lines × $125k = $1,000,000 max
  DEFAULT_BET_PER_LINE: 0.20,
  MAX_LINES: 8,
  SPIN_DURATION_MS: 1500,
  REEL_DELAY_MS: 250,
  
  SYMBOLS: [
    { id: 'wild',      label: '⭐', name: 'Wild Star',     color: '#ff00ff', weight: 8,  multiplier: 2.0, twoMultiplier: 0.12 },
    { id: 'btc',       label: '₿',  name: 'Bitcoin',       color: '#f7931a', weight: 16, multiplier: 1.5, twoMultiplier: 0.10 },
    { id: 'diamond',   label: '💎', name: 'Diamond Hands', color: '#00d4ff', weight: 18, multiplier: 1.3, twoMultiplier: 0.08 },
    { id: 'rocket',    label: '🚀', name: 'To The Moon',   color: '#6c5ce7', weight: 17, multiplier: 1.2, twoMultiplier: 0.06 },
    { id: 'lightning', label: '⚡', name: 'Lightning',     color: '#ffeb3b', weight: 16, multiplier: 1.0, twoMultiplier: 0.05 },
    { id: 'eth',       label: '🪙', name: 'Ethereum',      color: '#8b949e', weight: 14, multiplier: 0.8, twoMultiplier: 0.03 },
    { id: 'doge',      label: '🐶', name: 'Dogecoin',      color: '#ba9f33', weight: 11, multiplier: 0.5, twoMultiplier: 0.00 },
  ],

  
  PAYLINES: [
    // Horizontal lines
    { id: 1, name: 'Middle Row',    path: [[1, 0], [1, 1], [1, 2]], color: '#00ff88' },
    { id: 2, name: 'Top Row',       path: [[0, 0], [0, 1], [0, 2]], color: '#00d4ff' },
    { id: 3, name: 'Bottom Row',    path: [[2, 0], [2, 1], [2, 2]], color: '#ff4757' },
    // Diagonal lines
    { id: 4, name: 'Diagonal Down', path: [[0, 0], [1, 1], [2, 2]], color: '#f7931a' },
    { id: 5, name: 'Diagonal Up',   path: [[2, 0], [1, 1], [0, 2]], color: '#a020f0' },
    // Vertical column lines (NEW)
    { id: 6, name: 'Left Column',   path: [[0, 0], [1, 0], [2, 0]], color: '#ff6b6b' },
    { id: 7, name: 'Mid Column',    path: [[0, 1], [1, 1], [2, 1]], color: '#ffd93d' },
    { id: 8, name: 'Right Column',  path: [[0, 2], [1, 2], [2, 2]], color: '#6bcb77' },
  ],
};

// VIP Tier Configuration
export const VIP_CONFIG = [
  {
    id: 'wood',
    name: 'Wood',
    emoji: '🪵',
    minWager: 0,
    maxWager: 99.99,
    rakebackPct: 0,
    color: '#a0855b',
    glow: 'rgba(160,133,91,0.3)',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    emoji: '🥉',
    minWager: 100,
    maxWager: 499.99,
    rakebackPct: 1,
    color: '#cd7f32',
    glow: 'rgba(205,127,50,0.35)',
  },
  {
    id: 'silver',
    name: 'Silver',
    emoji: '🥈',
    minWager: 500,
    maxWager: 2499.99,
    rakebackPct: 2,
    color: '#c0c0c0',
    glow: 'rgba(192,192,192,0.35)',
  },
  {
    id: 'gold',
    name: 'Gold',
    emoji: '🥇',
    minWager: 2500,
    maxWager: 9999.99,
    rakebackPct: 3,
    color: '#ffd700',
    glow: 'rgba(255,215,0,0.4)',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    emoji: '💠',
    minWager: 10000,
    maxWager: 49999.99,
    rakebackPct: 4,
    color: '#00d4ff',
    glow: 'rgba(0,212,255,0.4)',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    minWager: 50000,
    maxWager: Infinity,
    rakebackPct: 5,
    color: '#a020f0',
    glow: 'rgba(160,32,240,0.5)',
  },
];

export const PLAYER_AVATARS = [
  { id: 'miner',    emoji: '⛏️',  label: 'BTC Miner' },
  { id: 'astronaut',emoji: '🚀',  label: 'Astronaut' },
  { id: 'diamond',  emoji: '💎',  label: 'Diamond Hands' },
  { id: 'hodl',     emoji: '🪙',  label: 'HODLer' },
  { id: 'bull',     emoji: '🐂',  label: 'Crypto Bull' },
  { id: 'dice',     emoji: '🎲',  label: 'Roll Master' },
  { id: 'wizard',   emoji: '🧙',  label: 'Degen Wizard' },
  { id: 'robot',    emoji: '🤖',  label: 'Trading Bot' },
];

export const PLINKO_CONFIG = {
  8: {
    low:    [5.6, 1.6, 1.1, 1.0, 0.5, 1.0, 1.1, 1.6, 5.6],
    medium: [13,  3,   1.3, 0.7, 0.4, 0.7, 1.3, 3,   13],
    high:   [29,  4,   1.5, 0.3, 0.2, 0.3, 1.5, 4,   29]
  },
  12: {
    low:    [10,  5,   2,   1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 2,   5,   10],
    medium: [33,  11,  4,   1.1, 0.6, 0.3, 0.3, 0.3, 0.6, 1.1, 4,   11,  33],
    high:   [170, 9,   2,   1.4, 0.6, 0.3, 0.2, 0.3, 0.6, 1.4, 2,   9,   170]
  },
  16: {
    low:    [16,   9,   2,   1.4, 1.3, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.3, 1.4, 2,   9,   16],
    medium: [110,  41,  10,  5,   3,   1.3, 0.5, 0.3, 0.3, 0.3, 0.5, 1.3, 3,   5,   10,  41,  110],
    high:   [1000, 130, 26,  9,   4,   2,   0.2, 0.2, 0.2, 0.2, 0.2, 2,   4,   9,   26,  130, 1000]
  }
};
