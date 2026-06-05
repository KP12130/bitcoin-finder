'use client';

import { useState, useCallback } from 'react';
import { useBalance } from '@/hooks/useBalance';
import { addGameResult, updateStats } from '@/lib/storage';
import { parseShorthand } from '@/lib/utils';
import { GAME_CONFIG } from '@/lib/constants';

// ─── Deck Construction ────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (let si = 0; si < SUITS.length; si++) {
    for (let ri = 0; ri < RANKS.length; ri++) {
      deck.push({
        id: `${SUIT_NAMES[si]}-${RANKS[ri]}-${Math.random().toString(36).slice(2, 7)}`,
        suit: SUIT_NAMES[si],
        suitSymbol: SUITS[si],
        rank: RANKS[ri],
        rankIndex: ri, // 0 = Ace, 12 = King
      });
    }
  }
  return deck;
}

function fisherYatesShuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Hand Evaluator ───────────────────────────────────────────────────────────

const PAY_TABLE = {
  'Royal Flush':     800,
  'Straight Flush':  50,
  'Four of a Kind':  25,
  'Full House':      9,
  'Flush':           6,
  'Straight':        4,
  'Three of a Kind': 3,
  'Two Pair':        2,
  'Jacks or Better': 1,
  'High Card':       0,
};

