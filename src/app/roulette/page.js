'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCircle, FaDice } from 'react-icons/fa';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useAchievements } from '@/hooks/useAchievements';
import { useRouletteEngine, isRed, isBlack } from '@/hooks/useRouletteEngine';
import { formatBTC } from '@/lib/utils';
import styles from './page.module.css';

// ─── European Roulette layout ─────────────────────────────────────────────────
// Numbers arranged in the standard European wheel order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Flat list of 1-36, arranged column-by-column for horizontal board layout:
// Row 1 (top): 3, 6, 9, ..., 36
// Row 2 (mid): 2, 5, 8, ..., 35
// Row 3 (bot): 1, 4, 7, ..., 34
const HORIZONTAL_GRID_NUMBERS = [
  3, 2, 1,
  6, 5, 4,
  9, 8, 7,
  12, 11, 10,
  15, 14, 13,
  18, 17, 16,
  21, 20, 19,
  24, 23, 22,
  27, 26, 25,
  30, 29, 28,
  33, 32, 31,
  36, 35, 34
];

const CHIP_SIZES = [0.10, 1, 5, 25, 100];

function formatChip(n) {
  if (n >= 100) return `${n}`;
  if (n >= 1) return `${n}`;
  return `${n}`;
}

function getNumberColor(n) {
  if (n === 0) return 'green';
  if (isRed(n)) return 'red';
  return 'black';
}

function getResultColorClass(n, styles) {
  if (n === 0) return styles.wheelResultGreen;
  if (isRed(n)) return styles.wheelResultRed;
  return styles.wheelResultBlack;
}

function getPillClass(n, styles) {
  if (n === 0) return styles.pillGreen;
  if (isRed(n)) return styles.pillRed;
  return styles.pillBlack;
}

function formatBetKey(key) {
  const labels = {
    red: '🔴 Red', black: '⚫ Black',
    odd: 'Odd', even: 'Even',
    '1-18': '1–18', '19-36': '19–36',
    dozen1: 'Dozen 1–12', dozen2: 'Dozen 13–24', dozen3: 'Dozen 25–36',
    col1: 'Column 1', col2: 'Column 2', col3: 'Column 3',
  };
  return labels[key] ?? `#${key}`;
}

