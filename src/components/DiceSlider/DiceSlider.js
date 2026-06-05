'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './DiceSlider.module.css';

export default function DiceSlider({
  target,
  setTarget,
  isUnder,
  setIsUnder,
  winChance,
  multiplier,
  rollResult,
  phase,
  disabled,
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  // Clamp target between 1 and 98.99
  const clampTarget = (v) => Math.min(98.99, Math.max(1.00, parseFloat(v.toFixed(2))));

  const handleTrackClick = (e) => {
    if (disabled) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setTarget(clampTarget(ratio * 99.99));
  };

  const handleMouseDown = (e) => {
    if (disabled) return;
    draggingRef.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      setTarget(clampTarget(ratio * 99.99));
    };
    const handleMouseUp = () => { draggingRef.current = false; };
    const handleTouchMove = (e) => {
      if (!draggingRef.current || !trackRef.current) return;
      const touch = e.touches[0];
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
      setTarget(clampTarget(ratio * 99.99));
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [setTarget]);

  const targetPct = (target / 99.99) * 100;
  const resultPct = rollResult !== null ? (rollResult / 99.99) * 100 : null;
  const isWinningRoll = rollResult !== null && (isUnder ? rollResult < target : rollResult > target);

  // Win zone is left (green) when isUnder, right (green) when isOver
  const winLeft = isUnder ? 0 : targetPct;
  const winWidth = isUnder ? targetPct : (100 - targetPct);
  const lossLeft = isUnder ? targetPct : 0;
  const lossWidth = isUnder ? (100 - targetPct) : targetPct;

  return (
    <div className={styles.sliderWrapper}>
      {/* Over / Under Toggle */}
      <div className={styles.toggleRow}>
        <button
          className={`${styles.toggleBtn} ${isUnder ? styles.toggleActive : ''}`}
          onClick={() => setIsUnder(true)}
          disabled={disabled}
        >
          Roll Under
        </button>
        <div className={styles.toggleStats}>
          <span className={styles.statChip}>
            Win Chance: <strong>{winChance.toFixed(2)}%</strong>
          </span>
          <span className={styles.statChip}>
            Multiplier: <strong>{multiplier.toFixed(4)}x</strong>
          </span>
        </div>
        <button
          className={`${styles.toggleBtn} ${!isUnder ? styles.toggleActive : ''}`}
          onClick={() => setIsUnder(false)}
          disabled={disabled}
        >
          Roll Over
        </button>
      </div>

      {/* Track */}
      <div
        className={`${styles.track} ${disabled ? styles.trackDisabled : ''}`}
        ref={trackRef}
        onClick={handleTrackClick}
      >
        {/* Win zone */}
        <div
          className={styles.winZone}
          style={{ left: `${winLeft}%`, width: `${winWidth}%` }}
        />
        {/* Loss zone */}
        <div
          className={styles.lossZone}
          style={{ left: `${lossLeft}%`, width: `${lossWidth}%` }}
        />

        {/* Target thumb */}
        <div
          className={styles.thumb}
          style={{ left: `${targetPct}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className={styles.thumbLabel}>{target.toFixed(2)}</div>
          <div className={styles.thumbDot} />
        </div>

        {/* Roll result marker — slides from the center (50%) to the final position */}
        <AnimatePresence>
          {resultPct !== null && phase === 'finished' && (
            <motion.div
              key={rollResult}  /* remount on every new roll so it always slides from the middle */
              className={`${styles.resultMarker} ${isWinningRoll ? styles.resultWin : styles.resultLoss}`}
              style={{ left: '50%' }}
              initial={{ left: '50%', opacity: 0 }}
              animate={{ left: `${resultPct}%`, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                left:    { type: 'spring', damping: 28, stiffness: 120, duration: 1.0 },
                opacity: { duration: 0.15 },
              }}
            >
              <div className={styles.resultBubble}>{rollResult?.toFixed(2)}</div>
              <div className={styles.resultPin} />
              <div className={styles.resultDot} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Range labels */}
      <div className={styles.rangeLabels}>
        <span>0.00</span>
        <span>24.99</span>
        <span>49.99</span>
        <span>74.99</span>
        <span>99.99</span>
      </div>
    </div>
  );
}
