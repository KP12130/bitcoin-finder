import { useCallback, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaDice, FaExclamationTriangle } from 'react-icons/fa';
import { BiTargetLock } from 'react-icons/bi';
import { getMultiplier, getWinChance, calculatePayout, formatBTC, parseShorthand } from '@/lib/utils';
import { DIFFICULTY_PRESETS, GAME_CONFIG } from '@/lib/constants';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import styles from './BetControls.module.css';

export default function BetControls({
  bet,
  setBet,
  guessCount,
  setGuessCount,
  balance,
  onStartMining,
  disabled,
  error,
}) {
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet from engine (USD) to local input (active currency)
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(bet);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [bet, currency]);

  // ── Bet helpers ──────────────────────────────
  const handleBetChange = useCallback(
    (e) => {
      const value = e.target.value;
      // Allow only digits, at most one dot, and optionally K or M shorthand
      const cleanValue = value.replace(/[^0-9.kKmM]/g, '');
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
    setBet((prev) => {
      return Math.max(GAME_CONFIG.MIN_BET, Math.round((prev / 2) * 100) / 100);
    });
  }, [setBet]);

  const doubleBet = useCallback(() => {
    setBet((prev) => {
      return Math.min(balance, Math.round(prev * 2 * 100) / 100);
    });
  }, [setBet, balance]);

  const minBet = useCallback(() => {
    setBet(GAME_CONFIG.MIN_BET);
  }, [setBet]);

  const maxBet = useCallback(() => {
    setBet(balance);
  }, [setBet, balance]);

  // ── Slider helpers ───────────────────────────
  const handleSliderChange = useCallback(
    (e) => {
      setGuessCount(parseInt(e.target.value, 10));
    },
    [setGuessCount]
  );

  const sliderProgress = useMemo(
    () =>
      ((guessCount - GAME_CONFIG.MIN_GUESSES) /
        (GAME_CONFIG.MAX_GUESSES - GAME_CONFIG.MIN_GUESSES)) *
      100,
    [guessCount]
  );

  // ── Active preset ────────────────────────────
  const activePreset = useMemo(
    () => DIFFICULTY_PRESETS.find((p) => p.guesses === guessCount)?.id ?? null,
    [guessCount]
  );

  // ── Derived values ───────────────────────────
  const winChance = useMemo(() => getWinChance(guessCount), [guessCount]);
  const multiplier = useMemo(() => getMultiplier(guessCount), [guessCount]);
  
  const parsedBet = useMemo(() => {
    return typeof bet === 'string' ? parseShorthand(bet) : (Number(bet) || 0);
  }, [bet]);

  const payout = useMemo(
    () => calculatePayout(parsedBet, guessCount),
    [parsedBet, guessCount]
  );

  const isBetValid = parsedBet >= GAME_CONFIG.MIN_BET && parsedBet <= balance;

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* ════════ BET AMOUNT ════════ */}
      <div className={styles.section}>
        <div className={styles.betHeader}>
          <span className={styles.sectionLabel}>
            <FaBitcoin className={styles.sectionIcon} />
            Bet Amount
          </span>
          <span className={styles.balanceDisplay}>
            Balance:{' '}
            <span className={styles.balanceAmount}>{formatBTC(balance)}</span>
          </span>
        </div>

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
          <motion.button
            className={styles.quickBetBtn}
            onClick={halfBet}
            disabled={disabled}
            whileTap={{ scale: 0.95 }}
          >
            ½
          </motion.button>
          <motion.button
            className={styles.quickBetBtn}
            onClick={doubleBet}
            disabled={disabled}
            whileTap={{ scale: 0.95 }}
          >
            2×
          </motion.button>
          <motion.button
            className={styles.quickBetBtn}
            onClick={minBet}
            disabled={disabled}
            whileTap={{ scale: 0.95 }}
          >
            Min
          </motion.button>
          <motion.button
            className={styles.quickBetBtn}
            onClick={maxBet}
            disabled={disabled}
            whileTap={{ scale: 0.95 }}
          >
            Max
          </motion.button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ════════ GUESS COUNT ════════ */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          <BiTargetLock className={styles.sectionIcon} />
          Number of Guesses
        </span>

        <div className={styles.guessCountDisplay}>
          <motion.div
            key={guessCount}
            className={styles.guessCountNumber}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {guessCount}
          </motion.div>
          <div className={styles.guessCountLabel}>guesses</div>
        </div>

        <div className={styles.sliderWrapper}>
          <input
            type="range"
            className={styles.slider}
            min={GAME_CONFIG.MIN_GUESSES}
            max={GAME_CONFIG.MAX_GUESSES}
            value={guessCount}
            onChange={handleSliderChange}
            disabled={disabled}
            style={{ '--slider-progress': `${sliderProgress}%` }}
          />
          <div className={styles.sliderLabels}>
            <span>{GAME_CONFIG.MIN_GUESSES}</span>
            <span>{GAME_CONFIG.MAX_GUESSES}</span>
          </div>
        </div>

        {/* Win Chance + Multiplier */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Win Chance</div>
            <div className={styles.statValueGreen}>{winChance}%</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Multiplier</div>
            <div className={styles.statValueBlue}>{multiplier}×</div>
          </div>
        </div>

        {/* Difficulty Presets */}
        <div className={styles.presetsRow}>
          {DIFFICULTY_PRESETS.map((preset) => (
            <motion.button
              key={preset.id}
              className={
                activePreset === preset.id
                  ? styles.presetBtnActive
                  : styles.presetBtn
              }
              onClick={() => setGuessCount(preset.guesses)}
              disabled={disabled}
              whileTap={{ scale: 0.93 }}
            >
              <span className={styles.presetEmoji}>{preset.emoji}</span>
              <span className={styles.presetName}>{preset.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ════════ POTENTIAL WIN ════════ */}
      <motion.div
        className={styles.potentialWin}
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className={styles.potentialWinLabel}>Potential Win</div>
        <div className={styles.potentialWinValue}>{formatBTC(payout)}</div>
      </motion.div>

      {/* ════════ START MINING ════════ */}
      <motion.button
        className={styles.startBtn}
        onClick={onStartMining}
        disabled={disabled || !isBetValid}
        whileTap={!disabled && isBetValid ? { scale: 0.97 } : {}}
      >
        ⛏️ Start Mining
      </motion.button>

      {/* ════════ ERROR ════════ */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.errorMessage}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <FaExclamationTriangle className={styles.errorIcon} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
