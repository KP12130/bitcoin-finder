'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

export function useLimboEngine(balance, subtractBalance, addBalance) {
  // ─── State ─────────────────────────────────────────────────────────────────
  const [betAmount, setBetAmount] = useState(10);
  const [targetMultiplier, setTargetMultiplier] = useState(2.00);
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'rolling' | 'result'
  const [resultMultiplier, setResultMultiplier] = useState(null);
  const [won, setWon] = useState(false);
  const [payout, setPayout] = useState(0);
  const [lastResults, setLastResults] = useState([]); // last 20 results
  const [rollingDisplay, setRollingDisplay] = useState(1.00);

  // Refs for animation cleanup
  const rollingTimerRef = useRef(null);
  const rollingIntervalRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rollingTimerRef.current) clearTimeout(rollingTimerRef.current);
      if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
    };
  }, []);

  // ─── Computed Values ───────────────────────────────────────────────────────
  const winChance = Math.min(99, (0.99 / targetMultiplier) * 100);
  const profitOnWin = Math.round((betAmount * targetMultiplier - betAmount) * 100) / 100;

  // ─── Save Result ───────────────────────────────────────────────────────────
  const saveResult = useCallback((betAmt, target, result, didWin, payoutAmt) => {
    const gameResult = {
      won: didWin,
      bet: betAmt,
      guessCount: 1,
      payout: payoutAmt,
      secretNumber: result,
      matchedGuess: didWin ? target : null,
      multiplier: didWin ? target.toFixed(2) : '0',
      gameType: 'limbo',
    };
    addGameResult(gameResult);
    updateStats(gameResult);
  }, []);

  // ─── Play Round ────────────────────────────────────────────────────────────
  const playRound = useCallback(async () => {
    // Guard: can't play while rolling
    if (gameState === 'rolling') return;

    // Validate bet
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) return;

    // Validate target
    const target = parseFloat(targetMultiplier);
    if (isNaN(target) || target < 1.01 || target > 1000000) return;

    // Increment nonce for active round determinism
    incrementNonce('limbo');

    const sSeed = getActiveServerSeed('limbo');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('limbo');

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }

    // Enter rolling state
    setGameState('rolling');
    setResultMultiplier(null);
    setWon(false);
    setPayout(0);
    setRollingDisplay(0.00);

    // Deterministically generate multiplier outcome based on hash
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);
    const floats = hashToRandomFloats(hash, 1);
    const rand = floats[0];
    
    // Formula produces an exponential distribution with 1% house edge
    const raw = 0.99 / (1.0 - rand);
    const result = Math.max(1.00, Math.floor(raw * 100) / 100);
    
    const didWin = result >= target;
    const payoutAmt = didWin ? Math.round(bet * target * 100) / 100 : 0;

    const animDuration = 5000; // 5s animation duration
    const startTime = Date.now();

    if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
    rollingIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, elapsed / animDuration);
      
      let currentVal;
      if (progress < 0.05) {
        currentVal = 0.00;
      } else {
        const activeProgress = (progress - 0.05) / 0.95;
        currentVal = Math.max(1.00, Math.floor(Math.pow(result, activeProgress) * 100) / 100);
      }
      setRollingDisplay(currentVal);

      // Play tick sound every 120ms (4 frames) during count-up
      if (Math.floor(elapsed / 30) % 4 === 0 && progress < 1.0) {
        playSound('tick');
      }

      if (progress >= 1.0) {
        if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
        rollingIntervalRef.current = null;

        // Set final results
        setRollingDisplay(result);
        setResultMultiplier(result);
        setWon(didWin);
        setPayout(payoutAmt);
        setGameState('result');

        // Play outcome arpeggios
        if (didWin) {
          playSound('win');
          addBalance(payoutAmt);
        } else {
          playSound('loss');
        }

        // Update history (keep last 20)
        setLastResults(prev => [
          { multiplier: result, target, won: didWin, payout: payoutAmt, bet },
          ...prev,
        ].slice(0, 20));

        // Save to storage
        saveResult(bet, target, result, didWin, payoutAmt);

        // Commit completed round verification ledger
        savePreviousRoundInfo(
          'limbo',
          sSeed,
          cSeed,
          nonceVal,
          hash,
          `Multiplier Rolled: ${result.toFixed(2)}x (Target: ${target.toFixed(2)}x | ${didWin ? 'Win' : 'Loss'})`
        );
      }
    }, 30);
  }, [gameState, betAmount, targetMultiplier, balance, subtractBalance, addBalance, saveResult]);

  // ─── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (rollingTimerRef.current) clearTimeout(rollingTimerRef.current);
    if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
    setGameState('idle');
    setResultMultiplier(null);
    setWon(false);
    setPayout(0);
    setRollingDisplay(1.00);
  }, []);

  return {
    // State
    betAmount,
    setBetAmount,
    targetMultiplier,
    setTargetMultiplier,
    gameState,
    resultMultiplier,
    won,
    payout,
    lastResults,
    rollingDisplay,

    // Computed
    winChance,
    profitOnWin,

    // Actions
    playRound,
    reset,
  };
}
