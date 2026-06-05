'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { playSound } from '@/lib/audio';

// ─── Crash Point Generation ──────────────────────────────────────────────────
// Uses the "house edge" formula: crash = 0.99 / (1 - random)
// This gives ~5% house edge with an exponential distribution.
// Clamped to a minimum of 1.00x.
function generateCrashPoint() {
  const r = Math.random();
  if (r < 0.05) return 1.00; // 5% instant-crash edge
  const raw = 0.99 / (1 - r);
  return Math.max(1.00, Math.floor(raw * 100) / 100); // 2 decimal places
}

// Growth curve: multiplier grows as e^(k*t) where k is tuned so it feels exciting
const GROWTH_K = 0.00006; // controls how fast the multiplier climbs

export function useCrashEngine(balance, subtractBalance, addBalance) {
  // ─── Phase: 'idle' | 'betting' | 'running' | 'crashed' | 'cashedout'
  const [phase, setPhase] = useState('idle');
  const [bet, setBet] = useState(10);
  const [multiplier, setMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState(null);
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [autoCashOutTarget, setAutoCashOutTarget] = useState(2.00);
  const [cashoutMultiplier, setCashoutMultiplier] = useState(null);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState([]); // last 10 crash points

  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const crashPointRef = useRef(null);
  const autoCashOutRef = useRef(false);
  const autoCashOutTargetRef = useRef(2.00);
  const betRef = useRef(10);
  const hashedOutRef = useRef(false);
  const multiplierRef = useRef(1.00);

  // Dynamic Speed and Jitter Refs
  const virtualElapsedRef = useRef(0);
  const lastTimestampRef = useRef(null);
  const currentSpeedRef = useRef(1.0);
  const targetSpeedRef = useRef(1.0);
  const speedChangeTimerRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { autoCashOutRef.current = autoCashOut; }, [autoCashOut]);
  useEffect(() => { autoCashOutTargetRef.current = autoCashOutTarget; }, [autoCashOutTarget]);
  useEffect(() => { betRef.current = bet; }, [bet]);

  // ─── Animation Loop ───────────────────────────────────────────────────────
  const tick = useCallback((timestamp) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
      lastTimestampRef.current = timestamp;
      virtualElapsedRef.current = 0;
      currentSpeedRef.current = 1.0;
      targetSpeedRef.current = 1.0;
      speedChangeTimerRef.current = timestamp;
    }

    const delta = timestamp - lastTimestampRef.current;
    lastTimestampRef.current = timestamp;

    // Every 800ms - 1500ms, randomly update target speed
    const elapsedSinceSpeedChange = timestamp - speedChangeTimerRef.current;
    if (elapsedSinceSpeedChange > 1000) {
      const rand = Math.random();
      if (rand < 0.35) {
        // Dynamic slow down: 0.3x to 0.6x speed
        targetSpeedRef.current = 0.3 + Math.random() * 0.3;
      } else if (rand < 0.70) {
        // Dynamic speed up: 1.5x to 2.2x speed
        targetSpeedRef.current = 1.5 + Math.random() * 0.7;
      } else {
        // Return to normal speed: 0.9x to 1.1x speed
        targetSpeedRef.current = 0.9 + Math.random() * 0.2;
      }
      speedChangeTimerRef.current = timestamp;
    }

    // Smoothly interpolate current speed towards target speed
    const lerpFactor = Math.min(1, 0.05 * (delta / 16.67));
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * lerpFactor;
    currentSpeedRef.current = Math.max(0.15, Math.min(2.5, currentSpeedRef.current));

    // Increment virtual elapsed time
    virtualElapsedRef.current += delta * currentSpeedRef.current;

    const currentMult = Math.floor(Math.exp(GROWTH_K * virtualElapsedRef.current) * 100) / 100;
    const cp = crashPointRef.current;

    // Play climb ticking sound every 150ms
    const elapsedSinceStart = timestamp - startTimeRef.current;
    if (Math.floor(elapsedSinceStart / 30) % 5 === 0 && currentMult < cp) {
      playSound('tick');
    }

    // Check auto cash-out
    if (
      autoCashOutRef.current &&
      !hashedOutRef.current &&
      currentMult >= autoCashOutTargetRef.current
    ) {
      hashedOutRef.current = true;
      const winPayout = Math.round(betRef.current * autoCashOutTargetRef.current * 100) / 100;
      addBalance(winPayout);
      setPayout(winPayout);
      setCashoutMultiplier(autoCashOutTargetRef.current);
      setMultiplier(autoCashOutTargetRef.current);
      setPhase('cashedout');
      playSound('cashout');
      _saveResult(betRef.current, autoCashOutTargetRef.current, winPayout, cp);
      return; // stop animating
    }

    // Check crash
    if (currentMult >= cp) {
      setMultiplier(cp);
      setCrashPoint(cp);
      setPhase('crashed');
      playSound('explosion');
      setHistory(prev => [cp, ...prev].slice(0, 10));
      if (!hashedOutRef.current) {
        // Player lost
        _saveResult(betRef.current, cp, 0, cp);
      }
      return; // stop animating
    }

    setMultiplier(currentMult);
    multiplierRef.current = currentMult;
    rafRef.current = requestAnimationFrame(tick);
  }, [addBalance]);

  function _saveResult(betAmt, mult, payoutAmt, cp) {
    const won = payoutAmt > 0;
    const result = {
      won,
      bet: betAmt,
      guessCount: 1,
      payout: payoutAmt,
      secretNumber: cp,
      matchedGuess: won ? mult : null,
      multiplier: won ? mult.toFixed(2) : '0',
      gameType: 'crash',
    };
    addGameResult(result);
    updateStats(result);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  const launch = useCallback(async () => {
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET) return { error: `Bet must be between $0.10 and $1,000,000` };
    if (bet > balance) return { error: 'Insufficient balance' };
    if (phase === 'running') return { error: 'Already running' };

    playSound('slide');

    const cp = generateCrashPoint();
    crashPointRef.current = cp;
    startTimeRef.current = null;
    lastTimestampRef.current = null;
    virtualElapsedRef.current = 0;
    currentSpeedRef.current = 1.0;
    targetSpeedRef.current = 1.0;
    hashedOutRef.current = false;

    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }
    setCrashPoint(cp);
    setMultiplier(1.00);
    multiplierRef.current = 1.00;
    setCashoutMultiplier(null);
    setPayout(0);
    setPhase('running');

    rafRef.current = requestAnimationFrame(tick);
    return { success: true };
  }, [bet, balance, phase, subtractBalance, tick]);

  const cashOut = useCallback(() => {
    if (phase !== 'running' || hashedOutRef.current) return;
    hashedOutRef.current = true;

    const currentMult = multiplierRef.current;
    const winPayout = Math.round(betRef.current * currentMult * 100) / 100;
    addBalance(winPayout);
    setPayout(winPayout);
    setCashoutMultiplier(currentMult);
    setPhase('cashedout');
    playSound('cashout');
    _saveResult(betRef.current, currentMult, winPayout, crashPointRef.current);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [phase, addBalance]);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase('idle');
    setMultiplier(1.00);
    multiplierRef.current = 1.00;
    setCrashPoint(null);
    setCashoutMultiplier(null);
    setPayout(0);
    hashedOutRef.current = false;
    startTimeRef.current = null;
    lastTimestampRef.current = null;
    virtualElapsedRef.current = 0;
    currentSpeedRef.current = 1.0;
    targetSpeedRef.current = 1.0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return {
    phase,
    bet,
    setBet,
    multiplier,
    crashPoint,
    cashoutMultiplier,
    payout,
    history,
    autoCashOut,
    setAutoCashOut,
    autoCashOutTarget,
    setAutoCashOutTarget,
    launch,
    cashOut,
    reset,
  };
}
