'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { isDbEnabled } from '@/lib/supabase';

// Context
const LiveBetsContext = createContext(null);

// Pool of crypto-themed NPC bot names to simulate other players
const BOT_NAMES = [
  'SatoshiSniper', 'BlockBreaker', 'CryptoKing99', 'HashHunter', 'MoonMiner',
  'DigiDriller', 'NodeRunner', 'BitBlaster', 'ChainChaser', 'TokenTiger',
  'GigaHash', 'GasFeeHater', 'LamboSoon', 'WhaleWatcher', 'BullRunner',
  'BearFighter', 'HODLWarrior', 'DipBuyer', 'LeverageLover', 'LiquidityProvider',
  'HalvingHelper', 'MempoolMonster', 'NonceNerd', 'TxTracker', 'MerkleRooter',
  'NonceNinja', 'GenesisBlocker', 'PrivateKeyKeeper', 'SeedPhraseSam', 'FiatFlee-er',
  'SolSurfer', 'EthGasLord', 'DogeDad', 'ShibaSoldier', 'PepePumper',
  'WifHatWearer', 'LedgerLover', 'TrezorTrustee', 'ColdWalletWarmHearts', 'SmartContractor',
  'ArbitrageAce', 'MEVSniper', 'GweiGenius', 'SlippageSlayer', 'PnLFlexer',
  'HighRollerPete', 'MicroWagerMick', 'YoloBetting', 'MartingaleMax', 'FomoFred'
];

// Avatars matching standard avatars in constant.js
const AVATAR_EMOJIS = ['⛏️', '🪙', '🚀', '🎰', '🎲', '💎', '🔥', '👑', '🧙', '👽', '🤖', '🐶'];

// Game categories
const GAMES = ['Mine', 'Slots', 'Crash', 'Dice', 'Plinko', 'Mines', 'Limbo', 'Tower', 'Hi-Lo', 'Blackjack', 'Coin Flip', 'Token Pop', 'Chicken Road', 'Snake Roll'];

