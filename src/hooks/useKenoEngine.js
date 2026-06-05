'use client';

import { useState, useCallback, useRef } from 'react';
import { useBalance } from '@/hooks/useBalance';
import { addGameResult, updateStats } from '@/lib/storage';
import { parseShorthand } from '@/lib/utils';

// ============================================================
// Keno Pay Tables for 40-square game (10 numbers drawn)
// risk → pickCount → array of multipliers [0 matches, 1 match, ..., pickCount matches]
// ============================================================
const KENO_PAY_TABLES = {
  classic: {
    1:  [0.0, 3.96],
    2:  [0.0, 1.9, 4.5],
    3:  [0.0, 1.0, 3.1, 10.4],
    4:  [0.0, 0.8, 1.8, 5.0, 22.5],
    5:  [0.0, 0.25, 1.4, 4.1, 16.5, 36.0],
    6:  [0.0, 0.0, 1.0, 3.68, 7.0, 16.5, 40.0],
    7:  [0.0, 0.0, 0.47, 3.0, 4.5, 14.0, 31.0, 60.0],
    8:  [0.0, 0.0, 0.0, 2.2, 4.0, 13.0, 22.0, 55.0, 70.0],
    9:  [0.0, 0.0, 0.0, 1.55, 3.0, 8.0, 15.0, 44.0, 60.0, 85.0],
    10: [0.0, 0.0, 0.0, 1.4, 2.25, 4.5, 8.0, 17.0, 50.0, 80.0, 100.0]
  },
  low: {
    1:  [0.7, 1.85],
    2:  [0.0, 2.0, 3.8],
    3:  [0.0, 1.1, 1.38, 26.0],
    4:  [0.0, 0.0, 2.2, 7.9, 90.0],
    5:  [0.0, 0.0, 1.5, 4.2, 13.0, 300.0],
    6:  [0.0, 0.0, 1.1, 2.0, 6.2, 100.0, 700.0],
    7:  [0.0, 0.0, 1.1, 1.6, 3.5, 15.0, 225.0, 700.0],
    8:  [0.0, 0.0, 1.1, 1.5, 2.0, 5.5, 39.0, 100.0, 800.0],
    9:  [0.0, 0.0, 1.1, 1.3, 1.7, 2.5, 7.5, 50.0, 250.0, 1000.0],
    10: [0.0, 0.0, 1.1, 1.2, 1.3, 1.8, 3.5, 13.0, 50.0, 250.0, 1000.0]
  },
  medium: {
    1:  [0.4, 2.75],
    2:  [0.0, 1.8, 5.1],
    3:  [0.0, 0.0, 2.8, 50.0],
    4:  [0.0, 0.0, 1.7, 10.0, 100.0],
    5:  [0.0, 0.0, 1.4, 4.0, 14.0, 390.0],
    6:  [0.0, 0.0, 0.0, 3.0, 9.0, 180.0, 710.0],
    7:  [0.0, 0.0, 0.0, 2.0, 7.0, 30.0, 400.0, 800.0],
    8:  [0.0, 0.0, 0.0, 2.0, 4.0, 11.0, 67.0, 400.0, 900.0],
    9:  [0.0, 0.0, 0.0, 2.0, 2.5, 5.0, 15.0, 100.0, 500.0, 1000.0],
    10: [0.0, 0.0, 0.0, 1.6, 2.0, 4.0, 7.0, 26.0, 100.0, 500.0, 1000.0]
  },
  high: {
    1:  [0.0, 3.96],
    2:  [0.0, 0.0, 17.1],
    3:  [0.0, 0.0, 0.0, 81.5],
    4:  [0.0, 0.0, 0.0, 10.0, 259.0],
    5:  [0.0, 0.0, 0.0, 4.5, 48.0, 450.0],
    6:  [0.0, 0.0, 0.0, 0.0, 11.0, 350.0, 710.0],
    7:  [0.0, 0.0, 0.0, 0.0, 7.0, 90.0, 400.0, 800.0],
    8:  [0.0, 0.0, 0.0, 0.0, 5.0, 20.0, 270.0, 600.0, 900.0],
    9:  [0.0, 0.0, 0.0, 0.0, 4.0, 11.0, 56.0, 500.0, 800.0, 1000.0],
    10: [0.0, 0.0, 0.0, 0.0, 3.5, 8.0, 13.0, 63.0, 500.0, 800.0, 1000.0]
  }
};

/**
 * Look up the multiplier for a given risk, pick count and match count.
 * Returns 0 if no entry found.
 */
export function getKenoMultiplier(risk, pickCount, matchCount) {
  const riskTable = KENO_PAY_TABLES[risk] || KENO_PAY_TABLES['classic'];
  const row = riskTable[pickCount];
  if (!row) return 0;
  return row[matchCount] ?? 0;
}

