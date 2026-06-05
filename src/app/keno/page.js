'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useAchievements } from '@/hooks/useAchievements';
import { useKenoEngine } from '@/hooks/useKenoEngine';
import { parseShorthand, formatBTC } from '@/lib/utils';
import styles from './page.module.css';

// Numbers 1-40 in a 4×10 grid
const ALL_NUMBERS = Array.from({ length: 40 }, (_, i) => i + 1);

export default function KenoPage() {
  const { checkAchievements } = useAchievements();
  const game = useKenoEngine();

  // Session stats
  const [gamesPlayed, setGamesPlayed]     = useState(0);
  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionWon, setSessionWon]       = useState(0);
  const [peakMultiplier, setPeakMultiplier] = useState(0);

  // Bet input field (text)
  const [betInput, setBetInput] = useState('100');

  // Keep betInput in sync when betAmount changes externally
  useEffect(() => {
    setBetInput(String(game.betAmount));
  }, []);   // intentionally only on mount

  const handleBetInput = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9.kKmM]/g, '');
    setBetInput(raw);
    const parsed = parseShorthand(raw);
    if (!isNaN(parsed) && parsed > 0) {
      game.setBetAmount(parsed);
    }
  }, [game]);

  const setQuickBet = useCallback((fn) => {
    if (game.gamePhase !== 'idle') return;
    game.setBetAmount((prev) => {
      const next = fn(prev, game.balance);
      setBetInput(String(next));
      return next;
    });
  }, [game]);

  const handleHalf  = () => setQuickBet((p) => Math.max(0.10, Math.round(p / 2 * 100) / 100));
  const handleDouble = () => setQuickBet((p, bal) => Math.min(bal, Math.round(p * 2 * 100) / 100));
  const handleMin   = () => setQuickBet(() => { setBetInput('0.10'); return 0.10; });
  const handleMax   = () => setQuickBet((_, bal) => { setBetInput(String(bal)); return bal; });

  const handlePlay = useCallback(async () => {
    if (game.gamePhase === 'result') {
      game.resetGame();
      return;
    }
    if (game.gamePhase !== 'idle') return;

    const prevBalance = game.balance;
    await game.playRound();

    // Wait for result phase to compute session stats
    // We'll track via effect below
  }, [game]);

  // Track session stats when a result comes in
  useEffect(() => {
    if (game.gamePhase === 'result') {
      setGamesPlayed(p => p + 1);
      setSessionWagered(p => p + game.betAmount);
      if (game.won) {
        setSessionWon(p => p + game.payout);
        setPeakMultiplier(p => Math.max(p, game.multiplier));
      }
      checkAchievements();
    }
  }, [game.gamePhase]);   // eslint-disable-line react-hooks/exhaustive-deps

  const isDrawing = game.gamePhase === 'drawing';
  const isResult  = game.gamePhase === 'result';
  const isIdle    = game.gamePhase === 'idle';

  // Determine button label
  let btnLabel = '🎯 PLAY KENO';
  if (isDrawing) btnLabel = '⏳ Drawing...';
  else if (isResult) btnLabel = '🔄 Play Again';

  return (
    <>
      <Navbar balance={game.balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.layout}>

            {/* ── LEFT COLUMN: Controls ── */}
            <div className={styles.controlsPanel}>
              <h1 className={styles.title}>Keno 🎯</h1>
              <p className={styles.subtitle}>
                Pick 1–10 numbers. 10 are drawn. More matches = bigger multiplier!
              </p>

              {/* Bet Amount */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount</div>
                <input
                  className={styles.input}
                  type="text"
                  value={betInput}
                  onChange={handleBetInput}
                  disabled={!isIdle}
                  placeholder="e.g. 100"
                />
                <div className={styles.quickBetRow}>
                  <button className={styles.quickBtn} onClick={handleHalf}   disabled={!isIdle}>½</button>
                  <button className={styles.quickBtn} onClick={handleDouble} disabled={!isIdle}>2×</button>
                  <button className={styles.quickBtn} onClick={handleMin}    disabled={!isIdle}>Min</button>
                  <button className={styles.quickBtn} onClick={handleMax}    disabled={!isIdle}>Max</button>
                </div>
              </div>

              {/* Risk selector */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Risk Level</div>
                <div className={styles.riskSelectRow}>
                  {['classic', 'low', 'medium', 'high'].map((r) => (
                    <button
                      key={r}
                      className={`${styles.riskBtn} ${game.risk === r ? styles.riskBtnActive : ''}`}
                      onClick={() => game.gamePhase === 'idle' && game.setRisk(r)}
                      disabled={!isIdle}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Picks counter */}
              <div className={styles.picksCounter}>
                <span className={styles.picksLabel}>Numbers selected</span>
                <span className={styles.picksCount}>{game.picks.size} / 10</span>
              </div>

              {/* Quick clear */}
              <button
                className={styles.clearBtn}
                onClick={game.clearPicks}
                disabled={!isIdle || game.picks.size === 0}
              >
                ✕ Clear All Picks
              </button>

              {/* Play / Again button */}
              <motion.button
                className={`${styles.playBtn} ${isResult ? styles.playBtnAgain : ''}`}
                onClick={handlePlay}
                disabled={isDrawing || (isIdle && game.picks.size === 0)}
                whileHover={!isDrawing ? { scale: 1.02 } : {}}
                whileTap={!isDrawing ? { scale: 0.97 } : {}}
                animate={isResult && game.won
                  ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 30px rgba(0,255,136,0.7)', '0 0 10px rgba(0,255,136,0.3)'] }
                  : {}
                }
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {btnLabel}
              </motion.button>

              {/* Error message */}
              {game.error && (
                <motion.div
                  className={styles.errorMsg}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {game.error}
                </motion.div>
              )}

              {/* Pay table preview (for current pick count) */}
              {game.picks.size > 0 && (
                <div className={styles.payTableCard}>
                  <div className={styles.payTableTitle}>
                    Pay Table — {game.picks.size} Pick{game.picks.size > 1 ? 's' : ''}
                  </div>
                  {/* We map from the KENO_PAY_TABLES array: index is matchCount, value is multiplier */}
                  {(game.KENO_PAY_TABLES[game.risk]?.[game.picks.size] || [])
                    .map((mult, mc) => ({ mc, mult }))
                    .filter(({ mult }) => mult > 0)
                    .sort((a, b) => b.mc - a.mc)
                    .map(({ mc, mult }) => {
                      const isCurrentMatch = isResult && game.matched.size === mc;
                      return (
                        <div
                          key={mc}
                          className={`${styles.payRow} ${isCurrentMatch ? styles.payRowActive : ''}`}
                        >
                          <span>{mc} match{mc !== 1 ? 'es' : ''}</span>
                          <span className={styles.payMult}>{mult}×</span>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Session Stats */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Session Stats</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{gamesPlayed}</span>
                    <span className={styles.statLabel}>Played</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{formatBTC(sessionWagered)}</span>
                    <span className={styles.statLabel}>Wagered</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>
                      +{formatBTC(sessionWon)}
                    </span>
                    <span className={styles.statLabel}>Won</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#ffd700' }}>
                      {peakMultiplier > 0 ? `${peakMultiplier}×` : '—'}
                    </span>
                    <span className={styles.statLabel}>Peak Mult.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Grid + Result ── */}
            <div className={styles.gameColumn}>

              {/* Result Banner */}
              <AnimatePresence mode="wait">
                {isResult ? (
                  <motion.div
                    key="result"
                    className={`${styles.resultBanner} ${game.won ? styles.resultWin : styles.resultLoss}`}
                    initial={{ opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.35 }}
                  >
                    {game.won ? (
                      <>
                        <span className={styles.resultEmoji}>🎉</span>
                        <span className={styles.resultText}>
                          {game.matched.size} match{game.matched.size !== 1 ? 'es' : ''}!{' '}
                          <strong>{game.multiplier}×</strong> — Won{' '}
                          <strong className={styles.winAmount}>{formatBTC(game.payout)}</strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.resultEmoji}>😢</span>
                        <span className={styles.resultText}>
                          {game.matched.size} match{game.matched.size !== 1 ? 'es' : ''} — No win this round
                        </span>
                      </>
                    )}
                  </motion.div>
                ) : isDrawing ? (
                  <motion.div
                    key="drawing"
                    className={`${styles.resultBanner} ${styles.resultDrawing}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className={styles.resultEmoji}>🎲</span>
                    <span className={styles.resultText}>
                      Drawing… ({game.drawn.length} / 10)
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    className={`${styles.resultBanner} ${styles.resultIdle}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className={styles.resultEmoji}>🎯</span>
                    <span className={styles.resultText}>
                      Pick your numbers and press PLAY!
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drawn count tracker */}
              {(isDrawing || isResult) && (
                <div className={styles.drawnTracker}>
                  <span className={styles.drawnLabel}>Drawn:</span>
                  <div className={styles.drawnBalls}>
                    {game.drawn.map((n) => (
                      <motion.span
                        key={n}
                        className={`${styles.miniball} ${game.matched.has(n) ? styles.miniballMatch : styles.miniballDraw}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      >
                        {n}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {/* 8×10 Keno Grid */}
              <div className={styles.kenoGrid}>
                {ALL_NUMBERS.map((num) => {
                  const isPicked  = game.picks.has(num);
                  const isDrawnNum = game.drawn.includes(num);
                  const isMatchedNum = game.matched.has(num);

                  let ballClass = styles.ball;
                  if (isMatchedNum)    ballClass += ` ${styles.ballMatched}`;
                  else if (isPicked)   ballClass += ` ${styles.ballPicked}`;
                  else if (isDrawnNum) ballClass += ` ${styles.ballDrawn}`;

                  return (
                    <motion.button
                      key={num}
                      className={ballClass}
                      onClick={() => game.togglePick(num)}
                      disabled={!isIdle}
                      whileHover={isIdle ? { scale: 1.12 } : {}}
                      whileTap={isIdle ? { scale: 0.92 } : {}}
                      animate={isMatchedNum
                        ? { boxShadow: ['0 0 8px rgba(0,255,136,0.5)', '0 0 20px rgba(0,255,136,0.9)', '0 0 8px rgba(0,255,136,0.5)'] }
                        : {}
                      }
                      transition={isMatchedNum ? { repeat: Infinity, duration: 1.2 } : {}}
                    >
                      {num}
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendPicked}`} /> Your pick
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendDrawn}`} /> Drawn
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendMatched}`} /> Match! 🎉
                </span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
