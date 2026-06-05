'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import PlinkoBoard from '@/components/PlinkoBoard/PlinkoBoard';
import { useBalance } from '@/hooks/useBalance';
import { usePlinkoEngine } from '@/hooks/usePlinkoEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { formatBTC, parseShorthand } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import styles from './page.module.css';

export default function PlinkoPage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();

  const [history, setHistory] = useState([]);
  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionWon, setSessionWon] = useState(0);
  const [ballsDropped, setBallsDropped] = useState(0);
  const [maxMultiplier, setMaxMultiplier] = useState(0);
  const [dropTrigger, setDropTrigger] = useState(null);
  const [error, setError] = useState('');

  // Callback whenever a ball completes its trajectory and lands in a bucket
  const handleBallFinished = useCallback(
    ({ payout, multiplier, bucketIndex }) => {
      // Append outcome to historical list
      setHistory((prev) => [{ id: Math.random().toString(36).slice(2, 7), multiplier }, ...prev].slice(0, 15));

      // Calculate stats
      setSessionWon((prev) => prev + payout);
      setMaxMultiplier((prev) => Math.max(prev, multiplier));

      // Run achievements check
      checkAchievements();
    },
    [checkAchievements]
  );

  const engine = usePlinkoEngine(balance, subtractBalance, addBalance, handleBallFinished);

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(engine.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [engine.betAmount, currency]);

  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;
    
    setBetInput(cleanValue);
    
    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed)) {
      const usdBet = convertActiveToUsd(parsed);
      engine.setBetAmount(usdBet);
    }
  }, [engine, convertActiveToUsd]);

  const triggerDrop = useCallback(async () => {
    setError('');
    const result = await engine.dropBall();

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      // Trigger canvas physics initialization
      setDropTrigger({
        ballId: result.ballId,
        path: result.path,
        resolvePayout: result.resolvePayout,
        payout: result.payout,
        multiplier: result.multiplier,
        rows: engine.rows,
        risk: engine.risk,
        timestamp: Date.now(),
      });

      // Update local drop statistics
      setSessionWagered((prev) => prev + engine.betAmount);
      setBallsDropped((prev) => prev + 1);
    }
  }, [engine]);

  // Beta shortcuts: Max, Min, Half, Double
  const handleHalfBet = useCallback(() => {
    engine.setBetAmount((prev) => Math.max(10, Math.floor(prev / 2)));
  }, [engine]);

  const handleDoubleBet = useCallback(() => {
    engine.setBetAmount((prev) => Math.min(balance, prev * 2));
  }, [engine]);

  const handleMaxBet = useCallback(() => {
    engine.setBetAmount(Math.min(100000000, balance));
  }, [balance, engine]);

  const handleMinBet = useCallback(() => {
    engine.setBetAmount(10);
  }, [engine]);

  const multipliers = engine.getMultipliers();

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">

          {/* Grid Layout */}
          <div className={styles.grid}>

            {/* Left Column: Interactive Controls */}
            <div className={styles.controlsPanel}>
              <h1 className={styles.title}>Plinko 🟢</h1>
              <p className={styles.subtitle}>Drop balls down the provably-fair Galton pyramid!</p>

              {/* Bet Controls */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount</div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={betInput}
                    onChange={handleBetInput}
                    disabled={engine.activeBalls > 30}
                  />
                  <div className={styles.quickBetGrid}>
                    <button className={styles.quickBetBtn} onClick={handleHalfBet}>½</button>
                    <button className={styles.quickBetBtn} onClick={handleDoubleBet}>2x</button>
                    <button className={styles.quickBetBtn} onClick={handleMinBet}>Min</button>
                    <button className={styles.quickBetBtn} onClick={handleMaxBet}>Max</button>
                  </div>
                </div>
              </div>

              {/* Risk Level */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Risk Level</div>
                <div className={styles.riskGrid}>
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      className={`${styles.riskBtn} ${styles[`risk_${level}`]} ${engine.risk === level ? styles.riskBtnActive : ''}`}
                      onClick={() => engine.setRisk(level)}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows Select */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Rows count</div>
                <div className={styles.rowsGrid}>
                  {[8, 12, 16].map((num) => (
                    <button
                      key={num}
                      className={`${styles.rowsBtn} ${engine.rows === num ? styles.rowsBtnActive : ''}`}
                      onClick={() => engine.setRows(num)}
                    >
                      {num} Rows
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Bet Trigger */}
              <motion.button
                className={styles.betBtn}
                onClick={triggerDrop}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                animate={engine.activeBalls > 0 ? { boxShadow: ['0 0 10px rgba(247,147,26,0.2)', '0 0 25px rgba(247,147,26,0.5)', '0 0 10px rgba(247,147,26,0.2)'] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🟢 Drop Ball
              </motion.button>

              {error && <div className={styles.error}>{error}</div>}

              {/* Plinko Stats Card */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Plinko Session Statistics</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{ballsDropped}</span>
                    <span className={styles.statLabel}>Balls Dropped</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{formatBTC(sessionWagered)}</span>
                    <span className={styles.statLabel}>Total Wagered</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>+{formatBTC(sessionWon)}</span>
                    <span className={styles.statLabel}>Total Won</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#ffd700' }}>{maxMultiplier}x</span>
                    <span className={styles.statLabel}>Peak Multiplier</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Physics Board & Ticker */}
            <div className={styles.boardColumn}>
              {/* History outcomes Ticker */}
              <div className={styles.tickerWrap}>
                <div className={styles.tickerLabel}>Recent Drops</div>
                <div className={styles.ticker}>
                  <AnimatePresence>
                    {history.length === 0 ? (
                      <div className={styles.tickerEmpty}>Outcome ticker will display rolls...</div>
                    ) : (
                      history.map((h, i) => (
                        <motion.div
                          key={h.id}
                          className={`${styles.tickerItem} ${
                            h.multiplier >= 3.0 ? styles.itemGold : h.multiplier >= 1.0 ? styles.itemGreen : styles.itemRed
                          }`}
                          initial={{ opacity: 0, x: -20, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', damping: 15 }}
                        >
                          {h.multiplier}x
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* The Physics Board */}
              <PlinkoBoard
                rows={engine.rows}
                risk={engine.risk}
                multipliers={multipliers}
                dropTrigger={dropTrigger}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
