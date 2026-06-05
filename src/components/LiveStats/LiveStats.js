'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { FaTimes, FaMinus, FaSync, FaChartLine, FaRegArrowAltCircleUp, FaRegArrowAltCircleDown } from 'react-icons/fa';
import { useCurrency } from '@/hooks/useCurrency';
import styles from './LiveStats.module.css';

const ROUTE_TO_GAME = {
  '/play': { id: 'mining', label: 'Mine ⛏️' },
  '/slots': { id: 'slot', label: 'Slots 🎰' },
  '/crash': { id: 'crash', label: 'Crash 🚀' },
  '/dice': { id: 'dice', label: 'Dice 🎲' },
  '/plinko': { id: 'plinko', label: 'Plinko 🟢' },
  '/mines': { id: 'mines', label: 'Mines 💣' },
  '/limbo': { id: 'limbo', label: 'Limbo 🎯' },
  '/tower': { id: 'tower', label: 'Tower 🏰' },
  '/hilo': { id: 'hilo', label: 'Hi-Lo 📈' },
  '/blackjack': { id: 'blackjack', label: 'Blackjack 🃏' },
  '/coinflip': { id: 'coinflip', label: 'Coin Flip 🪙' },
  '/cryptopop': { id: 'cryptopop', label: 'Token Pop 🪙' },
  '/chickenroad': { id: 'chickenroad', label: 'Chicken Road 🐓' },
  '/snakeroll': { id: 'snakeroll', label: 'Snake Roll 🐍' },
  '/videopoker': { id: 'videopoker', label: 'Video Poker 🃏' },
  '/keno': { id: 'keno', label: 'Keno 🎯' },
  '/roulette': { id: 'roulette', label: 'Roulette 🎡' },
  '/scratch': { id: 'scratch', label: 'Scratch 🎟️' },
  '/bullrun': { id: 'bullrun', label: 'Bull Run 📈' },
  '/baccarat': { id: 'baccarat', label: 'Baccarat 🃏' },
  '/lottery': { id: 'lottery', label: 'Lottery 🎟️' }
};

