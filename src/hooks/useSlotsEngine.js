'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SLOTS_CONFIG, GAME_CONFIG } from '@/lib/constants';
import { addGameResult, updateStats } from '@/lib/storage';
import { playSound } from '@/lib/audio';

// Helper to select a weighted random symbol
function getRandomSymbol() {
  const totalWeight = SLOTS_CONFIG.SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const symbol of SLOTS_CONFIG.SYMBOLS) {
    r -= symbol.weight;
    if (r <= 0) {
      return symbol;
    }
  }
  return SLOTS_CONFIG.SYMBOLS[SLOTS_CONFIG.SYMBOLS.length - 1];
}

function generateRandomReel() {
  // Allow duplicates — vertical stacks of 3 can now form and pay out via column paylines
  return [
    getRandomSymbol(),
    getRandomSymbol(),
    getRandomSymbol(),
  ];
}

// Helper to generate a complete 3x3 set of reels (3 columns, 3 symbols per column)
function generateRandomReels() {
  return [
    generateRandomReel(), // Reel 1 (Col 0)
    generateRandomReel(), // Reel 2 (Col 1)
    generateRandomReel(), // Reel 3 (Col 2)
  ];
}

export function useSlotsEngine(balance, subtractBalance, addBalance, onGameFinished) {
  const [bet, setBet] = useState(100);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState(() => generateRandomReels());
  
  // Last spin outcome states
  const [winningLines, setWinningLines] = useState([]);
  const [winBreakdown, setWinBreakdown] = useState([]);
  const [payout, setPayout] = useState(0);
  const [multiplier, setMultiplier] = useState('0');
  const [lastWin, setLastWin] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);

  const autoSpinRef = useRef(false);
  const autoSpinsLeftRef = useRef(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(10); // how many spins to run
  const [autoSpinsLeft, setAutoSpinsLeft] = useState(0);  // live countdown

  // Synchronous spin solver
  const solveSpin = useCallback((currentReels, currentBet) => {
    // Map column-major (reels[col][row]) to row-major (grid[row][col]) for easy payline evaluation
    const grid = [
      [currentReels[0][0], currentReels[1][0], currentReels[2][0]], // Row 0
      [currentReels[0][1], currentReels[1][1], currentReels[2][1]], // Row 1
      [currentReels[0][2], currentReels[1][2], currentReels[2][2]], // Row 2
    ];

    const activePaylines = SLOTS_CONFIG.PAYLINES; // All 8 paylines active
    const lineBet = Math.max(1, currentBet); // Full bet is the base — each payline win pays against total bet
    const hits = [];

    activePaylines.forEach((line) => {
      const s1 = grid[line.path[0][0]][line.path[0][1]];
      const s2 = grid[line.path[1][0]][line.path[1][1]];
      const s3 = grid[line.path[2][0]][line.path[2][1]];

      // --- 3-of-a-kind check (Wilds substitute any symbol) ---
      const nonWilds = [s1, s2, s3].filter((s) => s.id !== 'wild');
      let isThreeMatch = false;
      let winningSymbol = null;

      if (nonWilds.length === 0) {
        // 3 Wildcards — pays max BTC multiplier
        isThreeMatch = true;
        winningSymbol = SLOTS_CONFIG.SYMBOLS.find((s) => s.id === 'btc');
      } else {
        const baseSymbol = nonWilds[0];
        const matchesBase = [s1, s2, s3].every(
          (s) => s.id === 'wild' || s.id === baseSymbol.id
        );
        if (matchesBase) {
          isThreeMatch = true;
          winningSymbol = baseSymbol;
        }
      }

      if (isThreeMatch && winningSymbol && winningSymbol.multiplier > 0) {
        const mult = winningSymbol.multiplier;
        const linePayout = Math.round(lineBet * mult * 100) / 100;
        hits.push({
          lineId: line.id,
          symbol: winningSymbol,
          multiplier: mult,
          payout: linePayout,
          matchCount: 3,
          path: line.path,
          color: line.color,
        });
        return; // Already a 3-of-a-kind, skip 2-of-a-kind check
      }

      // --- 2-of-a-kind — check BOTH adjacent pairs on the payline ---
      // Pair A: pos 0+1  |  Pair B: pos 1+2
      // Each independently triggers a win if they match (wilds substitute)
      const checkPair = (pA, pB, pairPath) => {
        const symA = grid[pA[0]][pA[1]];
        const symB = grid[pB[0]][pB[1]];
        const nonWildPair = [symA, symB].filter((s) => s.id !== 'wild');
        let pairSymbol = null;
        if (nonWildPair.length === 0) {
          pairSymbol = SLOTS_CONFIG.SYMBOLS.find((s) => s.id === 'wild');
        } else {
          const base = nonWildPair[0];
          if ([symA, symB].every((s) => s.id === 'wild' || s.id === base.id)) {
            pairSymbol = base;
          }
        }
        if (pairSymbol && pairSymbol.twoMultiplier > 0) {
          const linePayout2 = Math.round(lineBet * pairSymbol.twoMultiplier * 100) / 100;
          if (linePayout2 > 0) {
            hits.push({
              lineId: line.id,
              symbol: pairSymbol,
              multiplier: pairSymbol.twoMultiplier,
              payout: linePayout2,
              matchCount: 2,
              path: pairPath,
              color: line.color,
            });
          }
        }
      };

      checkPair(line.path[0], line.path[1], [line.path[0], line.path[1]]);
      checkPair(line.path[1], line.path[2], [line.path[1], line.path[2]]);

    });

    const totalPayout = hits.reduce((sum, h) => sum + h.payout, 0);
    return {
      hits,
      totalPayout,
    };
  }, []);

  const spin = useCallback(async () => {
    if (bet < GAME_CONFIG.MIN_BET) return { error: 'Minimum bet is $0.10' };
    if (bet > balance) {
      setAutoSpin(false);
      autoSpinRef.current = false;
      return { error: 'Insufficient balance' };
    }
    if (isSpinning) return { error: 'Reels are already spinning' };

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }
    setIsSpinning(true);
    setWinningLines([]);
    setWinBreakdown([]);
    setPayout(0);
    setMultiplier('0');
    playSound('spin');

    // Generate new grid outcome immediately (provably fair local generation)
    const nextReels = generateRandomReels();
    const result = solveSpin(nextReels, bet);

    // We animate the reels spin in the UI using timers, then set the final values
    setTimeout(() => {
      setReels(nextReels);
      setIsSpinning(false);
      setHasPlayed(true);

      const won = result.totalPayout > 0;
      if (won) {
        addBalance(result.totalPayout);
        setPayout(result.totalPayout);
        setLastWin(result.totalPayout);
        setWinningLines(result.hits.map(h => h.lineId));
        setWinBreakdown(result.hits);
        setMultiplier((result.totalPayout / bet).toFixed(2));
        playSound('win');
      } else {
        setPayout(0);
        setLastWin(0);
        setMultiplier('0');
        playSound('loss');
      }

      // Persist results to storage
      const gameResult = {
        won,
        bet: bet,
        payout: result.totalPayout,
        secretNumber: nextReels.map(col => col.map(s => s.label).join(',')).join('|'), // representation of grid
        matchedGuess: won ? result.hits.map(h => h.symbol.name).join(', ') : null,
        multiplier: won ? (result.totalPayout / bet).toFixed(2) : '0',
        gameType: 'slot', // Tag game type
      };

      addGameResult(gameResult);
      updateStats(gameResult);
    }, SLOTS_CONFIG.SPIN_DURATION_MS);

    return { success: true };
  }, [bet, balance, isSpinning, solveSpin, subtractBalance, addBalance]);

  // Handle auto-spinning trigger
  useEffect(() => {
    if (!autoSpin) return;
    
    // When spinning is done, wait a brief pause and spin again
    if (!isSpinning && hasPlayed) {
      const timer = setTimeout(() => {
        if (autoSpinRef.current) {
          if (bet <= balance && autoSpinsLeftRef.current > 0) {
            autoSpinsLeftRef.current -= 1;
            setAutoSpinsLeft(autoSpinsLeftRef.current);
            spin();
          } else {
            // Ran out of spins or balance
            setAutoSpin(false);
            autoSpinRef.current = false;
            autoSpinsLeftRef.current = 0;
            setAutoSpinsLeft(0);
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!isSpinning && !hasPlayed) {
      // First spin — kick it off
      if (autoSpinsLeftRef.current > 0) {
        autoSpinsLeftRef.current -= 1;
        setAutoSpinsLeft(autoSpinsLeftRef.current);
        spin();
      }
    }
  }, [autoSpin, isSpinning, hasPlayed, bet, balance, spin]);

  const toggleAutoSpin = useCallback(() => {
    setAutoSpin(prev => {
      const next = !prev;
      autoSpinRef.current = next;
      if (next) {
        // Starting — load the counter
        autoSpinsLeftRef.current = autoSpinCount;
        setAutoSpinsLeft(autoSpinCount);
      } else {
        // Stopping manually
        autoSpinsLeftRef.current = 0;
        setAutoSpinsLeft(0);
      }
      return next;
    });
  }, [autoSpinCount]);

  return {
    bet,
    setBet,
    isSpinning,
    reels,
    winningLines,
    winBreakdown,
    payout,
    multiplier,
    lastWin,
    hasPlayed,
    spin,
    autoSpin,
    toggleAutoSpin,
    autoSpinCount,
    setAutoSpinCount,
    autoSpinsLeft,
  };
}
