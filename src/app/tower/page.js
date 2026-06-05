'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useTowerEngine } from '@/hooks/useTowerEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaFlag, FaSkull, FaCheck, FaCoins, FaInfoCircle, FaTrophy } from 'react-icons/fa';
import styles from './page.module.css';

export default function TowerPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleGameFinished = useCallback(({ win, payout, multiplier }) => {
    checkAchievements();
  }, [checkAchievements]);

  const game = useTowerEngine(balance, subtractBalance, addBalance, handleGameFinished);

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const isIdle = game.gameState === 'idle';
  const isPlaying = game.gameState === 'playing';
  const isWon = game.gameState === 'won';
  const isLost = game.gameState === 'lost';
  const isFinished = isWon || isLost;

  const handleStart = useCallback(() => {
    setError('');
    const res = game.startGame();
    if (res?.error) {
      setError(res.error);
    }
  }, [game]);

  const handleCashout = useCallback(() => {
    game.cashOut();
  }, [game]);

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
  }, [game, balance, isPlaying]);

  const handleTileClick = useCallback((level, index) => {
    if (!isPlaying || level !== game.currentLevel) return;
    game.clickTile(level, index);
  }, [isPlaying, game]);

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
                <p className={styles.subtitle}>Climb the Bitcoin tower! Find safe tiles on each row to multiply your winnings. Cash out anytime before hitting a trap.</p>
              </div>

              {/* Bet amount */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount</div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={betInput}
                    onChange={handleBetInput}
                    disabled={isPlaying}
                  />
                  <div className={styles.quickBetGrid}>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying}>½</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying}>2x</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying}>Min</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying}>Max</button>
                  </div>
                </div>
              </div>

              {/* Difficulty Select */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Difficulty Level</div>
                <div className={styles.difficultyGrid}>
                  {Object.keys(game.DIFFICULTY_CONFIGS).map((diff) => (
                    <button
                      key={diff}
                      className={`${styles.diffBtn} ${game.difficulty === diff ? `${styles.diffBtnActive} ${styles['diff_' + diff]}` : ''}`}
                      onClick={() => {
                        setError('');
                        game.setDifficulty(diff);
                      }}
                      disabled={isPlaying}
                    >
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

              {/* Action Buttons */}
              <div className={styles.actionSection}>
                {!isPlaying ? (
                  <motion.button
                    className={styles.betBtn}
                    onClick={handleStart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🏰 START CLIMB
                  </motion.button>
                ) : (
                  <div className={styles.activeActions}>
                    <motion.button
                      className={`${styles.betBtn} ${styles.cashoutBtn}`}
                      onClick={handleCashout}
                      disabled={game.currentLevel === 0}
                      whileHover={game.currentLevel > 0 ? { scale: 1.02 } : {}}
                      whileTap={game.currentLevel > 0 ? { scale: 0.98 } : {}}
                      animate={game.currentLevel > 0 ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)'] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      💰 CASHOUT (+{formatBTC(game.currentPayout)})
                    </motion.button>

                    <button className={styles.resetBtn} onClick={game.resetGame}>
                      Abort Round
                    </button>
                  </div>
                )}
              </div>

              {/* Rules description */}
              <div className={styles.rulesCard}>
                <div className={styles.rulesTitle}>
                  <FaInfoCircle /> Rules
                </div>
                <ul className={styles.rulesList}>
                  <li>Start climbing from the bottom row (Level 1).</li>
                  <li>Click a tile to reveal it. If safe, you climb up!</li>
                  <li>Each level cleared compounds your multiplier.</li>
                  <li>Hitting a trap loses your entire bet.</li>
                  <li>You can cash out on any level before you click.</li>
                </ul>
              </div>
            </div>

            {/* Right Tower climb column */}
            <div className={styles.towerColumn}>
              {/* Climbing status bar */}
              <div className={styles.statusBar}>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Current Multiplier</span>
                  <span className={styles.statusVal} style={{ color: '#ffd700' }}>
                    {game.currentMultiplier.toFixed(2)}x
                  </span>
                </div>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Next Step</span>
                  <span className={styles.statusVal} style={{ color: '#00d4ff' }}>
                    {game.nextMultiplier.toFixed(2)}x
                  </span>
                </div>
                <div className={styles.statusBox}>
                  <span className={styles.statusLabel}>Profit on Next</span>
                  <span className={styles.statusVal} style={{ color: '#00ff88' }}>
                    +{formatBTC(Math.round((game.betAmount * game.nextMultiplier - game.betAmount) * 100) / 100)}
                  </span>
                </div>
              </div>

              {/* The Tower Grid */}
              <div className={styles.towerGridContainer}>
                {/* Visual results overlays */}
                <AnimatePresence>
                  {isFinished && game.lastResult && (
                    <motion.div
                      className={styles.resultOverlay}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                    >
                      <div className={`${styles.resultCard} ${isWon ? styles.cardWin : styles.cardLoss}`}>
                        <div className={styles.resultIcon}>
                          {isWon ? <FaCrown className={styles.crownGlow} /> : <FaSkull className={styles.skullGlow} />}
                        </div>
                        <span className={styles.resultTitleText}>
                          {isWon ? 'Tower Conquered!' : 'Tower Busted!'}
                        </span>
                        {isWon ? (
                          <span className={styles.resultDetails}>
                            Cleared {game.currentLevel} levels for {game.lastResult.multiplier.toFixed(2)}x (+{formatBTC(game.lastResult.payout)})
                          </span>
                        ) : (
                          <span className={styles.resultDetails}>
                            Busted on level {game.currentLevel + 1}
                          </span>
                        )}
                        <button className={styles.playAgainBtn} onClick={game.resetGame}>
                          Play Again
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Render Levels Bottom to Top */}
                <div className={styles.towerAscender}>
                  {Array.from({ length: game.totalLevels }).map((_, idx) => {
                    const levelIndex = game.totalLevels - 1 - idx; // 8 down to 0
                    const isActive = levelIndex === game.currentLevel && isPlaying;
                    const isPassed = levelIndex < game.currentLevel;
                    const isFuture = levelIndex > game.currentLevel && !isFinished;
                    const rowMultiplier = game.multiplierLadder[levelIndex].multiplier;

                    return (
                      <div
                        key={levelIndex}
                        className={`${styles.towerRow} ${isActive ? styles.rowActive : ''} ${isPassed ? styles.rowPassed : ''} ${isFuture ? styles.rowFuture : ''}`}
                      >
                        {/* Level badge label */}
                        <div className={styles.levelLabel}>
                          <span className={styles.levelNum}>Lvl {levelIndex + 1}</span>
                          <span className={styles.levelMultiplier}>{rowMultiplier.toFixed(2)}x</span>
                        </div>

                        {/* Tiles Row */}
                        <div className={styles.tilesContainer}>
                          {Array.from({ length: game.config.tilesPerRow }).map((_, tileIdx) => {
                            const isTileRevealed = game.revealed[`${levelIndex}-${tileIdx}`];
                            const isSafe = game.grid[levelIndex]?.[tileIdx];
                            const isSelected = game.towerHistory.some(
                              (hist) => hist.level === levelIndex && hist.index === tileIdx
                            );

                            return (
                              <button
                                key={tileIdx}
                                className={`${styles.tile} ${isActive ? styles.tileActive : ''} ${
                                  isTileRevealed
                                    ? isSafe
                                      ? styles.tileSafe
                                      : styles.tileTrap
                                    : ''
                                } ${isSelected ? styles.tileSelected : ''}`}
                                onClick={() => handleTileClick(levelIndex, tileIdx)}
                                disabled={!isActive}
                              >
                                {isTileRevealed ? (
                                  isSafe ? (
                                    <FaCheck className={styles.checkIcon} />
                                  ) : (
                                    <FaSkull className={styles.trapIcon} />
                                  )
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
