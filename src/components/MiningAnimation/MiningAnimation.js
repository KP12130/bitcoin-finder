'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaForward, FaCog, FaCheckCircle, FaTrophy, FaTimesCircle } from 'react-icons/fa';
import { BiTargetLock } from 'react-icons/bi';
import styles from './MiningAnimation.module.css';

const MAX_VISIBLE_CELLS = 50;
const SCRAMBLE_CHARS = '0123456789';

/**
 * A small hook that returns a "scrambling" string that cycles
 * random digits for a given duration, then settles on the final value.
 */
function useScrambleText(finalValue, isScrambling, scrambleDuration = 400) {
  const [display, setDisplay] = useState('???');
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isScrambling) {
      setDisplay(String(finalValue));
      return;
    }

    // Start scrambling random digits
    const digitCount = String(finalValue).length || 3;
    intervalRef.current = setInterval(() => {
      let scrambled = '';
      for (let i = 0; i < digitCount; i++) {
        scrambled += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      setDisplay(scrambled);
    }, 50);

    // After duration, land on the real value
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setDisplay(String(finalValue));
    }, scrambleDuration);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [finalValue, isScrambling, scrambleDuration]);

  return display;
}

/**
 * Individual number cell with scramble → reveal animation.
 */
function NumberCell({ number, index, state }) {
  // state: 'unrevealed' | 'scrambling' | 'miss' | 'match'
  const isScrambling = state === 'scrambling';
  const displayText = useScrambleText(number, isScrambling, 350);

  const cellClass = [
    styles.cell,
    state === 'unrevealed' && styles.cellUnrevealed,
    state === 'scrambling' && styles.cellScrambling,
    state === 'miss' && styles.cellMiss,
    state === 'match' && styles.cellMatch,
  ]
    .filter(Boolean)
    .join(' ');

  const variants = {
    hidden: { opacity: 0, scale: 0.7 },
    visible: { opacity: 1, scale: 1 },
    match: {
      opacity: 1,
      scale: [1, 1.35, 1.15],
      transition: {
        scale: { duration: 0.6, times: [0, 0.5, 1], ease: 'easeOut' },
      },
    },
  };

  return (
    <motion.div
      className={cellClass}
      initial="hidden"
      animate={state === 'match' ? 'match' : 'visible'}
      variants={variants}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <span className={styles.cellText}>
        {state === 'unrevealed' ? '???' : displayText}
      </span>
    </motion.div>
  );
}

/**
 * MiningAnimation — THE STAR COMPONENT.
 *
 * Shows a grid of number slots being revealed one at a time with
 * scramble effects, progress tracking, and a match explosion.
 */
