'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useSnakeRollEngine, getSnakeBoardConfig } from '@/hooks/useSnakeRollEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDice, FaCoins, FaInfoCircle, FaSyncAlt } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

// Clockwise 4x4 Perimeter Loop Grid Layout
const GRID_CELLS = [
  { tileIndex: 0, row: 1, col: 1 },
  { tileIndex: 1, row: 1, col: 2 },
  { tileIndex: 2, row: 1, col: 3 },
  { tileIndex: 3, row: 1, col: 4 },
  { tileIndex: 11, row: 2, col: 1 },
  { isCenter: true, row: 2, col: 2, colSpan: 2, rowSpan: 2 },
  { tileIndex: 4, row: 2, col: 4 },
  { tileIndex: 10, row: 3, col: 1 },
  { tileIndex: 5, row: 3, col: 4 },
  { tileIndex: 9, row: 4, col: 1 },
  { tileIndex: 8, row: 4, col: 2 },
  { tileIndex: 7, row: 4, col: 3 },
  { tileIndex: 6, row: 4, col: 4 },
];

const SnakeShieldSVG = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" className={styles.snakeShieldSvg}>
    {/* Shield Outer Border */}
    <path 
      d="M32 6 C18 12 10 20 10 32 C10 44 20 54 32 58 C44 54 54 44 54 32 C54 20 46 12 32 6 Z" 
      fill="rgba(247, 147, 26, 0.03)" 
      stroke="rgba(255, 255, 255, 0.08)" 
      strokeWidth="2.5"
    />
    {/* Snake head inside */}
    <path 
      d="M32 18 C24 18 20 22 20 28 C20 34 24 37 32 40 C40 37 44 34 44 28 C44 22 40 18 32 18 Z" 
      fill="rgba(255, 255, 255, 0.05)"
      stroke="rgba(255, 255, 255, 0.15)"
      strokeWidth="2"
    />
    {/* Eyes */}
    <circle cx="27" cy="26" r="2.5" fill="rgba(255, 255, 255, 0.3)" />
    <circle cx="37" cy="26" r="2.5" fill="rgba(255, 255, 255, 0.3)" />
    {/* Tongue */}
    <path 
      d="M32 37 L32 44 M32 44 L29 47 M32 44 L35 47" 
      stroke="rgba(255, 71, 87, 0.5)" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function SnakeRollPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleGameFinished = useCallback((result) => {
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Snake Roll',
      bet: result.bet,
      multiplier: result.multiplier > 0 ? `${parseFloat(result.multiplier).toFixed(2)}x` : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [addBet, profile, user]);

  const game = useSnakeRollEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const isPlaying = game.gameState === 'playing';
  const isRolling = game.gameState === 'rolling';
  const isIdle = game.gameState === 'idle';
  const isLost = game.gameState === 'lost';
  const isWon = game.gameState === 'won';

  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet input
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.betAmount, currency]);

  const handleStart = useCallback(() => {
    game.startGame();
  }, [game]);

  const handleRoll = useCallback(() => {
    game.rollDice();
    setTimeout(() => checkAchievements(), 1500);
  }, [game, checkAchievements]);

  const handleCashOut = useCallback(() => {
    game.cashOut();
    setTimeout(() => checkAchievements(), 800);
  }, [game, checkAchievements]);

  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;

    setBetInput(cleanValue);

    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed) && parsed > 0) {
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

  const handleBailout = useCallback(() => {
    claimBailout();
  }, [claimBailout]);

  const renderDiceDots = (value) => {
    const dotPositions = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };
    const activeDots = dotPositions[value] || [4];
    return (
      <div className={styles.diceDotsGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.diceDotCell}>
            {activeDots.includes(i) && <div className={styles.diceDot} />}
          </div>
        ))}
      </div>
    );
  };

  const [localDiceValues, setLocalDiceValues] = useState([1, 1]);

  useEffect(() => {
    if (isRolling) {
      let timeoutId;
      let currentDelay = 50;

      const rollStep = () => {
        setLocalDiceValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
        currentDelay += 55;
        if (currentDelay < 300) {
          timeoutId = setTimeout(rollStep, currentDelay);
        }
      };

      timeoutId = setTimeout(rollStep, currentDelay);
      return () => clearTimeout(timeoutId);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalDiceValues(game.diceValues);
    }
  }, [isRolling, game.diceValues]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Snake Roll...</p>
      </div>
    );
  }

  const boardConfig = getSnakeBoardConfig(game.difficulty);

  // Active difficulty indicator display text
  const getDiffLabel = (diff) => {
    return {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      expert: 'Expert',
      master: 'Master'
    }[diff] || 'Medium';
  };

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.cryptopopPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className={styles.pageTitle}>🐍 SNAKE ROLL</h1>
              <div className={styles.liveMeta}>
                <span className={styles.onlineBadge}>● Online: 4120</span>
                <span className={styles.liveBetsLink}>Live tracking</span>
              </div>
            </div>
            <div className={styles.headerRightActions}>
              <button className={styles.helpBtn}><FaInfoCircle /> Game Manual</button>
            </div>
          </div>

          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && isIdle && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 Balance exhausted! Claim a free bailout to continue.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Master Layout */}
          <div className={styles.gameLayout}>
            {/* ─── Left Side: Bet & Trigger Panels ───────────────────────── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                
                {/* Manual / Auto Mode tabs */}
                <div className={styles.tabRow}>
                  <button 
                    className={`${styles.tabBtn} ${game.mode === 'manual' ? styles.tabActive : ''}`}
                    onClick={() => game.setMode && game.setMode('manual')}
                    disabled={isPlaying || isRolling}
                  >
                    Manual
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${game.mode === 'auto' ? styles.tabActive : ''}`}
                    onClick={() => game.setMode && game.setMode('auto')}
                    disabled={isPlaying || isRolling}
                  >
                    Auto
                  </button>
                </div>

                {/* Bet Amount Row */}
                <div className={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.unifiedLabelHeader}>
                      <span className={styles.goldBitcoinIcon}>₿</span> BET AMOUNT
                    </div>
                    <span className={styles.usdValueLabel}>Balance: <strong style={{ color: '#ffd666' }}>{formatBTC(balance)}</strong></span>
                  </div>
                  <div className={styles.unifiedInputArea}>
                    <span className={styles.goldDollarIcon}>$</span>
                    <input
                      type="text"
                      className={styles.monospaceTextField}
                      value={betInput}
                      onChange={handleBetInput}
                      disabled={isPlaying || isRolling}
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.unifiedQuickBetButtons}>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying || isRolling}>½</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying || isRolling}>2x</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying || isRolling}>Min</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying || isRolling}>Max</button>
                  </div>
                </div>

                {/* Difficulty Section */}
                <div className={styles.fieldGroup}>
                  <label className={styles.unifiedLabelHeader}>DIFFICULTY</label>
                  <div className={styles.customSelectBox}>
                    <select
                      className={styles.diffDropdownSelect}
                      value={game.difficulty}
                      onChange={(e) => game.setDifficulty(e.target.value)}
                      disabled={isPlaying || isRolling}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="expert">Expert</option>
                      <option value="master">Master</option>
                    </select>
                    <span className={styles.dropdownCarat}>▼</span>
                  </div>
                </div>

                {/* Bet Action Buttons */}
                <div className={styles.actionBlock} style={{ marginTop: '0.8rem' }}>
                  {isIdle || isLost || isWon ? (
                    <button
                      className={styles.dashGoBtnPrimaryBlue}
                      onClick={handleStart}
                      disabled={balance <= 0 || game.betAmount > balance}
                    >
                      Bet
                    </button>
                  ) : (
                    <button
                      className={styles.dashGoBtnPrimaryBlue}
                      onClick={handleCashOut}
                      disabled={isRolling}
                    >
                      Cashout
                    </button>
                  )}

                  <button
                    className={`${styles.dashGoBtnRoll} ${(!isPlaying || isRolling) ? styles.rollBtnDisabled : ''}`}
                    onClick={handleRoll}
                    disabled={!isPlaying || isRolling}
                  >
                    Roll {isPlaying ? `(${game.rollHistory.length}/5)` : ''}
                  </button>
                </div>

                {/* Bottom Read-Only Total Profit Box */}
                <div className={styles.fieldGroup} style={{ marginTop: '0.8rem' }}>
                  <label className={styles.unifiedLabelHeader}>Total Profit ({game.currentMultiplier.toFixed(2)}x)</label>
                  <div className={styles.unifiedInputAreaReadOnly}>
                    <span className={styles.profitAmtTextMonospace}>
                      {formatCryptoAmount(convertUsdToActive(game.betAmount * game.currentMultiplier), currency)}
                    </span>
                    <span className={styles.goldDollarIcon}>{activeSymbol}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* ─── Right Side: Board layout & Hollow Dice Loop Grid ─────────────── */}
            <div className={styles.displayPanel}>
              <div className={`${styles.gridCard} ${isLost ? styles.cardBurst : ''} ${isWon ? styles.cardCashout : ''}`}>
                
                {/* 4x4 Hollow Perimeter Loop Grid */}
                <div className={styles.perimeterLoopGrid}>
                  {GRID_CELLS.map((cell, cIdx) => {
                    if (cell.isCenter) {
                      // Center dice arena! Contains dice values and the multiplier status
                      return (
                        <div 
                          key={cIdx} 
                          className={styles.centerDiceArena}
                          style={{
                            gridRow: `span ${cell.rowSpan}`,
                            gridColumn: `span ${cell.colSpan}`
                          }}
                        >
                          <div className={styles.diceContainer}>
                            <motion.div 
                              className={`${styles.diceBlock} ${isRolling ? styles.diceRollingLeft : ''}`}
                              animate={isRolling ? { rotate: [0, 360, 720] } : {}}
                              transition={{ duration: 0.8 }}
                            >
                              {renderDiceDots(localDiceValues[0])}
                            </motion.div>

                            <motion.div 
                              className={`${styles.diceBlock} ${isRolling ? styles.diceRollingRight : ''}`}
                              animate={isRolling ? { rotate: [0, -360, -720] } : {}}
                              transition={{ duration: 0.8 }}
                            >
                              {renderDiceDots(localDiceValues[1])}
                            </motion.div>
                          </div>

                          <div className={styles.centerMultiplierIndicator}>
                            <div className={styles.indicatorValue}>
                              {game.currentMultiplier.toFixed(2)}x
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const tileIdx = cell.tileIndex;
                    const tile = boardConfig[tileIdx];
                    const isPlayerHere = game.currentTile === tileIdx;
                    const isTrap = tile.type === 'trap';

                    return (
                      <div 
                        key={cIdx} 
                        className={`
                          ${styles.tileCell} 
                          ${isPlayerHere ? styles.tileCellPlayer : ''} 
                        `}
                        style={{
                          gridRow: cell.row,
                          gridColumn: cell.col
                        }}
                      >
                        {tileIdx === 0 ? (
                          <div className={styles.startPlayIcon}>▶</div>
                        ) : isTrap ? (
                          <div className={styles.snakeShieldWrapper}>
                            <SnakeShieldSVG />
                          </div>
                        ) : (
                          <div className={styles.tileValBadge}>{tile.label}</div>
                        )}


                        {/* Exploded skull token on trap landing */}
                        {isPlayerHere && isLost && isTrap && (
                          <motion.div
                            className={styles.deadToken}
                            initial={{ scale: 0, rotate: 180 }}
                            animate={{ scale: 1, rotate: 0 }}
                          >
                            💀
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Pagination Dots */}
                <div className={styles.paginationDotsContainer}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`${styles.paginationDot} ${i === ['easy', 'medium', 'hard', 'expert', 'master'].indexOf(game.difficulty) ? styles.paginationDotActive : ''}`} 
                    />
                  ))}
                </div>

              </div>

              {/* History Rolls section */}
              {game.rollHistory.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyTitle}>Dice Rolls</div>
                  <div className={styles.historyPills}>
                    {game.rollHistory.map((r, i) => (
                      <div
                        key={i}
                        className={styles.historyPill}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        🎲 {r.d1} + {r.d2} = {r.roll} → Tile {r.landedTile} ({r.nextMult.toFixed(2)}x)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification & Seeds panel */}
              <VerificationPanel gameType="snakeroll" />

              {/* Live wagers Feed */}
              <LiveBetsFeed />
            </div>

          </div>
        </div>
      </div>

      {/* Achievements notifications */}
      <AnimatePresence>
        {newlyUnlocked && (
          <motion.div
            className={styles.achievementToast}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            onClick={dismissNotification}
          >
            <span className={styles.achievementIcon}>{newlyUnlocked.icon}</span>
            <div>
              <div className={styles.achievementLabel}>Achievement Unlocked!</div>
              <div className={styles.achievementName}>{newlyUnlocked.name}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
