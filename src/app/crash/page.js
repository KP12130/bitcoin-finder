'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import CrashGraph from '@/components/CrashGraph/CrashGraph';
import CrashControls from '@/components/CrashControls/CrashControls';
import { useBalance } from '@/hooks/useBalance';
import { useCrashEngine } from '@/hooks/useCrashEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { formatBTC } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function CrashPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const game = useCrashEngine(balance, subtractBalance, addBalance);

  // Sync bet to live feed when crash game finishes
  useEffect(() => {
    if (game.phase === 'crashed' || game.phase === 'cashedout') {
      const won = game.phase === 'cashedout';
      const mult = won ? game.cashoutMultiplier : game.multiplier;
      const payout = won ? game.payout : 0;

      addBet({
        name: profile?.username || 'Player',
        avatarEmoji: profile?.avatarEmoji || '⛏️',
        game: 'Crash',
        bet: game.bet,
        multiplier: mult > 0 ? `${mult.toFixed(2)}x` : '0.00x',
        payout,
        won,
        isPlayer: true,
        user_id: user?.id || null
      });
    }
  }, [game.phase, game.multiplier, game.cashoutMultiplier, game.payout, game.bet, addBet, profile, user]);

  const handleLaunch = useCallback(() => {
    setError('');
    if (game.phase === 'crashed' || game.phase === 'cashedout') game.reset();
    const result = game.launch();
    if (result?.error) setError(result.error);
    else setError('');
  }, [game]);

  const handleCashOut = useCallback(() => {
    game.cashOut();
    setTimeout(() => checkAchievements(), 500);
  }, [game, checkAchievements]);

  const handleBailout = useCallback(() => {
    claimBailout();
    setError('');
  }, [claimBailout]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Crypto Crash...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.crashPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🚀 Crypto Crash</h1>
            <p className={styles.pageSubtitle}>
              Cash out before the rocket crashes — or lose it all!
            </p>
          </div>

          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && game.phase === 'idle' && (
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
            {/* Left: Controls */}
            <div className={styles.controlsPanel}>
              <CrashControls
                phase={game.phase}
                bet={game.bet}
                setBet={game.setBet}
                balance={balance}
                payout={game.payout}
                cashoutMultiplier={game.cashoutMultiplier}
                autoCashOut={game.autoCashOut}
                setAutoCashOut={game.setAutoCashOut}
                autoCashOutTarget={game.autoCashOutTarget}
                setAutoCashOutTarget={game.setAutoCashOutTarget}
                launch={handleLaunch}
                cashOut={handleCashOut}
                reset={game.reset}
                error={error}
                multiplier={game.multiplier}
              />
            </div>

            {/* Right: Graph */}
            <div className={styles.graphPanel}>
              <CrashGraph
                phase={game.phase}
                multiplier={game.multiplier}
                history={game.history}
              />

              {/* Live multiplier badge during run */}
              <AnimatePresence>
                {game.phase === 'running' && (
                  <motion.div
                    className={styles.liveMultBadge}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className={styles.liveLabel}>LIVE</span>
                    <span className={styles.liveMult}>{game.multiplier.toFixed(2)}x</span>
                    <motion.button
                      className={styles.inlineCashOut}
                      onClick={handleCashOut}
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ repeat: Infinity, duration: 0.7 }}
                    >
                      💰 CASH OUT NOW
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* How to Play */}
          <div className={styles.howToPlay}>
            <h3 className={styles.howTitle}>How to Play</h3>
            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepNum}>1</span>
                <p>Set your bet and hit <strong>LAUNCH 🚀</strong></p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>2</span>
                <p>Watch the multiplier climb higher and higher</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>3</span>
                <p>Click <strong>CASH OUT</strong> before it crashes to keep your winnings</p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>4</span>
                <p>If you don&apos;t cash out before the crash — you lose your bet!</p>
              </div>
            </div>
          </div>

          {/* Live Bets Feed */}
          <LiveBetsFeed />
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