// ─── Wheel Component ──────────────────────────────────────────────────────────
function RouletteWheel({ spinning, result, winnings }) {
  const [wheelRotation, setWheelRotation] = useState(0);

  useEffect(() => {
    if (spinning && result !== null) {
      const idx = WHEEL_NUMBERS.indexOf(result);
      if (idx !== -1) {
        const targetAngle = 360 - (idx * (360 / 37) + (360 / 37) / 2);
        setWheelRotation(prev => {
          const nextRotation = Math.ceil(prev / 360) * 360 + 1800 + targetAngle;
          return nextRotation;
        });
      }
    }
  }, [spinning, result]);

  const resultColorClass = result !== null ? getResultColorClass(result, styles) : '';
  const statusText = spinning
    ? '🎡 Spinning...'
    : result !== null
    ? `Landed on ${result}!`
    : 'Place your bets & spin!';

  const statusClass = spinning
    ? styles.wheelStatusSpinning
    : winnings !== null && winnings > 0
    ? styles.wheelStatusWin
    : winnings !== null && winnings <= 0
    ? styles.wheelStatusLoss
    : '';

  // Generate wheel background conic gradient dynamically based on European order:
  // Green for 0, Red for RED_NUMBERS, Black otherwise.
  const gradientParts = WHEEL_NUMBERS.map((num, idx) => {
    const startAngle = idx * (360 / 37);
    const endAngle = (idx + 1) * (360 / 37);
    const color = num === 0 ? '#1a6b1a' : isRed(num) ? '#8b0000' : '#111';
    return `${color} ${startAngle.toFixed(2)}deg ${endAngle.toFixed(2)}deg`;
  });
  const wheelBackground = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className={styles.wheelCard}>
      <div className={styles.wheelWrapper}>
        <div className={styles.wheelOuter}>
          <motion.div
            className={styles.wheelSegments}
            style={{ background: wheelBackground }}
            animate={{ rotate: wheelRotation }}
            transition={spinning ? { duration: 3.5, ease: [0.15, 0.85, 0.35, 1] } : { duration: 0 }}
          >
            {WHEEL_NUMBERS.map((num, idx) => {
              const angle = idx * (360 / 37) + (360 / 37) / 2;
              return (
                <span
                  key={idx}
                  className={styles.wheelNumberLabel}
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-110px)`,
                  }}
                >
                  {num}
                </span>
              );
            })}
          </motion.div>
        </div>

        {/* Pointer */}
        <div className={styles.wheelPointer} />

        {/* Center number display */}
        <div className={styles.wheelCenter}>
          {result !== null && !spinning ? (
            <motion.span
              className={`${styles.wheelResultNumber} ${resultColorClass}`}
              key={result}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {result}
            </motion.span>
          ) : (
            <span className={styles.wheelResultNumber} style={{ color: 'rgba(255,255,255,0.2)' }}>
              {spinning ? '?' : '?'}
            </span>
          )}
        </div>
      </div>

      {/* Info column */}
      <div className={styles.wheelInfo}>
        <div className={`${styles.wheelStatus} ${statusClass}`}>
          {statusText}
        </div>

        <AnimatePresence mode="wait">
          {winnings !== null && !spinning && (
            <motion.div
              key={`win-${winnings}`}
              className={styles.winningsDisplay}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <div className={styles.winLabel}>Net Gain / Loss</div>
              <div className={`${styles.winAmount} ${
                winnings > 0 ? styles.winAmountPos :
                winnings < 0 ? styles.winAmountNeg :
                styles.winAmountNeutral
              }`}>
                {winnings > 0 ? '+' : ''}{formatBTC(winnings)}
              </div>
            </motion.div>
          )}
          {winnings === null && !spinning && (
            <motion.div
              key="idle"
              className={styles.winningsDisplay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.winLabel}>Net Gain / Loss</div>
              <div className={`${styles.winAmount} ${styles.winAmountNeutral}`}>—</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Betting Table ────────────────────────────────────────────────────────────
function BettingTable({ bets, placeBet, spinning, result }) {
  const hasBet = (key) => !!bets[key];

  const ROW1 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const ROW2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
  const ROW3 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

  function NumCell({ n, className }) {
    const color = getNumberColor(n);
    const betKey = String(n);
    const bet = bets[betKey];
    const isResult = result === n && result !== null && !spinning;

    return (
      <motion.button
        className={`${styles.numCell} ${
          color === 'green' ? styles.numCellGreen :
          color === 'red'   ? styles.numCellRed :
          styles.numCellBlack
        } ${hasBet(betKey) ? styles.hasBet : ''} ${isResult ? styles.winnerCell : ''} ${className || ''}`}
        onClick={() => placeBet(betKey)}
        disabled={spinning}
        whileHover={!spinning ? { scale: 1.1, zIndex: 10 } : {}}
        whileTap={!spinning ? { scale: 0.95 } : {}}
        title={`Bet on ${n} (35:1)`}
      >
        {n}
        {bet && (
          <span className={styles.chipOverlay}>
            {bet >= 100 ? '100+' : bet >= 10 ? `${Math.round(bet)}` : `${bet}`}
          </span>
        )}
      </motion.button>
    );
  }

  function OutsideCell({ betKey, label, colorClass, className, title, children }) {
    const bet = bets[betKey];
    const isResult = result !== null && !spinning && (() => {
      if (betKey === 'red') return isRed(result);
      if (betKey === 'black') return isBlack(result);
      if (betKey === 'odd') return result % 2 === 1 && result !== 0;
      if (betKey === 'even') return result % 2 === 0 && result !== 0;
      if (betKey === '1-18') return result >= 1 && result <= 18;
      if (betKey === '19-36') return result >= 19 && result <= 36;
      if (betKey === 'dozen1') return result >= 1 && result <= 12;
      if (betKey === 'dozen2') return result >= 13 && result <= 24;
      if (betKey === 'dozen3') return result >= 25 && result <= 36;
      if (betKey === 'col1') return result % 3 === 1;
      if (betKey === 'col2') return result % 3 === 2;
      if (betKey === 'col3') return result % 3 === 0 && result !== 0;
      return false;
    })();

    return (
      <motion.button
        className={`${styles.outsideCell} ${colorClass} ${className || ''} ${hasBet(betKey) ? styles.hasBet : ''} ${isResult ? styles.winnerCell : ''}`}
        onClick={() => placeBet(betKey)}
        disabled={spinning}
        whileHover={!spinning ? { scale: 1.04 } : {}}
        whileTap={!spinning ? { scale: 0.97 } : {}}
        title={title}
      >
        {children || label}
        {bet && <span className={styles.chipOverlay}>{bet >= 100 ? '100+' : `${Math.round(bet * 10) / 10}`}</span>}
      </motion.button>
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableSectionTitle}>🎰 Betting Table — Click to place chip</div>

      <div className={styles.numberGrid}>
        {/* Zero — spans 3 rows on the left */}
        <div className={styles.gridZero}>
          <NumCell n={0} className={styles.zeroCell} />
        </div>

        {/* Row 1 Numbers (3, 6, 9... 36) */}
        {ROW1.map(num => <NumCell key={num} n={num} />)}
        {/* Column 3 Label (Top Row) */}
        <OutsideCell betKey="col3" colorClass={styles.cellPurple} title="Column 3 (2:1)" label="2:1" />

        {/* Row 2 Numbers (2, 5, 8... 35) */}
        {ROW2.map(num => <NumCell key={num} n={num} />)}
        {/* Column 2 Label (Middle Row) */}
        <OutsideCell betKey="col2" colorClass={styles.cellPurple} title="Column 2 (2:1)" label="2:1" />

        {/* Row 3 Numbers (1, 4, 7... 34) */}
        {ROW3.map(num => <NumCell key={num} n={num} />)}
        {/* Column 1 Label (Bottom Row) */}
        <OutsideCell betKey="col1" colorClass={styles.cellPurple} title="Column 1 (2:1)" label="2:1" />

        {/* Dozens (Row 4) */}
        <OutsideCell betKey="dozen1" colorClass={styles.cellBlue} className={styles.dozenCell1} title="1st Dozen 1–12 (2:1)" label="1st 12" />
        <OutsideCell betKey="dozen2" colorClass={styles.cellBlue} className={styles.dozenCell2} title="2nd Dozen 13–24 (2:1)" label="2nd 12" />
        <OutsideCell betKey="dozen3" colorClass={styles.cellBlue} className={styles.dozenCell3} title="3rd Dozen 25–36 (2:1)" label="3rd 12" />

        {/* Even Money (Row 5) */}
        <OutsideCell betKey="1-18" colorClass={styles.cellGold} className={styles.evenMoney1} title="Low 1–18 (1:1)" label="1-18" />
        <OutsideCell betKey="even" colorClass={styles.cellGold} className={styles.evenMoney2} title="Even (1:1)" label="EVEN" />
        <OutsideCell betKey="red"  colorClass={styles.cellRed}  className={styles.evenMoney3} title="Red (1:1)">
          <span className={styles.redDot} /> RED
        </OutsideCell>
        <OutsideCell betKey="black" colorClass={styles.cellBlack} className={styles.evenMoney4} title="Black (1:1)">
          <span className={styles.blackDot} /> BLACK
        </OutsideCell>
        <OutsideCell betKey="odd"   colorClass={styles.cellGold} className={styles.evenMoney5} title="Odd (1:1)" label="ODD" />
        <OutsideCell betKey="19-36" colorClass={styles.cellGold} className={styles.evenMoney6} title="High 19–36 (1:1)" label="19-36" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RoulettePage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const engine = useRouletteEngine(balance, subtractBalance, addBalance);

  const {
    chipSize, setChipSize,
    bets, placeBet, clearBets, totalBet,
    spinning, result, winnings, lastResults,
    spin,
  } = engine;

  const handleSpin = useCallback(async () => {
    console.log("handleSpin click triggered");
    console.log("typeof spin:", typeof spin);
    console.log("typeof subtractBalance:", typeof subtractBalance);
    console.log("typeof addBalance:", typeof addBalance);
    console.log("totalBet:", totalBet, "balance:", balance);

    if (totalBet <= 0) {
      alert("Please place at least one bet on the table first!");
      return;
    }
    if (totalBet > balance) {
      alert(`Insufficient balance! Your total bet is $${totalBet.toFixed(2)} but your balance is only $${balance.toFixed(2)}.`);
      return;
    }
    try {
      await spin();
      setTimeout(() => checkAchievements(), 500);
    } catch (err) {
      console.error("Roulette page spin error:", err);
    }
  }, [spin, checkAchievements, totalBet, balance, subtractBalance, addBalance]);

  const canSpin = !spinning;

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Roulette...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.roulettePage}>
        <div className="page-container">

          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🎡 Roulette</h1>
            <p className={styles.pageSubtitle}>
              European Roulette — 37 pockets, multiple bet types, 1% house edge
            </p>
          </div>

          <div className={styles.gameLayout}>
            {/* ─── Left: Controls ─── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                {/* Chip Size */}
                <div>
                  <div className={styles.sectionLabel}>
                    <FaCircle className={styles.sectionLabelIcon} />
                    Chip Size
                  </div>
                  <div className={styles.chipGrid} style={{ marginTop: '0.6rem' }}>
                    {CHIP_SIZES.map(size => (
                      <button
                        key={size}
                        className={`${styles.chipBtn} ${chipSize === size ? styles.chipBtnActive : ''}`}
                        onClick={() => setChipSize(size)}
                        disabled={spinning}
                      >
                        {formatBTC(size)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Current Bets */}
                <div>
                  <div className={styles.sectionLabel}>
                    <FaDice className={styles.sectionLabelIcon} />
                    Current Bets
                  </div>
                  <div className={styles.currentBetsList} style={{ marginTop: '0.6rem' }}>
                    {Object.keys(bets).length === 0 ? (
                      <div className={styles.noBets}>No bets placed yet</div>
                    ) : (
                      Object.entries(bets).map(([key, amt]) => (
                        <div key={key} className={styles.currentBetItem}>
                          <span className={styles.currentBetItemKey}>{formatBetKey(key)}</span>
                          <span className={styles.currentBetItemAmt}>{formatBTC(amt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Bet Summary */}
                <div className={styles.betSummary}>
                  <div className={styles.betSummaryRow}>
                    <span>Total Bet</span>
                    <span className={`${styles.betSummaryVal} ${totalBet > 0 ? styles.betSummaryValGold : ''}`}>
                      {formatBTC(totalBet)}
                    </span>
                  </div>
                  <div className={styles.betSummaryRow}>
                    <span>Balance</span>
                    <span className={styles.betSummaryVal}>{formatBTC(balance)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actionRow}>
                  <motion.button
                    className={styles.clearBtn}
                    onClick={clearBets}
                    disabled={spinning || Object.keys(bets).length === 0}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    CLEAR
                  </motion.button>

                  <motion.button
                    className={`${styles.spinBtn} ${spinning ? styles.spinBtnSpinning : ''}`}
                    onClick={handleSpin}
                    disabled={!canSpin}
                    whileHover={canSpin ? { scale: 1.02 } : {}}
                    whileTap={canSpin ? { scale: 0.98 } : {}}
                  >
                    {spinning ? '🎡 Spinning...' : '🎯 SPIN'}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ─── Right: Wheel + Table ─── */}
            <div className={styles.displayPanel}>
              {/* Wheel */}
              <RouletteWheel spinning={spinning} result={result} winnings={winnings} />

              {/* Last Results */}
              {lastResults.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyLabel}>Last {lastResults.length}</div>
                  <div className={styles.historyPills}>
                    {lastResults.map((n, i) => (
                      <motion.div
                        key={i}
                        className={`${styles.historyPill} ${getPillClass(n, styles)}`}
                        initial={{ opacity: 0, scale: 0.5, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        title={`Result: ${n} (${getNumberColor(n)})`}
                      >
                        {n}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Betting Table */}
              <BettingTable
                bets={bets}
                placeBet={placeBet}
                spinning={spinning}
                result={result}
              />
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