// Helper to generate a fake transaction hash for bots
function generateFakeTxHash() {
  return Array.from({ length: 32 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
}

export function LiveBetsProvider({ children }) {
  const [bets, setBets] = useState([]);
  
  // Track existing bets in a ref to avoid stale state in timers
  const betsRef = useRef([]);
  betsRef.current = bets;

  // Add a new bet to the list (both user and bots use this)
  const addBet = useCallback((newBet) => {
    const betWithId = {
      id: newBet.id || `${Date.now()}-${Math.random()}`,
      timestamp: newBet.timestamp || Date.now(),
      ...newBet
    };

    // Dispatch custom event for chat simulation reactions
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('new-bet-slip', { detail: betWithId }));
    }

    setBets((prev) => {
      const updated = [betWithId, ...prev];
      if (updated.length > 50) {
        updated.length = 50; // Cap at 50 records
      }
      return updated;
    });
  }, []);

  // Simulation interval for background wagers
  useEffect(() => {
    const runSimulation = () => {
      // Pick random bot details
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const avatarEmoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
      const game = GAMES[Math.floor(Math.random() * GAMES.length)];
      
      // Determine wager amount (higher weight on smaller bets, occasional whales)
      const r = Math.random();
      let bet = 1.00;
      if (r < 0.6) {
        bet = parseFloat((1 + Math.random() * 24).toFixed(2)); // $1 - $25
      } else if (r < 0.9) {
        bet = parseFloat((25 + Math.random() * 175).toFixed(2)); // $25 - $200
      } else {
        bet = parseFloat((200 + Math.random() * 1800).toFixed(2)); // $200 - $2000
      }

      // Generate realistic outcomes based on game type
      let multiplier = 0;
      let won = false;

      switch (game) {
        case 'Crash':
        case 'Limbo': {
          // Standard crash logic: 3% instant crash, otherwise Pareto distribution
          const e = Math.random();
          if (e < 0.03) {
            multiplier = 1.00;
            won = false;
          } else {
            // Target multiplier reached
            const target = 0.97 / (1.00 - e);
            // Bots cash out randomly before target
            const cashoutFactor = 0.4 + Math.random() * 0.55; // Cashout at 40% - 95% of peak
            multiplier = parseFloat(Math.max(1.01, target * cashoutFactor).toFixed(2));
            won = Math.random() > 0.4; // 60% chance to cash out safely
            if (!won) multiplier = 0;
          }
          break;
        }
        case 'Slots': {
          // Volatile payouts
          const spin = Math.random();
          if (spin < 0.65) {
            multiplier = 0;
            won = false;
          } else if (spin < 0.9) {
            multiplier = parseFloat((0.2 + Math.random() * 1.8).toFixed(2)); // small win/loss
            won = multiplier >= 1.0;
          } else {
            multiplier = parseFloat((3 + Math.random() * 47).toFixed(2)); // Big jackpot hit!
            won = true;
          }
          break;
        }
        case 'Blackjack':
        case 'Hi-Lo': {
          // High chance 50/50 style
          won = Math.random() > 0.52; // slightly favor house
          multiplier = won ? (Math.random() < 0.1 ? 2.5 : 2.0) : 0; // 2.5x for Blackjack, 2x for double-up
          break;
        }
        case 'Plinko': {
          // Central nodes have lower returns, edges have high returns
          const pin = Math.random();
          won = true;
          if (pin < 0.7) {
            multiplier = parseFloat((0.2 + Math.random() * 0.8).toFixed(2)); // Central bins (loss of value)
          } else if (pin < 0.96) {
            multiplier = parseFloat((1.1 + Math.random() * 2.9).toFixed(2)); // Intermediate bins
          } else {
            multiplier = parseFloat((5 + Math.random() * 25).toFixed(2)); // Outermost edge bins!
          }
          break;
        }
        case 'Dice': {
          // Adjust target win chance
          const winChance = 10 + Math.random() * 80; // 10% - 90%
          won = Math.random() * 100 < winChance;
          multiplier = won ? parseFloat((98 / winChance).toFixed(2)) : 0;
          break;
        }
        case 'Mines':
        case 'Mine': {
          // Picks
          const mineCount = [1, 3, 5, 24][Math.floor(Math.random() * 4)];
          const picks = 1 + Math.floor(Math.random() * 8);
          won = Math.random() > (picks * (mineCount / 25));
          
          if (won) {
            // Calculate a plausible multiplier
            let mult = 1.0;
            for (let i = 0; i < picks; i++) {
              mult *= (25 - i) / (25 - mineCount - i);
            }
            multiplier = parseFloat((mult * 0.98).toFixed(2));
          } else {
            multiplier = 0;
          }
          break;
        }
        case 'Coin Flip': {
          won = Math.random() > 0.51;
          multiplier = won ? 1.96 : 0;
          break;
        }
        case 'Token Pop': {
          const gridSize = [4, 9, 16][Math.floor(Math.random() * 3)];
          const config = { 4: { traps: 1, min: 1.10, max: 2.50 }, 9: { traps: 2, min: 1.05, max: 2.00 }, 16: { traps: 4, min: 1.05, max: 2.50 } }[gridSize];
          const totalSafe = gridSize - config.traps;
          const pops = 1 + Math.floor(Math.random() * Math.min(6, totalSafe));
          won = Math.random() > (pops * (config.traps / gridSize));
          if (won) {
            let mult = 1.0;
            for (let i = 0; i < pops; i++) {
              const stepMult = config.min + Math.random() * (config.max - config.min) * 0.45;
              mult *= stepMult;
            }
            multiplier = parseFloat(mult.toFixed(2));
          } else {
            multiplier = 0;
          }
          break;
        }
        case 'Chicken Road': {
          const steps = 1 + Math.floor(Math.random() * 5);
          won = Math.random() > (steps * 0.15);
          if (won) {
            multiplier = parseFloat(Math.pow(1.47, steps).toFixed(2));
          } else {
            multiplier = 0;
          }
          break;
        }
        case 'Snake Roll': {
          const rolls = 1 + Math.floor(Math.random() * 4);
          won = Math.random() > (rolls * 0.12);
          if (won) {
            multiplier = parseFloat((1.0 + rolls * (0.10 + Math.random() * 0.30)).toFixed(2));
          } else {
            multiplier = 0;
          }
          break;
        }
        default:
          won = Math.random() > 0.55;
          multiplier = won ? 2.0 : 0;
          break;
      }

      const payout = won ? parseFloat((bet * multiplier).toFixed(2)) : 0;

      addBet({
        name,
        avatarEmoji,
        game,
        bet,
        multiplier: multiplier > 0 ? `${multiplier}x` : '0.00x',
        payout,
        won,
        isPlayer: false,
        txid: generateFakeTxHash()
      });

      // Schedule next bet with random offset to sound human
      const nextDelay = 1200 + Math.random() * 2400; // 1.2s - 3.6s
      timerRef.current = setTimeout(runSimulation, nextDelay);
    };

    // First delay before beginning wagers
    const timerRef = { current: setTimeout(runSimulation, 2000) };

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [addBet]);

  return (
    <LiveBetsContext.Provider value={{ bets, addBet }}>
      {children}
    </LiveBetsContext.Provider>
  );
}

// Hook to consume the context
export function useLiveBets() {
  const context = useContext(LiveBetsContext);
  if (!context) {
    throw new Error('useLiveBets must be used within a LiveBetsProvider');
  }
  return context;
}