export default function LiveStats() {
  const { currency, prices } = useCurrency();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'graph'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'game'

  // Dragging controls and position motion values
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Raw session wagers list state
  const [sessionWagers, setSessionWagers] = useState([]);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Detect active game based on path
  const activeGame = useMemo(() => {
    return ROUTE_TO_GAME[pathname] || null;
  }, [pathname]);

  // Default to game filter when entering a game route
  useEffect(() => {
    if (activeGame) {
      setFilterMode('game');
    } else {
      setFilterMode('all');
    }
  }, [pathname, activeGame]);

  // Load configuration and saved stats on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOpen = localStorage.getItem('btcfinder_livestats_open') === 'true';
      const savedMin = localStorage.getItem('btcfinder_livestats_minimized') === 'true';
      setIsOpen(savedOpen);
      setIsMinimized(savedMin);

      const savedWagers = localStorage.getItem('btcfinder_session_wagers');
      if (savedWagers) {
        try {
          const parsed = JSON.parse(savedWagers);
          if (Array.isArray(parsed)) {
            setSessionWagers(parsed.map(w => ({
              gameType: String(w.gameType || 'all'),
              bet: Number(w.bet || 0),
              payout: Number(w.payout || 0),
              won: !!w.won,
              timestamp: Number(w.timestamp || Date.now())
            })));
          }
        } catch (e) {
          console.error('Failed to parse saved session wagers:', e);
        }
      } else {
        // Migration fallback: if they have old stats structure but no wagers array
        const savedData = localStorage.getItem('btcfinder_live_stats');
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed && Number(parsed.bets || 0) > 0) {
              const initialWager = {
                gameType: 'all',
                bet: Number(parsed.wagered || 0),
                payout: Number(parsed.wagered || 0) + Number(parsed.profit || 0),
                won: Number(parsed.profit || 0) >= 0,
                timestamp: Date.now()
              };
              setSessionWagers([initialWager]);
              localStorage.setItem('btcfinder_session_wagers', JSON.stringify([initialWager]));
            }
          } catch (e) {
            console.error('Failed to migrate old stats format:', e);
          }
        }
      }

      const savedPos = localStorage.getItem('btcfinder_livestats_position');
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          let posX = Number(parsed.x || 0);
          let posY = Number(parsed.y || 0);

          // Viewport safety clamp: ensure the widget is visible on screen
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;

          const baseLeft = 32;   // 2rem
          const baseBottom = 32; // 2rem
          const widgetWidth = 320;
          const widgetHeight = 350;

          const currentLeft = baseLeft + posX;
          const currentTop = screenH - baseBottom - widgetHeight + posY;

          if (currentLeft + 100 > screenW) {
            posX = screenW - baseLeft - 100;
          }
          if (currentLeft < -100) {
            posX = -baseLeft - 100;
          }
          if (currentTop + 50 > screenH) {
            posY = screenH - (screenH - baseBottom - widgetHeight) - 50;
          }
          if (currentTop < 0) {
            posY = -(screenH - baseBottom - widgetHeight);
          }

          x.set(posX);
          y.set(posY);
        } catch (e) {
          console.error('Failed to parse saved position:', e);
        }
      }

      // Sync toggle state events from Navbar
      const handleToggle = (e) => {
        setIsOpen(e.detail);
      };
      window.addEventListener('livestats-toggle-state', handleToggle);
      return () => window.removeEventListener('livestats-toggle-state', handleToggle);
    }
  }, [x, y]);

  // Format currency dynamically based on active rates
  const formatValue = useCallback((amount) => {
    const price = prices[currency] || 1.0;
    const converted = amount / price;
    const dec = { USD: 2, BTC: 8, ETH: 6, SOL: 4, DOGE: 2 }[currency] ?? 2;
    const sym = { USD: '$', BTC: '₿', ETH: '♦', SOL: '◎', DOGE: 'Ð' }[currency] ?? '$';

    const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
    const absVal = Math.abs(converted);
    const formatted = absVal.toLocaleString(undefined, {
      minimumFractionDigits: Math.min(2, dec),
      maximumFractionDigits: dec
    });
    return `${sign}${sym}${formatted}`;
  }, [currency, prices]);

  // Calculate current stats on-the-fly depending on selected game filters
  const selectedGameType = filterMode === 'all' ? 'all' : (activeGame?.id || 'all');

  const currentStats = useMemo(() => {
    const wagers = sessionWagers.filter(w => selectedGameType === 'all' || w.gameType === selectedGameType);
    let profit = 0;
    let wagered = 0;
    let bets = wagers.length;
    let wins = 0;
    let losses = 0;
    let history = [0];

    wagers.forEach(w => {
      const net = w.payout - w.bet;
      profit += net;
      wagered += w.bet;
      if (w.won) wins++;
      else losses++;
      history.push(Number(profit.toFixed(4)));
    });

    return {
      profit: Number(profit.toFixed(4)),
      wagered: Number(wagered.toFixed(4)),
      bets,
      wins,
      losses,
      history
    };
  }, [sessionWagers, selectedGameType]);

  // Handle incoming wagers from player using central addGameResult events
  useEffect(() => {
    const handleNewBet = (e) => {
      const bet = e.detail; // gameResult object from storage.js
      if (!bet) return;

      setSessionWagers((prev) => {
        const betAmt = Number(bet.bet ?? 0);
        const payoutAmt = Number(bet.payout ?? 0);
        const wonVal = !!bet.won;
        const gameTypeVal = String(bet.gameType ?? 'all');

        const newWager = {
          gameType: gameTypeVal,
          bet: betAmt,
          payout: payoutAmt,
          won: wonVal,
          timestamp: Date.now()
        };

        const updated = [...prev, newWager].slice(-500); // keep last 500 wagers
        localStorage.setItem('btcfinder_session_wagers', JSON.stringify(updated));

        // Sync old live stats key for legacy compatibility
        let currentProfit = 0;
        let currentWagered = 0;
        let currentBets = updated.length;
        let currentWins = 0;
        let currentLosses = 0;
        let currentHistory = [0];

        updated.forEach(w => {
          const net = w.payout - w.bet;
          currentProfit += net;
          currentWagered += w.bet;
          if (w.won) currentWins++;
          else currentLosses++;
          currentHistory.push(Number(currentProfit.toFixed(4)));
        });

        localStorage.setItem('btcfinder_live_stats', JSON.stringify({
          profit: Number(currentProfit.toFixed(4)),
          wagered: Number(currentWagered.toFixed(4)),
          bets: currentBets,
          wins: currentWins,
          losses: currentLosses,
          history: currentHistory.slice(-100)
        }));

        return updated;
      });
    };

    window.addEventListener('new-game-result', handleNewBet);
    return () => window.removeEventListener('new-game-result', handleNewBet);
  }, []);

  // Draw chart inside canvas
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || activeTab !== 'graph') return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 125;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const history = currentStats.history;
    if (history.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting wagers to draw chart...', width / 2, height / 2);
      return;
    }

    const padding = { top: 12, right: 12, bottom: 18, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const profits = history;
    const minP = Math.min(0, ...profits);
    const maxP = Math.max(0, ...profits);
    const range = maxP - minP || 1;

    const xStep = chartW / (history.length - 1);
    const toX = (i) => padding.left + i * xStep;
    const toY = (v) => padding.top + chartH - ((v - minP) / range) * chartH;

    // Zero line
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-Axis Min / Zero / Max labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatValue(maxP), padding.left - 6, padding.top + 4);
    ctx.fillText('0.00', padding.left - 6, zeroY + 3);
    ctx.fillText(formatValue(minP), padding.left - 6, padding.top + chartH + 4);

    const points = history.map((val, i) => ({ x: toX(i), y: toY(val) }));

    // Green above zero gradient fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, zeroY - padding.top);
    ctx.clip();
    const gradUp = ctx.createLinearGradient(0, padding.top, 0, zeroY);
    gradUp.addColorStop(0, 'rgba(0, 255, 136, 0.12)');
    gradUp.addColorStop(1, 'rgba(0, 255, 136, 0.01)');
    ctx.fillStyle = gradUp;
    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Red below zero gradient fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, zeroY, chartW, chartH - (zeroY - padding.top));
    ctx.clip();
    const gradDown = ctx.createLinearGradient(0, zeroY, 0, padding.top + chartH);
    gradDown.addColorStop(0, 'rgba(255, 71, 87, 0.01)');
    gradDown.addColorStop(1, 'rgba(255, 71, 87, 0.12)');
    ctx.fillStyle = gradDown;
    ctx.beginPath();
    ctx.moveTo(points[0].x, zeroY);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Line segments
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < points.length - 1; i++) {
      const avg = (history[i] + history[i + 1]) / 2;
      ctx.strokeStyle = avg >= 0 ? '#00ff88' : '#ff4757';
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }

    // Final glow dot
    const last = points[points.length - 1];
    const lastProfit = history[history.length - 1];
    const dotColor = lastProfit >= 0 ? '#00ff88' : '#ff4757';
    
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = dotColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [currentStats.history, formatValue, activeTab]);

  // Re-draw when tab becomes graph or stats updates
  useEffect(() => {
    if (activeTab === 'graph') {
      const timer = setTimeout(drawChart, 20);
      window.addEventListener('resize', drawChart);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', drawChart);
      };
    }
  }, [activeTab, drawChart]);

  const handleMinimizeToggle = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    localStorage.setItem('btcfinder_livestats_minimized', String(next));
  };

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('btcfinder_livestats_open', 'false');
    window.dispatchEvent(new CustomEvent('livestats-toggle-state', { detail: false }));
  };

  const handleReset = () => {
    setSessionWagers([]);
    localStorage.removeItem('btcfinder_session_wagers');
    localStorage.removeItem('btcfinder_live_stats');
    if (activeTab === 'graph') {
      setTimeout(drawChart, 20);
    }
  };

  // Dragging event handlers
  const handleDragEnd = () => {
    const currentX = x.get();
    const currentY = y.get();
    localStorage.setItem('btcfinder_livestats_position', JSON.stringify({ x: currentX, y: currentY }));
  };

  const handleResetPosition = () => {
    x.set(0);
    y.set(0);
    localStorage.setItem('btcfinder_livestats_position', JSON.stringify({ x: 0, y: 0 }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.statsWrapper}>
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized Bubble floating node */
          <motion.div
            key="bubble"
            drag
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            className={styles.bubble}
            style={{ x, y }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleMinimizeToggle}
            onDoubleClick={handleResetPosition}
            title="Drag to move | Click to expand | Double-click to reset"
          >
            <FaChartLine className={styles.bubbleIcon} />
            {currentStats.bets > 0 && (
              <span className={`${styles.bubbleIndicator} ${currentStats.profit >= 0 ? styles.indicatorWin : styles.indicatorLoss}`} />
            )}
          </motion.div>
        ) : (
          /* Full expanded live stats card overlay */
          <motion.div
            key="card"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            className={styles.card}
            style={{ x, y }}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header / Grab Handle */}
            <div
              className={styles.header}
              onPointerDown={(e) => dragControls.start(e)}
              onDoubleClick={handleResetPosition}
              title="Drag header to move | Double-click to reset position"
            >
              <div className={styles.headerTitle}>
                <FaChartLine className={styles.chartIcon} />
                <span>Live Stats</span>
              </div>
              <div className={styles.actions} onPointerDown={(e) => e.stopPropagation()}>
                <button className={styles.actionBtn} onClick={handleMinimizeToggle} title="Minimize Window">
                  <FaMinus />
                </button>
                <button className={styles.actionBtn} onClick={handleClose} title="Close Stats">
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'stats' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                Stats Panel
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'graph' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('graph')}
              >
                Graph Trend
              </button>
            </div>

            {/* Game Filter pill switcher bar */}
            {activeGame && (
              <div className={styles.filterBar}>
                <button
                  className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilterMode('all')}
                >
                  All Session
                </button>
                <button
                  className={`${styles.filterBtn} ${filterMode === 'game' ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilterMode('game')}
                >
                  {activeGame.label}
                </button>
              </div>
            )}

            {/* Card Body content */}
            <div className={styles.body}>
              {activeTab === 'stats' ? (
                /* Stats grid layout */
                <div className={styles.statsGrid}>
                  {/* Profit block */}
                  <div className={`${styles.statCard} ${styles.fullWidth}`}>
                    <span className={styles.label}>
                      {filterMode === 'all' ? 'Session' : activeGame?.label.split(' ')[0]} Profit / Loss
                    </span>
                    <div className={`${styles.value} ${currentStats.profit > 0 ? styles.win : currentStats.profit < 0 ? styles.loss : ''}`}>
                      {formatValue(currentStats.profit)}
                    </div>
                  </div>

                  {/* Wagered block */}
                  <div className={styles.statCard}>
                    <span className={styles.label}>Total Wagered</span>
                    <div className={styles.valueSmall}>{formatValue(currentStats.wagered)}</div>
                  </div>

                  {/* Bets count block */}
                  <div className={styles.statCard}>
                    <span className={styles.label}>Bets Placed</span>
                    <div className={styles.valueSmall}>{currentStats.bets}</div>
                  </div>

                  {/* Wins block */}
                  <div className={`${styles.statCard} ${styles.winTextCard}`}>
                    <span className={styles.label}>Wins</span>
                    <div className={styles.row}>
                      <FaRegArrowAltCircleUp className={styles.trendUp} />
                      <span className={styles.valueSmall}>{currentStats.wins}</span>
                    </div>
                  </div>

                  {/* Losses block */}
                  <div className={`${styles.statCard} ${styles.lossTextCard}`}>
                    <span className={styles.label}>Losses</span>
                    <div className={styles.row}>
                      <FaRegArrowAltCircleDown className={styles.trendDown} />
                      <span className={styles.valueSmall}>{currentStats.losses}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Graph canvas display container */
                <div className={styles.graphContainer} ref={containerRef}>
                  <canvas ref={canvasRef} className={styles.canvas} />
                </div>
              )}
            </div>

            {/* Footer controls */}
            <div className={styles.footer}>
              <button className={styles.resetBtn} onClick={handleReset}>
                <FaSync className={styles.resetIcon} />
                Reset Session Stats
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
