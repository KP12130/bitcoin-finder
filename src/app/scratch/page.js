'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useScratchEngine, SYMBOLS } from '@/hooks/useScratchEngine';
import { parseShorthand, formatBTC } from '@/lib/utils';
import styles from './page.module.css';

export default function ScratchPage() {
  const { balance, isLoaded } = useBalance();

  const {
    betAmount,
    setBetAmount,
    gamePhase,
    panels,
    revealed,
    result,
    error,
    buyCard,
    revealPanel,
    revealAll,
    resetCard,
  } = useScratchEngine();

  // Session stats
  const [sessionGames,   setSessionGames]   = useState(0);
  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionWon,     setSessionWon]     = useState(0);
  const [sessionWins,    setSessionWins]    = useState(0);

  // Bet input string
  const [betInput, setBetInput] = useState('100');

  const handleBetInput = useCallback((e) => {
    const val = e.target.value.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) return;
    setBetInput(val);
    const parsed = parseShorthand(val);
    if (!isNaN(parsed) && parsed > 0) {
      setBetAmount(parsed);
    }
  }, [setBetAmount]);

  const quickBet = useCallback((factor, isAbsolute = false) => {
    if (gamePhase !== 'idle') return;
    setBetAmount((prev) => {
      const next = isAbsolute ? factor : Math.max(1, Math.round(prev * factor));
      setBetInput(String(next));
      return next;
    });
  }, [gamePhase, setBetAmount]);

  const handleBuyCard = useCallback(async () => {
    await buyCard();
    setSessionGames((p) => p + 1);
    setSessionWagered((p) => p + betAmount);
  }, [buyCard, betAmount]);

  const handleRevealPanel = useCallback((i) => {
    if (gamePhase !== 'scratching') return;
    revealPanel(i);
  }, [gamePhase, revealPanel]);

  const handleRevealAll = useCallback(() => {
    revealAll();
  }, [revealAll]);

  const handleNewCard = useCallback(() => {
    if (result) {
      if (result.won) {
        setSessionWon((p) => p + result.payout);
        setSessionWins((p) => p + 1);
      }
    }
    resetCard();
    setBetInput(String(betAmount));
  }, [result, resetCard, betAmount]);

  // Determine which symbol ids matched 3+
  const matchedIds = (() => {
    if (!result?.won || !result?.symbol) return new Set();
    return new Set([result.symbol.id]);
  })();

  const isPanelMatched = (i) => {
    if (!result?.won) return false;
    return panels[i] && matchedIds.has(panels[i].id);
  };

  const allRevealed = revealed.every(Boolean);

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>

            {/* =================== LEFT: Controls =================== */}
            <div className={styles.controlsPanel}>
              <h1 className={styles.title}>Scratch Cards 🎟️</h1>
              <p className={styles.subtitle}>
                Buy a card, scratch 9 panels. Match 3 identical symbols to win their prize. Best match wins!
              </p>

              {/* Bet Amount */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount (sats)</div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={betInput}
                    onChange={handleBetInput}
                    disabled={gamePhase !== 'idle'}
                    placeholder="e.g. 100 or 1k"
                  />
                  <div className={styles.quickBetGrid}>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => quickBet(0.5)}
                      disabled={gamePhase !== 'idle'}
                    >½</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => quickBet(2)}
                      disabled={gamePhase !== 'idle'}
                    >2×</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => quickBet(10, true)}
                      disabled={gamePhase !== 'idle'}
                    >Min</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => { quickBet(balance, true); }}
                      disabled={gamePhase !== 'idle'}
                    >Max</button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {gamePhase === 'idle' && (
                <motion.button
                  className={styles.buyBtn}
                  onClick={handleBuyCard}
                  disabled={!isLoaded || balance < betAmount || betAmount <= 0}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  animate={{
                    boxShadow: [
                      '0 4px 20px rgba(255,215,0,0.2)',
                      '0 4px 35px rgba(255,215,0,0.45)',
                      '0 4px 20px rgba(255,215,0,0.2)',
                    ],
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🎟️ Buy Scratch Card
                </motion.button>
              )}

              {gamePhase === 'scratching' && !allRevealed && (
                <motion.button
                  className={styles.revealAllBtn}
                  onClick={handleRevealAll}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  ✨ Reveal All Panels
                </motion.button>
              )}

              {(gamePhase === 'result' || (gamePhase === 'scratching' && allRevealed)) && (
                <motion.button
                  className={styles.newCardBtn}
                  onClick={handleNewCard}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  🔄 New Card
                </motion.button>
              )}

              {error && (
                <motion.div
                  className={styles.error}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {/* Payout Table */}
              <div className={styles.payoutTable}>
                <div className={styles.payoutHeader}>💰 Prize Table (3 of a kind)</div>
                {SYMBOLS.map((sym) => (
                  <div key={sym.id} className={styles.payoutRow}>
                    <span>
                      <span className={styles.payoutSymbol}>{sym.emoji}</span>
                      <span className={styles.payoutName}>{sym.label}</span>
                    </span>
                    <span className={styles.payoutMult}>{sym.multiplier}× bet</span>
                  </div>
                ))}
              </div>

              {/* Session Stats */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>📊 Session Stats</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{sessionGames}</span>
                    <span className={styles.statLabel}>Cards Played</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#ffd700' }}>{sessionWins}</span>
                    <span className={styles.statLabel}>Wins</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{formatBTC(sessionWagered)}</span>
                    <span className={styles.statLabel}>Total Wagered</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>
                      +{formatBTC(sessionWon)}
                    </span>
                    <span className={styles.statLabel}>Total Won</span>
                  </div>
                </div>
              </div>
            </div>

            {/* =================== RIGHT: Scratch Card Area =================== */}
            <div className={styles.cardColumn}>

              {/* Idle State */}
              {gamePhase === 'idle' && (
                <motion.div
                  className={styles.idlePlaceholder}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className={styles.idleIcon}>🎟️</div>
                  <div>Your scratch card will appear here</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,215,0,0.2)' }}>
                    Match 3 symbols to win!
                  </div>
                </motion.div>
              )}

              {/* Active Scratch Card */}
              {(gamePhase === 'scratching' || gamePhase === 'result') && (
                <motion.div
                  className={styles.scratchCardWrapper}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                >
                  {/* Card Header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>⚡ Bitcoin Finder</div>
                    <div className={styles.cardBetBadge}>
                      Bet: {formatBTC(betAmount)}
                    </div>
                  </div>
                  <div className={styles.cardSubtitle}>Scratch & Match — 3 of a Kind Wins</div>
                  <div className={styles.cardDivider} />

                  {/* 3×3 Panel Grid */}
                  <div className={styles.panelGrid}>
                    {panels.map((sym, i) => {
                      const isRevealed = revealed[i];
                      const isMatched  = isRevealed && isPanelMatched(i);

                      return (
                        <div
                          key={i}
                          className={`${styles.panelContainer} ${gamePhase !== 'scratching' || isRevealed ? styles.disabled : ''}`}
                          onClick={() => handleRevealPanel(i)}
                        >
                          <motion.div
                            className={styles.panel}
                            animate={{ rotateY: isRevealed ? 180 : 0 }}
                            transition={{ type: 'spring', damping: 18, stiffness: 180 }}
                            style={{ transformStyle: 'preserve-3d' }}
                          >
                            {/* Silver unscratched face */}
                            <div className={styles.panelFront}>
                              <span className={styles.scratchHint}>🪙</span>
                            </div>

                            {/* Revealed symbol face */}
                            <div className={`${styles.panelBack} ${isMatched ? styles.matched : ''}`}>
                              {sym && (
                                <span className={`${styles.panelEmoji} ${isMatched ? styles.matchedEmoji : ''}`}>
                                  {sym.emoji}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.cardDivider} />
                  <div className={styles.cardFooter}>
                    {gamePhase === 'scratching' && !allRevealed
                      ? `Click panels to scratch • ${revealed.filter(Boolean).length}/9 revealed`
                      : gamePhase === 'scratching' && allRevealed
                      ? 'Evaluating...'
                      : result?.won
                      ? `🎉 Winner! × ${result.multiplier} payout`
                      : 'No match this time — try again!'}
                  </div>
                </motion.div>
              )}

              {/* Result Banner */}
              <AnimatePresence>
                {gamePhase === 'result' && result && (
                  <motion.div
                    className={`${styles.resultBanner} ${result.won ? styles.winBanner : styles.lossBanner}`}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                  >
                    {result.won ? (
                      <>
                        <div className={`${styles.resultTitle} ${styles.winTitle}`}>
                          🏆 WINNER!
                        </div>
                        <div className={styles.resultDetail}>
                          Three <strong style={{ color: '#fff' }}>{result.symbol?.emoji} {result.symbol?.label}</strong> matched!
                        </div>
                        <div className={styles.resultPayout}>
                          +{formatBTC(result.payout)}
                        </div>
                        <div className={styles.resultMultiplier}>
                          {result.multiplier}× multiplier
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`${styles.resultTitle} ${styles.lossTitle}`}>
                          No Match
                        </div>
                        <div className={styles.resultDetail}>
                          No three-of-a-kind found. Better luck next card!
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
