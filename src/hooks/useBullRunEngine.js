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
} from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';

// Market Base Configurations
export const MARKETS = {
  'BTC/USD': { basePrice: 65000, volatility: 0.0020, name: 'Bitcoin' },
  'ETH/USD': { basePrice: 3500, volatility: 0.0030, name: 'Ethereum' },
  'SOL/USD': { basePrice: 150, volatility: 0.0055, name: 'Solana' },
  'DOGE/USD': { basePrice: 0.15, volatility: 0.0100, name: 'Dogecoin' }
};

// Seedable LCG PRNG helper
class LCG {
  constructor(seed) {
    this.seed = seed % 2147483648;
  }
  next() {
    this.seed = (1103515245 * this.seed + 12345) % 2147483648;
    return this.seed / 2147483648;
  }
}

export function useBullRunEngine(balance, subtractBalance, addBalance) {
  // ─── States ────────────────────────────────────────────────────────────────
  const [betAmount, setBetAmount] = useState(10);
  const [selectedMarket, setSelectedMarket] = useState('BTC/USD');
  const [scaleFactor, setScaleFactor] = useState(8); // Fixed scale factor (RTP ~95%)
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'running' | 'result'
  const [prediction, setPrediction] = useState(null); // 'up' | 'down' | null
  
  // Trade Metrics
  const [entryPrice, setEntryPrice] = useState(0);
  const [exitPrice, setExitPrice] = useState(0);
  const [won, setWon] = useState(false);
  const [payout, setPayout] = useState(0);
  const [payoutMultiplier, setPayoutMultiplier] = useState(1.0);
  const [currentPrice, setCurrentPrice] = useState(MARKETS['BTC/USD'].basePrice);
  
  // History & Chart
  const [chartData, setChartData] = useState([]);
  const [history, setHistory] = useState([]); // past positions
  const [priceDirection, setPriceDirection] = useState('flat'); // 'up' | 'down' | 'flat'

  // Refs for Ticker and Trading Logic
  const tickIntervalRef = useRef(null);
  const chartDataRef = useRef([]);
  const lcgRef = useRef(null);
  const currentPriceRef = useRef(MARKETS['BTC/USD'].basePrice);
  const driftRef = useRef(0);

  // Sync refs to avoid interval closure capture issues
  const stateRef = useRef({
    betAmount: 10,
    scaleFactor: 25,
    prediction: null,
    entryPrice: 0
  });

  useEffect(() => {
    stateRef.current = {
      betAmount,
      scaleFactor,
      prediction,
      entryPrice
    };
  }, [betAmount, scaleFactor, prediction, entryPrice]);
  
  // Provably Fair round details
  const activeRoundRef = useRef({
    serverSeed: '',
    clientSeed: '',
    nonce: 0,
    hash: ''
  });

  // ─── Chart History Generation ──────────────────────────────────────────────
  const generateInitialData = useCallback((market) => {
    const cfg = MARKETS[market];
    let price = cfg.basePrice;
    let data = [];
    
    for (let i = 0; i < 40; i++) {
      const variance = (Math.random() - 0.5) * 2 * cfg.volatility;
      price = price * (1 + variance);
      data.push({ time: i, price });
    }
    
    chartDataRef.current = data;
    setChartData(data);
    currentPriceRef.current = price;
    setCurrentPrice(price);
    setPriceDirection('flat');
  }, []);

  // Initialize on mount
  useEffect(() => {
    generateInitialData('BTC/USD');
  }, [generateInitialData]);

  // Market Switch Handler
  const changeMarket = useCallback((market) => {
    if (gameState !== 'idle' && gameState !== 'result') return;
    setSelectedMarket(market);
    generateInitialData(market);
  }, [gameState, generateInitialData]);

  // Slow Background Price Tick (Idle)
  useEffect(() => {
    const idleTicker = setInterval(() => {
      if (gameState !== 'idle' && gameState !== 'result') return;

      const cfg = MARKETS[selectedMarket];
      const current = currentPriceRef.current;
      const variance = (Math.random() - 0.5) * 2 * cfg.volatility;
      const nextPrice = current * (1 + variance);

      setPriceDirection(nextPrice > current ? 'up' : nextPrice < current ? 'down' : 'flat');
      currentPriceRef.current = nextPrice;
      setCurrentPrice(nextPrice);

      const prevData = chartDataRef.current;
      const nextTick = { time: prevData.length ? prevData[prevData.length - 1].time + 1 : 0, price: nextPrice };
      const updatedData = [...prevData, nextTick].slice(-40);
      chartDataRef.current = updatedData;
      setChartData(updatedData);
    }, 2000);

    return () => clearInterval(idleTicker);
  }, [selectedMarket, gameState]);

  // Helper to compute live multiplier based on current and entry price
  const calculateMultiplier = (currentVal, entryVal, dir, scale) => {
    if (!entryVal || isNaN(entryVal) || isNaN(currentVal)) return 1.0;
    const changePct = (currentVal - entryVal) / entryVal;
    const rawOutcome = dir === 'up' ? (changePct * scale) : (-changePct * scale);
    
    // Apply a 5% house edge on the final payout multiplier
    let mult = (1 + rawOutcome) * 0.95;
    
    // Clamp payout multiplier between 0x (liquidated) and 50x
    return Math.max(0.00, Math.min(50.00, isNaN(mult) ? 0.00 : mult));
  };

  // ─── Start 3-Second Binary Trade ───────────────────────────────────────────
  const startTrade = useCallback(async (dir) => {
    // Allow starting bets from idle OR result phase
    if (gameState === 'running') return { error: 'Game already active' };
    
    const wager = Math.round(Number(betAmount) * 100) / 100;
    if (isNaN(wager) || wager < GAME_CONFIG.MIN_BET || wager > GAME_CONFIG.MAX_BET) {
      return { error: `Bet must be between $0.10 and $1,000,000` };
    }
    if (wager > balance) {
      return { error: 'Insufficient balance' };
    }

    // Reset previous outcomes if starting a new bet directly from result state
    if (gameState === 'result') {
      setWon(false);
      setPayout(0);
      setPayoutMultiplier(1.0);
      setEntryPrice(0);
      setExitPrice(0);
    }

    // Provably fair seed fetch
    incrementNonce('bullrun');
    const sSeed = getActiveServerSeed('bullrun');
    const cSeed = getClientSeed();
    const nonceVal = getNonce('bullrun');
    const comboStr = `${sSeed}-${cSeed}-${nonceVal}`;
    const hash = await calculateSha256(comboStr);

    activeRoundRef.current = {
      serverSeed: sSeed,
      clientSeed: cSeed,
      nonce: nonceVal,
      hash
    };

    // Initialize deterministic PRNG
    const numericSeed = parseInt(hash.substring(0, 8), 16);
    lcgRef.current = new LCG(numericSeed);

    // Deduct wager
    try {
      await subtractBalance(wager);
    } catch (e) {
      return { error: 'Insufficient balance' };
    }

    const startPrice = currentPriceRef.current;
    setEntryPrice(startPrice);
    setPrediction(dir);
    setWon(false);
    setPayout(0);
    setPayoutMultiplier(1.0);
    setGameState('running');
    playSound('slide');

    // Run 10 ticks in 3 seconds (one tick every 300ms)
    let tickCount = 0;
    const maxTicks = 10;
    const config = MARKETS[selectedMarket];
    
    // Scale volatility by 4.5x during active rounds for small, realistic casino ticks
    const activeVolatility = config.volatility * 4.5;
    
    // Set a small random drift trend for this round based on seeds
    const lcgVal = lcgRef.current.next();
    const roundDrift = (lcgVal - 0.5) * 0.25 * activeVolatility; 
    driftRef.current = roundDrift;

    tickIntervalRef.current = setInterval(() => {
      tickCount += 1;
      
      const current = currentPriceRef.current;
      const rand = lcgRef.current.next();
      const variance = (rand - 0.5) * 2 * activeVolatility;
      const nextPrice = current * (1 + variance + driftRef.current);
      
      setPriceDirection(nextPrice > current ? 'up' : nextPrice < current ? 'down' : 'flat');
      currentPriceRef.current = nextPrice;
      setCurrentPrice(nextPrice);

      // Update Chart points
      const prevData = chartDataRef.current;
      const nextTick = { time: prevData.length ? prevData[prevData.length - 1].time + 1 : 0, price: nextPrice };
      const updatedData = [...prevData, nextTick].slice(-40);
      chartDataRef.current = updatedData;
      setChartData(updatedData);

      // Compute and update live payout multiplier indicator
      const activeState = stateRef.current;
      const currentMult = calculateMultiplier(nextPrice, startPrice, dir, activeState.scaleFactor);
      setPayoutMultiplier(currentMult);

      playSound('tick');

      // End of round (3 seconds / 10 ticks)
      if (tickCount >= maxTicks) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
        
        // Finalize exit stats
        setExitPrice(nextPrice);
        
        const finalMult = calculateMultiplier(nextPrice, startPrice, dir, activeState.scaleFactor);
        const payoutAmt = Math.round(wager * finalMult * 100) / 100;
        const didWin = payoutAmt > wager;
        
        setWon(didWin);
        setPayout(payoutAmt);
        setPayoutMultiplier(finalMult);
        setGameState('result');

        if (payoutAmt > 0) {
          addBalance(payoutAmt);
        }

        if (didWin) {
          playSound('win');
        } else {
          playSound(payoutAmt === 0 ? 'explosion' : 'loss'); // plays explosion sound on 0x liquidation
        }

        // Register results in DB & stats
        const gameResult = {
          won: didWin,
          bet: wager,
          guessCount: 1,
          payout: payoutAmt,
          secretNumber: nextPrice,
          matchedGuess: startPrice,
          multiplier: finalMult.toFixed(2),
          gameType: 'bullrun',
        };
        addGameResult(gameResult);
        updateStats(gameResult);

        // Update local lobby list
        setHistory(prev => [
          {
            market: selectedMarket,
            dir: dir,
            entry: startPrice,
            exit: nextPrice,
            payout: payoutAmt,
            multiplier: finalMult,
            won: didWin
          },
          ...prev
        ].slice(0, 15));

        // Save provably fair previous round ledger
        const round = activeRoundRef.current;
        savePreviousRoundInfo(
          'bullrun',
          round.serverSeed,
          round.clientSeed,
          round.nonce,
          round.hash,
          `Direction: ${dir.toUpperCase()} | Entry: ${startPrice.toFixed(4)} | Exit: ${nextPrice.toFixed(4)} | Mult: ${finalMult.toFixed(2)}x | Status: ${payoutAmt > 0 ? 'PAID' : 'LIQUIDATED'}`
        );
      }
    }, 300);

    return { success: true };
  }, [gameState, betAmount, balance, selectedMarket, subtractBalance, addBalance]);

  // Reset page helper
  const reset = useCallback(() => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    setGameState('idle');
    setPrediction(null);
    setEntryPrice(0);
    setExitPrice(0);
    setWon(false);
    setPayout(0);
    setPayoutMultiplier(1.0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, []);

  return {
    betAmount,
    setBetAmount,
    selectedMarket,
    changeMarket,
    scaleFactor,
    setScaleFactor,
    gameState,
    prediction,
    entryPrice,
    exitPrice,
    won,
    payout,
    payoutMultiplier,
    currentPrice,
    chartData,
    history,
    priceDirection,

    // Actions
    startTrade,
    reset
  };
}
