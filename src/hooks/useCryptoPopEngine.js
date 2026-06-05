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
  getDeterministicShuffle,
  hashToRandomFloats
} from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';

export function useCryptoPopEngine(balance, subtractBalance, addBalance, onGameFinished) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_cryptopop');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [gridSize, setGridSize] = useState(savedState ? savedState.gridSize : 9); // 4 | 9 | 16
  const [gameState, setGameState] = useState(savedState ? savedState.gameState : 'idle'); // 'idle' | 'playing' | 'cashout' | 'burst'
  const [balloons, setBalloons] = useState(savedState ? savedState.balloons : []);
  const [currentMultiplier, setCurrentMultiplier] = useState(savedState ? savedState.currentMultiplier : 1.0);
  const [lastResults, setLastResults] = useState(savedState ? savedState.lastResults : []); // last 20 results

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing';
    if (isActive) {
      localStorage.setItem('btcfinder_active_cryptopop', JSON.stringify({
        betAmount,
        gridSize,
        gameState,
        balloons,
        currentMultiplier,
        lastResults
      }));
    } else {
      localStorage.removeItem('btcfinder_active_cryptopop');
    }
  }, [gameState, betAmount, gridSize, balloons, currentMultiplier, lastResults]);
  
  // Setup config based on grid size
  const getGridConfig = useCallback((size) => {
    switch (size) {
      case 4:
        return { traps: 1, minMult: 1.10, maxMult: 2.50, power: 1.2 };
      case 16:
        return { traps: 4, minMult: 1.05, maxMult: 2.50, power: 3.5 };
      case 9:
      default:
        return { traps: 2, minMult: 1.05, maxMult: 2.00, power: 3.0 };
    }
  }, []);

  const saveResult = useCallback((betAmt, multiplier, didWin, payoutAmt) => {
    const gameResult = {
      won: didWin,
      bet: betAmt,
      guessCount: balloons.filter(b => b.status === 'popped').length,
      payout: payoutAmt,
      secretNumber: gridSize,
      matchedGuess: null,
      multiplier: multiplier.toFixed(2),
      gameType: 'cryptopop',
    };
    addGameResult(gameResult);
    updateStats(gameResult);
  }, [gridSize, balloons]);

  const startGame = useCallback(async () => {
    if (gameState === 'playing') return;

    // Validate bet
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) return { error: 'Invalid bet amount or insufficient balance' };

    // Increment nonce
    incrementNonce('cryptopop');

    const sSeed = getActiveServerSeed('cryptopop');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('cryptopop');

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }

    // Setup grid config
    const config = getGridConfig(gridSize);
    
    // Create base array (true represents a trap/dead balloon, false is safe)
    const baseArr = Array(gridSize).fill(false);
    for (let i = 0; i < config.traps; i++) {
      baseArr[i] = true;
    }

    // Deterministic shuffle using seed
    const shuffled = await getDeterministicShuffle('cryptopop', baseArr);

    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);
    const floats = hashToRandomFloats(hash, gridSize);

    const generatedBalloons = shuffled.map((isDead, idx) => {
      const floatVal = floats[idx % floats.length];
      const mult = isDead ? 0 : Math.round((config.minMult + (config.maxMult - config.minMult) * Math.pow(floatVal, config.power)) * 100) / 100;
      return {
        id: idx,
        status: 'unpopped', // 'unpopped' | 'popped' | 'burst' | 'unrevealed'
        isDead,
        multiplier: mult
      };
    });

    setBalloons(generatedBalloons);
    setCurrentMultiplier(1.0);
    setGameState('playing');
    playSound('slide');

    return { success: true };
  }, [gameState, betAmount, gridSize, balance, subtractBalance, getGridConfig]);

  const popBalloon = useCallback((index) => {
    if (gameState !== 'playing') return;
    if (index < 0 || index >= balloons.length) return;
    if (balloons[index].status !== 'unpopped') return;

    const newBalloons = [...balloons];
    const targetBalloon = newBalloons[index];

    const sSeed = getActiveServerSeed('cryptopop');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('cryptopop');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;

    if (targetBalloon.isDead) {
      // Balloon Pop Exploded / Hit Trap!
      targetBalloon.status = 'burst';
      
      // Reveal all other balloons
      newBalloons.forEach(b => {
        if (b.status === 'unpopped') {
          b.status = 'unrevealed';
        }
      });
      
      setBalloons(newBalloons);
      setGameState('burst');
      
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

      calculateSha256(comboStr).then(hash => {
        savePreviousRoundInfo(
          'cryptopop',
          sSeed,
          cSeed,
          nonceVal,
          hash,
          `Hit dead token at index ${index} on a ${gridSize}-grid w/ ${getGridConfig(gridSize).traps} traps.`
        );
      });

    } else {
      // Safe Pop!
      targetBalloon.status = 'popped';
      const nextMultiplier = Math.round(currentMultiplier * targetBalloon.multiplier * 100) / 100;
      
      playSound('tick');
      setCurrentMultiplier(nextMultiplier);
      setBalloons(newBalloons);

      // Check if all safe balloons are popped -> Auto Cash Out
      const unpoppedSafeBalloons = newBalloons.filter(b => !b.isDead && b.status === 'unpopped');
      if (unpoppedSafeBalloons.length === 0) {
        // Auto cashout
        const finalPayout = Math.round(betAmount * nextMultiplier * 100) / 100;
        addBalance(finalPayout);
        setGameState('cashout');
        
        // Reveal remaining (which are only traps)
        newBalloons.forEach(b => {
          if (b.status === 'unpopped') {
            b.status = 'unrevealed';
          }
        });
        setBalloons(newBalloons);
        playSound('win');
        playSound('cashout');

        setLastResults(prev => [
          { won: true, multiplier: nextMultiplier, bet: betAmount, payout: finalPayout, gridSize },
          ...prev,
        ].slice(0, 20));

        saveResult(betAmount, nextMultiplier, true, finalPayout);

        if (onGameFinished) {
          onGameFinished({
            bet: betAmount,
            won: true,
            payout: finalPayout,
            multiplier: nextMultiplier
          });
        }

        calculateSha256(comboStr).then(hash => {
          savePreviousRoundInfo(
            'cryptopop',
            sSeed,
            cSeed,
            nonceVal,
            hash,
            `Clean sweep! Popped all safe tokens. Multiplier: ${nextMultiplier}x`
          );
        });
      }
    }
  }, [gameState, balloons, currentMultiplier, betAmount, addBalance, saveResult, gridSize, getGridConfig]);

  const cashOut = useCallback(() => {
    if (gameState !== 'playing') return;
    if (currentMultiplier <= 1.0) return;

    const sSeed = getActiveServerSeed('cryptopop');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('cryptopop');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;

    const payoutAmt = Math.round(betAmount * currentMultiplier * 100) / 100;
    addBalance(payoutAmt);
    setGameState('cashout');

    const newBalloons = balloons.map(b => {
      if (b.status === 'unpopped') {
        return { ...b, status: 'unrevealed' };
      }
      return b;
    });
    setBalloons(newBalloons);

    playSound('win');
    playSound('cashout');

    setLastResults(prev => [
      { won: true, multiplier: currentMultiplier, bet: betAmount, payout: payoutAmt, gridSize },
      ...prev,
    ].slice(0, 20));

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
        'cryptopop',
        sSeed,
        cSeed,
        nonceVal,
        hash,
        `Cashed out round on ${gridSize}-grid. Multiplier: ${currentMultiplier}x`
      );
    });
  }, [gameState, currentMultiplier, betAmount, balloons, addBalance, saveResult, gridSize]);

  const reset = useCallback(() => {
    setGameState('idle');
    setBalloons([]);
    setCurrentMultiplier(1.0);
  }, []);

  const pickRandomToken = useCallback(() => {
    if (gameState !== 'playing') return;
    const unpopped = balloons.filter(b => b.status === 'unpopped');
    if (unpopped.length === 0) return;
    const randIdx = Math.floor(Math.random() * unpopped.length);
    popBalloon(unpopped[randIdx].id);
  }, [gameState, balloons, popBalloon]);

  return {
    betAmount,
    setBetAmount,
    gridSize,
    setGridSize,
    gameState,
    balloons,
    currentMultiplier,
    lastResults,
    startGame,
    popBalloon,
    cashOut,
    reset,
    pickRandomToken,
  };
}
