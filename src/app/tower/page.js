'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useTowerEngine } from '@/hooks/useTowerEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaSkull, FaCheck, FaInfoCircle } from 'react-icons/fa';
import AutoPanel from '@/components/AutoPanel/AutoPanel';
import styles from './page.module.css';

export default function TowerPage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('manual');

  useEffect(() => { setMounted(true); }, []);

  const handleGameFinished = useCallback(({ win, payout, multiplier }) => {
    checkAchievements();
  }, [checkAchievements]);

  const game = useTowerEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const gameRef = useRef(null);
  gameRef.current = game; // Always-current snapshot

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  // ─── Auto mode state ──────────────────────────────────────────────────────
  const [autoActive, setAutoActive] = useState(false);
  const [autoRoundsDone, setAutoRoundsDone] = useState(0);
  const [autoTotalRounds, setAutoTotalRounds] = useState(0);
  const [autoSessionPnl, setAutoSessionPnl] = useState(0);
  const [autoFloorTarget, setAutoFloorTarget] = useState(3); // UI: target floor to climb to

  const autoActiveRef = useRef(false);
  const autoPhaseRef = useRef('idle'); // 'idle'|'starting'|'playing'|'cashing-out'|'finishing'
  const autoConfigRef = useRef(null);
  const autoBaseBetRef = useRef(10);
  const autoRoundsDoneRef = useRef(0);
  const autoSessionPnlRef = useRef(0);
  const autoTimerRef = useRef(null);
  const autoFloorTargetRef = useRef(3);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  // ─── Manual tab handlers ──────────────────────────────────────────────────
  const isIdle = game.gameState === 'idle';
  const isPlaying = game.gameState === 'playing';
  const isWon = game.gameState === 'won';
  const isLost = game.gameState === 'lost';
  const isFinished = isWon || isLost;

  const handleStart = useCallback(async () => {
    setError('');
    const res = await game.startGame();
    if (res?.error) setError(res.error);
  }, [game]);

  const handleCashout = useCallback(() => { game.cashOut(); }, [game]);

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
    if (isPlaying) return;
    switch (action) {
      case 'half': game.setBetAmount(Math.max(0.10, Math.round((game.betAmount / 2) * 100) / 100)); break;
      case 'double': game.setBetAmount(Math.min(balance, Math.round(game.betAmount * 2 * 100) / 100)); break;
      case 'min': game.setBetAmount(0.10); break;
      case 'max': game.setBetAmount(balance); break;
    }
  }, [game, balance, isPlaying]);

  const handleTileClick = useCallback((level, index) => {
    if (!isPlaying || level !== game.currentLevel || autoActive) return;
    game.clickTile(level, index);
  }, [isPlaying, game, autoActive]);

  // ─── Auto mode state machine ──────────────────────────────────────────────

  const stopAuto = useCallback(() => {
    autoActiveRef.current = false;
    autoPhaseRef.current = 'idle';
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    setAutoActive(false);
  }, []);

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

    autoPhaseRef.current = 'starting';
    autoTimerRef.current = setTimeout(() => {
      if (!autoActiveRef.current) return;
      const g = gameRef.current;
      g.resetGame();
      setTimeout(async () => {
        if (!autoActiveRef.current) return;
        await gameRef.current.startGame();
      }, 200);
    }, 1200);
  };

  // Schedule a tile click on the current level
  const scheduleAutoTileClick = useCallback(() => {
    if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
    autoTimerRef.current = setTimeout(() => {
      if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
      const g = gameRef.current;
      if (g.gameState !== 'playing') return;

      // If we're already at target floor, cash out
      if (g.currentLevel >= autoFloorTargetRef.current) {
        autoPhaseRef.current = 'cashing-out';
        g.cashOut();
        return;
      }

      // Pick random tile on current level
      const tileIdx = Math.floor(Math.random() * g.config.tilesPerRow);
      g.clickTile(g.currentLevel, tileIdx);
      // The useEffect will handle the result (safe → schedule next, trap → round end)
    }, 750);
  }, []);

  // State machine: react to currentLevel and gameState
  useEffect(() => {
    if (!autoActiveRef.current) return;
    const phase = autoPhaseRef.current;

    if (game.gameState === 'playing' && phase === 'starting') {
      autoPhaseRef.current = 'playing';
      scheduleAutoTileClick();
      return;
    }

    if (game.gameState === 'playing' && phase === 'playing') {
      // Level just changed (safe tile clicked), decide next action
      if (game.currentLevel >= autoFloorTargetRef.current) {
        autoPhaseRef.current = 'cashing-out';
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = setTimeout(() => {
          if (!autoActiveRef.current) return;
          gameRef.current.cashOut();
        }, 400);
      } else {
        scheduleAutoTileClick();
      }
      return;
    }

    if (game.gameState === 'lost' && phase === 'playing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      const pnlDelta = -(gameRef.current?.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(false, pnlDelta);
      return;
    }

    if (game.gameState === 'won' && (phase === 'playing' || phase === 'cashing-out') && phase !== 'finishing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      const g = gameRef.current;
      const payout = (g?.currentPayout ?? 0);
      const pnlDelta = payout - (g?.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(true, pnlDelta);
      return;
    }
  }, [game.gameState, game.currentLevel, scheduleAutoTileClick]);

  const startAuto = useCallback(async (config) => {
    if (game.gameState === 'playing') return;
    autoConfigRef.current = config;
    autoRoundsDoneRef.current = 0;
    autoSessionPnlRef.current = 0;
    autoBaseBetRef.current = game.betAmount;
    autoFloorTargetRef.current = autoFloorTarget;
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
  }, [game, autoFloorTarget]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Tower of Satoshi...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>
            {/* Left Controls column */}
            <div className={styles.controlsPanel}>
              <div>
                <h1 className={styles.title}>Tower of Satoshi 🏰</h1>
                <p className={styles.subtitle}>Climb the Bitcoin tower! Find safe tiles on each row to multiply your winnings.</p>
              </div>

              {/* Manual / Auto tabs */}
              <div className={styles.tabRow}>
                <button className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('manual')} disabled={autoActive}>Manual</button>
                <button className={`${styles.tabBtn} ${activeTab === 'auto' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('auto')} disabled={isPlaying && !autoActive}>Auto</button>
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
                        <button className={styles.quickBetBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying}>½</button>
                        <button className={styles.quickBetBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying}>2x</button>
                        <button className={styles.quickBetBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying}>Min</button>
                        <button className={styles.quickBetBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying}>Max</button>
                      </div>
                    </div>
                  </div>

                  <div className={styles.controlGroup}>
                    <div className={styles.controlLabel}>Difficulty Level</div>
                    <div className={styles.difficultyGrid}>
                      {Object.keys(game.DIFFICULTY_CONFIGS).map((diff) => (
                        <button key={diff}
                          className={`${styles.diffBtn} ${game.difficulty === diff ? `${styles.diffBtnActive} ${styles['diff_' + diff]}` : ''}`}
                          onClick={() => { setError(''); game.setDifficulty(diff); }}
                          disabled={isPlaying}>
                          {game.DIFFICULTY_CONFIGS[diff].label}
                        </button>
                      ))}
                    </div>
                    <div className={styles.oddsPreview}>
                      <div>Tiles per Row: {game.config.tilesPerRow}</div>
                      <div>Traps per Row: {game.config.trapsPerRow}</div>
                    </div>
                  </div>

                  {error && <div className={styles.error}>{error}</div>}

                  <div className={styles.actionSection}>
                    {!isPlaying ? (
                      <motion.button className={styles.betBtn} onClick={handleStart}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        🏰 START CLIMB
                      </motion.button>
                    ) : (
                      <div className={styles.activeActions}>
                        <motion.button
                          className={`${styles.betBtn} ${styles.cashoutBtn}`}
                          onClick={handleCashout} disabled={game.currentLevel === 0}
                          whileHover={game.currentLevel > 0 ? { scale: 1.02 } : {}}
                          whileTap={game.currentLevel > 0 ? { scale: 0.98 } : {}}
                          animate={game.currentLevel > 0 ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)'] } : {}}
                          transition={{ repeat: Infinity, duration: 1.5 }}>
                          💰 CASHOUT (+{formatBTC(game.currentPayout)})
                        </motion.button>
                        <button className={styles.resetBtn} onClick={game.resetGame}>Abort Round</button>
                      </div>
                    )}
                  </div>

                  <div className={styles.rulesCard}>
                    <div className={styles.rulesTitle}><FaInfoCircle /> Rules</div>
                    <ul className={styles.rulesList}>
                      <li>Start climbing from the bottom row (Level 1).</li>
                      <li>Click a tile to reveal it. If safe, you climb up!</li>
                      <li>Each level cleared compounds your multiplier.</li>
                      <li>Hitting a trap loses your entire bet.</li>
                      <li>You can cash out on any level before you click.</li>
                    </ul>
                  </div>
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
                  {/* Game-specific: target floor */}
                  <div>
                    <div className={styles.controlLabel} style={{ marginBottom: '0.4rem' }}>
                      🏰 Climb to floor {autoFloorTarget} then cash out
                    </div>
                    <input type="range" className={styles.slider ?? ''}
                      min={1} max={game.totalLevels}
                      value={autoFloorTarget}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setAutoFloorTarget(v);
                        autoFloorTargetRef.current = v;
                      }}
                      disabled={autoActive}
                      style={{ width: '100%', accentColor: '#f7931a' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                      <span>Floor: {autoFloorTarget} / {game.totalLevels}</span>
                      <span>Target mult: {game.multiplierLadder[autoFloorTarget - 1]?.multiplier.toFixed(2)}x</span>
                    </div>
                  </div>
                </AutoPanel>
              )}
            </div>

            {/* Right Tower column */}
            <div className={styles.towerColumn}>
              <div className={styles.statusBar}>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Multiplier</span>
                  <span className={styles.statusVal} style={{ color: '#ffd700' }}>
                    {game.currentMultiplier.toFixed(2)}x
                    {autoActive && <span style={{ fontSize: '0.6rem', color: '#00ff88', marginLeft: '0.3rem' }}>[AUTO]</span>}
                  </span>
                </div>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Next Step</span>
                  <span className={styles.statusVal} style={{ color: '#00d4ff' }}>{game.nextMultiplier.toFixed(2)}x</span>
                </div>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Profit on Next</span>
                  <span className={styles.statusVal} style={{ color: '#00ff88' }}>
                    +{formatBTC(Math.round((game.betAmount * game.nextMultiplier - game.betAmount) * 100) / 100)}
                  </span>
                </div>
              </div>

              <div className={styles.towerGridContainer}>
                <AnimatePresence>
                  {isFinished && game.lastResult && !autoActive && (
                    <motion.div className={styles.resultOverlay}
                      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}>
                      <div className={`${styles.resultCard} ${isWon ? styles.cardWin : styles.cardLoss}`}>
                        <div className={styles.resultIcon}>
                          {isWon ? <FaCrown className={styles.crownGlow} /> : <FaSkull className={styles.skullGlow} />}
                        </div>
                        <span className={styles.resultTitleText}>{isWon ? 'Tower Conquered!' : 'Tower Busted!'}</span>
                        {isWon ? (
                          <span className={styles.resultDetails}>
                            Cleared {game.currentLevel} levels for {game.lastResult.multiplier?.toFixed(2)}x (+{formatBTC(game.lastResult.payout)})
                          </span>
                        ) : (
                          <span className={styles.resultDetails}>Busted on level {game.currentLevel + 1}</span>
                        )}
                        <button className={styles.playAgainBtn} onClick={game.resetGame}>Play Again</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={styles.towerAscender}>
                  {Array.from({ length: game.totalLevels }).map((_, idx) => {
                    const levelIndex = game.totalLevels - 1 - idx;
                    const isActive = levelIndex === game.currentLevel && isPlaying;
                    const isPassed = levelIndex < game.currentLevel;
                    const isFuture = levelIndex > game.currentLevel && !isFinished;
                    const rowMultiplier = game.multiplierLadder[levelIndex].multiplier;
                    const isAutoTarget = autoActive && levelIndex === autoFloorTarget - 1;

                    return (
                      <div key={levelIndex}
                        className={`${styles.towerRow} ${isActive ? styles.rowActive : ''} ${isPassed ? styles.rowPassed : ''} ${isFuture ? styles.rowFuture : ''}`}
                        style={isAutoTarget ? { outline: '1px dashed rgba(247,147,26,0.3)', borderRadius: '12px' } : {}}>
                        <div className={styles.levelLabel}>
                          <span className={styles.levelNum}>Lvl {levelIndex + 1}</span>
                          <span className={styles.levelMultiplier}>{rowMultiplier.toFixed(2)}x</span>
                        </div>
                        <div className={styles.tilesContainer}>
                          {Array.from({ length: game.config.tilesPerRow }).map((_, tileIdx) => {
                            const isTileRevealed = game.revealed[`${levelIndex}-${tileIdx}`];
                            const isSafe = game.grid[levelIndex]?.[tileIdx];
                            const isSelected = game.towerHistory.some(
                              h => h.level === levelIndex && h.index === tileIdx
                            );
                            return (
                              <button key={tileIdx}
                                className={`${styles.tile} ${isActive ? styles.tileActive : ''} ${isTileRevealed ? (isSafe ? styles.tileSafe : styles.tileTrap) : ''} ${isSelected ? styles.tileSelected : ''}`}
                                onClick={() => handleTileClick(levelIndex, tileIdx)}
                                disabled={!isActive || autoActive}>
                                {isTileRevealed ? (
                                  isSafe ? <FaCheck className={styles.checkIcon} /> : <FaSkull className={styles.trapIcon} />
                                ) : (
                                  <span className={styles.tileQuestion}>🥚</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
