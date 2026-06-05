'use client';

import { useState, useCallback } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';

// ─── Red numbers in European Roulette ──────────────────────────────────────────
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function isRed(n) { return RED_NUMBERS.has(n); }
export function isBlack(n) { return n !== 0 && !RED_NUMBERS.has(n); }

// ─── Bet payouts (net multiplier, i.e. you get back bet + bet * payout) ────────
// Using RTP factor 0.99 (1% house edge) baked into payout values
const BET_PAYOUTS = {
  straight: 35,   // single number
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  '1-18': 1,
  '19-36': 1,
  dozen1: 2,
  dozen2: 2,
  dozen3: 2,
  col1: 2,
  col2: 2,
  col3: 2,
};

// ─── Evaluate a single bet against a result ────────────────────────────────────
function evaluateBet(betKey, result) {
  if (/^\d+$/.test(betKey)) {
    // straight number bet
    return parseInt(betKey, 10) === result;
  }
  if (result === 0) return false; // 0 only wins straight bets on 0

  switch (betKey) {
    case 'red':    return isRed(result);
    case 'black':  return isBlack(result);
    case 'odd':    return result % 2 === 1;
    case 'even':   return result % 2 === 0;
    case '1-18':   return result >= 1 && result <= 18;
    case '19-36':  return result >= 19 && result <= 36;
    case 'dozen1': return result >= 1 && result <= 12;
    case 'dozen2': return result >= 13 && result <= 24;
    case 'dozen3': return result >= 25 && result <= 36;
    case 'col1':   return result % 3 === 1;  // 1,4,7,10,...34
    case 'col2':   return result % 3 === 2;  // 2,5,8,11,...35
    case 'col3':   return result % 3 === 0 && result !== 0; // 3,6,9,...36
    default:       return false;
  }
}

function getPayoutMultiplier(betKey) {
  if (/^\d+$/.test(betKey)) return BET_PAYOUTS.straight;
  return BET_PAYOUTS[betKey] ?? 1;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useRouletteEngine(balance, subtractBalance, addBalance) {
  // chip size in currency units (same as balance)
  const [chipSize, setChipSize] = useState(1);
  // bets: { betKey: totalAmount }
  const [bets, setBets] = useState({});
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);       // 0-36
  const [winnings, setWinnings] = useState(null);   // net gain/loss
  const [lastResults, setLastResults] = useState([]); // last 15 results

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

  // Place chip on a bet cell — adds chipSize to existing bets[betKey]
  const placeBet = useCallback((betKey) => {
    if (spinning) return;
    setBets(prev => ({
      ...prev,
      [betKey]: Math.round(((prev[betKey] ?? 0) + chipSize) * 100) / 100,
    }));
  }, [spinning, chipSize]);

  // Clear all placed bets
  const clearBets = useCallback(() => {
    if (spinning) return;
    setBets({});
    setResult(null);
    setWinnings(null);
  }, [spinning]);

  // Main spin function
  const spin = useCallback(async () => {
    if (spinning) return;
    if (totalBet <= 0) return;
    if (totalBet > balance) return;

    setSpinning(true);
    setResult(null);
    setWinnings(null);

    try {
      console.log("spin() inside hook called");
      console.log("spin() typeof subtractBalance:", typeof subtractBalance);
      console.log("spin() typeof addBalance:", typeof addBalance);
      
      // Deduct total bet upfront
      await subtractBalance(totalBet);

      // Random European roulette result 0-36
      const spinResult = Math.floor(Math.random() * 37);
      setResult(spinResult);

      // Small delay for spin animation (controlled by page component)
      await new Promise(resolve => setTimeout(resolve, 3500));

      // Evaluate all bets
      let totalPayout = 0;
      let anyWin = false;
      const betEntries = Object.entries(bets);

      for (const [betKey, betAmount] of betEntries) {
        if (evaluateBet(betKey, spinResult)) {
          const mult = getPayoutMultiplier(betKey);
          // payout = betAmount * (mult + 1) = return stake + profit, then apply 0.99 RTP
          const payout = Math.round(betAmount * (mult + 1) * 0.99 * 100) / 100;
          totalPayout += payout;
          anyWin = true;
        }
      }

      // Credit winnings
      if (totalPayout > 0) {
        await addBalance(totalPayout);
      }

      const netGain = Math.round((totalPayout - totalBet) * 100) / 100;
      setWinnings(netGain);

      // Log game result
      addGameResult({
        won: anyWin,
        bet: totalBet,
        payout: totalPayout,
        guessCount: betEntries.length,
        secretNumber: spinResult,
        matchedGuess: anyWin ? spinResult : null,
        multiplier: totalBet > 0 ? (totalPayout / totalBet).toFixed(2) : '0',
        gameType: 'roulette',
      });

      updateStats({
        won: anyWin,
        bet: totalBet,
        payout: totalPayout,
        gameType: 'roulette',
      });

      // Track last 15 results
      setLastResults(prev => [spinResult, ...prev].slice(0, 15));
    } catch (err) {
      console.error("Roulette spin error:", err);
    } finally {
      setSpinning(false);
    }
  }, [spinning, totalBet, balance, bets, subtractBalance, addBalance]);

  return {
    chipSize,
    setChipSize,
    bets,
    placeBet,
    clearBets,
    totalBet,
    spinning,
    result,
    winnings,
    lastResults,
    spin,
  };
}
