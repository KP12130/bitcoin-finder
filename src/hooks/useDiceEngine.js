'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { playSound } from '@/lib/audio';

// ─── Math Helpers ─────────────────────────────────────────────────────────────
const HOUSE_EDGE = 0.01; // 1%

export function calcWinChance(target, isUnder) {
  // Under: win if roll < target  (0.01 to 98.00)
  // Over:  win if roll > target  (1.99 to 99.98)
  const raw = isUnder ? target : 99.99 - target;
  return Math.min(98.00, Math.max(1.00, parseFloat(raw.toFixed(2))));
}

export function calcMultiplier(winChance) {
  // multiplier = (1 - houseEdge) * 100 / winChance
  const m = ((1 - HOUSE_EDGE) * 100) / winChance;
  return Math.min(99.00, Math.max(1.01, parseFloat(m.toFixed(4))));
}

function generateRoll() {
  // Produces a number [0.00, 99.99]
  return parseFloat((Math.random() * 99.99).toFixed(2));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDiceEngine(balance, subtractBalance, addBalance) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'rolling' | 'finished'
  const [bet, setBet] = useState(10);
  const [target, setTarget] = useState(50.00);
  const [isUnder, setIsUnder] = useState(true);
  const [rollResult, setRollResult] = useState(null);
  const [won, setWon] = useState(null);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState([]); // last 15 rolls

  // Auto-bet
  const [autoActive, setAutoActive] = useState(false);
  const [autoRollsTotal, setAutoRollsTotal] = useState(10);
  const [autoRollsLeft, setAutoRollsLeft] = useState(0);
  const [onWinMode, setOnWinMode] = useState('reset');   // 'reset' | 'increase'
  const [onWinPct, setOnWinPct] = useState(0);
  const [onLossMode, setOnLossMode] = useState('reset'); // 'reset' | 'increase'
  const [onLossPct, setOnLossPct] = useState(100);       // Martingale default
  const [stopOnProfit, setStopOnProfit] = useState('');
  const [stopOnLoss, setStopOnLoss] = useState('');

  const autoIntervalRef = useRef(null);
  const betRef = useRef(10);
  const baseBetRef = useRef(10); // original bet before auto modifiers
  const targetRef = useRef(50.00);
  const isUnderRef = useRef(true);
  const balanceRef = useRef(balance);
  const startBalanceRef = useRef(balance);
  const autoRollsLeftRef = useRef(0);
  const onWinModeRef = useRef('reset');
  const onWinPctRef = useRef(0);
  const onLossModeRef = useRef('reset');
  const onLossPctRef = useRef(100);
  const stopOnProfitRef = useRef('');
  const stopOnLossRef = useRef('');
  const addBalanceRef = useRef(addBalance);
  const subtractBalanceRef = useRef(subtractBalance);

  // Sync refs
  useEffect(() => { betRef.current = bet; }, [bet]);
  useEffect(() => { targetRef.current = target; }, [target]);
  useEffect(() => { isUnderRef.current = isUnder; }, [isUnder]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { onWinModeRef.current = onWinMode; }, [onWinMode]);
  useEffect(() => { onWinPctRef.current = onWinPct; }, [onWinPct]);
  useEffect(() => { onLossModeRef.current = onLossMode; }, [onLossMode]);
  useEffect(() => { onLossPctRef.current = onLossPct; }, [onLossPct]);
  useEffect(() => { stopOnProfitRef.current = stopOnProfit; }, [stopOnProfit]);
  useEffect(() => { stopOnLossRef.current = stopOnLoss; }, [stopOnLoss]);
  useEffect(() => { addBalanceRef.current = addBalance; }, [addBalance]);
  useEffect(() => { subtractBalanceRef.current = subtractBalance; }, [subtractBalance]);

  // ─── Core Roll ──────────────────────────────────────────────────────────────
  const executeRoll = useCallback((betAmt, tgt, under) => {
    const roll = generateRoll();
    const didWin = under ? roll < tgt : roll > tgt;
    const winChance = calcWinChance(tgt, under);
    const mult = calcMultiplier(winChance);
    const winPayout = didWin ? Math.round(betAmt * mult * 100) / 100 : 0;

    // Balance update
    subtractBalanceRef.current(betAmt);
    if (didWin) addBalanceRef.current(winPayout);

    // History entry
    const entry = {
      roll,
      won: didWin,
      bet: betAmt,
      target: tgt,
      isUnder: under,
      multiplier: mult,
      payout: winPayout,
      timestamp: Date.now(),
    };

    // Persist
    addGameResult({
      won: didWin,
      bet: betAmt,
      payout: winPayout,
      guessCount: 1,
      secretNumber: roll,
      matchedGuess: didWin ? roll : null,
      multiplier: didWin ? mult.toFixed(2) : '0',
      gameType: 'dice',
    });
    updateStats({
      won: didWin,
      bet: betAmt,
      payout: winPayout,
      gameType: 'dice',
    });

    return entry;
  }, []);

  const roll = useCallback(() => {
    if (phase === 'rolling') return;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) return;

    setPhase('rolling');
    playSound('spin');

    setTimeout(() => {
      const entry = executeRoll(bet, target, isUnder);
      setRollResult(entry.roll);
      setWon(entry.won);
      setPayout(entry.payout);
      setHistory(prev => [entry, ...prev].slice(0, 15));
      setPhase('finished');

      if (entry.won) {
        playSound('win');
      } else {
        playSound('loss');
      }
    }, 600); // brief rolling animation
  }, [phase, bet, balance, target, isUnder, executeRoll]);

  // ─── Auto-Bet ───────────────────────────────────────────────────────────────
  const stopAutoBet = useCallback(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    setAutoActive(false);
    setAutoRollsLeft(0);
    // Reset to base bet when auto stops
    setBet(baseBetRef.current);
  }, []);

  const startAutoBet = useCallback(() => {
    if (autoIntervalRef.current) return;
    if (betRef.current < GAME_CONFIG.MIN_BET || betRef.current > GAME_CONFIG.MAX_BET || betRef.current > balanceRef.current) return;

    baseBetRef.current = betRef.current;
    startBalanceRef.current = balanceRef.current;
    autoRollsLeftRef.current = autoRollsTotal === '' ? Infinity : Number(autoRollsTotal);
    setAutoRollsLeft(autoRollsLeftRef.current);
    setAutoActive(true);

    const tick = () => {
      const currentBet = betRef.current;
      const currentBalance = balanceRef.current;

      // Stop conditions
      if (currentBet < GAME_CONFIG.MIN_BET || currentBet > GAME_CONFIG.MAX_BET || currentBet > currentBalance) {
        stopAutoBet();
        return;
      }
      if (autoRollsLeftRef.current <= 0) {
        stopAutoBet();
        return;
      }
      const profitLimit = parseFloat(stopOnProfitRef.current);
      const lossLimit = parseFloat(stopOnLossRef.current);
      const netChange = currentBalance - startBalanceRef.current;
      if (!isNaN(profitLimit) && netChange >= profitLimit) {
        stopAutoBet();
        return;
      }
      if (!isNaN(lossLimit) && netChange <= -Math.abs(lossLimit)) {
        stopAutoBet();
        return;
      }

      // Execute
      const entry = executeRoll(currentBet, targetRef.current, isUnderRef.current);
      setRollResult(entry.roll);
      setWon(entry.won);
      setPayout(entry.payout);
      setHistory(prev => [entry, ...prev].slice(0, 15));
      setPhase('finished');

      // Adjust next bet
      if (entry.won) {
        if (onWinModeRef.current === 'reset') {
          betRef.current = baseBetRef.current;
        } else {
          betRef.current = Math.round(betRef.current * (1 + onWinPctRef.current / 100) * 100) / 100;
        }
      } else {
        if (onLossModeRef.current === 'reset') {
          betRef.current = baseBetRef.current;
        } else {
          betRef.current = Math.round(betRef.current * (1 + onLossPctRef.current / 100) * 100) / 100;
        }
      }
      setBet(betRef.current);

      autoRollsLeftRef.current -= 1;
      setAutoRollsLeft(autoRollsLeftRef.current);
    };

    // Run first tick immediately then on interval
    tick();
    autoIntervalRef.current = setInterval(tick, 900);
  }, [autoRollsTotal, executeRoll, stopAutoBet]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  const winChance = calcWinChance(target, isUnder);
  const multiplier = calcMultiplier(winChance);
  const profitOnWin = bet && !isNaN(bet) ? Math.round((bet * multiplier - bet) * 100) / 100 : 0;

  return {
    phase, setPhase,
    bet, setBet,
    target, setTarget,
    isUnder, setIsUnder,
    rollResult,
    won,
    payout,
    history,
    winChance,
    multiplier,
    profitOnWin,
    roll,
    // auto
    autoActive,
    autoRollsTotal, setAutoRollsTotal,
    autoRollsLeft,
    onWinMode, setOnWinMode,
    onWinPct, setOnWinPct,
    onLossMode, setOnLossMode,
    onLossPct, setOnLossPct,
    stopOnProfit, setStopOnProfit,
    stopOnLoss, setStopOnLoss,
    startAutoBet,
    stopAutoBet,
  };
}
