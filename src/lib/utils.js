import { GAME_CONFIG } from './constants';

/**
 * Generate a cryptographically-ish random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate the secret target number
 */
export function generateSecretNumber() {
  return randomInt(GAME_CONFIG.MIN_NUMBER, GAME_CONFIG.MAX_NUMBER);
}

/**
 * Generate an array of unique random guesses
 */
export function generateGuesses(count) {
  const guesses = new Set();
  while (guesses.size < count) {
    guesses.add(randomInt(GAME_CONFIG.MIN_NUMBER, GAME_CONFIG.MAX_NUMBER));
  }
  return Array.from(guesses);
}

/**
 * Calculate payout with 2% house edge
 * payout = bet × (1000 / guessCount) × 0.98
 */
export function calculatePayout(bet, guessCount) {
  const multiplier = (GAME_CONFIG.MAX_NUMBER / guessCount) * (1 - GAME_CONFIG.HOUSE_EDGE);
  return parseFloat((bet * multiplier).toFixed(2));
}

/**
 * Get the multiplier for a given guess count
 */
export function getMultiplier(guessCount) {
  return ((GAME_CONFIG.MAX_NUMBER / guessCount) * (1 - GAME_CONFIG.HOUSE_EDGE)).toFixed(2);
}

/**
 * Get win probability as percentage
 */
export function getWinChance(guessCount) {
  return ((guessCount / GAME_CONFIG.MAX_NUMBER) * 100).toFixed(1);
}

/**
 * Format a number as active currency display (dynamically converts from USD base)
 */
export function formatBTC(amount) {
  if (amount === undefined || amount === null) return '$0.00';

  let currency = 'USD';
  let price = 1.0;

  if (typeof window !== 'undefined') {
    currency = window.__activeCurrency || 'USD';
    price = window.__activeCurrencyPrice || 1.0;
  }

  const converted = Number(amount) / price;

  const CRYPTO_DECIMALS = {
    USD: 2,
    BTC: 8,
    ETH: 6,
    SOL: 4,
    DOGE: 2,
  };

  const symbols = {
    USD: '$',
    BTC: '₿',
    ETH: '♦',
    SOL: '◎',
    DOGE: 'Ð',
  };

  const dec = CRYPTO_DECIMALS[currency] !== undefined ? CRYPTO_DECIMALS[currency] : 4;
  const sym = symbols[currency] || '$';

  const formatted = converted.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, dec),
    maximumFractionDigits: dec,
  });

  return `${sym}${formatted}`;
}

/**
 * Clamp a bet amount to the global min/max limits.
 * Also clamps to the player's available balance.
 */
export function clampBet(amount, balance) {
  const min = GAME_CONFIG.MIN_BET;
  const max = GAME_CONFIG.MAX_BET;
  const clamped = Math.min(max, Math.max(min, Number(amount) || min));
  // Never bet more than available balance
  if (balance !== undefined && balance !== null) {
    return Math.min(clamped, balance);
  }
  return clamped;
}


/**
 * Format a number with commas
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Get time remaining until next daily reward
 */
export function getTimeUntilReward(lastClaim) {
  if (!lastClaim) return null;
  const next = lastClaim + 24 * 60 * 60 * 1000;
  const remaining = next - Date.now();
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

  return { hours, minutes, seconds, total: remaining };
}

/**
 * Calculate daily reward based on streak
 */
export function calculateDailyReward(streak) {
  const base = GAME_CONFIG.DAILY_REWARD_BASE;
  if (streak >= 30) return base * 5;
  if (streak >= 7) return base * 2;
  return base;
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parses shorthand notations like "10k" or "1.5M" into integers.
 * Returns the parsed integer, or the original number if no shorthand matches.
 */
export function parseShorthand(val) {
  if (val === null || val === undefined) return 0;
  const str = String(val).trim().toUpperCase();
  
  if (str.endsWith('K')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000 * 100) / 100;
  }
  if (str.endsWith('M')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num * 1000000 * 100) / 100;
  }
  
  // Strip any non-numeric characters except dots
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}
