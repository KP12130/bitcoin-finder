'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import styles from './DailyReward.module.css';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 80, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 22, stiffness: 260 },
  },
  exit: {
    opacity: 0,
    y: 60,
    scale: 0.95,
    transition: { duration: 0.25 },
  },
};

function getFlameEmojis(streak) {
  if (streak >= 30) return '🔥🔥🔥🔥🔥';
  if (streak >= 14) return '🔥🔥🔥🔥';
  if (streak >= 7) return '🔥🔥🔥';
  if (streak >= 3) return '🔥🔥';
  if (streak >= 1) return '🔥';
  return '';
}

function getStreakBonusText(streak) {
  if (streak >= 30) return 'Day 30+ = 5x bonus!';
  if (streak >= 7) return 'Day 7+ = 2x bonus!';
  return null;
}

export default function DailyReward({
  canClaim,
  streak,
  rewardAmount,
  timeRemaining,
  onClaim,
  onClose,
}) {
  const flames = getFlameEmojis(streak);
  const bonusText = getStreakBonusText(streak);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className={styles.card}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>

          {/* Title */}
          <h2 className={styles.title}>🎁 Daily Mining Reward</h2>

          {/* Streak */}
          <div className={styles.streakSection}>
            <span className={styles.streakDay}>Day {streak}</span>
            {flames && <span className={styles.flames}>{flames}</span>}
          </div>

          {bonusText && (
            <motion.span
              className={styles.bonusIndicator}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {bonusText}
            </motion.span>
          )}

          {/* Reward amount */}
          <motion.div
            className={styles.rewardAmount}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 14 }}
          >
            $ {rewardAmount}
          </motion.div>

          {/* Claim button or countdown */}
          {canClaim ? (
            <motion.button
              className={styles.claimBtn}
              onClick={onClaim}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              CLAIM REWARD
            </motion.button>
          ) : (
            <div className={styles.countdown}>
              <span className={styles.countdownLabel}>Next reward in:</span>
              <span className={styles.countdownTime}>
                {timeRemaining
                  ? `${String(timeRemaining.hours).padStart(2, '0')}h ${String(timeRemaining.minutes).padStart(2, '0')}m ${String(timeRemaining.seconds).padStart(2, '0')}s`
                  : '--h --m --s'}
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
