'use client';

import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaPlay, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { formatBTC, parseShorthand } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import styles from './SlotControls.module.css';

const MIN_BET = 0.10;

export default function SlotControls({
  bet,
  setBet,
  balance,
  isSpinning,
  spin,
  autoSpin,
  toggleAutoSpin,
  autoSpinCount = 10,
  setAutoSpinCount,
  autoSpinsLeft = 0,
  payout = 0,
  multiplier = '0',
  error,
}) {
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(bet);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [bet, currency]);

  // Bet helpers
  const handleBetChange = useCallback(
    (e) => {
      const val = e.target.value;
      const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
      const dotCount = (cleanValue.match(/\./g) || []).length;
      if (dotCount > 1) return;
      
      setBetInput(cleanValue);
      
      const parsed = parseShorthand(cleanValue);
      if (!isNaN(parsed)) {
        const usdBet = convertActiveToUsd(parsed);
        setBet(usdBet);
      }
    },
    [setBet, convertActiveToUsd]
  );

  const halfBet = useCallback(() => {
    setBet((prev) => Math.max(MIN_BET, Math.round((prev / 2) * 100) / 100));
  }, [setBet]);

  const doubleBet = useCallback(() => {
    setBet((prev) => Math.min(balance, Math.round(prev * 2 * 100) / 100));
  }, [setBet, balance]);

  const minBet = useCallback(() => {
    setBet(MIN_BET);
  }, [setBet]);

  const maxBet = useCallback(() => {
    setBet(balance);
  }, [setBet, balance]);

  const handleStartSpin = () => {
    spin();
  };

  const isBetValid = bet >= MIN_BET && bet <= balance;

  return (
    <div className={styles.container}>
      {/* ════════ WALLET BALANCE ════════ */}
      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>YOUR BALANCE:</span>
        <span className={styles.balanceAmount}>{formatBTC(balance)}</span>
      </div>

      {/* ════════ BET AMOUNT ════════ */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          <FaBitcoin className={styles.sectionIcon} />
          Bet Amount
        </span>

        <div className={styles.inputWrapper}>
          <span className={styles.currencySymbol}>{activeSymbol}</span>
          <input
            type="text"
            className={styles.betInput}
            value={betInput}
            onChange={handleBetChange}
            placeholder="0"
          />
        </div>

        <div className={styles.quickBetRow}>
          <button onClick={halfBet} disabled={isSpinning} className={styles.quickBtn}>
            ½
          </button>
          <button onClick={doubleBet} disabled={isSpinning} className={styles.quickBtn}>
            2x
          </button>
          <button onClick={minBet} disabled={isSpinning} className={styles.quickBtn}>
            Min
          </button>
          <button onClick={maxBet} disabled={isSpinning} className={styles.quickBtn}>
            Max
          </button>
        </div>
      </div>

      <div className={styles.infoText}>
        🎰 8 paylines active — 3-in-a-row &amp; 2-in-a-row both pay!
      </div>

      {/* ════════ PAYOUT SUMMARY ════════ */}
      <div className={styles.summaryBox}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Bet</span>
          <span className={styles.summaryValueBet}>{formatBTC(bet || 0)}</span>
        </div>
        <div className={styles.verticalDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Last Payout</span>
          <span className={payout > 0 ? styles.summaryValueWin : styles.summaryValueNone}>
            {payout > 0 ? `+${formatBTC(payout)} (${multiplier}x)` : '$0.00'}
          </span>
        </div>
      </div>

      {/* ════════ ERROR CONTAINER ════════ */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.error}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <FaExclamationTriangle className={styles.errorIcon} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ AUTO SPIN COUNT ════════ */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          <FaSync className={styles.sectionIcon} />
          Auto Spin Count
        </span>
        <div className={styles.autoCountRow}>
          {[10, 25, 50, 100].map((n) => (
            <button
              key={n}
              disabled={autoSpin}
              onClick={() => setAutoSpinCount(n)}
              className={autoSpinCount === n ? styles.countBtnActive : styles.countBtn}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            className={styles.countInput}
            value={autoSpinCount}
            min={1}
            max={9999}
            disabled={autoSpin}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) setAutoSpinCount(Math.min(v, 9999));
            }}
          />
        </div>
        {autoSpin && autoSpinsLeft > 0 && (
          <div className={styles.countdownBadge}>
            🔄 {autoSpinsLeft} spin{autoSpinsLeft !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>

      {/* ════════ ACTION BUTTONS ════════ */}
      <div className={styles.actionsRow}>
        {/* Auto Spin Toggle */}
        <button
          onClick={toggleAutoSpin}
          disabled={isSpinning && !autoSpin}
          className={autoSpin ? styles.autoBtnActive : styles.autoBtn}
        >
          <FaSync className={autoSpin ? styles.spinIcon : ''} />
          {autoSpin ? 'AUTO: ON' : 'AUTO SPIN'}
        </button>

        {/* Big Spin Button */}
        <motion.button
          onClick={handleStartSpin}
          disabled={isSpinning || !isBetValid}
          className={`${styles.spinButton} ${isSpinning ? styles.spinBtnActive : ''}`}
          whileTap={!isSpinning && isBetValid ? { scale: 0.95 } : {}}
          animate={!isSpinning && isBetValid ? { boxShadow: ['0 0 10px rgba(247,147,26,0.3)', '0 0 25px rgba(247,147,26,0.5)', '0 0 10px rgba(247,147,26,0.3)'] } : {}}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <FaPlay className={styles.playIcon} />
          {isSpinning ? 'SPINNING...' : 'SPIN REELS'}
        </motion.button>
      </div>
    </div>
  );
}
