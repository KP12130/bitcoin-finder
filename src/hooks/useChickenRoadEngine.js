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

// Detailed config copied from stake chicken.txt
export const STAKE_CHICKEN_CONFIG = {
  easy: { // Safe Mode
    maxSteps: 19,
    multipliers: [1.03, 1.09, 1.15, 1.23, 1.31, 1.40, 1.51, 1.63, 1.78, 1.96, 2.18, 2.45, 2.80, 3.27, 3.92, 4.90, 6.53, 9.80, 19.60],
    survivalChances: [95.0, 90.0, 85.0, 80.0, 75.0, 70.0, 65.0, 60.0, 55.0, 50.0, 45.0, 40.0, 35.0, 30.0, 25.0, 20.0, 15.0, 10.0, 5.0]
  },
  medium: { // Balanced
    maxSteps: 17,
    multipliers: [1.15, 1.37, 1.64, 2.00, 2.46, 3.07, 3.91, 5.08, 6.77, 9.31, 13.30, 19.95, 31.92, 55.86, 111.72, 279.30, 1117.20],
    survivalChances: [85.0, 71.578947, 59.649123, 49.122807, 39.912281, 31.929825, 25.087719, 19.298246, 14.473684, 10.526316, 7.368421, 4.912281, 3.070175, 1.754386, 0.877193, 0.350877, 0.087719]
  },
  hard: { // Risky
    maxSteps: 15,
    multipliers: [1.31, 1.77, 2.46, 3.48, 5.06, 7.59, 11.81, 19.18, 32.89, 60.29, 120.59, 271.32, 723.52, 2532.32, 15193.92],
    survivalChances: [75.0, 55.263158, 39.912281, 28.173375, 19.369195, 12.912797, 8.301084, 5.108359, 2.979876, 1.625387, 0.812693, 0.361197, 0.135449, 0.038700, 0.006450]
  },
  expert: { // Yolo
    maxSteps: 10,
    multipliers: [1.96, 4.14, 9.31, 22.61, 60.29, 180.88, 633.08, 2743.35, 16460.08, 181060.88],
    survivalChances: [50.0, 23.684211, 10.526316, 4.334365, 1.625387, 0.541796, 0.154799, 0.035723, 0.005954, 0.000541]
  }
};

