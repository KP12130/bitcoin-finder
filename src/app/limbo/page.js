'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useLimboEngine } from '@/hooks/useLimboEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBolt, FaDice, FaChartLine } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

export default function LimboPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const game = useLimboEngine(balance, subtractBalance, addBalance);

  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();

  // Local targetInputVal state to allow typing decimal values (e.g., '2.') without snapping back.
  const [targetInputVal, setTargetInputVal] = useState('2.00');

  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  // Sync the local input field value whenever the underlying engine target changes (e.g. from quick buttons)
  useEffect(() => {
    if (game.targetMultiplier) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetInputVal(game.targetMultiplier.toString());
    }
  }, [game.targetMultiplier]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleBet = useCallback(() => {
    game.playRound();
    setTimeout(() => checkAchievements(), 800);
  }, [game, checkAchievements]);

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

  const handleTargetInput = useCallback((e) => {
    const rawString = e.target.value;
    setTargetInputVal(rawString);
    const val = parseFloat(rawString);
    if (!isNaN(val)) {
      game.setTargetMultiplier(Math.min(1000000, Math.max(1.01, val)));
    }
  }, [game]);

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

  const handleQuickTarget = useCallback((value) => {
    game.setTargetMultiplier(value);
  }, [game]);

  const handleBailout = useCallback(() => {
    claimBailout();
  }, [claimBailout]);

  // ─── Display Helpers ───────────────────────────────────────────────────────
  const formatMultiplier = (val) => {
    if (val === undefined || val === null) return '1.00';
    if (val >= 1000) return val.toFixed(1);
    return val.toFixed(2);
  };

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Limbo...</p>
      </div>
    );
  }

  const isRolling = game.gameState === 'rolling';
  const isResult = game.gameState === 'result';
  const isIdle = game.gameState === 'idle';
  const canBet = !isRolling && balance > 0 && game.betAmount > 0 && game.betAmount <= balance;

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.limboPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🎯 Limbo</h1>
            <p className={styles.pageSubtitle}>
              Set your target multiplier — beat it and win big!
            </p>
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
                <p>📉 You&apos;re broke! Claim a bailout to keep playing.</p>
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
                      disabled={isRolling}
                      placeholder="0.00"
                    />
                    <span className={styles.inputUnit}>{activeSymbol}</span>
                  </div>
                  <div className={styles.quickBets}>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('half')} disabled={isRolling}>½</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('double')} disabled={isRolling}>2×</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('min')} disabled={isRolling}>Min</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('max')} disabled={isRolling}>Max</button>
                  </div>
                </div>

                {/* Divider */}
                <div className={styles.divider} />

                {/* Target Multiplier */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaChartLine className={styles.fieldIcon} />
                    Target Multiplier
                  </label>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      className={styles.targetInput}
                      value={targetInputVal}
                      onChange={handleTargetInput}
                      disabled={isRolling}
                    />
                    <span className={styles.inputUnit}>×</span>
                  </div>
                  <div className={styles.quickTargets}>
                    {[1.5, 2, 3, 5, 10, 100].map(val => (
                      <button
                        key={val}
                        className={`${styles.quickTargetBtn} ${game.targetMultiplier === val ? styles.quickTargetActive : ''}`}
                        onClick={() => handleQuickTarget(val)}
                        disabled={isRolling}
                      >
                        {val}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className={styles.divider} />

                {/* Stats Display */}
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Win Chance</span>
                    <span className={styles.statValue} style={{ color: 'var(--color-blue)' }}>
                      {game.winChance.toFixed(2)}%
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Profit on Win</span>
                    <span className={styles.statValue} style={{ color: 'var(--color-green)' }}>
                      +{formatBTC(game.profitOnWin)}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Multiplier</span>
                    <span className={styles.statValue} style={{ color: 'var(--color-gold)' }}>
                      {game.targetMultiplier.toFixed(2)}×
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Payout</span>
                    <span className={styles.statValue} style={{ color: 'var(--color-purple)' }}>
                      {formatBTC(game.betAmount * game.targetMultiplier)}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className={styles.divider} />

                {/* BET Button */}
                <motion.button
                  className={`${styles.betButton} ${isRolling ? styles.betButtonRolling : ''}`}
                  onClick={handleBet}
                  disabled={!canBet}
                  whileHover={canBet ? { scale: 1.02 } : {}}
                  whileTap={canBet ? { scale: 0.98 } : {}}
                >
                  {isRolling ? (
                    <span className={styles.betButtonContent}>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}
                        style={{ display: 'inline-block' }}
                      >
                        ⚡
                      </motion.span>
                      ROLLING...
                    </span>
                  ) : (
                    <span className={styles.betButtonContent}>
                      <FaBolt /> BET
                    </span>
                  )}
                </motion.button>
              </div>
            </div>

            {/* ─── Right Column: Game Display ────────────────────────────── */}
            <div className={styles.displayPanel}>
              {/* Giant Multiplier Display */}
              <div className={styles.resultCard}>
                {/* Background glow effect */}
                <div className={`${styles.resultGlow} ${isResult && game.won ? styles.glowWin : ''} ${isResult && !game.won ? styles.glowLoss : ''}`} />

                {/* Target indicator */}
                <div className={styles.targetIndicator}>
                  <span className={styles.targetLabel}>TARGET</span>
                  <span className={styles.targetValue}>{game.targetMultiplier.toFixed(2)}×</span>
                </div>

                {/* Main result display */}
                <div className={styles.resultArea}>
                  <div className={`${styles.persistentMultiplier} ${
                    isResult ? (game.won ? styles.multiplierWin : styles.multiplierLoss) :
                    isRolling ? styles.multiplierRolling :
                    styles.multiplierIdle
                  }`}>
                    {formatMultiplier(isRolling ? game.rollingDisplay : (game.resultMultiplier !== null ? game.resultMultiplier : (game.lastResults[0]?.multiplier || 1.00)))}×
                  </div>

                  <div className={styles.resultOutcome}>
                    <AnimatePresence mode="wait">
                      {isRolling && (
                        <motion.div
                          key="rolling-label"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className={styles.rollingText}
                        >
                          Climbing...
                        </motion.div>
                      )}
                      {isResult && (
                        <motion.div
                          key={`result-label-${game.resultMultiplier}`}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          {game.won ? (
                            <span className={styles.winText}>
                              🏆 Won {formatBTC(game.payout)}
                            </span>
                          ) : (
                            <span className={styles.lossText}>
                              💥 Busted (Below target)
                            </span>
                          )}
                        </motion.div>
                      )}
                      {isIdle && (
                        <div className={styles.idleHint}>
                          Place a bet to play
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Comparison indicator */}
                {isResult && game.resultMultiplier !== null && (
                  <motion.div
                    className={styles.comparisonBar}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className={styles.comparisonItem}>
                      <span className={styles.compLabel}>Result</span>
                      <span className={styles.compValue} style={{ color: game.won ? '#00ff88' : '#ff4757' }}>
                        {formatMultiplier(game.resultMultiplier)}×
                      </span>
                    </div>
                    <div className={styles.compVs}>{game.won ? '≥' : '<'}</div>
                    <div className={styles.comparisonItem}>
                      <span className={styles.compLabel}>Target</span>
                      <span className={styles.compValue} style={{ color: 'var(--color-gold)' }}>
                        {game.targetMultiplier.toFixed(2)}×
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* History */}
              {game.lastResults.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyLabel}>Recent Results</div>
                  <div className={styles.historyPills}>
                    {game.lastResults.map((r, i) => (
                      <motion.div
                        key={i}
                        className={`${styles.pill} ${r.won ? styles.pillWin : styles.pillLoss} ${r.multiplier >= 10 ? styles.pillGold : ''}`}
                        initial={{ opacity: 0, scale: 0.5, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        title={`Result: ${formatMultiplier(r.multiplier)}× | Target: ${r.target.toFixed(2)}×`}
                      >
                        {formatMultiplier(r.multiplier)}×
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* How to Play */}
              <div className={styles.howToPlay}>
                <h3 className={styles.howTitle}>How to Play</h3>
                <div className={styles.steps}>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>1</span>
                    <p>Set your <strong>bet amount</strong> in dollars ($)</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>2</span>
                    <p>Choose a <strong>target multiplier</strong> — higher = riskier but bigger payout</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>3</span>
                    <p>Hit <strong>BET</strong> — a random multiplier is generated</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>4</span>
                    <p>If the result ≥ your target, you <strong>win</strong> your target payout!</p>
                  </div>
                </div>
              </div>

              {/* Verification Panel */}
              <VerificationPanel gameType="limbo" />
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Toast */}
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
