/**
 * Computes combinations nCr = n! / (r! * (n - r)!)
 * Optimized iteratively to prevent floating-point and numerical overflows.
 */
export function combinations(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  
  // Take advantage of symmetry: nCr = nC(n-r)
  const k = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = res * (n - i + 1) / i;
  }
  return res;
}

/**
 * Calculates provably fair multiplier for Mines based on combinatorial odds
 * with a precise 1% house edge (99% RTP).
 */
export function getMinesMultiplier(minesCount, gemsFound) {
  if (gemsFound <= 0) return 1;
  const totalWays = combinations(25, minesCount);
  const remainingWays = combinations(25 - gemsFound, minesCount);
  
  if (remainingWays === 0) return 0;
  
  // Multiplier = 0.99 * (Total Ways / Remaining Ways)
  const mult = 0.99 * (totalWays / remainingWays);
  return Number(mult.toFixed(2));
}
