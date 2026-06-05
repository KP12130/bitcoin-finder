'use client';

import { useState, useCallback, useRef } from 'react';
import { useBalance } from '@/hooks/useBalance';
import { useAchievements } from '@/hooks/useAchievements';
import { addGameResult, updateStats } from '@/lib/storage';

// --- Symbols ---
export const SYMBOLS = [
  { id: 'diamond', emoji: '💎', label: 'Diamond', multiplier: 50, weight: 1 },
  { id: 'rocket',  emoji: '🚀', label: 'Rocket',  multiplier: 25, weight: 2 },
  { id: 'star',    emoji: '⭐', label: 'Star',    multiplier: 10, weight: 5 },
  { id: 'bitcoin', emoji: '₿',  label: 'Bitcoin', multiplier: 5,  weight: 10 },
  { id: 'bell',    emoji: '🔔', label: 'Bell',    multiplier: 3,  weight: 18 },
  { id: 'clover',  emoji: '🍀', label: 'Clover',  multiplier: 2,  weight: 28 },
  { id: 'lemon',   emoji: '🍋', label: 'Lemon',   multiplier: 1,  weight: 40 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);

function pickWeightedSymbol() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function generateCard() {
  const panels = Array(9).fill(null);

  // 29% chance of guaranteed win (RTP ~96.5%)
  const isWin = Math.random() < 0.29;

  if (isWin) {
    const winSym = pickWeightedSymbol();
    // Choose 3 random positions for the winning symbol
    const positions = [...Array(9).keys()].sort(() => Math.random() - 0.5).slice(0, 3);
    
    // Place winning symbol
    positions.forEach(pos => { panels[pos] = winSym; });

    // Fill other positions ensuring no other triple is formed
    for (let i = 0; i < 9; i++) {
      if (panels[i] === null) {
        let sym;
        let attempts = 0;
        do {
          sym = pickWeightedSymbol();
          attempts++;
          const count = panels.filter(p => p && p.id === sym.id).length;
          if (count < 2 && sym.id !== winSym.id) {
            break;
          }
        } while (attempts < 50);
        panels[i] = sym;
      }
    }
  } else {
    // Fill all 9 positions ensuring no symbol appears 3 or more times (loss)
    const counts = {};
    for (let i = 0; i < 9; i++) {
      let sym;
      let attempts = 0;
      do {
        sym = pickWeightedSymbol();
        attempts++;
        const count = counts[sym.id] || 0;
        if (count < 2) {
          counts[sym.id] = count + 1;
          break;
        }
      } while (attempts < 50);
      panels[i] = sym;
    }
  }

  return panels;
}

function evaluatePanels(panels, bet) {
  // Count occurrences of each symbol
  const counts = {};
  for (const sym of panels) {
    counts[sym.id] = (counts[sym.id] || 0) + 1;
  }

  // Find best (highest multiplier) symbol with 3+ matches
  let best = null;
  for (const sym of SYMBOLS) {
    if ((counts[sym.id] || 0) >= 3) {
      if (!best || sym.multiplier > best.multiplier) {
        best = sym;
      }
    }
  }

  if (!best) {
    return { won: false, multiplier: 0, symbol: null, payout: 0 };
  }

  const multiplier = best.multiplier * 0.99; // 1% house edge
  const payout = Math.round(bet * multiplier);
  return { won: true, multiplier: best.multiplier, symbol: best, payout };
}

// --- Hook ---
export function useScratchEngine() {
  const { balance, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();

  const [betAmount, setBetAmount] = useState(100);
  const [gamePhase, setGamePhase] = useState('idle'); // 'idle' | 'scratching' | 'result'
  const [panels, setPanels] = useState(Array(9).fill(null));
  const [revealed, setRevealed] = useState(Array(9).fill(false));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Track if we've already finalised (to avoid double-calling on revealAll)
  const finalisedRef = useRef(false);

  // --- Finalise card after all revealed ---
  const finaliseCard = useCallback(async (currentPanels, bet) => {
    if (finalisedRef.current) return;
    finalisedRef.current = true;

    const evaluation = evaluatePanels(currentPanels, bet);
    setResult(evaluation);
    setGamePhase('result');

    if (evaluation.won) {
      await addBalance(evaluation.payout);
    }

    addGameResult({
      won: evaluation.won,
      bet,
      payout: evaluation.payout,
      multiplier: evaluation.won ? evaluation.multiplier : 0,
      symbol: evaluation.symbol?.id || null,
      gameType: 'scratch',
      secretNumber: null,
      matchedGuess: evaluation.symbol?.emoji || null,
      guessCount: 9,
    });

    updateStats({
      won: evaluation.won,
      bet,
      payout: evaluation.payout,
      gameType: 'scratch',
    });

    checkAchievements();
  }, [addBalance, checkAchievements]);

  // --- Buy Card ---
  const buyCard = useCallback(async () => {
    setError('');
    if (betAmount <= 0) {
      setError('Bet must be greater than 0');
      return;
    }
    if (betAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    try {
      await subtractBalance(betAmount);
    } catch {
      setError('Insufficient balance');
      return;
    }

    const newPanels = generateCard();
    finalisedRef.current = false;

    setPanels(newPanels);
    setRevealed(Array(9).fill(false));
    setResult(null);
    setGamePhase('scratching');
  }, [betAmount, balance, subtractBalance]);

  // --- Reveal single panel ---
  const revealPanel = useCallback((index) => {
    if (gamePhase !== 'scratching') return;

    setRevealed((prev) => {
      if (prev[index]) return prev; // already revealed
      const next = [...prev];
      next[index] = true;

      // Check if all revealed
      if (next.every(Boolean)) {
        // Use setTimeout to let state settle before finalising
        setTimeout(() => {
          setPanels((currentPanels) => {
            finaliseCard(currentPanels, betAmount);
            return currentPanels;
          });
        }, 400);
      }

      return next;
    });
  }, [gamePhase, betAmount, finaliseCard]);

  // --- Reveal All ---
  const revealAll = useCallback(() => {
    if (gamePhase !== 'scratching') return;

    setRevealed(Array(9).fill(true));

    setTimeout(() => {
      setPanels((currentPanels) => {
        finaliseCard(currentPanels, betAmount);
        return currentPanels;
      });
    }, 600);
  }, [gamePhase, betAmount, finaliseCard]);

  // --- Reset ---
  const resetCard = useCallback(() => {
    setGamePhase('idle');
    setPanels(Array(9).fill(null));
    setRevealed(Array(9).fill(false));
    setResult(null);
    setError('');
    finalisedRef.current = false;
  }, []);

  return {
    // State
    betAmount,
    setBetAmount,
    gamePhase,
    panels,
    revealed,
    result,
    error,
    balance,
    // Actions
    buyCard,
    revealPanel,
    revealAll,
    resetCard,
    // Data
    SYMBOLS,
  };
}
