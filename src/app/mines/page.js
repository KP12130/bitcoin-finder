'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useMinesEngine } from '@/hooks/useMinesEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { getMinesMultiplier } from '@/lib/combinations';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import AutoPanel from '@/components/AutoPanel/AutoPanel';
import styles from './page.module.css';

export default function MinesPage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();

  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionWon, setSessionWon] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [peakWin, setPeakWin] = useState(0);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'auto'

  // ─── Auto mode state ──────────────────────────────────────────────────────
  const [autoActive, setAutoActive] = useState(false);
  const [autoRoundsDone, setAutoRoundsDone] = useState(0);
  const [autoTotalRounds, setAutoTotalRounds] = useState(0);
  const [autoSessionPnl, setAutoSessionPnl] = useState(0);
  const [autoGemsTarget, setAutoGemsTarget] = useState(3); // UI state for gem target

  // Refs — the auto state machine runs from these to avoid stale closures
  const autoActiveRef = useRef(false);
  const autoPhaseRef = useRef('idle'); // 'idle' | 'starting' | 'playing' | 'cashing-out' | 'finishing'
  const autoConfigRef = useRef(null);
  const autoBaseBetRef = useRef(10);
  const autoRoundsDoneRef = useRef(0);
  const autoSessionPnlRef = useRef(0);
  const autoTimerRef = useRef(null);
  const autoGemsTargetRef = useRef(3);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  // Always-current snapshot of the game object
  const gameRef = useRef(null);

  const handleGameFinished = useCallback(({ win, payout, multiplier }) => {
    if (win) {
      setSessionWon((p) => p + payout);
      setPeakWin((p) => Math.max(p, multiplier));
    }
    checkAchievements();
  }, [checkAchievements]);

  const game = useMinesEngine(balance, subtractBalance, addBalance, handleGameFinished);

  // Update game ref every render so setTimeout callbacks always get latest values
  gameRef.current = game;

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  // ─── Manual handlers ───────────────────────────────────────────────────────
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

  const handleStart = useCallback(async () => {
    setError('');
    const result = await game.startGame();
    if (result?.error) { setError(result.error); return; }
    setGamesPlayed((p) => p + 1);
    setSessionWagered((p) => p + game.betAmount);
  }, [game]);

  const handleCashout = useCallback(() => { game.cashOut(); }, [game]);

  const handleHalfBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount((prev) => Math.max(0.10, Math.round((prev / 2) * 100) / 100));
  }, [game]);

  const handleDoubleBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount((prev) => Math.min(balance, Math.round(prev * 2 * 100) / 100));
  }, [balance, game]);

  const handleMaxBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount(balance);
  }, [balance, game]);

  const handleMinBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount(0.10);
  }, [game]);

  // ─── Auto mode — state machine driven by useEffect ────────────────────────

  const stopAuto = useCallback(() => {
    autoActiveRef.current = false;
    autoPhaseRef.current = 'idle';
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoActive(false);
  }, []);

  // Reveal one random unrevealed gem cell, then schedule next check
  const scheduleReveal = useCallback(() => {
    if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;

    autoTimerRef.current = setTimeout(() => {
      if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
      const g = gameRef.current;
      if (!g || g.gameState !== 'playing') return;

      // If we already hit the target, cash out
      if (g.gemsFound >= autoGemsTargetRef.current) {
        autoPhaseRef.current = 'cashing-out';
        g.cashOut();
        return;
      }

      // Pick a random unrevealed cell
      const unrevealed = Array.from({ length: 25 }, (_, i) => i).filter(i => !g.revealed[i]);
      if (unrevealed.length === 0) return;
      const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      g.revealCell(idx);

      // After reveal, wait for React state update then decide next step
      autoTimerRef.current = setTimeout(() => {
        if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
        const g2 = gameRef.current;
        if (!g2) return;

        if (g2.gameState === 'playing') {
          if (g2.gemsFound >= autoGemsTargetRef.current) {
            autoPhaseRef.current = 'cashing-out';
            g2.cashOut();
          } else {
            scheduleReveal();
          }
        }
        // if gameState = 'lost', the useEffect[game.gameState] handles it
      }, 350);
    }, 700);
  }, []); // stable ref — reads gameRef.current at call time

  // Adjust bet for next round based on win/loss config
  const applyBetAdjustment = useCallback((won) => {
    const cfg = autoConfigRef.current;
    if (!cfg) return;
    const g = gameRef.current;
    const base = autoBaseBetRef.current;
    const cur = g.betAmount;

    if (won) {
      if (cfg.onWin === 'reset') g.setBetAmount(base);
      else if (cfg.onWin === 'increase') g.setBetAmount(Math.min(balanceRef.current, Math.round(cur * (1 + cfg.onWinPct / 100) * 100) / 100));
    } else {
      if (cfg.onLoss === 'reset') g.setBetAmount(base);
      else if (cfg.onLoss === 'increase') g.setBetAmount(Math.min(balanceRef.current, Math.round(cur * (1 + cfg.onLossPct / 100) * 100) / 100));
    }
  }, []);

  // Called at end of every auto round
  const handleAutoRoundEndRef = useRef(null);
  handleAutoRoundEndRef.current = (won, pnlDelta) => {
    autoSessionPnlRef.current += pnlDelta;
    setAutoSessionPnl(autoSessionPnlRef.current);
    autoRoundsDoneRef.current += 1;
    setAutoRoundsDone(autoRoundsDoneRef.current);

    const cfg = autoConfigRef.current;
    if (!cfg) { stopAuto(); return; }

    const done = autoRoundsDoneRef.current;
    const pnl = autoSessionPnlRef.current;

    if (cfg.rounds !== Infinity && done >= cfg.rounds) { stopAuto(); return; }
    if (cfg.stopOnProfit > 0 && pnl >= cfg.stopOnProfit) { stopAuto(); return; }
    if (cfg.stopOnLoss > 0 && pnl <= -cfg.stopOnLoss) { stopAuto(); return; }
    if (balanceRef.current <= 0) { stopAuto(); return; }

    applyBetAdjustment(won);

    // Wait, reset, then start next round
    autoPhaseRef.current = 'starting';
    autoTimerRef.current = setTimeout(() => {
      if (!autoActiveRef.current) return;
      const g = gameRef.current;
      g.resetGame();
      setTimeout(async () => {
        if (!autoActiveRef.current) return;
        const g2 = gameRef.current;
        await g2.startGame();
      }, 200);
    }, 1200);
  };

  // State machine: watch gameState to drive auto transitions
  useEffect(() => {
    if (!autoActiveRef.current) return;
    const phase = autoPhaseRef.current;

    if (game.gameState === 'playing' && phase === 'starting') {
      autoPhaseRef.current = 'playing';
      scheduleReveal();
    }

    if (game.gameState === 'lost' && phase === 'playing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      // Lost the full bet
      const pnlDelta = -(gameRef.current?.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(false, pnlDelta);
    }

    if (game.gameState === 'won' && (phase === 'playing' || phase === 'cashing-out') && autoPhaseRef.current !== 'finishing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      const g = gameRef.current;
      const mult = getMinesMultiplier(g.minesCount, g.gemsFound || autoGemsTargetRef.current);
      const payout = (g.betAmount ?? 0) * mult;
      const pnlDelta = payout - (g.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(true, pnlDelta);
    }
  }, [game.gameState, scheduleReveal]);

  // Start auto mode
  const startAuto = useCallback(async (config) => {
    if (game.gameState === 'playing') return; // don't interrupt active game
    autoConfigRef.current = config;
    autoRoundsDoneRef.current = 0;
    autoSessionPnlRef.current = 0;
    autoBaseBetRef.current = game.betAmount;
    autoGemsTargetRef.current = autoGemsTarget;
    autoPhaseRef.current = 'starting';
    autoActiveRef.current = true;

    setAutoActive(true);
    setAutoRoundsDone(0);
    setAutoTotalRounds(config.rounds);
    setAutoSessionPnl(0);

    game.resetGame();
    setTimeout(async () => {
      if (!autoActiveRef.current) return;
      await gameRef.current.startGame();
    }, 200);
  }, [game, autoGemsTarget]);

  // ─── Derived display values ───────────────────────────────────────────────
  const currentMultiplier = getMinesMultiplier(game.minesCount, game.gemsFound);
  const nextMultiplier = getMinesMultiplier(game.minesCount, game.gemsFound + 1);
  const currentPayout = Math.round(game.betAmount * currentMultiplier * 100) / 100;
  const isPlaying = game.gameState === 'playing';

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>

            {/* Left Controls column */}
            <div className={styles.controlsPanel}>
              <h1 className={styles.title}>Satoshi Mines 💣💎</h1>
              <p className={styles.subtitle}>Flip cells for gems. Cash out at any time. Avoid hidden mines!</p>

              {/* Manual / Auto tab toggle */}
              <div className={styles.tabRow}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('manual')}
                  disabled={autoActive}
                >Manual</button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'auto' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('auto')}
                  disabled={isPlaying && !autoActive}
                >Auto</button>
              </div>

              {/* ── MANUAL TAB ── */}
              {activeTab === 'manual' && (
                <>
                  <div className={styles.controlGroup}>
                    <div className={styles.controlLabel}>Bet Amount</div>
                    <div className={styles.inputRow}>
                      <input className={styles.input} type="text" value={betInput}
                        onChange={handleBetInput} disabled={isPlaying} />
                      <div className={styles.quickBetGrid}>
                        <button className={styles.quickBetBtn} onClick={handleHalfBet} disabled={isPlaying}>½</button>
                        <button className={styles.quickBetBtn} onClick={handleDoubleBet} disabled={isPlaying}>2x</button>
                        <button className={styles.quickBetBtn} onClick={handleMinBet} disabled={isPlaying}>Min</button>
                        <button className={styles.quickBetBtn} onClick={handleMaxBet} disabled={isPlaying}>Max</button>
                      </div>
                    </div>
                  </div>

                  <div className={styles.controlGroup}>
                    <div className={styles.controlLabel}>Mines: {game.minesCount}</div>
                    <input type="range" className={styles.slider} min={1} max={24}
                      value={game.minesCount}
                      onChange={(e) => game.setMinesCount(Number(e.target.value))}
                      disabled={isPlaying} />
                    <div className={styles.oddsPreview}>
                      <div>Win Chance: {(((25 - game.minesCount) / 25) * 100).toFixed(0)}%</div>
                      <div>Next Gem: {nextMultiplier}x</div>
                    </div>
                  </div>

                  {!isPlaying ? (
                    <motion.button className={styles.betBtn} onClick={handleStart}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      💣 Start Game
                    </motion.button>
                  ) : (
                    <motion.button
                      className={`${styles.betBtn} ${styles.cashoutBtn}`}
                      onClick={handleCashout} disabled={game.gemsFound === 0}
                      whileHover={game.gemsFound > 0 ? { scale: 1.02 } : {}}
                      whileTap={game.gemsFound > 0 ? { scale: 0.97 } : {}}
                      animate={game.gemsFound > 0 ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)'] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}>
                      💰 Cash Out ({formatBTC(currentPayout)})
                    </motion.button>
                  )}

                  {error && <div className={styles.error}>{error}</div>}
                </>
              )}

              {/* ── AUTO TAB ── */}
              {activeTab === 'auto' && (
                <AutoPanel
                  isRunning={autoActive}
                  onStart={startAuto}
                  onStop={stopAuto}
                  roundsDone={autoRoundsDone}
                  totalRounds={autoTotalRounds}
                  sessionPnl={autoSessionPnl}
                >
                  {/* Game-specific: gem target */}
                  <div>
                    <div className={styles.controlLabel} style={{ marginBottom: '0.4rem' }}>
                      💎 Collect {autoGemsTarget} gem{autoGemsTarget !== 1 ? 's' : ''} then cash out
                    </div>
                    <input type="range" className={styles.slider}
                      min={1} max={Math.min(10, 25 - game.minesCount)}
                      value={autoGemsTarget}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setAutoGemsTarget(v);
                        autoGemsTargetRef.current = v;
                      }}
                      disabled={autoActive} />
                    <div className={styles.oddsPreview}>
                      <div>Target: {autoGemsTarget} gems</div>
                      <div>Target mult: {getMinesMultiplier(game.minesCount, autoGemsTarget)}x</div>
                    </div>
                  </div>
                </AutoPanel>
              )}

              {/* Stats card (always visible) */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Session Stats</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{gamesPlayed}</span>
                    <span className={styles.statLabel}>Games Played</span>
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
                    <span className={styles.statVal} style={{ color: '#ffd700' }}>{peakWin}x</span>
                    <span className={styles.statLabel}>Peak Multiplier</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 5x5 Mines Grid */}
            <div className={styles.gridColumn}>
              {/* Status bar */}
              <div className={styles.statusBar}>
                {isPlaying ? (
                  <div className={styles.statusRow}>
                    <div className={styles.statusIndicator}>
                      💎 Gems: <strong>{game.gemsFound} / {25 - game.minesCount}</strong>
                      {autoActive && <span style={{ marginLeft: '0.5rem', color: '#ffd700', fontSize: '0.75rem' }}>[AUTO]</span>}
                    </div>
                    <div className={styles.multiplierLabel}>
                      Current: <strong style={{ color: '#ffd700' }}>{currentMultiplier}x</strong>
                    </div>
                    <div className={styles.multiplierLabel}>
                      Next: <strong style={{ color: '#00ff88' }}>{nextMultiplier}x</strong>
                    </div>
                  </div>
                ) : game.gameState === 'won' ? (
                  <div className={styles.winBar}>🎉 Won <strong>{formatBTC(currentPayout)} ({currentMultiplier}x)</strong></div>
                ) : game.gameState === 'lost' ? (
                  <div className={styles.lostBar}>💥 Exploded! Better luck next round!</div>
                ) : (
                  <div className={styles.idleBar}>Select bet amount, choose mine count, and click Start!</div>
                )}
              </div>

              {/* 5×5 Grid */}
              <div className={`${styles.minesGrid} ${game.gameState === 'lost' ? styles.gridExploded : ''}`}>
                {Array(25).fill(null).map((_, i) => {
                  const isRevealed = game.revealed[i];
                  const item = game.grid[i];
                  return (
                    <div key={i} className={styles.cardContainer}
                      onClick={() => !autoActive && game.revealCell(i)}>
                      <motion.div
                        className={`${styles.card} ${isRevealed ? styles.cardFlipped : ''}`}
                        animate={{ rotateY: isRevealed ? 180 : 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                      >
                        <div className={styles.cardFront}>
                          <div className={styles.satoshiDot} />
                        </div>
                        <div className={`${styles.cardBack} ${isRevealed ? (item === 'mine' ? styles.backMine : styles.backGem) : ''}`}>
                          {isRevealed && (item === 'mine' ? '💣' : '💎')}
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>

              <VerificationPanel gameType="mines" />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