/**
 * Draw 10 unique random numbers from 1-40
 */
function drawNumbers() {
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const drawn = [];
  while (drawn.length < 10) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn;
}

// ============================================================
// Hook
// ============================================================
export function useKenoEngine() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();

  const [betAmount, setBetAmount] = useState(100);    // in satoshis / cents
  const [risk, setRisk] = useState('classic');         // 'classic' | 'low' | 'medium' | 'high'
  const [picks, setPicks] = useState(new Set());       // chosen numbers 1-40
  const [drawn, setDrawn] = useState([]);              // 10 drawn numbers (revealed progressively)
  const [allDrawn, setAllDrawn] = useState([]);        // full draw result (after animation)
  const [matched, setMatched] = useState(new Set());   // intersection of picks & drawn
  const [gamePhase, setGamePhase] = useState('idle');  // 'idle' | 'drawing' | 'result'
  const [multiplier, setMultiplier] = useState(0);
  const [payout, setPayout] = useState(0);
  const [won, setWon] = useState(false);
  const [error, setError] = useState('');

  const intervalRef = useRef(null);

  // -----------------------------------------------------------
  // Toggle a number in/out of picks
  // -----------------------------------------------------------
  const togglePick = useCallback((num) => {
    if (gamePhase !== 'idle') return;
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        if (next.size >= 10) return prev; // max 10
        next.add(num);
      }
      return next;
    });
  }, [gamePhase]);

  // -----------------------------------------------------------
  // Clear all picks
  // -----------------------------------------------------------
  const clearPicks = useCallback(() => {
    if (gamePhase !== 'idle') return;
    setPicks(new Set());
  }, [gamePhase]);

  // -----------------------------------------------------------
  // Play a round
  // -----------------------------------------------------------
  const playRound = useCallback(async () => {
    setError('');

    if (picks.size < 1) {
      setError('Pick at least 1 number before playing!');
      return;
    }
    if (betAmount < 0.10) {
      setError('Minimum bet is $0.10.');
      return;
    }
    if (betAmount > balance) {
      setError('Insufficient balance.');
      return;
    }

    // Deduct bet
    try {
      await subtractBalance(betAmount);
    } catch {
      setError('Insufficient balance.');
      return;
    }

    // Draw 10 numbers
    const drawnNumbers = drawNumbers();
    const picksArray = Array.from(picks);
    const matchSet = new Set(picksArray.filter((n) => drawnNumbers.includes(n)));
    const matchCount = matchSet.size;
    const mult = getKenoMultiplier(risk, picks.size, matchCount);
    const isWon = mult > 0;
    const payoutAmt = isWon ? Math.round(betAmount * mult * 100) / 100 : 0;

    // Save full draw result for logging after animation
    setAllDrawn(drawnNumbers);
    setMatched(matchSet);
    setMultiplier(mult);
    setPayout(payoutAmt);
    setWon(isWon);

    // Start animated reveal
    setGamePhase('drawing');
    setDrawn([]);

    let revealIdx = 0;
    intervalRef.current = setInterval(() => {
      revealIdx += 1;
      setDrawn(drawnNumbers.slice(0, revealIdx));

      if (revealIdx >= drawnNumbers.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setGamePhase('result');

        // Credit winnings
        if (isWon && payoutAmt > 0) {
          addBalance(payoutAmt);
        }

        // Log game result
        const result = {
          won: isWon,
          bet: betAmount,
          payout: payoutAmt,
          guessCount: picks.size,
          secretNumber: drawnNumbers.join(','),
          matchedGuess: matchCount,
          multiplier: mult.toFixed(2),
          gameType: 'keno',
        };
        addGameResult(result);
        updateStats(result);
      }
    }, 80);
  }, [picks, betAmount, risk, balance, subtractBalance, addBalance]);

  // -----------------------------------------------------------
  // Reset to idle
  // -----------------------------------------------------------
  const resetGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDrawn([]);
    setAllDrawn([]);
    setMatched(new Set());
    setMultiplier(0);
    setPayout(0);
    setWon(false);
    setGamePhase('idle');
    setError('');
  }, []);

  return {
    // balance
    balance,
    isLoaded,
    // state
    betAmount,
    setBetAmount,
    risk,
    setRisk,
    picks,
    drawn,
    allDrawn,
    matched,
    gamePhase,
    multiplier,
    payout,
    won,
    error,
    setError,
    // actions
    togglePick,
    clearPicks,
    playRound,
    resetGame,
    // helpers
    getKenoMultiplier,
    KENO_PAY_TABLES,
  };
}
