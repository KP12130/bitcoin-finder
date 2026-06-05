'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import BetControls from '@/components/BetControls/BetControls';
import MiningAnimation from '@/components/MiningAnimation/MiningAnimation';
import ResultModal from '@/components/ResultModal/ResultModal';
import DailyReward from '@/components/DailyReward/DailyReward';
import GameHistory from '@/components/GameHistory/GameHistory';
import { useBalance } from '@/hooks/useBalance';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useDailyReward } from '@/hooks/useDailyReward';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { getGameHistory } from '@/lib/storage';
import { formatBTC } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function PlayPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();

  const handleGameFinished = useCallback((result) => {
    setRecentHistory(getGameHistory().slice(0, 5));
    checkAchievements();
    
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Mine',
      bet: result.bet,
      multiplier: result.multiplier > 0 ? `${parseFloat(result.multiplier).toFixed(2)}x` : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [checkAchievements, addBet, profile, user]);

  const game = useGameEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const daily = useDailyReward();

  const [error, setError] = useState('');
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [recentHistory, setRecentHistory] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial history
  useEffect(() => {
    if (mounted) {
      setRecentHistory(getGameHistory().slice(0, 5));
    }
  }, [mounted]);

  const handleStartMining = useCallback(() => {
    setError('');
    const result = game.startGame();
    if (result.error) {
      setError(result.error);
    }
  }, [game]);

  const handleClaimDaily = useCallback(() => {
    const reward = daily.claimReward();
    if (reward) {
      addBalance(reward.amount);
      setShowDailyReward(false);
    }
  }, [daily, addBalance]);

  const handlePlayAgain = useCallback(() => {
    game.resetGame();
    setError('');
  }, [game]);

  const handleBailout = useCallback(() => {
    claimBailout();
    setError('');
  }, [claimBailout]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Bitcoin Finder...</p>
      </div>
    );
  }

  const isPlaying = game.gameState === game.STATES.MINING;
  const showResult = game.gameState === game.STATES.RESULT && game.result;

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.playPage}>
        <div className="page-container">
          {/* Bankrupt banner */}
          <AnimatePresence>
            {isBankrupt && game.gameState === game.STATES.IDLE && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 You&apos;re broke! Claim a bailout to keep mining.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim {formatBTC(10)} Bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.gameLayout}>
            {/* Left: Controls */}
            <div className={styles.controlsPanel}>
              <BetControls
                bet={game.bet}
                setBet={game.setBet}
                guessCount={game.guessCount}
                setGuessCount={game.setGuessCount}
                balance={balance}
                onStartMining={handleStartMining}
                disabled={isPlaying || showResult}
                error={error}
              />
            </div>

            {/* Right: Mining Area */}
            <div className={styles.miningPanel}>
              {game.gameState === game.STATES.IDLE ? (
                <div className={styles.idleState}>
                  <div className={styles.idleIcon}>⛏️</div>
                  <h2>Ready to Mine</h2>
                  <p>Set your bet and guesses, then hit Start Mining!</p>
                </div>
              ) : (
                <MiningAnimation
                  guesses={game.guesses}
                  revealedCount={game.revealedCount}
                  matchIndex={game.matchIndex}
                  secretNumber={game.secretNumber}
                  isComplete={game.gameState === game.STATES.RESULT}
                  onSkip={game.skipReveal}
                />
              )}
            </div>
          </div>

          {/* Recent History */}
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

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
          <ResultModal
            result={game.result}
            onPlayAgain={handlePlayAgain}
            onClose={handlePlayAgain}
          />
        )}
      </AnimatePresence>



      {/* Achievement notification toast */}
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
