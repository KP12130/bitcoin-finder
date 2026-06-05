'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import SlotsGrid from '@/components/SlotsGrid/SlotsGrid';
import SlotControls from '@/components/SlotControls/SlotControls';
import GameHistory from '@/components/GameHistory/GameHistory';
import { useBalance } from '@/hooks/useBalance';
import { useSlotsEngine } from '@/hooks/useSlotsEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { getGameHistory } from '@/lib/storage';
import { formatBTC } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function SlotsPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  
  const [recentHistory, setRecentHistory] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial history
  useEffect(() => {
    if (mounted) {
      setRecentHistory(getGameHistory().slice(0, 5));
    }
  }, [mounted]);

  // Stamped callback when a spin finishes
  const handleGameFinished = useCallback((result) => {
    setRecentHistory(getGameHistory().slice(0, 5));
    checkAchievements();
    
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Slots',
      bet: result.bet,
      multiplier: result.multiplier > 0 ? `${parseFloat(result.multiplier).toFixed(2)}x` : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [checkAchievements, addBet, profile, user]);

  const game = useSlotsEngine(balance, subtractBalance, addBalance, handleGameFinished);

  const handleStartSpin = useCallback(() => {
    setError('');
    const result = game.spin();
    if (result?.error) {
      setError(result.error);
    }
  }, [game]);

  const handleBailout = useCallback(() => {
    claimBailout();
    setError('');
  }, [claimBailout]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Satoshi Slots...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.slotsPage}>
        <div className="page-container">
          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && !game.isSpinning && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 You&apos;re broke! Claim a bailout to spin the slots.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim {formatBTC(10)} Bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.gameLayout}>
            {/* Left: Controls Panel */}
            <div className={styles.controlsPanel}>
              <SlotControls
                bet={game.bet}
                setBet={game.setBet}
                balance={balance}
                isSpinning={game.isSpinning}
                spin={handleStartSpin}
                autoSpin={game.autoSpin}
                toggleAutoSpin={game.toggleAutoSpin}
                autoSpinCount={game.autoSpinCount}
                setAutoSpinCount={game.setAutoSpinCount}
                autoSpinsLeft={game.autoSpinsLeft}
                payout={game.payout}
                multiplier={game.multiplier}
                error={error}
              />
            </div>

            {/* Right: Reels Cabinet Panel */}
            <div className={styles.slotsPanel}>
              <SlotsGrid
                reels={game.reels}
                isSpinning={game.isSpinning}
                winningLines={game.winningLines}
                winBreakdown={game.winBreakdown}
              />
            </div>
          </div>

          {/* Recent History Table */}
          {recentHistory.length > 0 && (
            <div className={styles.recentSection}>
              <h3 className={styles.recentTitle}>Recent Games</h3>
              <GameHistory history={recentHistory} />
            </div>
          )}

          {/* Live Bets Feed */}
          <LiveBetsFeed />
        </div>
      </div>

      {/* Achievement Unlocked Toast Notification */}
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
