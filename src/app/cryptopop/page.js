'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useCryptoPopEngine } from '@/hooks/useCryptoPopEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDice, FaBolt, FaRegDotCircle, FaInfoCircle, FaCoins } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

// Signature coins to distribute across grid cells for visual variety
const COIN_TYPES = [
  { name: 'BTC', symbol: '₿', color: 'linear-gradient(135deg, #f7931a, #b56200)', border: '#f7931a' },
  { name: 'ETH', symbol: 'Ξ', color: 'linear-gradient(135deg, #627eea, #3c51b5)', border: '#627eea' },
  { name: 'SOL', symbol: '◎', color: 'linear-gradient(135deg, #14f195, #9945ff)', border: '#9945ff' },
  { name: 'DOGE', symbol: 'Ð', color: 'linear-gradient(135deg, #c2a633, #8c730e)', border: '#c2a633' }
];

export default function CryptoPopPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGameFinished = useCallback((result) => {
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Token Pop',
      bet: result.bet,
      multiplier: result.multiplier > 0 ? `${parseFloat(result.multiplier).toFixed(2)}x` : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [addBet, profile, user]);

  const game = useCryptoPopEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet inputs from hook and local state
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const handleStart = useCallback(() => {
    game.startGame();
  }, [game]);

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
    if (!isNaN(parsed)) {
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

  const handleGridToggle = useCallback((size) => {
    if (game.gameState === 'playing') return;
    game.setGridSize(size);
  }, [game]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Token Pop...</p>
      </div>
    );
  }

  const isPlaying = game.gameState === 'playing';
  const isIdle = game.gameState === 'idle';
  const isBurst = game.gameState === 'burst';
  const isCashout = game.gameState === 'cashout';

  // Derived grid values
  const columnsClass = {
    4: styles.grid2x2,
    9: styles.grid3x3,
    16: styles.grid4x4
  }[game.gridSize];

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.cryptopopPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🪙 Token Pop</h1>
            <p className={styles.pageSubtitle}>
              Pop tokens to multiply wagers. Cash out before you hit a scam token!
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
            {/* ─── Left Side: Bet & Grid Config Panels ───────────────────────── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                {/* Bet Input */}
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
                      disabled={isPlaying}
                      placeholder="0.00"
                    />
                    <span className={styles.inputUnit}>{activeSymbol}</span>
                  </div>
                  <div className={styles.quickBets}>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying}>½</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying}>2×</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying}>Min</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying}>Max</button>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Grid Size Selectors */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaRegDotCircle className={styles.fieldIcon} />
                    Grid Size & Traps
                  </label>
                  <div className={styles.gridSelector}>
                    {[
                      { size: 4, traps: 1, label: '2x2' },
                      { size: 9, traps: 2, label: '3x3' },
                      { size: 16, traps: 4, label: '4x4' }
                    ].map(opt => (
                      <button
                        key={opt.size}
                        className={`${styles.gridOptBtn} ${game.gridSize === opt.size ? styles.gridOptActive : ''}`}
                        onClick={() => handleGridToggle(opt.size)}
                        disabled={isPlaying}
                      >
                        <div className={styles.gridOptSize}>{opt.label}</div>
                        <div className={styles.gridOptTraps}>{opt.traps} Trap{opt.traps > 1 ? 's' : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Payout Stats Info */}
                <div className={styles.payoutCard}>
                  <div className={styles.payoutRow}>
                    <span>Current Multiplier</span>
                    <strong className={isPlaying ? styles.glowGreen : ''}>
                      {game.currentMultiplier.toFixed(2)}x
                    </strong>
                  </div>
                  <div className={styles.payoutRow}>
                    <span>Estimated Payout</span>
                    <strong>{formatBTC(game.betAmount * game.currentMultiplier)}</strong>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Primary Game Triggers */}
                <div className={styles.actionBlock} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!isPlaying ? (
                    <motion.button
                      className={styles.playButton}
                      onClick={handleStart}
                      disabled={balance <= 0 || game.betAmount > balance}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FaBolt /> START GAME
                    </motion.button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                      <motion.button
                        className={styles.cashoutButton}
                        onClick={handleCashOut}
                        disabled={game.currentMultiplier <= 1.0}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        👑 CASH OUT ({game.currentMultiplier.toFixed(2)}x)
                      </motion.button>
                      
                      <motion.button
                        className={styles.randomBtn}
                        onClick={game.pickRandomToken}
                        disabled={game.gameState !== 'playing'}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        🎯 RANDOM PICK
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* ─── Right Side: Token Grid Layout ───────────────────────────── */}
            <div className={styles.displayPanel}>
              <div className={`${styles.gridCard} ${isBurst ? styles.cardBurst : ''} ${isCashout ? styles.cardCashout : ''}`}>
                
                {/* Result Message Banner overlays */}
                <AnimatePresence>
                  {isBurst && (
                    <motion.div
                      className={styles.outcomeBanner}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      💥 RUGGED! You hit a scam token.
                    </motion.div>
                  )}
                  {isCashout && (
                    <motion.div
                      className={styles.outcomeBannerWin}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      🏆 CASHED OUT! Won {game.currentMultiplier.toFixed(2)}x (+{formatBTC(game.betAmount * game.currentMultiplier)})
                    </motion.div>
                  )}
                  {isIdle && (
                    <div className={styles.gameIdleHint}>
                      Place your bet and start the game!
                    </div>
                  )}
                </AnimatePresence>

                {/* Active/Rendering Tokens Grid */}
                {(isPlaying || isBurst || isCashout) && (
                  <div className={`${styles.balloonsGrid} ${columnsClass}`}>
                    {game.balloons.map((b, idx) => {
                      const coinType = COIN_TYPES[idx % COIN_TYPES.length];
                      
                      return (
                        <div key={b.id} className={styles.coinWrapper}>
                          {/* unpopped states */}
                          {b.status === 'unpopped' && (
                            <motion.button
                              className={styles.coinBtn}
                              onClick={() => game.popBalloon(b.id)}
                              disabled={!isPlaying}
                              style={{ 
                                background: coinType.color,
                                borderColor: coinType.border,
                                boxShadow: `0 0 15px ${coinType.border}40, inset -3px -3px 8px rgba(0,0,0,0.4), inset 3px 3px 8px rgba(255,255,255,0.4)`
                              }}
                              whileHover={{ scale: 1.15, rotateY: 180 }}
                              animate={{ y: [0, -3, 0] }}
                              transition={{ duration: 2.5 + (idx % 2), repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <div className={styles.coinInnerCircle}>
                                <span className={styles.coinLogo}>{coinType.symbol}</span>
                              </div>
                            </motion.button>
                          )}

                          {/* popped safely states */}
                          {b.status === 'popped' && (
                            <motion.div
                              className={styles.poppedBadge}
                              initial={{ scale: 0, rotate: -8 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                              <div className={styles.badgeLabel}>{coinType.name}</div>
                              <div className={styles.badgeMult}>+{b.multiplier.toFixed(2)}x</div>
                            </motion.div>
                          )}

                          {/* burst / trap trigger balloon */}
                          {b.status === 'burst' && (
                            <motion.div
                              className={styles.burstBadge}
                              initial={{ scale: 0, rotate: 25 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 350 }}
                            >
                              🚨 SCAM
                            </motion.div>
                          )}

                          {/* unrevealed safe / trap end results */}
                          {b.status === 'unrevealed' && (
                            <div className={`${styles.revealedOutcome} ${b.isDead ? styles.revealedDead : styles.revealedSafe}`}>
                              {b.isDead ? '💣 RUG' : `+${b.multiplier.toFixed(2)}x`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* History Pills */}
              {game.lastResults.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyTitle}>Recent Games</div>
                  <div className={styles.historyPills}>
                    {game.lastResults.map((r, i) => (
                      <motion.div
                        key={i}
                        className={`${styles.historyPill} ${r.won ? styles.pillWin : styles.pillLoss}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        title={`Multiplier: ${r.multiplier.toFixed(2)}x | Grid: ${r.gridSize}`}
                      >
                        {r.multiplier.toFixed(1)}x
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rules and Explanation card */}
              <div className={styles.howToPlay}>
                <h3 className={styles.howTitle}>Rules & Multipliers</h3>
                <div className={styles.howBody}>
                  <FaInfoCircle className={styles.howIcon} />
                  <p>
                    Choose your grid size and traps configuration:
                    <br />
                    • <strong>2x2 (4 tokens)</strong>: 1 trap. Multiplier: Provably fair random (1.10x - 2.50x) per pop. Higher wagers yield higher multipliers!
                    <br />
                    • <strong>3x3 (9 tokens)</strong>: 2 traps. Multiplier: Provably fair random (1.05x - 2.00x) per pop.
                    <br />
                    • <strong>4x4 (16 tokens)</strong>: 4 traps. Multiplier: Provably fair random (1.05x - 2.50x) per pop.
                    <br />
                    Pop coins. Avoid the RUG/SCAM. Safe pops compound your multiplier wagers. Cash out at any time!
                  </p>
                </div>
              </div>

              {/* Hashed Auditing panel */}
              <VerificationPanel gameType="cryptopop" />

              {/* Live Bets Ticker */}
              <LiveBetsFeed />
            </div>
          </div>
        </div>
      </div>

      {/* Achievement unlocked toast */}
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
