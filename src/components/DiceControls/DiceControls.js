'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCoins, FaRobot, FaStop } from 'react-icons/fa';
import { GiRollingDices } from 'react-icons/gi';
import { formatBTC, parseShorthand } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import styles from './DiceControls.module.css';

const MIN_BET = 0.1;

export default function DiceControls({
  phase,
  bet,
  setBet,
  balance,
  winChance,
  multiplier,
  profitOnWin,
  rollResult,
  won,
  payout,
  target,
  setTarget,
  isUnder,
  // auto
  autoActive,
  autoRollsTotal,
  setAutoRollsTotal,
  autoRollsLeft,
  onWinMode,
  setOnWinMode,
  onWinPct,
  setOnWinPct,
  onLossMode,
  setOnLossMode,
  onLossPct,
  setOnLossPct,
  stopOnProfit,
  setStopOnProfit,
  stopOnLoss,
  setStopOnLoss,
  onRoll,
  onStartAuto,
  onStopAuto,
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

  const [activeTab, setActiveTab] = useState('manual');

  const isRolling = phase === 'rolling';
  const isBetValid = Number(bet) >= MIN_BET && Number(bet) <= balance;

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

  const handleTargetInput = useCallback((e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) setTarget(Math.min(98.99, Math.max(1.00, v)));
  }, [setTarget]);

  const half  = () => setBet(prev => Math.max(MIN_BET, Math.round((Number(prev) / 2) * 100) / 100));
  const double = () => setBet(prev => Math.min(balance, Math.round(Number(prev) * 2 * 100) / 100));
  const minBet = () => setBet(MIN_BET);
  const maxBet = () => setBet(balance);

  return (
    <div className={styles.container}>
      {/* Balance */}
      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>BALANCE</span>
        <span className={styles.balanceAmount}>{formatBTC(balance)}</span>
      </div>

      {/* Tabs */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.tab} ${activeTab === 'manual' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('manual')}
          disabled={autoActive}
        >
          Manual
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'auto' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('auto')}
          disabled={autoActive}
        >
          Auto
        </button>
      </div>

      {/* Bet Input */}
      <div className={styles.section}>
        <label className={styles.label}><FaCoins className={styles.labelIcon} /> Bet Amount</label>
        <div className={styles.inputRow}>
          <span className={styles.currencySymbol}>{activeSymbol}</span>
          <input
            type="text"
            className={styles.betInput}
            value={betInput}
            onChange={handleBetChange}
            placeholder="0"
          />
        </div>
        <div className={styles.quickRow}>
          <button onClick={half}   disabled={isRolling || autoActive} className={styles.quickBtn}>½</button>
          <button onClick={double} disabled={isRolling || autoActive} className={styles.quickBtn}>2x</button>
          <button onClick={minBet} disabled={isRolling || autoActive} className={styles.quickBtn}>Min</button>
          <button onClick={maxBet} disabled={isRolling || autoActive} className={styles.quickBtn}>Max</button>
        </div>
      </div>

      {/* Target Input */}
      <div className={styles.section}>
        <label className={styles.label}>Target ({isUnder ? 'Under' : 'Over'})</label>
        <div className={styles.inputRow}>
          <input
            type="number"
            className={styles.targetInput}
            value={target}
            onChange={handleTargetInput}
            min={1.00}
            max={98.99}
            step={0.01}
            disabled={isRolling || autoActive}
          />
        </div>
      </div>

      {/* Payout Summary */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Win Chance</span>
          <span className={styles.summaryValue}>{winChance.toFixed(2)}%</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Multiplier</span>
          <span className={styles.summaryValue}>{multiplier.toFixed(4)}x</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Profit on Win</span>
          <span className={styles.summaryValueGreen}>+{formatBTC(profitOnWin)}</span>
        </div>
      </div>

      {/* Last Roll Result */}
      <AnimatePresence mode="wait">
        {phase === 'finished' && rollResult !== null && (
          <motion.div
            key={rollResult}
            className={`${styles.resultBanner} ${won ? styles.resultWin : styles.resultLoss}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 14 }}
          >
            <span className={styles.resultEmoji}>{won ? '🎉' : '💀'}</span>
            <div>
              <div className={styles.resultRoll}>Rolled {rollResult.toFixed(2)}</div>
              <div className={styles.resultPayout}>
                {won ? `+${formatBTC(payout)}` : `Lost ${formatBTC(Number(bet))}`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Tab */}
      {activeTab === 'manual' && (
        <motion.button
          className={`${styles.rollBtn} ${!isBetValid || isRolling ? styles.rollBtnDisabled : ''}`}
          onClick={onRoll}
          disabled={!isBetValid || isRolling || autoActive}
          whileTap={isBetValid ? { scale: 0.96 } : {}}
          animate={isBetValid && !isRolling ? {
            boxShadow: ['0 0 10px rgba(0,255,136,0.2)', '0 0 28px rgba(0,255,136,0.5)', '0 0 10px rgba(0,255,136,0.2)']
          } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {isRolling ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}>
              🎲
            </motion.span>
          ) : (
            <GiRollingDices />
          )}
          {isRolling ? 'Rolling...' : 'ROLL DICE'}
        </motion.button>
      )}

      {/* Auto Tab */}
      {activeTab === 'auto' && (
        <div className={styles.autoPanel}>
          <div className={styles.autoRow}>
            <label className={styles.label}>Number of Rolls</label>
            <div className={styles.inputRow}>
              <input
                type="number"
                className={styles.autoInput}
                value={autoRollsTotal}
                onChange={e => setAutoRollsTotal(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value)))}
                placeholder="∞"
                min={1}
                disabled={autoActive}
              />
            </div>
          </div>

          <div className={styles.strategyRow}>
            <div className={styles.strategyBlock}>
              <label className={styles.label}>On Win</label>
              <div className={styles.strategyBtns}>
                <button className={onWinMode === 'reset' ? styles.stratBtnActive : styles.stratBtn} onClick={() => setOnWinMode('reset')} disabled={autoActive}>Reset</button>
                <button className={onWinMode === 'increase' ? styles.stratBtnActive : styles.stratBtn} onClick={() => setOnWinMode('increase')} disabled={autoActive}>+%</button>
              </div>
              {onWinMode === 'increase' && (
                <div className={styles.inputRow}>
                  <input type="number" className={styles.autoInput} value={onWinPct} onChange={e => setOnWinPct(Math.max(0, parseFloat(e.target.value) || 0))} min={0} disabled={autoActive} />
                  <span className={styles.pctLabel}>%</span>
                </div>
              )}
            </div>

            <div className={styles.strategyBlock}>
              <label className={styles.label}>On Loss</label>
              <div className={styles.strategyBtns}>
                <button className={onLossMode === 'reset' ? styles.stratBtnActive : styles.stratBtn} onClick={() => setOnLossMode('reset')} disabled={autoActive}>Reset</button>
                <button className={onLossMode === 'increase' ? styles.stratBtnActive : styles.stratBtn} onClick={() => setOnLossMode('increase')} disabled={autoActive}>+%</button>
              </div>
              {onLossMode === 'increase' && (
                <div className={styles.inputRow}>
                  <input type="number" className={styles.autoInput} value={onLossPct} onChange={e => setOnLossPct(Math.max(0, parseFloat(e.target.value) || 0))} min={0} disabled={autoActive} />
                  <span className={styles.pctLabel}>%</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.stopRow}>
            <div className={styles.stopBlock}>
              <label className={styles.label}>Stop on Profit ($)</label>
              <input type="number" className={styles.autoInput} value={stopOnProfit} onChange={e => setStopOnProfit(e.target.value)} placeholder="—" disabled={autoActive} />
            </div>
            <div className={styles.stopBlock}>
              <label className={styles.label}>Stop on Loss ($)</label>
              <input type="number" className={styles.autoInput} value={stopOnLoss} onChange={e => setStopOnLoss(e.target.value)} placeholder="—" disabled={autoActive} />
            </div>
          </div>

          {autoActive && (
            <div className={styles.autoStatus}>
              <span className={styles.autoStatusDot} />
              <span>{autoRollsLeft === Infinity ? '∞' : autoRollsLeft} rolls remaining</span>
            </div>
          )}

          {autoActive ? (
            <motion.button
              className={styles.stopBtn}
              onClick={onStopAuto}
              whileTap={{ scale: 0.96 }}
            >
              <FaStop /> STOP AUTO
            </motion.button>
          ) : (
            <motion.button
              className={`${styles.autoStartBtn} ${!isBetValid ? styles.rollBtnDisabled : ''}`}
              onClick={onStartAuto}
              disabled={!isBetValid}
              whileTap={isBetValid ? { scale: 0.96 } : {}}
            >
              <FaRobot /> START AUTO
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
