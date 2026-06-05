'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import DiceSlider from '@/components/DiceSlider/DiceSlider';
import DiceControls from '@/components/DiceControls/DiceControls';
import { useBalance } from '@/hooks/useBalance';
import { useDiceEngine } from '@/hooks/useDiceEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { formatBTC } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function DicePage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const game = useDiceEngine(balance, subtractBalance, addBalance);

  const handleRoll = useCallback(() => {
    game.roll();
    setTimeout(() => checkAchievements(), 800);
  }, [game, checkAchievements]);

  const handleStartAuto = useCallback(() => {
    game.startAutoBet();
  }, [game]);

  const handleStopAuto = useCallback(() => {
    game.stopAutoBet();
  }, [game]);

  const handleBailout = useCallback(() => {
    claimBailout();
  }, [claimBailout]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Bitcoin Dice...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.dicePage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🎲 Bitcoin Dice</h1>
            <p className={styles.pageSubtitle}>
              Predict Over or Under — roll your dollars to glory!
            </p>
          </div>

          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && !game.autoActive && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 You&apos;re broke! Claim a bailout to keep rolling.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim {formatBTC(10)} Bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Layout */}
          <div className={styles.gameLayout}>
            {/* Left: Controls */}
            <div className={styles.controlsPanel}>
              <DiceControls
                phase={game.phase}
                bet={game.bet}
                setBet={game.setBet}
                balance={balance}
                winChance={game.winChance}
                multiplier={game.multiplier}
                profitOnWin={game.profitOnWin}
                rollResult={game.rollResult}
                won={game.won}
                payout={game.payout}
                target={game.target}
                setTarget={game.setTarget}
                isUnder={game.isUnder}
                autoActive={game.autoActive}
                autoRollsTotal={game.autoRollsTotal}
                setAutoRollsTotal={game.setAutoRollsTotal}
                autoRollsLeft={game.autoRollsLeft}
                onWinMode={game.onWinMode}
                setOnWinMode={game.setOnWinMode}
                onWinPct={game.onWinPct}
                setOnWinPct={game.setOnWinPct}
                onLossMode={game.onLossMode}
                setOnLossMode={game.setOnLossMode}
                onLossPct={game.onLossPct}
                setOnLossPct={game.setOnLossPct}
                stopOnProfit={game.stopOnProfit}
                setStopOnProfit={game.setStopOnProfit}
                stopOnLoss={game.stopOnLoss}
                setStopOnLoss={game.setStopOnLoss}
                onRoll={handleRoll}
                onStartAuto={handleStartAuto}
                onStopAuto={handleStopAuto}
              />
            </div>

            {/* Right: Slider + History */}
            <div className={styles.mainPanel}>
              {/* Big Roll Display */}
              <AnimatePresence mode="wait">
                {game.phase === 'finished' && game.rollResult !== null && (
                  <motion.div
                    key={game.rollResult}
                    className={`${styles.bigResult} ${game.won ? styles.bigResultWin : styles.bigResultLoss}`}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                  >
                    <div className={styles.bigResultEmoji}>{game.won ? '🎉' : '💀'}</div>
                    <div className={styles.bigResultNumber}>{game.rollResult.toFixed(2)}</div>
                    <div className={styles.bigResultLabel}>
                      {game.won
                        ? `${game.multiplier.toFixed(2)}x — Won ${formatBTC(game.payout)}`
                        : `${game.isUnder ? 'Under' : 'Over'} ${game.target.toFixed(2)} — Busted!`}
                    </div>
                  </motion.div>
                )}
                {game.phase === 'rolling' && (
                  <motion.div
                    key="rolling"
                    className={styles.rollingDisplay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className={styles.rollingDice}
                      animate={{ rotate: [0, 90, 180, 270, 360] }}
                      transition={{ repeat: Infinity, duration: 0.4, ease: 'linear' }}
                    >
                      🎲
                    </motion.div>
                    <div className={styles.rollingText}>Rolling...</div>
                  </motion.div>
                )}
                {game.phase === 'idle' && (
                  <motion.div
                    key="idle"
                    className={styles.idleDisplay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className={styles.idleText}>🎲 Set your bet and roll!</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Slider */}
              <DiceSlider
                target={game.target}
                setTarget={game.setTarget}
                isUnder={game.isUnder}
                setIsUnder={game.setIsUnder}
                winChance={game.winChance}
                multiplier={game.multiplier}
                rollResult={game.rollResult}
                phase={game.phase}
                disabled={game.phase === 'rolling' || game.autoActive}
              />

              {/* History Pills */}
              {game.history.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyLabel}>Recent Rolls</div>
                  <div className={styles.historyPills}>
                    {game.history.map((h, i) => (
                      <motion.span
                        key={i}
                        className={`${styles.pill} ${h.won ? styles.pillWin : styles.pillLoss}`}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        {h.roll.toFixed(2)}
                      </motion.span>
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
                    <p>Set your bet amount and drag the <strong>target slider</strong></p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>2</span>
                    <p>Choose <strong>Roll Under</strong> or <strong>Roll Over</strong> the target</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>3</span>
                    <p>Lower win chance = <strong>higher multiplier</strong> payout</p>
                  </div>
                  <div className={styles.step}>
                    <span className={styles.stepNum}>4</span>
                    <p>Use <strong>Auto Bet</strong> with Martingale strategy for power sessions</p>
                  </div>
                </div>
              </div>
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
