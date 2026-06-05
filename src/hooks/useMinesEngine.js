'use client';

import { useState, useCallback, useEffect } from 'react';
import { getMinesMultiplier } from '@/lib/combinations';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { 
  getClientSeed, 
  getNonce, 
  incrementNonce, 
  getActiveServerSeed, 
  calculateSha256, 
  savePreviousRoundInfo, 
  getDeterministicShuffle 
} from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';

export function useMinesEngine(balance, subtractBalance, addBalance, onFinished) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_mines');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [minesCount, setMinesCount] = useState(savedState ? savedState.minesCount : 3); // 1 to 24 mines
  const [gameState, setGameState] = useState(savedState ? savedState.gameState : 'idle'); // idle | playing | won | lost
  const [grid, setGrid] = useState(savedState ? savedState.grid : []); // Array of 25 strings: 'gem' or 'mine'
  const [revealed, setRevealed] = useState(savedState ? savedState.revealed : Array(25).fill(false));
  const [gemsFound, setGemsFound] = useState(savedState ? savedState.gemsFound : 0);

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing';
    if (isActive) {
      localStorage.setItem('btcfinder_active_mines', JSON.stringify({
        betAmount,
        minesCount,
        gameState,
        grid,
        revealed,
        gemsFound
      }));
    } else {
      localStorage.removeItem('btcfinder_active_mines');
    }
  }, [gameState, betAmount, minesCount, grid, revealed, gemsFound]);

  // Initialize a deterministic seed-shuffled grid of 25 items containing exactly minesCount mines
  const startGame = useCallback(async () => {
    if (betAmount < GAME_CONFIG.MIN_BET || betAmount > GAME_CONFIG.MAX_BET) {
      return { error: 'Bet must be between $0.10 and $1,000,000' };
    }
    if (balance < betAmount) {
      return { error: 'Insufficient balance' };
    }
    if (minesCount < 1 || minesCount > 24) {
      return { error: 'Invalid mine count (must be between 1 and 24)' };
    }

    incrementNonce('mines');

    // Deduct bet amount immediately
    try { await subtractBalance(betAmount); } catch (e) { return { error: 'Insufficient balance' }; }

    // 1. Create unshuffled array
    const newGrid = Array(25).fill('gem');
    for (let i = 0; i < minesCount; i++) {
      newGrid[i] = 'mine';
    }

    // 2. Fisher-Yates Shuffle using deterministic seed hash
    const shuffledGrid = await getDeterministicShuffle('mines', newGrid);

    setGrid(shuffledGrid);
    setRevealed(Array(25).fill(false));
    setGemsFound(0);
    setGameState('playing');
    playSound('slide');

    return { success: true };
  }, [balance, betAmount, minesCount, subtractBalance]);

  // Click handler for individual cell index
  const revealCell = useCallback((index) => {
    if (gameState !== 'playing' || revealed[index]) return null;

    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);

    const hit = grid[index];
    const sSeed = getActiveServerSeed('mines');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('mines');

    if (hit === 'mine') {
      // 💥 Exploded! Game Lost.
      setGameState('lost');
      setRevealed(Array(25).fill(true));
      playSound('explosion');

      const result = {
        won: false,
        bet: betAmount,
        payout: 0,
        guessCount: gemsFound,
        secretNumber: minesCount,
        matchedGuess: null,
        multiplier: '0',
        gameType: 'mines',
      };
      addGameResult(result);
      updateStats(result);

      const combo = `${sSeed}-${cSeed}-${nonceVal}`;
      calculateSha256(combo).then(hash => {
        savePreviousRoundInfo('mines', sSeed, cSeed, nonceVal, hash, `Bust (Hit Mine at Cell ${index + 1})`);
      });

      if (onFinished) {
        onFinished({ win: false, payout: 0, multiplier: 0 });
      }

      return 'mine';
    } else {
      // 💎 Gem Found!
      const newGemsCount = gemsFound + 1;
      setGemsFound(newGemsCount);

      // Check if all gems are cleared
      const totalGems = 25 - minesCount;
      if (newGemsCount === totalGems) {
        // Automatic Cash Out!
        const finalMult = getMinesMultiplier(minesCount, newGemsCount);
        const payout = Math.round(Number(betAmount) * finalMult * 100) / 100;

        setGameState('won');
        setRevealed(Array(25).fill(true));
        addBalance(payout);
        playSound('cashout');

        const result = {
          won: true,
          bet: betAmount,
          payout,
          guessCount: newGemsCount,
          secretNumber: minesCount,
          matchedGuess: null,
          multiplier: finalMult.toFixed(2),
          gameType: 'mines',
        };
        addGameResult(result);
        updateStats(result);

        const combo = `${sSeed}-${cSeed}-${nonceVal}`;
        calculateSha256(combo).then(hash => {
          savePreviousRoundInfo('mines', sSeed, cSeed, nonceVal, hash, `Cleared All Gems! (Win ${finalMult.toFixed(2)}x)`);
        });

        if (onFinished) {
          onFinished({ win: true, payout, multiplier: finalMult });
        }
      } else {
        // Normal gem reveal chimes flip
        playSound('flip');
      }

      return 'gem';
    }
  }, [gameState, revealed, grid, gemsFound, minesCount, betAmount, addBalance, onFinished]);

  // Player decides to secure their current winnings
  const cashOut = useCallback(() => {
    if (gameState !== 'playing' || gemsFound === 0) return null;

    const currentMultiplier = getMinesMultiplier(minesCount, gemsFound);
    const payout = Math.round(Number(betAmount) * currentMultiplier * 100) / 100;

    setGameState('won');
    setRevealed(Array(25).fill(true));
    addBalance(payout);
    playSound('cashout');

    const result = {
      won: true,
      bet: betAmount,
      payout,
      guessCount: gemsFound,
      secretNumber: minesCount,
      matchedGuess: null,
      multiplier: currentMultiplier.toFixed(2),
      gameType: 'mines',
    };
    addGameResult(result);
    updateStats(result);

    const sSeed = getActiveServerSeed('mines');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('mines');
    const combo = `${sSeed}-${cSeed}-${nonceVal}`;
    calculateSha256(combo).then(hash => {
      savePreviousRoundInfo('mines', sSeed, cSeed, nonceVal, hash, `Cashed Out: ${currentMultiplier.toFixed(2)}x (${gemsFound} Gems)`);
    });

    if (onFinished) {
      onFinished({ win: true, payout, multiplier: currentMultiplier });
    }

    return payout;
  }, [gameState, gemsFound, minesCount, betAmount, addBalance, onFinished]);

  // Reset board back to settings
  const resetGame = useCallback(() => {
    setGameState('idle');
    setRevealed(Array(25).fill(false));
    setGemsFound(0);
    setGrid([]);
  }, []);

  return {
    betAmount,
    setBetAmount,
    minesCount,
    setMinesCount,
    gameState,
    grid,
    revealed,
    gemsFound,
    startGame,
    revealCell,
    cashOut,
    resetGame,
  };
}