export function useChickenRoadEngine(balance, subtractBalance, addBalance, onGameFinished) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_chickenroad');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [difficulty, setDifficulty] = useState(savedState ? savedState.difficulty : 'medium'); // 'easy' (Safe) | 'medium' (Balanced) | 'hard' (Risky) | 'expert' (Yolo)
  const [gameState, setGameState] = useState(savedState ? savedState.gameState : 'idle'); // 'idle' | 'playing' | 'won' | 'lost'
  const [currentStep, setCurrentStep] = useState(savedState ? savedState.currentStep : 0); // number of successfully completed steps
  const [chickenHistory, setChickenHistory] = useState(savedState ? savedState.chickenHistory : []);
  const [trapIndex, setTrapIndex] = useState(savedState ? savedState.trapIndex : -1); // step index where the player died

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing';
    if (isActive) {
      localStorage.setItem('btcfinder_active_chickenroad', JSON.stringify({
        betAmount,
        difficulty,
        gameState,
        currentStep,
        chickenHistory,
        trapIndex
      }));
    } else {
      localStorage.removeItem('btcfinder_active_chickenroad');
    }
  }, [gameState, betAmount, difficulty, currentStep, chickenHistory, trapIndex]);

  const getStepMultiplier = useCallback((step, diff) => {
    const config = STAKE_CHICKEN_CONFIG[diff] || STAKE_CHICKEN_CONFIG.medium;
    if (step <= 0) return 1.0;
    return config.multipliers[Math.min(step - 1, config.maxSteps - 1)] || 1.0;
  }, []);

  const saveResult = useCallback((betAmt, mult, didWin, payoutAmt) => {
    const gameResult = {
      won: didWin,
      bet: betAmt,
      guessCount: currentStep,
      payout: payoutAmt,
      secretNumber: currentStep,
      matchedGuess: null,
      multiplier: mult.toFixed(2),
      gameType: 'chickenroad',
    };
    addGameResult(gameResult);
    updateStats(gameResult);
  }, [currentStep]);

  const startGame = useCallback(async () => {
    if (gameState === 'playing') return;

    // Validate bet
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) {
      return { error: 'Invalid bet amount or insufficient balance' };
    }

    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }
    setCurrentStep(0);
    setTrapIndex(-1);
    setGameState('playing');
    playSound('slide');

    return { success: true };
  }, [gameState, betAmount, balance, subtractBalance]);

  // Handle a manual single step forward
  const takeManualStep = useCallback(async () => {
    if (gameState !== 'playing') return;

    const config = STAKE_CHICKEN_CONFIG[difficulty] || STAKE_CHICKEN_CONFIG.medium;
    const nextStepIndex = currentStep; // 0-indexed next step

    if (nextStepIndex >= config.maxSteps) return;

    incrementNonce('chickenroad');

    const sSeed = getActiveServerSeed('chickenroad');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('chickenroad');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);

    const floats = hashToRandomFloats(hash, 1);
    const roll = floats[0] * 100.0; // 0 to 100 float

    // Calculate conditional probability of surviving nextStepIndex given survived up to nextStepIndex - 1
    const pCurrent = config.survivalChances[nextStepIndex];
    const pPrevious = nextStepIndex === 0 ? 100.0 : config.survivalChances[nextStepIndex - 1];
    const conditionalSurvivalChance = (pCurrent / pPrevious) * 100.0;

    if (roll < conditionalSurvivalChance) {
      // Safe step!
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      playSound('tick');

      // If they survived the absolute final step, trigger automatic cashout!
      if (newStep === config.maxSteps) {
        const stepMult = config.multipliers[newStep - 1];
        const finalPayout = Math.round(betAmount * stepMult * 100) / 100;
        addBalance(finalPayout);
        setGameState('won');
        playSound('win');
        playSound('cashout');

        setChickenHistory(prev => [
          { won: true, multiplier: stepMult, bet: betAmount, payout: finalPayout, difficulty },
          ...prev,
        ].slice(0, 20));

        saveResult(betAmount, stepMult, true, finalPayout);

        if (onGameFinished) {
          onGameFinished({
            bet: betAmount,
            won: true,
            payout: finalPayout,
            multiplier: stepMult
          });
        }

        savePreviousRoundInfo(
          'chickenroad',
          sSeed,
          cSeed,
          nonceVal,
          hash,
          `Completed the entire road in ${difficulty}! Payout: ${stepMult}x`
        );
      }
    } else {
      // Hit trap!
      setTrapIndex(nextStepIndex);
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
        'chickenroad',
        sSeed,
        cSeed,
        nonceVal,
        hash,
        `Hit trap at step ${nextStepIndex + 1} (Difficulty: ${difficulty}). Payout: 0x`
      );
    }
  }, [gameState, currentStep, difficulty, betAmount, addBalance, saveResult, onGameFinished]);



  const cashOut = useCallback(() => {
    if (gameState !== 'playing') return;
    if (currentStep === 0) return;

    const sSeed = getActiveServerSeed('chickenroad');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('chickenroad');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;

    const config = STAKE_CHICKEN_CONFIG[difficulty] || STAKE_CHICKEN_CONFIG.medium;
    const finalMult = config.multipliers[currentStep - 1];
    const finalPayout = Math.round(betAmount * finalMult * 100) / 100;

    addBalance(finalPayout);
    setGameState('won');
    playSound('win');
    playSound('cashout');

    setChickenHistory(prev => [
      { won: true, multiplier: finalMult, bet: betAmount, payout: finalPayout, difficulty },
      ...prev,
    ].slice(0, 20));

    saveResult(betAmount, finalMult, true, finalPayout);

    if (onGameFinished) {
      onGameFinished({
        bet: betAmount,
        won: true,
        payout: finalPayout,
        multiplier: finalMult
      });
    }

    calculateSha256(comboStr).then(hash => {
      savePreviousRoundInfo(
        'chickenroad',
        sSeed,
        cSeed,
        nonceVal,
        hash,
        `Manual Cash out after step ${currentStep} (${difficulty}). Payout: ${finalMult}x`
      );
    });
  }, [gameState, currentStep, betAmount, difficulty, addBalance, saveResult, onGameFinished]);

  const reset = useCallback(() => {
    setGameState('idle');
    setCurrentStep(0);
    setTrapIndex(-1);
  }, []);

  return {
    betAmount,
    setBetAmount,
    difficulty,
    setDifficulty,
    gameState,
    currentStep,
    trapIndex,
    chickenHistory,
    startGame,
    takeManualStep,
    cashOut,
    reset,
    getStepMultiplier,
  };
}
