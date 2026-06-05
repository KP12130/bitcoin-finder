'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { formatBTC } from '../../lib/utils';
import styles from './ResultModal.module.css';

const PARTICLE_COLORS = [
  '#f7931a', '#fdb94d', '#ffe066', // golds
  '#00ff88', '#00d4ff',            // green, blue
  '#6c5ce7', '#ff6b81',            // purple, pink
  '#ffffff',                        // white
];

function ConfettiParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: `${5 + Math.random() * 6}px`,
    }));
  }, []);

  return (
    <div className={styles.confettiContainer}>
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  );
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export default function ResultModal({ result, onPlayAgain, onClose }) {
  if (!result) return null;

  const isWin = result.won === true;
  const profit = isWin ? (result.payout - result.bet) : 0;

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
          className={`${styles.modal} ${isWin ? styles.modalWin : styles.modalLoss}`}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>

          {/* Win shimmer bar */}
          {isWin && <div className={styles.shimmerBar} />}

          {/* Confetti particles for win */}
          {isWin && <ConfettiParticles />}

          {/* Title */}
          <h2 className={`${styles.title} ${isWin ? styles.titleWin : styles.titleLoss}`}>
            {isWin ? '🎉 BLOCK MINED!' : '❌ Block Not Found'}
          </h2>

          {/* Details */}
          <div className={styles.details}>
            {isWin ? (
              <>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Target</span>
                  <span className={styles.detailValue}>{result.secretNumber}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Your Match</span>
                  <span className={styles.detailValue}>{result.matchedGuess}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Bet</span>
                  <span className={styles.detailValue}>{formatBTC(result.bet)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Payout</span>
                  <span className={styles.payoutValue}>{formatBTC(result.payout)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Multiplier</span>
                  <span className={styles.multiplierValue}>{result.multiplier}x</span>
                </div>

                <div className={styles.divider} />

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Profit</span>
                  <span className={styles.profitValue}>+{formatBTC(profit)}</span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Target was</span>
                  <span className={styles.detailValue}>{result.secretNumber}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Lost</span>
                  <span className={styles.lostValue}>-{formatBTC(result.bet)}</span>
                </div>
              </>
            )}
          </div>

          {/* Loss message */}
          {!isWin && <p className={styles.lossMessage}>Better luck next time, miner.</p>}

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={onPlayAgain}>
              Mine Again
            </button>
            <button className={styles.btnSecondary} onClick={onClose}>
              View Stats
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