export default function MiningAnimation({
  guesses = [],
  revealedCount = 0,
  matchIndex = -1,
  secretNumber = 0,
  isComplete = false,
  onSkip,
}) {
  const gridRef = useRef(null);
  const totalGuesses = guesses.length;
  const progress = totalGuesses > 0 ? (revealedCount / totalGuesses) * 100 : 0;

  // Determine which cells to render for performance
  const { visibleCells, hiddenBefore } = useMemo(() => {
    if (totalGuesses === 0) return { visibleCells: [], hiddenBefore: 0 };

    // For large guess counts, only show the last MAX_VISIBLE_CELLS revealed + a few unrevealed
    if (totalGuesses > MAX_VISIBLE_CELLS) {
      const startIndex = Math.max(0, revealedCount - MAX_VISIBLE_CELLS + 10);
      const endIndex = Math.min(totalGuesses, startIndex + MAX_VISIBLE_CELLS);
      const cells = guesses.slice(startIndex, endIndex).map((num, i) => ({
        number: num,
        originalIndex: startIndex + i,
      }));
      return { visibleCells: cells, hiddenBefore: startIndex };
    }

    return {
      visibleCells: guesses.map((num, i) => ({ number: num, originalIndex: i })),
      hiddenBefore: 0,
    };
  }, [guesses, totalGuesses, revealedCount]);

  // Determine the currently-being-checked number
  const currentNumber = useMemo(() => {
    if (revealedCount === 0) return null;
    const idx = Math.min(revealedCount - 1, totalGuesses - 1);
    return guesses[idx];
  }, [guesses, revealedCount, totalGuesses]);

  const isCurrentMatch = revealedCount > 0 && matchIndex >= 0 && revealedCount - 1 >= matchIndex;

  // Get cell state
  const getCellState = useCallback(
    (originalIndex) => {
      if (originalIndex >= revealedCount) return 'unrevealed';
      if (originalIndex === revealedCount - 1 && !isComplete) return 'scrambling';
      if (originalIndex === matchIndex) return 'match';
      return 'miss';
    },
    [revealedCount, matchIndex, isComplete]
  );

  // Auto-scroll to the latest revealed cell
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = gridRef.current.scrollHeight;
    }
  }, [revealedCount]);

  // Empty state
  if (totalGuesses === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FaBitcoin />
          </div>
          <div className={styles.emptyText}>Waiting to mine…</div>
        </div>
      </div>
    );
  }

  const hasMatch = matchIndex >= 0;

  return (
    <div className={styles.container}>
      {/* ---- Target Block ---- */}
      <motion.div
        className={styles.targetBlock}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.targetLabel}>
          <BiTargetLock style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Target Block
        </div>
        <div
          className={`${styles.targetValue} ${isComplete ? styles.targetRevealed : ''}`}
        >
          {isComplete ? secretNumber : '? ? ?'}
        </div>
      </motion.div>

      {/* ---- Progress Bar ---- */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <div className={styles.progressText}>
            <span
              className={`${styles.progressIcon} ${isComplete ? styles.progressIconDone : ''}`}
            >
              {isComplete ? <FaCheckCircle /> : <FaCog />}
            </span>
            Mining: {revealedCount} / {totalGuesses}
          </div>

          {!isComplete && onSkip && (
            <motion.button
              className={styles.skipButton}
              onClick={onSkip}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaForward /> Skip
            </motion.button>
          )}
        </div>

        <div className={styles.progressBarTrack}>
          <motion.div
            className={`${styles.progressBarFill} ${isComplete ? styles.progressBarComplete : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ---- Currently Checking ---- */}
      {currentNumber !== null && (
        <motion.div
          className={styles.currentCheck}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.currentCheckLabel}>
            {isComplete ? 'Last Checked' : 'Currently Checking'}
          </div>
          <motion.div
            key={currentNumber}
            className={`${styles.currentCheckNumber} ${isCurrentMatch ? styles.currentCheckMatch : ''}`}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {currentNumber}
          </motion.div>
        </motion.div>
      )}

      {/* ---- Summary Counter (for large sets) ---- */}
      {hiddenBefore > 0 && (
        <div className={styles.summaryCounter}>
          <span className={styles.summaryCount}>{hiddenBefore}</span> earlier guesses checked
          — showing last {visibleCells.length}
        </div>
      )}

      {/* ---- Number Grid ---- */}
      <div className={styles.gridWrapper} ref={gridRef}>
        <div className={styles.grid}>
          {visibleCells.map(({ number, originalIndex }) => (
            <NumberCell
              key={originalIndex}
              number={number}
              index={originalIndex}
              state={getCellState(originalIndex)}
            />
          ))}
        </div>
      </div>

      {/* ---- Completion Message ---- */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            className={`${styles.completeMessage} ${hasMatch ? styles.completeWin : styles.completeLoss}`}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className={styles.completeIcon}>
              {hasMatch ? <FaTrophy /> : <FaTimesCircle />}
            </div>
            {hasMatch
              ? `Block mined! Match found at guess #${matchIndex + 1}`
              : 'Mining complete — no match found'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
