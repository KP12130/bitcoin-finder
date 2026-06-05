'use client';

import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCoins, FaRocket, FaExclamationTriangle } from 'react-icons/fa';
import { formatBTC, parseShorthand } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import styles from './CrashControls.module.css';

const MIN_BET = 0.1;

export default function CrashControls({
  phase,
  bet,
  setBet,
  balance,
  payout,
  cashoutMultiplier,
  autoCashOut,
  setAutoCashOut,
  autoCashOutTarget,
  setAutoCashOutTarget,
  launch,
  cashOut,
  reset,
  error,
  multiplier = 1.00,
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

  const isIdle = phase === 'idle' || phase === 'cashedout' || phase === 'crashed';
  const isRunning = phase === 'running';
  const isBetValid = bet >= MIN_BET && bet <= balance;

  const handleBetChange = useCallback((e) => {
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
  }, [setBet, convertActiveToUsd]);

  const halfBet  = () => setBet(prev => Math.max(MIN_BET, Math.round((prev / 2) * 100) / 100));
  const doubleBet = () => setBet(prev => Math.min(balance, Math.round(prev * 2 * 100) / 100));
  const minBet   = () => setBet(MIN_BET);
  const maxBet   = () => setBet(balance);

  const [targetInputVal, setTargetInputVal] = useState(autoCashOutTarget.toString());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetInputVal(autoCashOutTarget.toString());
  }, [autoCashOutTarget]);

  const handleAutoCashOutTarget = useCallback((e) => {
    const raw = e.target.value;
    setTargetInputVal(raw);
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 1.01) {
      setAutoCashOutTarget(v);
    }
  }, [setAutoCashOutTarget]);

  const handleBlur = useCallback(() => {
    const v = parseFloat(targetInputVal);
    if (isNaN(v) || v < 1.01) {
      setAutoCashOutTarget(1.01);
      setTargetInputVal("1.01");
    } else {
      const rounded = Math.round(v * 100) / 100;
      setAutoCashOutTarget(rounded);
      setTargetInputVal(rounded.toString());
    }
  }, [targetInputVal, setAutoCashOutTarget]);

  const handleLaunch = () => {
    if (!isIdle) return;
    if (phase !== 'idle') reset();
    launch();
  };

  return (
    <div className={styles.container}>
      {/* Balance */}
      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>YOUR BALANCE:</span>
        <span className={styles.balanceAmount}>{formatBTC(balance)}</span>
      </div>

      {/* Bet Amount */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          <FaCoins className={styles.sectionIcon} />
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
          <button onClick={halfBet}  disabled={isRunning} className={styles.quickBtn}>½</button>
          <button onClick={doubleBet} disabled={isRunning} className={styles.quickBtn}>2x</button>
          <button onClick={minBet}   disabled={isRunning} className={styles.quickBtn}>Min</button>
          <button onClick={maxBet}   disabled={isRunning} className={styles.quickBtn}>Max</button>
        </div>
      </div>

      {/* Auto Cash-Out */}
      <div className={styles.section}>
        <div className={styles.autoCashRow}>
          <span className={styles.sectionLabel}>Auto Cash-Out</span>
          <button
            className={autoCashOut ? styles.toggleOn : styles.toggleOff}
            onClick={() => setAutoCashOut(p => !p)}
            disabled={isRunning}
          >
            {autoCashOut ? 'ON' : 'OFF'}
          </button>
        </div>
        <AnimatePresence>
          {autoCashOut && (
            <motion.div
              className={styles.targetRow}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  className={styles.targetInput}
                  value={targetInputVal}
                  onChange={handleAutoCashOutTarget}
                  onBlur={handleBlur}
                  min={1.01}
                  step={0.1}
                  disabled={isRunning}
                  placeholder="2.00"
                />
                <span className={styles.targetSuffix}>x</span>
              </div>
              <div className={styles.targetPresets}>
                {[1.5, 2, 3, 5, 10].map(v => (
                  <button
                    key={v}
                    className={autoCashOutTarget === v ? styles.presetActive : styles.preset}
                    onClick={() => setAutoCashOutTarget(v)}
                    disabled={isRunning}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Payout Summary */}
      <div className={styles.summaryBox}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Bet</span>
          <span className={styles.summaryValueBet}>{formatBTC(bet || 0)}</span>
        </div>
        <div className={styles.vertDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>
            {phase === 'cashedout' ? 'Won at' : phase === 'crashed' ? 'Crashed at' : 'Target'}
          </span>
          <span className={
            phase === 'cashedout' ? styles.summaryWin :
            phase === 'crashed' ? styles.summaryCrash :
            styles.summaryValueBet
          }>
            {phase === 'cashedout'
              ? `+${formatBTC(payout)} (${cashoutMultiplier?.toFixed(2)}x)`
              : phase === 'crashed'
              ? `$0.00 LOST`
              : autoCashOut
              ? `${autoCashOutTarget}x`
              : '—'
            }
          </span>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={styles.error}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <FaExclamationTriangle />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button */}
      {isRunning ? (
        <motion.button
          className={styles.cashOutBtn}
          onClick={cashOut}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          whileTap={{ scale: 0.96 }}
        >
          💰 CASH OUT ({multiplier.toFixed(2)}x)
        </motion.button>
      ) : (
        <motion.button
          className={`${styles.launchBtn} ${!isBetValid || isRunning ? styles.launchDisabled : ''}`}
          onClick={handleLaunch}
          disabled={!isBetValid}
          whileTap={isBetValid ? { scale: 0.96 } : {}}
          animate={isBetValid ? { boxShadow: ['0 0 10px rgba(0,255,136,0.2)', '0 0 28px rgba(0,255,136,0.5)', '0 0 10px rgba(0,255,136,0.2)'] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <FaRocket />
          {phase === 'crashed' || phase === 'cashedout' ? 'PLAY AGAIN' : 'LAUNCH 🚀'}
        </motion.button>
      )}
    </div>
  );
}
