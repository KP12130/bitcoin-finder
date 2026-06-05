'use client';

const cachedPrices = {
  BTC: 65000,
  ETH: 3400,
  LTC: 85,
  SOL: 150,
  DOGE: 0.15,
  POL: 0.45,
  USDT: 1.00,
  USDC: 1.00,
};
const lastFetched = {
  BTC: 0,
  ETH: 0,
  LTC: 0,
  SOL: 0,
  DOGE: 0,
  POL: 0,
  USDT: 0,
  USDC: 0,
};
const CACHE_TTL = 30000; // 30 seconds

const CRYPTO_DECIMALS = {
  BTC: 8,
  ETH: 6,
  LTC: 5,
  SOL: 4,
  DOGE: 2,
  POL: 4,
  USDT: 2,
  USDC: 2,
};

/**
 * Fetch the current spot price of a cryptocurrency in USD from Coinbase
 */
export async function fetchCryptoPrice(coinSymbol) {
  const coin = String(coinSymbol).toUpperCase();
  const now = Date.now();
  
  if (coin === 'USDT' || coin === 'USDC' || coin === 'USD') {
    return 1.00;
  }

  if (cachedPrices[coin] !== undefined && now - (lastFetched[coin] || 0) < CACHE_TTL) {
    return cachedPrices[coin];
  }

  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`);
    if (!res.ok) throw new Error(`Price fetch response not OK for ${coin}`);
    const data = await res.json();
    const amount = parseFloat(data.data.amount);
    if (!isNaN(amount) && amount > 0) {
      cachedPrices[coin] = amount;
      lastFetched[coin] = now;
      return cachedPrices[coin];
    }
  } catch (err) {
    console.error(`Failed to fetch ${coin} price from Coinbase:`, err);
  }
  
  return cachedPrices[coin] || 1.00;
}

/**
 * Convert USD to crypto amount using current live price
 */
export async function usdToCrypto(usdAmount, coin) {
  const price = await fetchCryptoPrice(coin);
  const cryptoAmount = Number(usdAmount) / price;
  return cryptoAmount;
}

/**
 * Convert crypto amount to USD using current live price
 */
export async function cryptoToUsd(cryptoAmount, coin) {
  const price = await fetchCryptoPrice(coin);
  const usdAmount = Number(cryptoAmount) * price;
  return Math.round(usdAmount * 100) / 100;
}

/**
 * Format a cryptocurrency amount cleanly with appropriate decimal places
 */
export function formatCryptoAmount(amount, coinSymbol) {
  const coin = String(coinSymbol).toUpperCase();
  const dec = CRYPTO_DECIMALS[coin] !== undefined ? CRYPTO_DECIMALS[coin] : 4;
  const num = Number(amount) || 0;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, dec),
    maximumFractionDigits: dec,
  });
}

// Deprecated compatibility hooks (mapped to multi-crypto engine)
export async function fetchBtcPrice() {
  return fetchCryptoPrice('BTC');
}

export async function usdToSats(usdAmount) {
  const price = await fetchCryptoPrice('BTC');
  const sats = usdAmount * (100000000 / price);
  return Math.round(sats);
}

export async function satsToUsd(satsAmount) {
  const price = await fetchCryptoPrice('BTC');
  const usd = satsAmount * (price / 100000000);
  return Math.round(usd * 100) / 100;
}
