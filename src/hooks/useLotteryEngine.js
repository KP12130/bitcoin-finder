'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { addGameResult, updateStats } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { playSound } from '@/lib/audio';

const BOT_NAMES = [
  'CryptoKing', 'SatoshiAccumulator', 'HODL_Master', 'WhaleWatcher', 'BitcoinBull',
  'DogeMillionaire', 'EtherSurfer', 'HalvingHunter', 'LaszloHanyecz', 'PizzaGuy',
  'BlockChainChain', 'MoonMission', 'DipBuyer', 'GenesisBlock', 'NonceCracker'
];

export function useLotteryEngine(balance, subtractBalance, addBalance) {
  const [progressivePot, setProgressivePot] = useState(100.0);
  const [ticketAmount, setTicketAmount] = useState(10);
  const [myTickets, setMyTickets] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState(null); // e.g. ['7', '7', '7'] (3 digits)
  const [timeLeft, setTimeLeft] = useState(15);
  const [drawHistory, setDrawHistory] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState('');
  const [wonPotAmount, setWonPotAmount] = useState(0);
  const [lastDrawState, setLastDrawState] = useState('idle'); // 'idle' | 'won' | 'lost'
  const [lastDrawHalf, setLastDrawHalf] = useState(false); // True if winning ticket has duplicates

  const activeTicketsRef = useRef([]);
  const currentPotRef = useRef(100.0);

  // Sync ref with state
  useEffect(() => {
    activeTicketsRef.current = myTickets;
  }, [myTickets]);

  useEffect(() => {
    currentPotRef.current = progressivePot;
    if (typeof window !== 'undefined') {
      localStorage.setItem('btcfinder_lottery_pot', progressivePot.toFixed(2));
    }
  }, [progressivePot]);

  // Load initial pot and history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPot = localStorage.getItem('btcfinder_lottery_pot');
      if (savedPot) {
        setProgressivePot(parseFloat(savedPot));
      }
      const savedHistory = localStorage.getItem('btcfinder_lottery_history');
      if (savedHistory) {
        try {
          setDrawHistory(JSON.parse(savedHistory));
        } catch (e) {}
      }
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory) => {
    setDrawHistory(newHistory);
    if (typeof window !== 'undefined') {
      localStorage.setItem('btcfinder_lottery_history', JSON.stringify(newHistory));
    }
  };

  // Buy Ticket action (Single)
  const buyTicket = useCallback(async (ticketCode) => {
    setError('');
    if (!/^\d{3}$/.test(ticketCode)) {
      setError('Ticket code must be exactly 3 digits (e.g. 777)');
      return false;
    }

    const price = Math.round(Number(ticketAmount) * 100) / 100;
    if (isNaN(price) || price < GAME_CONFIG.MIN_BET || price > GAME_CONFIG.MAX_BET) {
      setError(`Ticket price must be between $0.10 and $1,000,000`);
      return false;
    }

    if (balance < price) {
      setError('Insufficient balance');
      return false;
    }

    try {
      await subtractBalance(price);
    } catch (e) {
      setError('Insufficient balance');
      return false;
    }

    // Add ticket
    setMyTickets(prev => [...prev, ticketCode]);

    // Pot increases by 90% of ticket cost
    setProgressivePot(prev => prev + (price * 0.90));

    // Add to activity
    setRecentActivity(prev => [
      { player: 'You', ticket: ticketCode, amount: price, time: Date.now() },
      ...prev
    ].slice(0, 20));

    playSound('card');
    return true;
  }, [ticketAmount, balance, subtractBalance]);

  // Buy Tickets Bulk action
  const buyTicketsBulk = useCallback(async (quantity) => {
    setError('');
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 100) {
      setError('Bulk purchase quantity must be between 1 and 100.');
      return false;
    }

    const pricePerTicket = Math.round(Number(ticketAmount) * 100) / 100;
    const totalPrice = pricePerTicket * qty;

    if (balance < totalPrice) {
      setError('Insufficient balance');
      return false;
    }

    try {
      await subtractBalance(totalPrice);
    } catch (e) {
      setError('Insufficient balance');
      return false;
    }

    const codes = [];
    for (let i = 0; i < qty; i++) {
      const ticketCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      codes.push(ticketCode);
    }

    setMyTickets(prev => [...prev, ...codes]);
    setProgressivePot(prev => prev + (totalPrice * 0.90));

    setRecentActivity(prev => [
      { player: 'You', ticket: `${qty} Tickets (Bulk)`, amount: totalPrice, time: Date.now() },
      ...prev
    ].slice(0, 20));

    playSound('card');
    return true;
  }, [ticketAmount, balance, subtractBalance]);

  // Handle the Drawing Math & Animations
  const performDraw = useCallback(() => {
    setIsDrawing(true);
    setLastDrawState('idle');
    setWonPotAmount(0);
    setLastDrawHalf(false);

    // Pick 3 random digits deterministically
    const digit1 = Math.floor(Math.random() * 10).toString();
    const digit2 = Math.floor(Math.random() * 10).toString();
    const digit3 = Math.floor(Math.random() * 10).toString();
    const winningCode = `${digit1}${digit2}${digit3}`;

    // Play rolling sounds sequentially
    setTimeout(() => playSound('tick'), 300);
    setTimeout(() => playSound('tick'), 600);
    setTimeout(() => playSound('tick'), 900);

    setTimeout(() => {
      setDrawResult([digit1, digit2, digit3]);
      setIsDrawing(false);

      const userTickets = activeTicketsRef.current;
      const currentPot = currentPotRef.current;

      // Check if winning ticket has duplicates
      const uniqueDigits = new Set(winningCode.split(''));
      const hasDuplicates = uniqueDigits.size < 3;

      // User wins pot (halved if duplicate digits)
      const userMatched = userTickets.includes(winningCode);

      if (userMatched) {
        // Calculate payout (if duplicates, half the winnings)
        const rawWinVal = hasDuplicates ? (currentPot / 2) : currentPot;
        const winVal = Math.round(rawWinVal * 100) / 100;
        
        setWonPotAmount(winVal);
        setLastDrawState('won');
        setLastDrawHalf(hasDuplicates);
        addBalance(winVal);
        playSound('win');

        // Reset/reduce pot (if half won, other half remains in pot)
        const nextPot = hasDuplicates ? (currentPot - winVal) : 100.0;
        setProgressivePot(Math.max(100.0, nextPot));

        // Add to history
        const newHistory = [
          { 
            draw: winningCode, 
            pot: winVal, 
            winner: `You (${hasDuplicates ? '50% Duplicates' : '100% Full'})`, 
            time: new Date().toLocaleTimeString() 
          },
          ...drawHistory
        ].slice(0, 15);
        saveHistory(newHistory);

        // Log results
        const logData = {
          won: true,
          bet: userTickets.length * ticketAmount,
          payout: winVal,
          guessCount: userTickets.length,
          secretNumber: parseInt(winningCode, 10),
          matchedGuess: winningCode,
          multiplier: (winVal / (userTickets.length * ticketAmount || 1)).toFixed(2),
          gameType: 'lottery',
        };
        addGameResult(logData);
        updateStats({
          won: true,
          bet: userTickets.length * ticketAmount,
          payout: winVal,
          gameType: 'lottery',
        });

      } else {
        // Roll over!
        setLastDrawState('lost');
        setLastDrawHalf(hasDuplicates);
        playSound('loss');

        // Add to history
        const newHistory = [
          { draw: winningCode, pot: currentPot, winner: 'Roll Over', time: new Date().toLocaleTimeString() },
          ...drawHistory
        ].slice(0, 15);
        saveHistory(newHistory);

        // If user placed bets, log a loss
        if (userTickets.length > 0) {
          const totalBet = userTickets.length * ticketAmount;
          const logData = {
            won: false,
            bet: totalBet,
            payout: 0,
            guessCount: userTickets.length,
            secretNumber: parseInt(winningCode, 10),
            matchedGuess: null,
            multiplier: '0.00',
            gameType: 'lottery',
          };
          addGameResult(logData);
          updateStats({
            won: false,
            bet: totalBet,
            payout: 0,
            gameType: 'lottery',
          });
        }
      }

      // Clear player tickets
      setMyTickets([]);

    }, 1500);

  }, [drawHistory, ticketAmount, addBalance]);

  // Global Time Clock effect & Bot Purchases
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const seconds = Math.floor(Date.now() / 1000);
      const remaining = 15 - (seconds % 15);
      setTimeLeft(remaining);

      // Trigger draw exactly on 15s boundary
      if (remaining === 15 && !isDrawing) {
        performDraw();
      }
    }, 200);

    return () => clearInterval(clockInterval);
  }, [isDrawing, performDraw]);

  // Bot bets activity simulation
  useEffect(() => {
    const botTimer = setInterval(() => {
      if (isDrawing) return;
      
      // 35% chance to buy a virtual ticket every tick
      if (Math.random() < 0.35) {
        const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        const ticketCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const botBet = 10; // fixed bot ticket price

        setProgressivePot(prev => prev + (botBet * 0.90));
        setRecentActivity(prev => [
          { player: botName, ticket: ticketCode, amount: botBet, time: Date.now() },
          ...prev
        ].slice(0, 20));
      }
    }, 2000);

    return () => clearInterval(botTimer);
  }, [isDrawing]);

  return {
    progressivePot,
    ticketAmount,
    setTicketAmount,
    myTickets,
    isDrawing,
    drawResult,
    timeLeft,
    drawHistory,
    recentActivity,
    error,
    wonPotAmount,
    lastDrawState,
    lastDrawHalf,
    buyTicket,
    buyTicketsBulk,
  };
}
