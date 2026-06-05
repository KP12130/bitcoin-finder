'use client';

// Helper to generate a random 32-character hex string (Server Seed)
function generateRandomSeed() {
  if (typeof window === 'undefined') return '';
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Basic async SHA-256 hash using Web Crypto API
export async function calculateSha256(message) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return '';
  }
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return '';
  }
}

// Retrieve Client Seed
export function getClientSeed() {
  if (typeof window === 'undefined') return 'client_satoshi_seed_777';
  const stored = localStorage.getItem('btcfinder_client_seed');
  if (!stored) {
    localStorage.setItem('btcfinder_client_seed', 'client_satoshi_seed_777');
    return 'client_satoshi_seed_777';
  }
  return stored;
}

// Update Client Seed
export function setClientSeed(seed) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('btcfinder_client_seed', seed.trim() || 'client_satoshi_seed_777');
  // Dispatch event so other components sync
  window.dispatchEvent(new Event('vip-settings-update'));
}

// Retrieve Nonce for a specific game type
export function getNonce(gameType) {
  if (typeof window === 'undefined') return 0;
  const key = `btcfinder_nonce_${gameType}`;
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, '0');
    return 0;
  }
  return parseInt(stored, 10);
}

// Increment Nonce
export function incrementNonce(gameType) {
  if (typeof window === 'undefined') return 0;
  const key = `btcfinder_nonce_${gameType}`;
  const next = getNonce(gameType) + 1;
  localStorage.setItem(key, next.toString());
  window.dispatchEvent(new Event('vip-settings-update'));
  return next;
}

// Reset Nonce
export function resetNonce(gameType) {
  if (typeof window === 'undefined') return;
  const key = `btcfinder_nonce_${gameType}`;
  localStorage.setItem(key, '0');
  window.dispatchEvent(new Event('vip-settings-update'));
}

// Retrieve Active Server Seed (generates if missing)
export function getActiveServerSeed(gameType) {
  if (typeof window === 'undefined') return '';
  const key = `btcfinder_server_seed_${gameType}`;
  let seed = localStorage.getItem(key);
  if (!seed) {
    seed = generateRandomSeed();
    localStorage.setItem(key, seed);
  }
  return seed;
}

// Hashed Active Server Seed
export function getActiveServerSeedHash(gameType) {
  if (typeof window === 'undefined') return '';
  const key = `btcfinder_server_seed_hash_${gameType}`;
  const seed = getActiveServerSeed(gameType);
  
  // Return synchronous cached hash if available, otherwise trigger calculations
  let cachedHash = localStorage.getItem(key);
  if (!cachedHash && seed) {
    calculateSha256(seed).then(hash => {
      if (hash) localStorage.setItem(key, hash);
    });
    // Fallback static indicator until calculation returns
    return 'Loading hash...';
  }
  return cachedHash || 'Hashing seed...';
}

// Re-generate Server Seed (commits previous seed to history for verification)
export function rollServerSeed(gameType) {
  if (typeof window === 'undefined') return;
  const currentSeedKey = `btcfinder_server_seed_${gameType}`;
  const prevSeed = localStorage.getItem(currentSeedKey) || getActiveServerSeed(gameType);

  // Commit previous unhashed seed so user can inspect it
  localStorage.setItem(`btcfinder_prev_server_seed_${gameType}`, prevSeed);

  // Generate new server seed
  const nextSeed = generateRandomSeed();
  localStorage.setItem(currentSeedKey, nextSeed);

  // Re-hash next seed
  calculateSha256(nextSeed).then(hash => {
    localStorage.setItem(`btcfinder_server_seed_hash_${gameType}`, hash);
    window.dispatchEvent(new Event('vip-settings-update'));
  });

  // Reset nonce
  resetNonce(gameType);
}

// Get Previous Round Info for auditing
export function getPreviousRoundInfo(gameType) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`btcfinder_prev_round_${gameType}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

// Save Completed Round Info
export function savePreviousRoundInfo(gameType, serverSeed, clientSeed, nonce, resultHash, outcomeDesc) {
  if (typeof window === 'undefined') return;
  const info = {
    serverSeed,
    clientSeed,
    nonce,
    resultHash,
    outcomeDesc,
    timestamp: Date.now()
  };
  localStorage.setItem(`btcfinder_prev_round_${gameType}`, JSON.stringify(info));
  window.dispatchEvent(new Event('vip-settings-update'));
}

// Deterministic random float generator using SHA-256 hex string
// Extracts 8 character chunks (32 bits), parses as int, maps to [0.0, 1.0)
export function hashToRandomFloats(hashHex, count = 10) {
  const floats = [];
  for (let i = 0; i < count; i++) {
    const start = (i * 8) % (hashHex.length - 8);
    const chunk = hashHex.slice(start, start + 8);
    const intVal = parseInt(chunk, 16);
    floats.push(intVal / 0xffffffff);
  }
  return floats;
}

// Returns a single deterministic float in [0.0, 1.0) for active round
export async function getDeterministicFloat(gameType) {
  const sSeed = getActiveServerSeed(gameType);
  const cSeed = getClientSeed();
  const nonceVal = getNonce(gameType);

  const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
  const hash = await calculateSha256(comboStr);
  const floats = hashToRandomFloats(hash, 1);
  return floats[0];
}

// Deterministic array shuffle (Fisher-Yates) using seed hashing
export async function getDeterministicShuffle(gameType, arrayToShuffle) {
  const sSeed = getActiveServerSeed(gameType);
  const cSeed = getClientSeed();
  const nonceVal = getNonce(gameType);

  const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
  const hash = await calculateSha256(comboStr);
  // generate 100 floats to be safe
  const floats = hashToRandomFloats(hash, 100);

  const result = [...arrayToShuffle];
  let floatIdx = 0;
  for (let i = result.length - 1; i > 0; i--) {
    const float = floats[floatIdx % floats.length];
    floatIdx++;
    const j = Math.floor(float * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
