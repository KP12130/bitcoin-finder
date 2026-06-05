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
  getDeterministicShuffle 
} from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';

// Deck Helper Functions
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function generateDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < 13; i++) {
      deck.push({
        value: i + 1, // 1 to 13
        suit,
        label: LABELS[i],
      });
    }
  }
  return deck;
}

// Fallback Standard Shuffle
function shuffle(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function useHiLoEngine(balance, subtractBalance, addBalance) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_hilo');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [gameState, setGameState] = useState(savedState ? savedState.gameState : 'idle'); // 'idle' | 'playing' | 'won' | 'lost'
  const [deck, setDeck] = useState(savedState ? savedState.deck : []);
  const [currentCard, setCurrentCard] = useState(savedState ? savedState.currentCard : null);
  const [streak, setStreak] = useState(savedState ? savedState.streak : 0);
  const [currentMultiplier, setCurrentMultiplier] = useState(savedState ? savedState.currentMultiplier : 1.00);
  const [history, setHistory] = useState(savedState ? savedState.history : []); // cards drawn this round
  const [error, setError] = useState('');

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing';
    if (isActive) {
      localStorage.setItem('btcfinder_active_hilo', JSON.stringify({
        betAmount,
        gameState,
        deck,
        currentCard,
        streak,
        currentMultiplier,
        history
      }));
    } else {
      localStorage.removeItem('btcfinder_active_hilo');
    }
  }, [gameState, betAmount, deck, currentCard, streak, currentMultiplier, history]);

  // Odds calculations based on remaining deck
  const getOdds = useCallback(() => {
    if (!currentCard || deck.length === 0) return { higherOdds: 0.5, lowerOdds: 0.5 };
    const currentValue = currentCard.value;
    let higherCount = 0;
    let lowerCount = 0;

    for (const card of deck) {
      if (card.value > currentValue) higherCount++;
      if (card.value < currentValue) lowerCount++;
    }

    const totalRemaining = deck.length;
    const pHigher = higherCount / totalRemaining;
    const pLower = lowerCount / totalRemaining;

    // Multiplier is 0.99 / probability (clamped to prevent infinity or extreme edge cases)
    const multHigher = pHigher > 0 ? Math.floor((0.99 / pHigher) * 100) / 100 : 0;
    const multLower = pLower > 0 ? Math.floor((0.99 / pLower) * 100) / 100 : 0;

    return {
      pHigher,
      pLower,
      multHigher,
      multLower,
      higherCount,
      lowerCount,
      totalRemaining,
    };
  }, [currentCard, deck]);

    // Start game
  const startGame = useCallback(async () => {
    setError('');
    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (isNaN(bet) || bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET) {
      setError('Please enter a valid bet amount.');
      return;
    }
    if (balance < bet) {
      setError('Insufficient balance.');
      return;
    }

    incrementNonce('hilo');
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }

    // Prepare shuffled deck deterministically
    const freshDeck = await getDeterministicShuffle('hilo', generateDeck());
    const firstCard = freshDeck.pop();

    setDeck(freshDeck);
    setCurrentCard(firstCard);
    setHistory([firstCard]);
    setStreak(0);
    setCurrentMultiplier(1.00);
    setGameState('playing');
    playSound('slide');
  }, [betAmount, balance, subtractBalance]);

  // Guess next card: 'higher' or 'lower'
  const guess = useCallback((direction) => {
    if (gameState !== 'playing' || !currentCard || deck.length === 0) return;

    setError('');
    const nextDeck = [...deck];
    const nextCard = nextDeck.pop();
    setDeck(nextDeck);

    const oldCard = currentCard;
    setCurrentCard(nextCard);
    setHistory((prev) => [...prev, nextCard]);
    playSound('slide');

    // Check guess
    let correct = false;
    const odds = getOdds();

    if (direction === 'higher') {
      correct = nextCard.value > oldCard.value;
    } else if (direction === 'lower') {
      correct = nextCard.value < oldCard.value;
    }

    const sSeed = getActiveServerSeed('hilo');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('hilo');

    if (correct) {
      // Win step: increase streak, multiply current payout
      const multiplierStep = direction === 'higher' ? odds.multHigher : odds.multLower;
      const nextMultiplier = Math.round(currentMultiplier * multiplierStep * 100) / 100;

      setStreak((s) => s + 1);
      setCurrentMultiplier(nextMultiplier);
      playSound('win');

      // If deck runs out
      if (nextDeck.length === 0) {
        const payout = Math.round(Number(betAmount) * nextMultiplier * 100) / 100;
        addBalance(payout);
        setGameState('won');
        playSound('cashout');

        const logData = {
          won: true,
          bet: betAmount,
          payout,
          guessCount: streak + 1,
          secretNumber: nextMultiplier,
          matchedGuess: direction,
          multiplier: nextMultiplier.toFixed(2),
          gameType: 'hilo',
        };
        addGameResult(logData);
        updateStats(logData);

        const combo = `${sSeed}-${cSeed}-${nonceVal}`;
        calculateSha256(combo).then(hash => {
          savePreviousRoundInfo('hilo', sSeed, cSeed, nonceVal, hash, `Cleared Deck (Win ${nextMultiplier.toFixed(2)}x)`);
        });
      }
    } else {
      // Lost round
      setGameState('lost');
      playSound('loss');

      const logData = {
        won: false,
        bet: betAmount,
        payout: 0,
        guessCount: streak,
        secretNumber: 0,
        matchedGuess: direction,
        multiplier: '0',
        gameType: 'hilo',
      };
      addGameResult(logData);
      updateStats(logData);

      const combo = `${sSeed}-${cSeed}-${nonceVal}`;
      calculateSha256(combo).then(hash => {
        savePreviousRoundInfo('hilo', sSeed, cSeed, nonceVal, hash, `Bust (Lost on card ${nextCard.label})`);
      });
    }
  }, [gameState, currentCard, deck, getOdds, currentMultiplier, betAmount, streak, addBalance]);

  // Cash out
  const cashOut = useCallback(() => {
    if (gameState !== 'playing' || streak === 0) return;

    const payout = Math.round(Number(betAmount) * currentMultiplier * 100) / 100;
    addBalance(payout);
    setGameState('won');
    playSound('cashout');

    const logData = {
      won: true,
      bet: betAmount,
      payout,
      guessCount: streak,
      secretNumber: currentMultiplier,
      matchedGuess: null,
      multiplier: currentMultiplier.toFixed(2),
      gameType: 'hilo',
    };
    addGameResult(logData);
    updateStats(logData);

    const sSeed = getActiveServerSeed('hilo');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('hilo');
    const combo = `${sSeed}-${cSeed}-${nonceVal}`;
    calculateSha256(combo).then(hash => {
      savePreviousRoundInfo('hilo', sSeed, cSeed, nonceVal, hash, `Cashed Out: ${currentMultiplier.toFixed(2)}x`);
    });
  }, [gameState, streak, betAmount, currentMultiplier, addBalance]);

  // Reset to idle
  const resetGame = useCallback(() => {
    setGameState('idle');
    setDeck([]);
    setCurrentCard(null);
    setStreak(0);
    setCurrentMultiplier(1.00);
    setHistory([]);
    setError('');
  }, []);

  return {
    betAmount,
    setBetAmount,
    gameState,
    currentCard,
    streak,
    currentMultiplier,
    history,
    error,
    getOdds,
    startGame,
    guess,
    cashOut,
    resetGame,
  };
}
