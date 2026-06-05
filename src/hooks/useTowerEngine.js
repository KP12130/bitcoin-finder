'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { playSound } from '@/lib/audio';

// Difficulty configurations
const DIFFICULTY_CONFIGS = {
  easy: {
    tilesPerRow: 4,
    trapsPerRow: 1,
    stepMultiplier: 1.32,
    label: 'Easy',
  },
  medium: {
    tilesPerRow: 3,
    trapsPerRow: 1,
    stepMultiplier: 1.48,
    label: 'Medium',
  },
  hard: {
    tilesPerRow: 3,
    trapsPerRow: 2,
    stepMultiplier: 2.97,
    label: 'Hard',
  },
};

const TOTAL_LEVELS = 9;
const HOUSE_EDGE_FACTOR = 0.99; // 1% house edge

/**
 * Calculate the multiplier at a given level (1-indexed, i.e. after clearing N levels)
 */
function getMultiplierAtLevel(difficulty, level) {
  if (level <= 0) return 1;
  const config = DIFFICULTY_CONFIGS[difficulty];
  return HOUSE_EDGE_FACTOR * Math.pow(config.stepMultiplier, level);
}

/**
 * Generate one row of tiles using Fisher-Yates shuffle.
 * Returns an array of booleans: true = safe, false = trap
 */
function generateRow(tilesPerRow, trapsPerRow) {
  const row = [];
  for (let i = 0; i < tilesPerRow; i++) {
    row.push(i >= trapsPerRow); // first N are traps, rest safe
  }
  // Fisher-Yates Shuffle
  for (let i = row.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [row[i], row[j]] = [row[j], row[i]];
  }
  return row;
}

/**
 * Generate the full 9-level grid
 */
function generateGrid(difficulty) {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const grid = [];
  for (let level = 0; level < TOTAL_LEVELS; level++) {
    grid.push(generateRow(config.tilesPerRow, config.trapsPerRow));
  }
  return grid;
}

