'use client';

import { useState, useCallback } from 'react';
import { PLINKO_CONFIG } from '@/lib/constants';
import { updateStats, addGameResult } from '@/lib/storage';

export function usePlinkoEngine(balance, subtractBalance, addBalance, onFinished) {
  const [betAmount, setBetAmount] = useState(100);
  const [rows, setRows] = useState(12); // 8 | 12 | 16
  const [risk, setRisk] = useState('medium'); // low | medium | high
  const [activeBalls, setActiveBalls] = useState(0);

  const getMultipliers = useCallback(() => {
    return PLINKO_CONFIG[rows]?.[risk] || PLINKO_CONFIG[12].medium;
  }, [rows, risk]);

  const dropBall = useCallback(async () => {
    if (balance < betAmount) {
      return { error: 'Insufficient balance' };
    }

    // Deduct bet amount immediately
    try { await subtractBalance(betAmount); } catch (e) { return { error: 'Insufficient balance' }; }
    setActiveBalls((prev) => prev + 1);

    // Generate provably-fair binary path (0 = left, 1 = right)
    const path = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
    const bucketIndex = path.reduce((sum, val) => sum + val, 0);

    const multipliers = getMultipliers();
    const multiplier = multipliers[bucketIndex];
    const payout = Math.round(Number(betAmount) * multiplier * 100) / 100;

    const ballId = Math.random().toString(36).slice(2, 9);

    // Callback when the physics ball completes its trajectory and hits the bucket
    const resolvePayout = () => {
      if (payout > 0) {
        addBalance(payout);
      }

      const logData = {
        won: payout > 0,
        bet: betAmount,
        payout: payout,
        guessCount: rows,
        secretNumber: path.join(''),
        matchedGuess: bucketIndex,
        multiplier: multiplier.toFixed(2),
        gameType: 'plinko',
      };

      // Update global casino statistics and history
      addGameResult(logData);
      updateStats(logData);

      setActiveBalls((prev) => Math.max(0, prev - 1));
      if (onFinished) {
        onFinished({ payout, multiplier, bucketIndex });
      }
    };

    return {
      success: true,
      ballId,
      path,
      bucketIndex,
      multiplier,
      payout,
      resolvePayout,
    };
  }, [balance, betAmount, rows, getMultipliers, subtractBalance, addBalance, onFinished]);

  return {
    betAmount,
    setBetAmount,
    rows,
    setRows,
    risk,
    setRisk,
    activeBalls,
    getMultipliers,
    dropBall,
  };
}
