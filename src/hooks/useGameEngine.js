'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSecretNumber, generateGuesses, calculatePayout, formatBTC } from '@/lib/utils';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { playSound } from '@/lib/audio';

const STATES = {
  IDLE: 'idle',
  BETTING: 'betting',
  MINING: 'mining',
  REVEALING: 'revealing',
  RESULT: 'result',
};

export function useGameEngine(balance, subtractBalance, addBalance, onGameFinished) {
  const [gameState, setGameState] = useState(STATES.IDLE);
  const [bet, setBet] = useState(1); // Default $1 bet
  const [guessCount, setGuessCount] = useState(100);
  const [secretNumber, setSecretNumber] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [result, setResult] = useState(null);
  const [matchIndex, setMatchIndex] = useState(-1);
  const revealTimerRef = useRef(null);
  const stoppedEarly = useRef(false);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const startGame = useCallback(async () => {
    if (bet < GAME_CONFIG.MIN_BET) return { error: `Minimum bet is ${formatBTC(GAME_CONFIG.MIN_BET)}` };
    if (bet > GAME_CONFIG.MAX_BET) return { error: `Maximum bet is ${formatBTC(GAME_CONFIG.MAX_BET)}` };
    if (bet > balance) return { error: 'Insufficient balance' };
    if (guessCount < GAME_CONFIG.MIN_GUESSES || guessCount > GAME_CONFIG.MAX_GUESSES) {
      return { error: `Guesses must be between ${GAME_CONFIG.MIN_GUESSES} and ${GAME_CONFIG.MAX_GUESSES}` };
    }

    clearRevealTimer();

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }

    // Generate game
    const secret = generateSecretNumber();
    const playerGuesses = generateGuesses(guessCount);

    // Check if won
    const foundIndex = playerGuesses.indexOf(secret);

    setSecretNumber(secret);
    setGuesses(playerGuesses);
    setRevealedCount(0);
    setMatchIndex(foundIndex);
    setResult(null);
    setGameState(STATES.MINING);
    stoppedEarly.current = false;

    playSound('slide');

    // Start revealing numbers
    let count = 0;
    const totalToReveal = foundIndex >= 0 ? foundIndex + 1 : playerGuesses.length;
    // Adjust speed based on count: faster for more guesses
    const baseDelay = guessCount > 100 ? 30 : guessCount > 50 ? 50 : GAME_CONFIG.REVEAL_DELAY_MS;

    revealTimerRef.current = setInterval(() => {
      count++;
      setRevealedCount(count);
      playSound('tick');

      if (count >= totalToReveal || stoppedEarly.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;

        const won = foundIndex >= 0;
        const payout = won ? calculatePayout(bet, guessCount) : 0;

        if (won) {
          addBalance(payout);
          playSound('win');
        } else {
          playSound('loss');
        }

        const gameResult = {
          won,
          bet,
          guessCount,
          payout,
          secretNumber: secret,
          matchedGuess: won ? playerGuesses[foundIndex] : null,
          multiplier: won ? (payout / bet).toFixed(2) : '0',
        };

        setResult(gameResult);
        setGameState(STATES.RESULT);

        // Save to history and update stats
        addGameResult(gameResult);
        updateStats(gameResult);

        if (onGameFinished) {
          onGameFinished(gameResult);
        }
      }
    }, baseDelay);

    return { success: true };
  }, [bet, guessCount, balance, subtractBalance, addBalance, clearRevealTimer, onGameFinished]);

  const skipReveal = useCallback(() => {
    stoppedEarly.current = true;
  }, []);

  const resetGame = useCallback(() => {
    clearRevealTimer();
    setGameState(STATES.IDLE);
    setSecretNumber(null);
    setGuesses([]);
    setRevealedCount(0);
    setResult(null);
    setMatchIndex(-1);
  }, [clearRevealTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearRevealTimer();
  }, [clearRevealTimer]);

  return {
    gameState,
    STATES,
    bet,
    setBet,
    guessCount,
    setGuessCount,
    secretNumber,
    guesses,
    revealedCount,
    result,
    matchIndex,
    startGame,
    skipReveal,
    resetGame,
  };
}
