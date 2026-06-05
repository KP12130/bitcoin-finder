'use client';

import { useState, useCallback, useEffect } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { 
  getClientSeed, 
  getNonce, 
  incrementNonce, 
  getActiveServerSeed, 
  calculateSha256, 
  savePreviousRoundInfo,
  hashToRandomFloats
} from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';

// Static board configuration mapper based on screenshots
export const getSnakeBoardConfig = (difficulty) => {
  const traps = {
    easy: [6],
    medium: [5, 6, 7],
    hard: [4, 5, 6, 7, 11],
    expert: [3, 4, 5, 6, 7, 8, 11],
    master: [2, 3, 4, 5, 6, 7, 8, 9, 11]
  }[difficulty] || [5, 6, 7];

  const multipliers = {
    easy: { 1: 2.00, 2: 1.30, 3: 1.20, 4: 1.10, 5: 1.01, 7: 1.01, 8: 1.10, 9: 1.20, 10: 1.30, 11: 2.00 },
    medium: { 1: 4.00, 2: 2.50, 3: 1.40, 4: 1.11, 8: 1.11, 9: 1.40, 10: 2.50, 11: 4.00 },
    hard: { 1: 7.50, 2: 3.00, 3: 1.38, 8: 1.38, 9: 3.00, 10: 7.50 },
    expert: { 1: 10.00, 2: 3.82, 9: 3.82, 10: 10.00 },
    master: { 1: 17.64, 10: 17.64 }
  }[difficulty] || {};

  return Array.from({ length: 12 }).map((_, idx) => {
    if (idx === 0) return { id: 0, label: '▶', value: 1.0, type: 'start' };
    const isTrap = traps.includes(idx);
    if (isTrap) {
      return { id: idx, label: 'trap', value: 0, type: 'trap' };
    }
    const val = multipliers[idx] || 1.0;
    return { id: idx, label: `${val.toFixed(2)}x`, value: val, type: 'mult' };
  });
};

export const SNAKE_BOARD = getSnakeBoardConfig('medium');

