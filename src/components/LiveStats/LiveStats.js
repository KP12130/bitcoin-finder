'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMinus, FaExpandAlt, FaSync, FaChartLine, FaTrophy, FaRegArrowAltCircleUp, FaRegArrowAltCircleDown } from 'react-icons/fa';
import { useCurrency } from '@/hooks/useCurrency';
import styles from './LiveStats.module.css';

export default function LiveStats() {
  const { currency, prices } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'graph'

  // Session stats state
  const [sessionStats, setSessionStats] = useState({
    profit: 0,
    wagered: 0,
    bets: 0,
    wins: 0,
    losses: 0,
    history: [0]
  });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load configuration and saved stats on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOpen = localStorage.getItem('btcfinder_livestats_open') === 'true';
      const savedMin = localStorage.getItem('btcfinder_livestats_minimized') === 'true';
      setIsOpen(savedOpen);
      setIsMinimized(savedMin);

      const savedData = localStorage.getItem('btcfinder_live_stats');
      if (savedData) {
        try {
          setSessionStats(JSON.parse(savedData));
        } catch (e) {
          console.error('Failed to parse saved live stats:', e);
        }
      }

      // Sync toggle state events from Navbar
      const handleToggle = (e) => {
        setIsOpen(e.detail);
      };
      window.addEventListener('livestats-toggle-state', handleToggle);
      return () => window.removeEventListener('livestats-toggle-state', handleToggle);
    }
  }, []);

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

  // Handle incoming wagers from player
  useEffect(() => {
    const handleNewBet = (e) => {
      const bet = e.detail;
      if (!bet.isPlayer) return; // Only track player wagers

      setSessionStats((prev) => {
        const netProfit = bet.payout - bet.bet;
        const newProfit = Number((prev.profit + netProfit).toFixed(4));
        const newWagered = Number((prev.wagered + bet.bet).toFixed(4));
        const newHistory = [...prev.history, newProfit].slice(-100);

        const updated = {
          profit: newProfit,
          wagered: newWagered,
          bets: prev.bets + 1,
          wins: prev.wins + (bet.won ? 1 : 0),
          losses: prev.losses + (bet.won ? 0 : 1),
          history: newHistory
        };

        localStorage.setItem('btcfinder_live_stats', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('new-bet-slip', handleNewBet);
    return () => window.removeEventListener('new-bet-slip', handleNewBet);
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

    const history = sessionStats.history;
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
  }, [sessionStats.history, formatValue, activeTab]);

  // Re-draw when tab becomes graph or stats updates
  useEffect(() => {
    if (activeTab === 'graph') {
      // Small timeout to let DOM render ref container
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
    const freshStats = {
      profit: 0,
      wagered: 0,
      bets: 0,
      wins: 0,
      losses: 0,
      history: [0]
    };
    setSessionStats(freshStats);
    localStorage.setItem('btcfinder_live_stats', JSON.stringify(freshStats));
    if (activeTab === 'graph') {
      setTimeout(drawChart, 20);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.statsWrapper}>
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized Bubble floating node */
          <motion.button
            key="bubble"
            className={styles.bubble}
            onClick={handleMinimizeToggle}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Expand Session Stats"
          >
            <FaChartLine className={styles.bubbleIcon} />
            {sessionStats.bets > 0 && (
              <span className={`${styles.bubbleIndicator} ${sessionStats.profit >= 0 ? styles.indicatorWin : styles.indicatorLoss}`} />
            )}
          </motion.button>
        ) : (
          /* Full expanded live stats card overlay */
          <motion.div
            key="card"
            className={styles.card}
            initial={{ y: 50, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 50, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <FaChartLine className={styles.chartIcon} />
                <span>Live Stats</span>
              </div>
              <div className={styles.actions}>
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

            {/* Card Body content */}
            <div className={styles.body}>
              {activeTab === 'stats' ? (
                /* Stats grid layout */
                <div className={styles.statsGrid}>
                  {/* Profit block */}
                  <div className={`${styles.statCard} ${styles.fullWidth}`}>
                    <span className={styles.label}>Session Profit / Loss</span>
                    <div className={`${styles.value} ${sessionStats.profit > 0 ? styles.win : sessionStats.profit < 0 ? styles.loss : ''}`}>
                      {formatValue(sessionStats.profit)}
                    </div>
                  </div>

                  {/* Wagered block */}
                  <div className={styles.statCard}>
                    <span className={styles.label}>Total Wagered</span>
                    <div className={styles.valueSmall}>{formatValue(sessionStats.wagered)}</div>
                  </div>

                  {/* Bets count block */}
                  <div className={styles.statCard}>
                    <span className={styles.label}>Bets Placed</span>
                    <div className={styles.valueSmall}>{sessionStats.bets}</div>
                  </div>

                  {/* Wins block */}
                  <div className={`${styles.statCard} ${styles.winTextCard}`}>
                    <span className={styles.label}>Wins</span>
                    <div className={styles.row}>
                      <FaRegArrowAltCircleUp className={styles.trendUp} />
                      <span className={styles.valueSmall}>{sessionStats.wins}</span>
                    </div>
                  </div>

                  {/* Losses block */}
                  <div className={`${styles.statCard} ${styles.lossTextCard}`}>
                    <span className={styles.label}>Losses</span>
                    <div className={styles.row}>
                      <FaRegArrowAltCircleDown className={styles.trendDown} />
                      <span className={styles.valueSmall}>{sessionStats.losses}</span>
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