export function useTowerEngine(balance, subtractBalance, addBalance, onFinished) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_tower');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [difficulty, setDifficulty] = useState(savedState ? savedState.difficulty : 'easy');
  const [gameState, setGameState] = useState(savedState ? savedState.gameState : 'idle');
  const [currentLevel, setCurrentLevel] = useState(savedState ? savedState.currentLevel : 0);
  const [grid, setGrid] = useState(savedState ? savedState.grid : []);
  const [revealed, setRevealed] = useState(savedState ? savedState.revealed : {});
  const [towerHistory, setTowerHistory] = useState(savedState ? savedState.towerHistory : []);
  const [lastResult, setLastResult] = useState(null);

  // Sync state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing';
    if (isActive) {
      localStorage.setItem('btcfinder_active_tower', JSON.stringify({
        betAmount,
        difficulty,
        gameState,
        currentLevel,
        grid,
        revealed,
        towerHistory
      }));
    } else {
      localStorage.removeItem('btcfinder_active_tower');
    }
  }, [gameState, betAmount, difficulty, currentLevel, grid, revealed, towerHistory]); // { won, payout, multiplier }

  const config = DIFFICULTY_CONFIGS[difficulty];

  // Precompute all multipliers for the ladder display
  const multiplierLadder = useMemo(() => {
    const ladder = [];
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
      ladder.push({
        level,
        multiplier: getMultiplierAtLevel(difficulty, level),
      });
    }
    return ladder;
  }, [difficulty]);

  // Current multiplier (based on levels cleared so far)
  const currentMultiplier = useMemo(() => {
    return getMultiplierAtLevel(difficulty, currentLevel);
  }, [difficulty, currentLevel]);

  // Next multiplier (what you'd get by clearing the next level)
  const nextMultiplier = useMemo(() => {
    if (currentLevel >= TOTAL_LEVELS) return currentMultiplier;
    return getMultiplierAtLevel(difficulty, currentLevel + 1);
  }, [difficulty, currentLevel, currentMultiplier]);

  // Current potential payout
  const currentPayout = useMemo(() => {
    return Math.round(betAmount * currentMultiplier * 100) / 100;
  }, [betAmount, currentMultiplier]);

  // Start a new game
  const startGame = useCallback(async () => {
    if (balance < betAmount) {
      return { error: 'Insufficient balance' };
    }
    if (betAmount < GAME_CONFIG.MIN_BET || betAmount > GAME_CONFIG.MAX_BET) {
      return { error: 'Minimum bet is $0.10' };
    }

    try { await subtractBalance(betAmount); } catch (e) { return { error: 'Insufficient balance' }; }

    const newGrid = generateGrid(difficulty);
    setGrid(newGrid);
    setRevealed({});
    setTowerHistory([]);
    setCurrentLevel(0);
    setGameState('playing');
    setLastResult(null);

    playSound('slide');

    return { success: true };
  }, [balance, betAmount, difficulty, subtractBalance]);

  // Click a tile at a specific level and index
  const clickTile = useCallback((level, index) => {
    if (gameState !== 'playing' || level !== currentLevel || revealed[`${level}-${index}`]) return null;

    // Mark this tile as revealed
    const newRevealed = { ...revealed, [`${level}-${index}`]: true };
    setRevealed(newRevealed);

    const isSafe = grid[level][index];

    if (!isSafe) {
      // 💀 Hit a trap! Game over.
      // Reveal all tiles on all levels
      const fullReveal = {};
      for (let l = 0; l < TOTAL_LEVELS; l++) {
        for (let t = 0; t < grid[l].length; t++) {
          fullReveal[`${l}-${t}`] = true;
        }
      }
      setRevealed(fullReveal);
      setGameState('lost');
      playSound('explosion');

      const result = {
        won: false,
        bet: betAmount,
        payout: 0,
        guessCount: currentLevel,
        secretNumber: TOTAL_LEVELS,
        matchedGuess: null,
        multiplier: '0',
        gameType: 'tower',
      };
      addGameResult(result);
      updateStats(result);

      const finishResult = { win: false, payout: 0, multiplier: 0 };
      setLastResult(finishResult);

      if (onFinished) {
        onFinished(finishResult);
      }

      return 'trap';
    } else {
      // ✅ Safe! Advance to next level.
      const newLevel = currentLevel + 1;
      const newHistory = [...towerHistory, { level, index }];
      setTowerHistory(newHistory);
      setCurrentLevel(newLevel);

      // Check if tower is fully climbed
      if (newLevel >= TOTAL_LEVELS) {
        const finalMult = getMultiplierAtLevel(difficulty, newLevel);
        const payout = Math.round(Number(betAmount) * finalMult * 100) / 100;

        setGameState('won');
        addBalance(payout);

        // Reveal all tiles
        const fullReveal = {};
        for (let l = 0; l < TOTAL_LEVELS; l++) {
          for (let t = 0; t < grid[l].length; t++) {
            fullReveal[`${l}-${t}`] = true;
          }
        }
        setRevealed(fullReveal);

        const result = {
          won: true,
          bet: betAmount,
          payout,
          guessCount: newLevel,
          secretNumber: TOTAL_LEVELS,
          matchedGuess: null,
          multiplier: finalMult.toFixed(2),
          gameType: 'tower',
        };
        addGameResult(result);
        updateStats(result);

        const finishResult = { win: true, payout, multiplier: finalMult };
        setLastResult(finishResult);

        if (onFinished) {
          onFinished(finishResult);
        }
        playSound('cashout');
      } else {
        playSound('flip');
      }

      return 'safe';
    }
  }, [gameState, currentLevel, revealed, grid, betAmount, difficulty, towerHistory, addBalance, onFinished]);

  // Cash out at the current level
  const cashOut = useCallback(() => {
    if (gameState !== 'playing' || currentLevel === 0) return null;

    const mult = getMultiplierAtLevel(difficulty, currentLevel);
    const payout = Math.round(Number(betAmount) * mult * 100) / 100;

    setGameState('won');
    addBalance(payout);

    // Reveal all tiles
    const fullReveal = {};
    for (let l = 0; l < TOTAL_LEVELS; l++) {
      for (let t = 0; t < grid[l].length; t++) {
        fullReveal[`${l}-${t}`] = true;
      }
    }
    setRevealed(fullReveal);

    const result = {
      won: true,
      bet: betAmount,
      payout,
      guessCount: currentLevel,
      secretNumber: TOTAL_LEVELS,
      matchedGuess: null,
      multiplier: mult.toFixed(2),
      gameType: 'tower',
    };
    addGameResult(result);
    updateStats(result);

    const finishResult = { win: true, payout, multiplier: mult };
    setLastResult(finishResult);

    if (onFinished) {
      onFinished(finishResult);
    }
    playSound('cashout');

    return payout;
  }, [gameState, currentLevel, difficulty, betAmount, grid, addBalance, onFinished]);

  // Reset back to idle
  const resetGame = useCallback(() => {
    setGameState('idle');
    setRevealed({});
    setTowerHistory([]);
    setCurrentLevel(0);
    setGrid([]);
    setLastResult(null);
  }, []);

  return {
    // State
    betAmount,
    setBetAmount,
    difficulty,
    setDifficulty,
    gameState,
    currentLevel,
    grid,
    revealed,
    towerHistory,
    lastResult,

    // Derived
    config,
    multiplierLadder,
    currentMultiplier,
    nextMultiplier,
    currentPayout,
    totalLevels: TOTAL_LEVELS,

    // Actions
    startGame,
    clickTile,
    cashOut,
    resetGame,

    // Constants
    DIFFICULTY_CONFIGS,
  };
}