export function useSnakeRollEngine(balance, subtractBalance, addBalance, onGameFinished) {
  // Load active state from localStorage on init
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_snakeroll');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [difficulty, setDifficulty] = useState(savedState ? savedState.difficulty : 'medium');
  const [gameState, setGameState] = useState(savedState ? (savedState.gameState === 'rolling' ? 'playing' : savedState.gameState) : 'idle');
  const [currentTile, setCurrentTile] = useState(savedState ? savedState.currentTile : 0);
  const [currentMultiplier, setCurrentMultiplier] = useState(savedState ? savedState.currentMultiplier : 1.0);
  const [diceValues, setDiceValues] = useState(savedState ? savedState.diceValues : [1, 1]);
  const [rollHistory, setRollHistory] = useState(savedState ? savedState.rollHistory : []);
  const [mode, setMode] = useState(savedState ? savedState.mode : 'manual'); // 'manual' | 'auto'

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = (gameState === 'playing' || gameState === 'rolling');
    if (isActive) {
      localStorage.setItem('btcfinder_active_snakeroll', JSON.stringify({
        betAmount,
        difficulty,
        gameState: gameState === 'rolling' ? 'playing' : gameState,
        currentTile,
        currentMultiplier,
        diceValues,
        rollHistory,
        mode
      }));
    } else {
      localStorage.removeItem('btcfinder_active_snakeroll');
    }
  }, [gameState, betAmount, difficulty, currentTile, currentMultiplier, diceValues, rollHistory, mode]);

  const saveResult = useCallback((betAmt, mult, didWin, payoutAmt) => {
    const gameResult = {
      won: didWin,
      bet: betAmt,
      guessCount: rollHistory.length,
      payout: payoutAmt,
      secretNumber: currentTile,
      matchedGuess: null,
      multiplier: mult.toFixed(2),
      gameType: 'snakeroll',
    };
    addGameResult(gameResult);
    updateStats(gameResult);
  }, [currentTile, rollHistory]);

  const startGame = useCallback(async () => {
    if (gameState === 'playing' || gameState === 'rolling') return;

    // Validate bet
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) {
      return { error: 'Invalid bet amount or insufficient balance' };
    }

    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }
    setCurrentTile(0);
    setCurrentMultiplier(1.0);
    setRollHistory([]);
    setDiceValues([1, 1]);
    setGameState('playing');
    playSound('slide');

    return { success: true };
  }, [gameState, betAmount, balance, subtractBalance]);

  const rollDice = useCallback(async () => {
    if (gameState !== 'playing') return;
    if (rollHistory.length >= 5) return;

    setGameState('rolling');
    playSound('spin');

    incrementNonce('snakeroll');

    const sSeed = getActiveServerSeed('snakeroll');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('snakeroll');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);

    const floats = hashToRandomFloats(hash, 2);
    const d1 = 1 + Math.floor(floats[0] * 6);
    const d2 = 1 + Math.floor(floats[1] * 6);
    const sum = d1 + d2;

    // Reset position to tile 0 instantly at start of rolling animation
    setCurrentTile(0);

    setTimeout(() => {
      setDiceValues([d1, d2]);
      
      const targetIndex = sum - 1; // Since Square 1 is index 0 (◀), sum S lands on index S - 1
      const boardConfig = getSnakeBoardConfig(difficulty);
      const landingTile = boardConfig[targetIndex];
      const isLandedOnTrap = landingTile.type === 'trap';

      setCurrentTile(targetIndex);

      if (isLandedOnTrap) {
        setGameState('lost');
        playSound('explosion');
        playSound('loss');

        saveResult(betAmount, 0, false, 0);

        if (onGameFinished) {
          onGameFinished({
            bet: betAmount,
            won: false,
            payout: 0,
            multiplier: 0
          });
        }

        savePreviousRoundInfo(
          'snakeroll',
          sSeed,
          cSeed,
          nonceVal,
          hash,
          `Rolled ${d1} + ${d2} = ${sum}. Landed on trap at Tile ${targetIndex}. Payout: 0x`
        );
      } else {
        const nextMult = Math.round((currentMultiplier * landingTile.value) * 100) / 100;
        setCurrentMultiplier(nextMult);
        
        const newHistory = [...rollHistory, { roll: sum, d1, d2, landedTile: targetIndex, nextMult }];
        setRollHistory(newHistory);

        if (newHistory.length >= 5) {
          // Max 5 rolls reached, auto-cashout!
          setGameState('won');
          playSound('win');
          playSound('cashout');

          const payoutAmt = Math.round(betAmount * nextMult * 100) / 100;
          addBalance(payoutAmt);
          saveResult(betAmount, nextMult, true, payoutAmt);

          if (onGameFinished) {
            onGameFinished({
              bet: betAmount,
              won: true,
              payout: payoutAmt,
              multiplier: nextMult
            });
          }

          savePreviousRoundInfo(
            'snakeroll',
            sSeed,
            cSeed,
            nonceVal,
            hash,
            `Reached max 5 rolls. Auto-cashed out at Tile ${targetIndex}. Multiplier: ${nextMult}x`
          );
        } else {
          setGameState('playing');
          playSound('tick');

          savePreviousRoundInfo(
            'snakeroll',
            sSeed,
            cSeed,
            nonceVal,
            hash,
            `Rolled ${d1} + ${d2} = ${sum}. Landed on Tile ${targetIndex} (${landingTile.label}). Multiplier updated to ${nextMult}x`
          );

          // Automatically slide back to starting square (Tile 0) after 1.2 seconds so player is ready on 0!
          setTimeout(() => {
            setGameState(currState => {
              if (currState === 'playing') {
                setCurrentTile(0);
              }
              return currState;
            });
          }, 1200);
        }
      }
    }, 850);

  }, [gameState, currentMultiplier, betAmount, difficulty, saveResult, onGameFinished, rollHistory, addBalance]);

  const cashOut = useCallback(() => {
    if (gameState !== 'playing') return;
    if (currentTile === 0 && currentMultiplier === 1.0) return;

    const sSeed = getActiveServerSeed('snakeroll');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('snakeroll');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;

    const payoutAmt = Math.round(betAmount * currentMultiplier * 100) / 100;
    addBalance(payoutAmt);
    setGameState('won');
    playSound('win');
    playSound('cashout');

    saveResult(betAmount, currentMultiplier, true, payoutAmt);

    if (onGameFinished) {
      onGameFinished({
        bet: betAmount,
        won: true,
        payout: payoutAmt,
        multiplier: currentMultiplier
      });
    }

    calculateSha256(comboStr).then(hash => {
      savePreviousRoundInfo(
        'snakeroll',
        sSeed,
        cSeed,
        nonceVal,
        hash,
        `Cashed out round at Tile ${currentTile}. Multiplier: ${currentMultiplier}x`
      );
    });

  }, [gameState, currentTile, currentMultiplier, betAmount, addBalance, saveResult, onGameFinished]);

  const reset = useCallback(() => {
    setGameState('idle');
    setCurrentTile(0);
    setCurrentMultiplier(1.0);
    setRollHistory([]);
    setDiceValues([1, 1]);
  }, []);

  return {
    betAmount,
    setBetAmount,
    difficulty,
    setDifficulty,
    gameState,
    currentTile,
    currentMultiplier,
    diceValues,
    rollHistory,
    mode,
    setMode,
    startGame,
    rollDice,
    cashOut,
    reset,
  };
}
