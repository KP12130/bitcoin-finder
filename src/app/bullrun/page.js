'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useBullRunEngine, MARKETS } from '@/hooks/useBullRunEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChartLine, FaDice, FaCoins, FaInfoCircle, FaPlay, FaStop, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

export default function BullRunPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hook state
  const game = useBullRunEngine(balance, subtractBalance, addBalance);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();

  // Local string input state
  const [betInput, setBetInput] = useState('');
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'auto'

  // Auto Pilot States
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [autoDirection, setAutoDirection] = useState('up'); // 'up' | 'down' | 'random'
  const [autoRounds, setAutoRounds] = useState('10');
  const [roundsRemaining, setRoundsRemaining] = useState(0);
  const [autoStats, setAutoStats] = useState({ roundsPlayed: 0, netProfit: 0 });

  const isAutoActiveRef = useRef(false);
  const autoCooldownRef = useRef(false);
  const roundsRemainingRef = useRef(0);
  const autoDirectionRef = useRef('up');

  // Keep refs in sync
  useEffect(() => { isAutoActiveRef.current = isAutoActive; }, [isAutoActive]);
  useEffect(() => { roundsRemainingRef.current = roundsRemaining; }, [roundsRemaining]);
  useEffect(() => { autoDirectionRef.current = autoDirection; }, [autoDirection]);

  // Sync bet inputs
  useEffect(() => {
    const activeWager = convertUsdToActive(game.betAmount);
    const parsedInput = parseShorthand(betInput);
    if (Math.abs(parsedInput - activeWager) > 0.00000001) {
      setBetInput(formatCryptoAmount(activeWager, currency));
    }
  }, [game.betAmount, currency]);

  // Canvas ref for chart drawing
  const canvasRef = useRef(null);

  // ─── Chart Drawing Logic ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 35, right: 70, bottom: 20, left: 15 };

    ctx.clearRect(0, 0, width, height);

    const data = game.chartData;
    if (data.length === 0) return;

    // Calculate Y limits
    const prices = data.map(d => d.price);
    if (game.gameState === 'running') {
      prices.push(game.entryPrice);
    }
    
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    const priceDiff = maxPrice - minPrice;
    
    if (priceDiff === 0) {
      minPrice *= 0.9995;
      maxPrice *= 1.0005;
    } else {
      minPrice -= priceDiff * 0.12;
      maxPrice += priceDiff * 0.12;
    }

    const getX = (index) => {
      const step = (width - padding.left - padding.right) / Math.max(1, data.length - 1);
      return padding.left + index * step;
    };

    const getY = (price) => {
      const usableHeight = height - padding.top - padding.bottom;
      return padding.top + usableHeight - ((price - minPrice) / (maxPrice - minPrice)) * usableHeight;
    };

    // 1. Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const gridLines = 5;
    for (let i = 0; i < gridLines; i++) {
      const y = padding.top + (i * (height - padding.top - padding.bottom)) / (gridLines - 1);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const labelPrice = maxPrice - (i * (maxPrice - minPrice)) / (gridLines - 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px Orbitron, sans-serif';
      ctx.fillText(labelPrice.toFixed(selectedDecimals(game.selectedMarket)), width - padding.right + 5, y + 3);
    }

    ctx.setLineDash([]);

    // 2. Draw Price Chart Line
    let isPositive = true;
    if (game.gameState === 'running') {
      const currentPriceVal = data[data.length - 1].price;
      isPositive = currentPriceVal >= game.entryPrice;
    } else {
      isPositive = game.priceDirection !== 'down';
    }

    const strokeColor = isPositive ? '#00ff88' : '#ff4757';

    // Area Gradient Fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, isPositive ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 71, 87, 0.12)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].price));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(data[i].price));
    }
    ctx.lineTo(getX(data.length - 1), height - padding.bottom);
    ctx.lineTo(getX(0), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Chart Line Stroke
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].price));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(data[i].price));
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Draw Entry Price Guideline
    if (game.gameState === 'running') {
      const entryY = getY(game.entryPrice);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Entry badge text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.roundRect(width - padding.right - 62, entryY - 9, 58, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.fillText('ENTRY LEVEL', width - padding.right - 56, entryY + 2);
    }

    // 4. Latest Price Dot
    const latestX = getX(data.length - 1);
    const latestY = getY(data[data.length - 1].price);

    ctx.beginPath();
    ctx.arc(latestX, latestY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = strokeColor;
    ctx.fill();

    const pulseRadius = 5 + (Date.now() % 1000) * 0.007;
    ctx.beginPath();
    ctx.arc(latestX, latestY, pulseRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = strokeColor + '66';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [game.chartData, game.gameState, game.entryPrice, game.selectedMarket, game.priceDirection]);

  const selectedDecimals = (mkt) => {
    if (mkt === 'BTC/USD') return 2;
    if (mkt === 'ETH/USD') return 2;
    if (mkt === 'SOL/USD') return 3;
    return 5;
  };

  // ─── Auto Play Loop Handlers ───────────────────────────────────────────────
  const handleAutoRoundEnd = useCallback((pnlEarned) => {
    setAutoStats(prev => ({
      roundsPlayed: prev.roundsPlayed + 1,
      netProfit: prev.netProfit + pnlEarned
    }));

    if (!isAutoActiveRef.current) return;

    let count = roundsRemainingRef.current;
    if (count > 1) {
      const nextCount = count - 1;
      setRoundsRemaining(nextCount);
      roundsRemainingRef.current = nextCount;
    } else if (count === 1) {
      setIsAutoActive(false);
      isAutoActiveRef.current = false;
      setRoundsRemaining(0);
      return;
    }

    autoCooldownRef.current = true;
    setTimeout(async () => {
      autoCooldownRef.current = false;
      if (!isAutoActiveRef.current) return;

      let dir = autoDirectionRef.current;
      if (dir === 'random') {
        dir = Math.random() < 0.5 ? 'up' : 'down';
      }

      const res = await game.startTrade(dir);
      if (res && res.error) {
        setIsAutoActive(false);
        isAutoActiveRef.current = false;
      }
    }, 1200); // 1.2s cooldown
  }, [game]);

  const prevGameStateRef = useRef('idle');
  useEffect(() => {
    const prev = prevGameStateRef.current;
    const curr = game.gameState;
    prevGameStateRef.current = curr;

    if (prev === 'running' && curr === 'result') {
      const wager = game.betAmount;
      const profit = game.payout - wager;
      if (isAutoActiveRef.current || autoCooldownRef.current) {
        handleAutoRoundEnd(profit);
      }
    }
  }, [game.gameState, game.payout, game.betAmount, handleAutoRoundEnd]);

  // ─── Inputs ────────────────────────────────────────────────────────────────
  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;

    setBetInput(cleanValue);

    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed)) {
      const usdBet = convertActiveToUsd(parsed);
      game.setBetAmount(usdBet);
    }
  }, [game, convertActiveToUsd]);

  const handleQuickBet = useCallback((action) => {
    switch (action) {
      case 'half':
        game.setBetAmount(Math.max(0.10, Math.round((game.betAmount / 2) * 100) / 100));
        break;
      case 'double':
        game.setBetAmount(Math.min(balance, Math.round(game.betAmount * 2 * 100) / 100));
        break;
      case 'min':
        game.setBetAmount(0.10);
        break;
      case 'max':
        game.setBetAmount(balance);
        break;
    }
  }, [game, balance]);

  const handleStartAuto = async () => {
    if (isAutoActive) {
      setIsAutoActive(false);
      isAutoActiveRef.current = false;
      return;
    }

    const val = parseInt(autoRounds, 10);
    const limit = isNaN(val) || val <= 0 ? 999999 : val;

    setRoundsRemaining(limit);
    roundsRemainingRef.current = limit;
    setIsAutoActive(true);
    isAutoActiveRef.current = true;

    let dir = autoDirection;
    if (dir === 'random') {
      dir = Math.random() < 0.5 ? 'up' : 'down';
    }

    const res = await game.startTrade(dir);
    if (res && res.error) {
      setIsAutoActive(false);
      isAutoActiveRef.current = false;
      setRoundsRemaining(0);
    }
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0.00';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: selectedDecimals(game.selectedMarket),
      maximumFractionDigits: selectedDecimals(game.selectedMarket),
    });
  };

  const handleBailout = useCallback(() => {
    claimBailout();
  }, [claimBailout]);

  const isRunning = game.gameState === 'running';
  const isResult = game.gameState === 'result';
  const canTrade = !isRunning && !isAutoActive && balance > 0 && game.betAmount > 0 && game.betAmount <= balance;

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.bullRunPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>📈 Bull Run</h1>
            <p className={styles.pageSubtitle}>
              Predict the price movement after 3 seconds. Win or lose proportionally to the percentage change!
            </p>
          </div>

          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && !isRunning && !isAutoActive && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 Out of balance! Claim a bailout to trade.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim {formatBTC(10)} Bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Layout */}
          <div className={styles.gameLayout}>
            {/* ─── Left Column: Controls ─────────────────────────────────── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                {/* Tabs */}
                <div className={styles.tabsHeader}>
                  <button
                    className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabActive : ''}`}
                    onClick={() => !isAutoActive && setActiveTab('manual')}
                    disabled={isAutoActive}
                  >
                    Manual
                  </button>
                  <button
                    className={`${styles.tabBtn} ${activeTab === 'auto' ? styles.tabActive : ''}`}
                    onClick={() => !isRunning && setActiveTab('auto')}
                    disabled={isRunning}
                  >
                    Auto Mode
                  </button>
                </div>

                {/* Market Selector */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaCoins className={styles.fieldIcon} />
                    Trading Asset
                  </label>
                  <select
                    className={styles.marketSelect}
                    value={game.selectedMarket}
                    onChange={(e) => game.changeMarket(e.target.value)}
                    disabled={isRunning || isAutoActive}
                  >
                    {Object.keys(MARKETS).map(mkt => (
                      <option key={mkt} value={mkt}>
                        {MARKETS[mkt].name} ({mkt})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bet Amount */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaDice className={styles.fieldIcon} />
                    Bet Amount
                  </label>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      className={styles.betInput}
                      value={betInput}
                      onChange={handleBetInput}
                      disabled={isRunning || isAutoActive}
                      placeholder="0.00"
                    />
                    <span className={styles.inputUnit}>{activeSymbol}</span>
                  </div>
                  <div className={styles.quickBets}>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('half')} disabled={isRunning || isAutoActive}>½</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('double')} disabled={isRunning || isAutoActive}>2×</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('min')} disabled={isRunning || isAutoActive}>Min</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('max')} disabled={isRunning || isAutoActive}>Max</button>
                  </div>
                </div>



                <div className={styles.divider} />

                {/* Non-blocking compact result display in Sidebar */}
                <AnimatePresence>
                  {isResult && (
                    <motion.div
                      className={styles.compactOutcomeBadge}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className={`${styles.compactResultHeader} ${game.won ? styles.pnlWin : styles.pnlLoss}`}>
                        {game.won ? '🏆 TRADE WON' : game.payoutMultiplier === 0 ? '💀 LIQUIDATED' : '💥 TRADE LOST'}
                      </div>
                      <div className={styles.compactResultMeta}>
                        Multiplier: <strong>{(game.payoutMultiplier ?? 1.0).toFixed(2)}x</strong> ({game.payout > 0 ? `+${formatBTC(game.payout)}` : `-${formatBTC(game.betAmount)}`})
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Manual Tab Actions */}
                {activeTab === 'manual' && (
                  <div className={styles.manualEntryGrid}>
                    <motion.button
                      className={styles.longBtn}
                      onClick={() => game.startTrade('up')}
                      disabled={!canTrade}
                      whileHover={canTrade ? { scale: 1.02 } : {}}
                      whileTap={canTrade ? { scale: 0.98 } : {}}
                    >
                      <FaArrowUp /> BULL / UP 📈
                    </motion.button>
                    <motion.button
                      className={styles.shortBtn}
                      onClick={() => game.startTrade('down')}
                      disabled={!canTrade}
                      whileHover={canTrade ? { scale: 1.02 } : {}}
                      whileTap={canTrade ? { scale: 0.98 } : {}}
                    >
                      <FaArrowDown /> BEAR / DOWN 📉
                    </motion.button>
                  </div>
                )}

                {/* Auto Tab Actions */}
                {activeTab === 'auto' && (
                  <div className={styles.autoSetupCard}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Auto Bet Direction</label>
                      <div className={styles.autoDirGrid}>
                        {['up', 'down', 'random'].map(dir => (
                          <button
                            key={dir}
                            className={`${styles.dirBtn} ${autoDirection === dir ? styles.dirBtnActive : ''}`}
                            onClick={() => setAutoDirection(dir)}
                            disabled={isAutoActive}
                          >
                            {dir === 'up' ? 'UP' : dir === 'down' ? 'DOWN' : 'RANDOM'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Rounds Limit (Empty = Infinite)</label>
                      <input
                        type="text"
                        className={styles.autoRoundsInput}
                        placeholder="e.g. 10"
                        value={autoRounds}
                        onChange={(e) => setAutoRounds(e.target.value.replace(/[^0-9]/g, ''))}
                        disabled={isAutoActive}
                      />
                    </div>

                    {isAutoActive && (
                      <div className={styles.autoStatusAlert}>
                        <span className={styles.autoStatusText}>
                          🤖 Auto Mode Active: {roundsRemaining === 999999 ? 'Infinite' : `${roundsRemaining} Left`}
                        </span>
                        <div className={styles.autoMiniStats}>
                          <span>Rounds Played: {autoStats.roundsPlayed}</span>
                          <span style={{ color: autoStats.netProfit >= 0 ? '#00ff88' : '#ff4757' }}>
                            Net: {autoStats.netProfit >= 0 ? '+' : ''}{formatBTC(autoStats.netProfit)}
                          </span>
                        </div>
                      </div>
                    )}

                    <motion.button
                      className={`${styles.autoPlayBtn} ${isAutoActive ? styles.autoPlayActive : ''}`}
                      onClick={handleStartAuto}
                      disabled={balance <= 0 && !isAutoActive}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isAutoActive ? <><FaStop /> STOP AUTO MODE</> : <><FaPlay /> START AUTO MODE</>}
                    </motion.button>
                  </div>
                )}

                {/* In game status overlay detail */}
                {isRunning && (
                  <div className={styles.runningDetailCard}>
                    <div className={styles.runningProgress}>
                      <div className={styles.progressBar} />
                    </div>
                    <div className={styles.runningInfo}>
                      <span>Direction: <strong>{game.prediction.toUpperCase()}</strong></span>
                      <span>Pending Payout: <strong style={{ color: game.payoutMultiplier >= 1.0 ? '#00ff88' : '#ff4757' }}>{(game.payoutMultiplier ?? 1.0).toFixed(2)}x</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right Column: Chart Panel ─────────────────────────────────── */}
            <div className={styles.displayPanel}>
              {/* Giant Live Ticker Header */}
              <div className={styles.tickerCard}>
                <div className={styles.marketLabelInfo}>
                  <span className={styles.mktBadge}>{game.selectedMarket}</span>
                  <span className={styles.mktName}>{MARKETS[game.selectedMarket].name} Live Price</span>
                </div>
                <div className={`${styles.giantPrice} ${
                  game.priceDirection === 'up' ? styles.priceUp :
                  game.priceDirection === 'down' ? styles.priceDown :
                  styles.priceFlat
                }`}>
                  {formatPrice(game.currentPrice)}
                  <span className={styles.priceArrow}>
                    {game.priceDirection === 'up' ? ' 📈' : game.priceDirection === 'down' ? ' 📉' : ''}
                  </span>
                </div>
              </div>

              {/* HTML Canvas Chart Board */}
              <div className={styles.chartWrapper}>
                <canvas ref={canvasRef} className={styles.priceCanvas} />

                {/* Non-blocking win/loss overlay */}
                <AnimatePresence>
                  {isResult && (
                    <motion.div
                      className={styles.nonBlockingResultOverlay}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className={styles.resultBannerCard}>
                        <div className={game.won ? styles.outcomeTitleWin : styles.outcomeTitleLoss}>
                          {game.won ? '🏆 TRADE WON' : game.payoutMultiplier === 0 ? '💀 LIQUIDATED' : '💥 TRADE LOST'}
                        </div>
                        <div className={styles.outcomeMeta}>
                          Entry: {formatPrice(game.entryPrice)} → Exit: {formatPrice(game.exitPrice)}
                        </div>
                        <div className={`${styles.outcomePayoutAmount} ${game.won ? styles.pnlWin : styles.pnlLoss}`}>
                          {(game.payoutMultiplier ?? 1.0).toFixed(2)}x ({game.payout > 0 ? `+${formatBTC(game.payout)}` : `-${formatBTC(game.betAmount)}`})
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Historical Wagers List */}
              {game.history.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyLabel}>Recent Trades</div>
                  <div className={styles.historyRows}>
                    {game.history.map((h, i) => (
                      <motion.div
                        key={i}
                        className={styles.historyRow}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span className={styles.hMarket}>{h.market}</span>
                        <span className={`${styles.hType} ${h.dir === 'up' ? styles.pnlWin : styles.pnlLoss}`}>
                          {h.dir.toUpperCase()}
                        </span>
                        <span className={styles.hDetails}>
                          {formatPrice(h.entry)} → {formatPrice(h.exit)}
                        </span>
                        <span className={`${styles.hPnl} ${h.won ? styles.pnlWin : styles.pnlLoss}`}>
                          {h.multiplier.toFixed(2)}x
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* How to Play Instruction Block */}
              <div className={styles.howToPlay}>
                <h3 className={styles.howTitle}>How to Play</h3>
                <div className={styles.steps}>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>1</span>
                    <p>Select your <strong>Trading Asset</strong> and set your <strong>Bet Amount</strong>.</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>2</span>
                    <p>Click <strong>BULL / UP 📈</strong> if you predict price will rise, or <strong>BEAR / DOWN 📉</strong> if you predict it will fall. Bets are immediate, no confirmation needed!</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>3</span>
                    <p>Watch the 3-second price ticking. The pending payout multiplier updates live based on the price change.</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>4</span>
                    <p>At the 3-second mark, get credited with the final scaled payout. Wins can go up to <strong>50.00x</strong> bet, while losses can lead to complete <strong>0.00x liquidation</strong>!</p>
                  </div>
                </div>
              </div>

              {/* Provably Fair verification */}
              <VerificationPanel gameType="bullrun" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
