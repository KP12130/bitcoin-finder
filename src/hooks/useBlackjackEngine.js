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

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Helper to create a deck of 52 cards
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < 13; i++) {
      const label = LABELS[i];
      let val = i + 1;
      if (['J', 'Q', 'K'].includes(label)) val = 10;
      if (label === 'A') val = 11; // default to 11

      deck.push({
        id: `${suit}-${label}-${Math.random()}`,
        suit,
        label,
        value: val,
      });
    }
  }
  return deck;
}

// Generate and shuffle 4 decks of cards (initial fallback)
function createShoe() {
  let shoe = [];
  for (let i = 0; i < 4; i++) {
    shoe = shoe.concat(createDeck());
  }
  // Standard shuffle
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

// Calculate total value of a hand, handling Aces optimally
export function calculateHandTotal(hand) {
  let total = 0;
  let aceCount = 0;

  for (const card of hand) {
    total += card.value;
    if (card.label === 'A') {
      aceCount++;
    }
  }

  // Convert Aces from 11 to 1 if we're busted
  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  return total;
}

export function useBlackjackEngine(balance, subtractBalance, addBalance) {
  const getSavedActiveState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('btcfinder_active_blackjack');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const savedState = getSavedActiveState();

  const [betAmount, setBetAmount] = useState(savedState ? savedState.betAmount : 10);
  const [currentBet, setCurrentBet] = useState(savedState ? savedState.currentBet : 10);
  const [gameState, setGameState] = useState(savedState ? (savedState.gameState === 'dealerTurn' ? 'playing' : savedState.gameState) : 'idle'); // 'idle' | 'playing' | 'dealerTurn' | 'resolved'
  const [shoe, setShoe] = useState(savedState ? savedState.shoe : []);
  const [playerHand, setPlayerHand] = useState(savedState ? savedState.playerHand : []);
  const [dealerHand, setDealerHand] = useState(savedState ? savedState.dealerHand : []);
  const [dealerHidden, setDealerHidden] = useState(savedState ? savedState.dealerHidden : true);
  const [result, setResult] = useState(savedState ? savedState.result : null); // 'win' | 'lose' | 'push' | 'blackjack' | 'bust'
  const [payout, setPayout] = useState(savedState ? savedState.payout : 0);
  const [error, setError] = useState('');

  // Stats
  const [sessionHands, setSessionHands] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionPushes, setSessionPushes] = useState(0);

  // Initialize shoe if not restored
  useEffect(() => {
    if (!savedState || !savedState.shoe || savedState.shoe.length === 0) {
      setShoe(createShoe());
    }
  }, []);

  // Sync game state to localStorage
  useEffect(() => {
    const isActive = gameState === 'playing' || gameState === 'dealerTurn';
    if (isActive) {
      localStorage.setItem('btcfinder_active_blackjack', JSON.stringify({
        betAmount,
        currentBet,
        gameState: gameState === 'dealerTurn' ? 'playing' : gameState,
        shoe,
        playerHand,
        dealerHand,
        dealerHidden,
        result,
        payout
      }));
    } else {
      localStorage.removeItem('btcfinder_active_blackjack');
    }
  }, [gameState, betAmount, currentBet, shoe, playerHand, dealerHand, dealerHidden, result, payout]);

  const playerTotal = calculateHandTotal(playerHand);
  const dealerTotal = calculateHandTotal(dealerHand);

  // Start new round
  const deal = useCallback(async () => {
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

    // Increment nonce for round determinism
    incrementNonce('blackjack');

    // Deduct bet
    try { await subtractBalance(bet); } catch (e) { return { error: 'Insufficient balance' }; }
    setCurrentBet(bet);
    setResult(null);
    setPayout(0);
    setDealerHidden(true);

    let currentShoe = [...shoe];
    // Re-shuffle shoe deterministically if running low
    if (currentShoe.length < 40) {
      let freshShoe = [];
      for (let i = 0; i < 4; i++) {
        freshShoe = freshShoe.concat(createDeck());
      }
      currentShoe = await getDeterministicShuffle('blackjack', freshShoe);
    }

    // Deal cards
    const p1 = currentShoe.pop();
    const d1 = currentShoe.pop();
    const p2 = currentShoe.pop();
    const d2 = currentShoe.pop();

    const pHand = [p1, p2];
    const dHand = [d1, d2];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setShoe(currentShoe);
    setSessionHands((h) => h + 1);

    const pTotal = calculateHandTotal(pHand);
    const dTotal = calculateHandTotal(dHand);

    // Check for immediate natural blackjacks
    if (pTotal === 21) {
      setDealerHidden(false);
      setGameState('resolved');
      
      const activeServerSeed = getActiveServerSeed('blackjack');
      const activeClientSeed = getClientSeed();
      const activeNonce = getNonce('blackjack');

      if (dTotal === 21) {
        // Double blackjack = push
        setResult('push');
        setPayout(bet);
        addBalance(bet);
        setSessionPushes((p) => p + 1);
        playSound('flip');
        logGame('push', bet, bet, pHand, dHand);

        const combo = `${activeServerSeed}-${activeClientSeed}-${activeNonce}`;
        calculateSha256(combo).then(hash => {
          savePreviousRoundInfo('blackjack', activeServerSeed, activeClientSeed, activeNonce, hash, 'Natural Blackjack (Push)');
        });
      } else {
        // Player blackjack pays 3:2 (2.5x total payout)
        const bjPayout = Math.round(bet * 2.5 * 100) / 100;
        setResult('blackjack');
        setPayout(bjPayout);
        addBalance(bjPayout);
        setSessionWins((w) => w + 1);
        playSound('win');
        logGame('blackjack', bet, bjPayout, pHand, dHand);

        const combo = `${activeServerSeed}-${activeClientSeed}-${activeNonce}`;
        calculateSha256(combo).then(hash => {
          savePreviousRoundInfo('blackjack', activeServerSeed, activeClientSeed, activeNonce, hash, 'Natural Blackjack (Win)');
        });
      }
    } else {
      setGameState('playing');
    }
  }, [betAmount, balance, shoe, subtractBalance, addBalance]);

  // Log results
  const logGame = useCallback((outcome, bet, finalPayout, pHand, dHand) => {
    const won = outcome === 'win' || outcome === 'blackjack';
    const logData = {
      won,
      bet,
      payout: finalPayout,
      guessCount: pHand.length,
      secretNumber: calculateHandTotal(dHand),
      matchedGuess: outcome,
      multiplier: outcome === 'blackjack' ? '2.50' : won ? '2.00' : outcome === 'push' ? '1.00' : '0.00',
      gameType: 'blackjack',
    };
    addGameResult(logData);
    updateStats({
      won,
      bet,
      payout: finalPayout,
      gameType: 'blackjack',
    });
  }, []);

  // Resolve Round (final calculation)
  const resolveRound = useCallback((pHand, dHand, activeBet) => {
    setGameState('resolved');
    const pTotal = calculateHandTotal(pHand);
    const dTotal = calculateHandTotal(dHand);
    
    let finalOutcome = 'lose';

    if (dTotal > 21) {
      // Dealer bust! Player wins
      setResult('win');
      const winPayout = activeBet * 2;
      setPayout(winPayout);
      addBalance(winPayout);
      setSessionWins((w) => w + 1);
      playSound('win');
      logGame('win', activeBet, winPayout, pHand, dHand);
      finalOutcome = 'win';
    } else if (pTotal > dTotal) {
      // Player beats dealer
      setResult('win');
      const winPayout = activeBet * 2;
      setPayout(winPayout);
      addBalance(winPayout);
      setSessionWins((w) => w + 1);
      playSound('win');
      logGame('win', activeBet, winPayout, pHand, dHand);
      finalOutcome = 'win';
    } else if (pTotal < dTotal) {
      // Dealer beats player
      setResult('lose');
      setPayout(0);
      playSound('loss');
      logGame('lose', activeBet, 0, pHand, dHand);
      finalOutcome = 'lose';
    } else {
      // Push
      setResult('push');
      setPayout(activeBet);
      addBalance(activeBet);
      setSessionPushes((p) => p + 1);
      playSound('flip');
      logGame('push', activeBet, activeBet, pHand, dHand);
      finalOutcome = 'push';
    }

    const activeServerSeed = getActiveServerSeed('blackjack');
    const activeClientSeed = getClientSeed();
    const activeNonce = getNonce('blackjack');
    const combo = `${activeServerSeed}-${activeClientSeed}-${activeNonce}`;
    calculateSha256(combo).then(hash => {
      savePreviousRoundInfo(
        'blackjack',
        activeServerSeed,
        activeClientSeed,
        activeNonce,
        hash,
        finalOutcome === 'win' ? 'Dealer Stand (Win)' : finalOutcome === 'push' ? 'Dealer Stand (Push)' : 'Dealer Stand (Lose)'
      );
    });
  }, [addBalance, logGame]);

  // Run Dealer Turn (deals recursively every 600ms)
  const runDealerTurn = useCallback((pHand, currentDHand, currentShoe, activeBet) => {
    const dTotal = calculateHandTotal(currentDHand);
    if (dTotal < 17) {
      const nextShoe = [...currentShoe];
      const nextCard = nextShoe.pop();
      const nextDHand = [...currentDHand, nextCard];

      setDealerHand(nextDHand);
      setShoe(nextShoe);
      playSound('slide');

      const newTotal = calculateHandTotal(nextDHand);
      const delay = newTotal < 17 ? 600 : 350;

      setTimeout(() => {
        runDealerTurn(pHand, nextDHand, nextShoe, activeBet);
      }, delay);
    } else {
      resolveRound(pHand, currentDHand, activeBet);
    }
  }, [resolveRound]);

  // Hit
  const hit = useCallback(async () => {
    if (gameState !== 'playing') return;

    playSound('slide');

    const currentShoe = [...shoe];
    const newCard = currentShoe.pop();
    const nextHand = [...playerHand, newCard];

    setPlayerHand(nextHand);
    setShoe(currentShoe);

    const nextTotal = calculateHandTotal(nextHand);
    if (nextTotal > 21) {
      // Bust!
      setGameState('resolved');
      setDealerHidden(false);
      setResult('bust');
      setPayout(0);
      playSound('loss');
      logGame('bust', currentBet, 0, nextHand, dealerHand);

      const activeServerSeed = getActiveServerSeed('blackjack');
      const activeClientSeed = getClientSeed();
      const activeNonce = getNonce('blackjack');
      const combo = `${activeServerSeed}-${activeClientSeed}-${activeNonce}`;
      calculateSha256(combo).then(hash => {
        savePreviousRoundInfo('blackjack', activeServerSeed, activeClientSeed, activeNonce, hash, 'Player Bust');
      });
    }
  }, [gameState, shoe, playerHand, dealerHand, currentBet, logGame]);

  // Stand
  const stand = useCallback(() => {
    if (gameState !== 'playing' && gameState !== 'dealerTurn') return;

    setGameState('dealerTurn');
    setDealerHidden(false);
    playSound('flip');

    runDealerTurn(playerHand, dealerHand, shoe, currentBet);
  }, [gameState, playerHand, dealerHand, shoe, currentBet, runDealerTurn]);

  // Double Down
  const doubleDown = useCallback(async () => {
    if (gameState !== 'playing') return;
    if (balance < currentBet) {
      setError('Insufficient balance to double down.');
      return;
    }

    playSound('slide');

    // Deduct double bet
    try { await subtractBalance(currentBet); } catch (e) { return { error: 'Insufficient balance' }; }
    const newBet = currentBet * 2;
    setCurrentBet(newBet);

    const currentShoe = [...shoe];
    const newCard = currentShoe.pop();
    const nextHand = [...playerHand, newCard];

    setPlayerHand(nextHand);
    setShoe(currentShoe);

    const nextTotal = calculateHandTotal(nextHand);

    if (nextTotal > 21) {
      setGameState('resolved');
      setDealerHidden(false);
      setResult('bust');
      setPayout(0);
      playSound('loss');
      logGame('bust', newBet, 0, nextHand, dealerHand);

      const activeServerSeed = getActiveServerSeed('blackjack');
      const activeClientSeed = getClientSeed();
      const activeNonce = getNonce('blackjack');
      const combo = `${activeServerSeed}-${activeClientSeed}-${activeNonce}`;
      calculateSha256(combo).then(hash => {
        savePreviousRoundInfo('blackjack', activeServerSeed, activeClientSeed, activeNonce, hash, 'Double Down Bust');
      });
    } else {
      // Must stand immediately after double down, trigger dealer turn
      setGameState('dealerTurn');
      setDealerHidden(false);
      runDealerTurn(nextHand, dealerHand, currentShoe, newBet);
    }
  }, [gameState, balance, currentBet, shoe, playerHand, dealerHand, subtractBalance, runDealerTurn, logGame]);

  // Reset to idle
  const resetGame = useCallback(() => {
    setGameState('idle');
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
    setPayout(0);
    setError('');
  }, []);

  return {
    betAmount,
    setBetAmount,
    currentBet,
    gameState,
    playerHand,
    dealerHand,
    dealerHidden,
    playerTotal,
    dealerTotal,
    result,
    payout,
    error,
    sessionHands,
    sessionWins,
    sessionPushes,
    deal,
    hit,
    stand,
    doubleDown,
    resetGame,
  };
}
