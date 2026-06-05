'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOTS_CONFIG } from '@/lib/constants';
import styles from './SlotsGrid.module.css';

// Random placeholders for the blur spin strip
const SPIN_PLACEHOLDERS = SLOTS_CONFIG.SYMBOLS.map(s => s.label);

export default function SlotsGrid({
  reels = [],
  isSpinning = false,
  winningLines = [],
  winBreakdown = [],
}) {
  const [colSpinning, setColSpinning] = useState([false, false, false]);
  const [displayedReels, setDisplayedReels] = useState(reels);

  // Staggered stop logic
  useEffect(() => {
    if (isSpinning) {
      setColSpinning([true, true, true]);
    } else {
      // Stagger landing
      const stopSequence = [
        { col: 0, delay: 0 },
        { col: 1, delay: 200 },
        { col: 2, delay: 400 },
      ];

      stopSequence.forEach(({ col, delay }) => {
        setTimeout(() => {
          setColSpinning(prev => {
            const next = [...prev];
            next[col] = false;
            return next;
          });
          setDisplayedReels(prev => {
            const next = [...prev];
            next[col] = reels[col];
            return next;
          });
        }, delay);
      });
    }
  }, [isSpinning, reels]);

  // Sync initial reels
  useEffect(() => {
    if (!isSpinning) {
      setDisplayedReels(reels);
    }
  }, [reels, isSpinning]);

  // Check if a cell coordinate is part of any winning payline
  const isCellWinning = (row, col) => {
    return winBreakdown.some((hit) =>
      hit.path.some(([r, c]) => r === row && c === col)
    );
  };

  return (
    <div className={styles.machineFrame}>
      {/* Golden metallic borders */}
      <div className={styles.innerBezel}>
        <div className={styles.gridContainer}>
          {/* Reel Columns */}
          {[0, 1, 2].map((colIndex) => {
            const colSymbols = displayedReels[colIndex] || [];
            const spinning = colSpinning[colIndex];

            return (
              <div key={colIndex} className={styles.reelColumn}>
                <AnimatePresence mode="wait">
                  {spinning ? (
                    /* Blur Spinning Strip Animation */
                    <motion.div
                      key="spinning"
                      className={`${styles.reelStrip} ${styles.blur}`}
                      animate={{ y: [0, -320] }}
                      transition={{
                        ease: 'linear',
                        duration: 0.12,
                        repeat: Infinity,
                      }}
                    >
                      {SPIN_PLACEHOLDERS.concat(SPIN_PLACEHOLDERS).map((sym, idx) => (
                        <div key={idx} className={styles.symbolCellPlaceholder}>
                          {sym}
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    /* Final outcome symbols with spring bounce */
                    <motion.div
                      key="stopped"
                      className={styles.reelStripOutcome}
                      initial={{ y: -50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        damping: 12,
                        stiffness: 110,
                      }}
                    >
                      {colSymbols.map((symbol, rowIndex) => {
                        const isWin = isCellWinning(rowIndex, colIndex);
                        return (
                          <motion.div
                            key={rowIndex}
                            className={`${styles.symbolCell} ${isWin ? styles.symbolWin : ''}`}
                            style={{ '--glow-color': symbol.color }}
                            animate={isWin ? { scale: [1, 1.15, 1] } : {}}
                            transition={isWin ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } : {}}
                          >
                            <span className={styles.symbolIcon}>{symbol.label}</span>
                            <span className={styles.symbolName}>{symbol.name}</span>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* SVG Payline Overlay */}
          {!isSpinning && winBreakdown.length > 0 && (
            <svg className={styles.paylineOverlay}>
              {winBreakdown.map((hit, hitIdx) => {
                // Map [row, col] coordinates to relative svg percents
                const points = hit.path
                  .map(([row, col]) => {
                    const x = ((col * 2 + 1) / 6) * 100;
                    const y = ((row * 2 + 1) / 6) * 100;
                    return `${x}% ${y}%`;
                  })
                  .join(', ');

                return (
                  <motion.polyline
                    key={`${hit.lineId}-${hitIdx}`}
                    points={points}
                    stroke={hit.color}
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={styles.glowLine}
                    style={{ '--stroke-color': hit.color }}
                  />
                );
              })}

            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
