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

export function useCoinFlipEngine(balance, subtractBalance, addBalance, onGameFinished) {
  const [betAmount, setBetAmount] = useState(10);
  const [chosenSide, setChosenSide] = useState('heads'); // 'heads' | 'tails'
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'flipping' | 'result'
  const [resultSide, setResultSide] = useState(null); // 'heads' | 'tails' | null
  const [won, setWon] = useState(false);
  const [payout, setPayout] = useState(0);
  const [lastResults, setLastResults] = useState([]); // last 20 results
  
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveResult = useCallback((betAmt, sideChosen, result, didWin, payoutAmt) => {
    const gameResult = {
      won: didWin,
      bet: betAmt,
      guessCount: 1,
      payout: payoutAmt,
      secretNumber: result === 'heads' ? 0 : 1, // 0 = Heads, 1 = Tails
      matchedGuess: sideChosen === result ? (result === 'heads' ? 0 : 1) : null,
      multiplier: didWin ? '1.96' : '0',
      gameType: 'coinflip',
    };
    addGameResult(gameResult);
    updateStats(gameResult);
  }, []);

  const playRound = useCallback(async () => {
    if (gameState === 'flipping') return;

    // Validate bet
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET || bet > balance) return { error: 'Invalid bet amount or insufficient balance' };

    // Increment nonce
    incrementNonce('coinflip');

    const sSeed = getActiveServerSeed('coinflip');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('coinflip');

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }

    // Enter flipping state
    setGameState('flipping');
    setResultSide(null);
    setWon(false);
    setPayout(0);

    // Play tick/flip sound
    playSound('tick');

    // Deterministically generate float outcome
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);
    const floats = hashToRandomFloats(hash, 1);
    const rand = floats[0];

    // Map float to heads or tails (50% chance each)
    const result = rand < 0.5 ? 'heads' : 'tails';
    const didWin = chosenSide === result;
    const payoutAmt = didWin ? Math.round(bet * 1.96 * 100) / 100 : 0;

    // 1.2s spin delay
    timerRef.current = setTimeout(() => {
      setResultSide(result);
      setWon(didWin);
      setPayout(payoutAmt);
      setGameState('result');

      if (didWin) {
        playSound('win');
        addBalance(payoutAmt);
      } else {
        playSound('loss');
      }

      setLastResults(prev => [
        { result, chosenSide, won: didWin, payout: payoutAmt, bet },
        ...prev,
      ].slice(0, 20));

      saveResult(bet, chosenSide, result, didWin, payoutAmt);

      savePreviousRoundInfo(
        'coinflip',
        sSeed,
        cSeed,
        nonceVal,
        hash,
        `Coin landed on: ${result.toUpperCase()} (Chosen: ${chosenSide.toUpperCase()} | ${didWin ? 'Win' : 'Loss'})`
      );

      if (onGameFinished) {
        onGameFinished({
          bet,
          won: didWin,
          payout: payoutAmt
        });
      }
    }, 1200);

    return { success: true };
  }, [gameState, betAmount, chosenSide, balance, subtractBalance, addBalance, saveResult]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setGameState('idle');
    setResultSide(null);
    setWon(false);
    setPayout(0);
  }, []);

  return {
    betAmount,
    setBetAmount,
    chosenSide,
    setChosenSide,
    gameState,
    resultSide,
    won,
    payout,
    lastResults,
    playRound,
    reset,
  };
}