function evaluateHand(hand) {
  // Gather ranks and suits
  const rankIndices = hand.map((c) => c.rankIndex).sort((a, b) => a - b);
  const suits = hand.map((c) => c.suit);

  // Count occurrences of each rank
  const rankCount = {};
  for (const r of rankIndices) {
    rankCount[r] = (rankCount[r] || 0) + 1;
  }
  const counts = Object.values(rankCount).sort((a, b) => b - a); // descending

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight: sorted consecutive, or A-2-3-4-5 (wheel)
  const isStraight = (() => {
    const uniq = [...new Set(rankIndices)];
    if (uniq.length !== 5) return false;
    // Normal consecutive
    if (uniq[4] - uniq[0] === 4) return true;
    // Ace-low wheel: A(0),2(1),3(2),4(3),5(4) => already covered above
    // Royal wheel: A(0) + 10(9) J(10) Q(11) K(12)
    if (JSON.stringify(uniq) === JSON.stringify([0, 9, 10, 11, 12])) return true;
    return false;
  })();

  const isRoyal = isFlush && (() => {
    const uniq = [...new Set(rankIndices)];
    return JSON.stringify(uniq) === JSON.stringify([0, 9, 10, 11, 12]);
  })();

  if (isRoyal && isFlush) return 'Royal Flush';
  if (isStraight && isFlush) return 'Straight Flush';
  if (counts[0] === 4) return 'Four of a Kind';
  if (counts[0] === 3 && counts[1] === 2) return 'Full House';
  if (isFlush) return 'Flush';
  if (isStraight) return 'Straight';
  if (counts[0] === 3) return 'Three of a Kind';
  if (counts[0] === 2 && counts[1] === 2) {
    // Check if either pair is Jacks or better (J=10, Q=11, K=12, A=0)
    return 'Two Pair';
  }
  if (counts[0] === 2) {
    // Pair — check if it's Jacks or Better
    const pairedRankIndex = parseInt(
      Object.entries(rankCount).find(([, v]) => v === 2)[0]
    );
    // Jacks = index 10, Queens = 11, Kings = 12, Aces = 0
    if (pairedRankIndex >= 10 || pairedRankIndex === 0) {
      return 'Jacks or Better';
    }
    return 'High Card';
  }
  return 'High Card';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVideoPokerEngine() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();

  const [betInput, setBetInput] = useState('1');
  const [betAmount, setBetAmount] = useState(1);
  const [gamePhase, setGamePhase] = useState('idle'); // 'idle' | 'dealt' | 'result'
  const [hand, setHand] = useState([]); // array of 5 card objects
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [lastResult, setLastResult] = useState(null); // { won, payout, multiplier }
  const [handName, setHandName] = useState('');
  const [error, setError] = useState('');
  const [deck, setDeck] = useState([]);

  // Session stats
  const [sessionHands, setSessionHands] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionProfit, setSessionProfit] = useState(0);

  // ── Bet helpers ──────────────────────────────────────────────────────────────
  const handleBetInput = useCallback((rawVal) => {
    // strip non-numeric chars except k/K/m/M and dot
    const clean = String(rawVal).replace(/[^0-9.kKmM]/g, '');
    setBetInput(clean);
    const parsed = parseShorthand(clean);
    if (!isNaN(parsed) && parsed > 0) {
      setBetAmount(parsed);
    }
  }, []);

  const applyQuickBet = useCallback((action) => {
    if (gamePhase !== 'idle') return;
    let next = betAmount;
    switch (action) {
      case 'half':
        next = Math.max(GAME_CONFIG.MIN_BET, betAmount / 2);
        break;
      case 'double':
        next = Math.min(balance, betAmount * 2);
        break;
      case 'min':
        next = GAME_CONFIG.MIN_BET;
        break;
      case 'max':
        next = Math.min(balance, GAME_CONFIG.MAX_BET);
        break;
    }
    next = Math.round(next * 100) / 100;
    setBetAmount(next);
    setBetInput(String(next));
  }, [betAmount, balance, gamePhase]);

  // ── Deal ─────────────────────────────────────────────────────────────────────
  const deal = useCallback(async () => {
    setError('');
    const bet = Math.round(betAmount * 100) / 100;

    if (isNaN(bet) || bet < GAME_CONFIG.MIN_BET) {
      setError(`Minimum bet is $${GAME_CONFIG.MIN_BET}`);
      return;
    }
    if (bet > GAME_CONFIG.MAX_BET) {
      setError(`Maximum bet is $${GAME_CONFIG.MAX_BET.toLocaleString()}`);
      return;
    }
    if (balance < bet) {
      setError('Insufficient balance.');
      return;
    }

    try {
      await subtractBalance(bet);
    } catch {
      setError('Insufficient balance.');
      return;
    }

    const freshDeck = fisherYatesShuffle(createDeck());
    const dealtHand = freshDeck.slice(0, 5);
    const remaining = freshDeck.slice(5);

    setDeck(remaining);
    setHand(dealtHand);
    setHeld([false, false, false, false, false]);
    setLastResult(null);
    setHandName('');
    setGamePhase('dealt');
  }, [betAmount, balance, subtractBalance]);

  // ── Toggle Hold ───────────────────────────────────────────────────────────────
  const toggleHold = useCallback((index) => {
    if (gamePhase !== 'dealt') return;
    setHeld((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, [gamePhase]);

  // ── Draw ─────────────────────────────────────────────────────────────────────
  const draw = useCallback(async () => {
    if (gamePhase !== 'dealt') return;

    const bet = Math.round(betAmount * 100) / 100;
    const currentDeck = [...deck];

    // Replace non-held cards
    const finalHand = hand.map((card, i) => {
      if (held[i]) return card;
      const newCard = currentDeck.shift();
      return newCard;
    });

    setHand(finalHand);
    setGamePhase('result');

    // Evaluate hand
    const name = evaluateHand(finalHand);
    const multiplier = PAY_TABLE[name] ?? 0;
    const won = multiplier > 0;
    const payout = won ? Math.round(bet * multiplier * 100) / 100 : 0;

    setHandName(name);
    setLastResult({ won, payout, multiplier, bet });
    setSessionHands((h) => h + 1);

    if (won) {
      await addBalance(payout);
      setSessionWins((w) => w + 1);
      setSessionProfit((p) => Math.round((p + payout - bet) * 100) / 100);
    } else {
      setSessionProfit((p) => Math.round((p - bet) * 100) / 100);
    }

    // Log result
    addGameResult({
      won,
      bet,
      payout,
      guessCount: 5,
      secretNumber: finalHand.map((c) => `${c.rank}${c.suitSymbol}`).join(' '),
      matchedGuess: name,
      multiplier: multiplier.toString(),
      gameType: 'videopoker',
    });

    updateStats({
      won,
      bet,
      payout,
      gameType: 'videopoker',
    });
  }, [gamePhase, betAmount, deck, hand, held, addBalance]);

  // ── Reset ────────────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    setGamePhase('idle');
    setHand([]);
    setHeld([false, false, false, false, false]);
    setLastResult(null);
    setHandName('');
    setError('');
  }, []);

  // ── Hold All ─────────────────────────────────────────────────────────────────
  const holdAll = useCallback(() => {
    if (gamePhase !== 'dealt') return;
    setHeld([true, true, true, true, true]);
  }, [gamePhase]);

  const discardAll = useCallback(() => {
    if (gamePhase !== 'dealt') return;
    setHeld([false, false, false, false, false]);
  }, [gamePhase]);

  return {
    // Balance
    balance,
    isLoaded,

    // Bet
    betInput,
    betAmount,
    setBetAmount,
    handleBetInput,
    applyQuickBet,

    // Game state
    gamePhase,
    hand,
    held,
    lastResult,
    handName,
    error,

    // Actions
    deal,
    toggleHold,
    draw,
    resetGame,
    holdAll,
    discardAll,

    // Session stats
    sessionHands,
    sessionWins,
    sessionProfit,

    // Pay table reference
    PAY_TABLE,
  };
}
