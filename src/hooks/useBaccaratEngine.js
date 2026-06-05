'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

// Helper to create a single deck
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < 13; i++) {
      const label = LABELS[i];
      const value = i + 1; // 1 to 13
      let baccaratValue = value;
      if (value >= 10) baccaratValue = 0; // 10, J, Q, K count as 0

      deck.push({
        id: `${suit}-${label}-${Math.random()}`,
        suit,
        label,
        value,
        baccaratValue,
      });
    }
  }
  return deck;
}

// Helper to calculate total value modulo 10
export function calculateBaccaratTotal(hand) {
  const sum = hand.reduce((acc, card) => acc + card.baccaratValue, 0);
  return sum % 10;
}

export function useBaccaratEngine(balance, subtractBalance, addBalance) {
  const [betAmount, setBetAmount] = useState(10);
  const [betType, setBetType] = useState('player'); // 'player' | 'banker' | 'tie'
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'dealing' | 'result'
  const [playerHand, setPlayerHand] = useState([]);
  const [bankerHand, setBankerHand] = useState([]);
  const [visiblePlayerCount, setVisiblePlayerCount] = useState(0);
  const [visibleBankerCount, setVisibleBankerCount] = useState(0);
  const [won, setWon] = useState(false);
  const [payout, setPayout] = useState(0);
  const [resultType, setResultType] = useState(null); // 'player' | 'banker' | 'tie'
  const [history, setHistory] = useState([]); // last 20 results ('P', 'B', 'T')
  const [error, setError] = useState('');

  // Stats
  const [sessionRounds, setSessionRounds] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);

  // Reference to timing timeouts
  const timeoutsRef = useRef([]);

  const cleanTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => cleanTimeouts();
  }, []);

  const playRound = useCallback(async () => {
    if (gameState === 'dealing') return;
    setError('');
    cleanTimeouts();

    const bet = Math.round(Number(betAmount) * 100) / 100;
    if (isNaN(bet) || bet < GAME_CONFIG.MIN_BET || bet > GAME_CONFIG.MAX_BET) {
      setError(`Bet must be between $0.10 and $1,000,000`);
      return;
    }
    if (balance < bet) {
      setError('Insufficient balance');
      return;
    }

    // Increment nonce
    incrementNonce('baccarat');

    // Deduct bet
    try {
      await subtractBalance(bet);
    } catch (e) {
      setError('Insufficient balance');
      return;
    }

    setGameState('dealing');
    setWon(false);
    setPayout(0);
    setResultType(null);
    setPlayerHand([]);
    setBankerHand([]);
    setVisiblePlayerCount(0);
    setVisibleBankerCount(0);

    // Create 8-deck shoe
    let shoe = [];
    for (let i = 0; i < 8; i++) {
      shoe = shoe.concat(createDeck());
    }

    // Shuffle shoe deterministically using Provably Fair
    const shuffledShoe = await getDeterministicShuffle('baccarat', shoe);

    // Baccarat dealing sequence
    const p1 = shuffledShoe.pop();
    const b1 = shuffledShoe.pop();
    const p2 = shuffledShoe.pop();
    const b2 = shuffledShoe.pop();

    const pHand = [p1, p2];
    const bHand = [b1, b2];

    const pTotalInitial = calculateBaccaratTotal(pHand);
    const bTotalInitial = calculateBaccaratTotal(bHand);

    let p3 = null;
    let b3 = null;

    // Check for natural
    const isNatural = pTotalInitial >= 8 || bTotalInitial >= 8;

    if (!isNatural) {
      // Player third card rule: draws if 0-5
      if (pTotalInitial <= 5) {
        p3 = shuffledShoe.pop();
        pHand.push(p3);
      }

      // Banker third card rule
      const p3Val = p3 ? p3.baccaratValue : null;
      const bTotal = bTotalInitial;

      const shouldBankerDraw = () => {
        if (p3 === null) {
          // Player stood, Banker draws if 0-5
          return bTotal <= 5;
        }
        // Player drew third card
        if (bTotal <= 2) return true;
        if (bTotal === 3) return p3Val !== 8;
        if (bTotal === 4) return [2, 3, 4, 5, 6, 7].includes(p3Val);
        if (bTotal === 5) return [4, 5, 6, 7].includes(p3Val);
        if (bTotal === 6) return [6, 7].includes(p3Val);
        return false; // 7 stands
      };

      if (shouldBankerDraw()) {
        b3 = shuffledShoe.pop();
        bHand.push(b3);
      }
    }

    const finalPlayerTotal = calculateBaccaratTotal(pHand);
    const finalBankerTotal = calculateBaccaratTotal(bHand);

    // Determine winner
    let outcome = 'tie'; // 'player' | 'banker' | 'tie'
    if (finalPlayerTotal > finalBankerTotal) {
      outcome = 'player';
    } else if (finalBankerTotal > finalPlayerTotal) {
      outcome = 'banker';
    }

    // Determine payout
    let didWin = false;
    let payoutAmt = 0;

    if (betType === outcome) {
      didWin = true;
      if (outcome === 'player') {
        payoutAmt = bet * 2; // 1:1 payout
      } else if (outcome === 'banker') {
        payoutAmt = bet * 1.95; // 0.95:1 payout (5% commission)
      } else {
        payoutAmt = bet * 9; // 8:1 payout (payoutAmt = bet * 9)
      }
    } else if (outcome === 'tie' && (betType === 'player' || betType === 'banker')) {
      // Tie results in push for Player/Banker bets
      didWin = false; // push is not technically a "win" statistics-wise, but returns bet
      payoutAmt = bet; // return the bet
    }

    // Save hands to render
    setPlayerHand(pHand);
    setBankerHand(bHand);

    // Sequential card deal animations timing:
    // P1, B1, P2, B2, [P3], [B3]
    const animationSteps = [
      { player: 1, banker: 0, delay: 300 },
      { player: 1, banker: 1, delay: 600 },
      { player: 2, banker: 1, delay: 900 },
      { player: 2, banker: 2, delay: 1200 },
    ];

    let currentDelay = 1200;
    if (pHand.length > 2) {
      currentDelay += 500;
      animationSteps.push({ player: 3, banker: 2, delay: currentDelay });
    }
    if (bHand.length > 2) {
      currentDelay += 500;
      animationSteps.push({ player: pHand.length, banker: 3, delay: currentDelay });
    }

    animationSteps.forEach((step) => {
      const timeout = setTimeout(() => {
        setVisiblePlayerCount(step.player);
        setVisibleBankerCount(step.banker);
        playSound('card');
      }, step.delay);
      timeoutsRef.current.push(timeout);
    });

    const finalTimeout = setTimeout(() => {
      setResultType(outcome);
      setWon(didWin || (outcome === 'tie' && betType !== 'tie')); // Show win sound if we got bet back or won
      setPayout(payoutAmt);
      setGameState('result');
      setSessionRounds((r) => r + 1);

      if (payoutAmt > bet) {
        playSound('win');
        setSessionWins((w) => w + 1);
        addBalance(payoutAmt);
      } else if (payoutAmt === bet) {
        playSound('flip'); // push sound
        addBalance(payoutAmt);
      } else {
        playSound('loss');
      }

      // Add to history
      setHistory((prev) => [outcome[0].toUpperCase(), ...prev].slice(0, 20));

      // Save to storage
      const logData = {
        won: payoutAmt > bet,
        bet,
        payout: payoutAmt,
        guessCount: pHand.length + bHand.length,
        secretNumber: finalBankerTotal,
        matchedGuess: betType,
        multiplier: payoutAmt > bet ? (payoutAmt / bet).toFixed(2) : payoutAmt === bet ? '1.00' : '0.00',
        gameType: 'baccarat',
      };
      addGameResult(logData);
      updateStats({
        won: payoutAmt > bet,
        bet,
        payout: payoutAmt,
        gameType: 'baccarat',
      });

      // Save provably fair previous round ledger
      const sSeed = getActiveServerSeed('baccarat');
      const cSeed = getClientSeed();
      const nonceVal = getNonce('baccarat');
      const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
      calculateSha256(comboStr).then((hash) => {
        savePreviousRoundInfo(
          'baccarat',
          sSeed,
          cSeed,
          nonceVal,
          hash,
          `Player Hand: ${finalPlayerTotal} (${pHand.map(c => c.label + c.suit[0]).join(', ')}) | Banker Hand: ${finalBankerTotal} (${bHand.map(c => c.label + c.suit[0]).join(', ')}) | Outcome: ${outcome.toUpperCase()}`
        );
      });
    }, currentDelay + 600);

    timeoutsRef.current.push(finalTimeout);
  }, [betAmount, betType, balance, gameState, subtractBalance, addBalance]);

  const reset = useCallback(() => {
    cleanTimeouts();
    setGameState('idle');
    setPlayerHand([]);
    setBankerHand([]);
    setVisiblePlayerCount(0);
    setVisibleBankerCount(0);
    setWon(false);
    setPayout(0);
    setResultType(null);
    setError('');
  }, []);

  return {
    betAmount,
    setBetAmount,
    betType,
    setBetType,
    gameState,
    playerHand,
    bankerHand,
    visiblePlayerCount,
    visibleBankerCount,
    playerTotal: calculateBaccaratTotal(playerHand.slice(0, visiblePlayerCount)),
    bankerTotal: calculateBaccaratTotal(bankerHand.slice(0, visibleBankerCount)),
    won,
    payout,
    resultType,
    history,
    error,
    sessionRounds,
    sessionWins,
    playRound,
    reset,
  };
}
