'use client';
import { useState } from 'react';
import styles from './AutoPanel.module.css';

export default function AutoPanel({
  isRunning,
  onStart,
  onStop,
  roundsDone = 0,
  totalRounds = 0,
  sessionPnl = 0,
  children, // game-specific slot (gem count, floor target, step count, etc.)
}) {
  const [rounds, setRounds] = useState(10);
  const [infinite, setInfinite] = useState(false);
  const [stopOnProfit, setStopOnProfit] = useState('');
  const [stopOnLoss, setStopOnLoss] = useState('');
  const [onWin, setOnWin] = useState('reset');
  const [onWinPct, setOnWinPct] = useState(50);
  const [onLoss, setOnLoss] = useState('same');
  const [onLossPct, setOnLossPct] = useState(100);

  const handleStart = () => {
    onStart({
      rounds: infinite ? Infinity : Math.max(1, rounds),
      stopOnProfit: parseFloat(stopOnProfit) || 0,
      stopOnLoss: parseFloat(stopOnLoss) || 0,
      onWin,
      onWinPct: parseFloat(onWinPct) || 0,
      onLoss,
      onLossPct: parseFloat(onLossPct) || 0,
    });
  };

  const pnlColor = sessionPnl >= 0 ? '#00ff88' : '#ff4757';

  return (
    <div className={styles.panel}>
      {/* Game-specific slot (gem count, target floor, etc.) */}
      {children && <div className={styles.gameSlot}>{children}</div>}

      {/* Number of rounds */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Number of Rounds</label>
        <div className={styles.roundsRow}>
          <input
            id="auto-rounds"
            type="number" min={1} max={1000}
            value={rounds}
            onChange={e => setRounds(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            disabled={infinite || isRunning}
            className={styles.numberInput}
          />
          <label className={`${styles.infiniteToggle} ${infinite ? styles.infiniteOn : ''}`}>
            <input
              type="checkbox"
              checked={infinite}
              onChange={e => setInfinite(e.target.checked)}
              disabled={isRunning}
            />
            <span>∞ Infinite</span>
          </label>
        </div>
      </div>

      {/* Stop conditions */}
      <div className={styles.stopGrid}>
        <div className={styles.stopBlock}>
          <label className={styles.fieldLabel}>Stop on Profit ($)</label>
          <input
            type="number" min={0} step={0.01} placeholder="Disabled"
            value={stopOnProfit}
            onChange={e => setStopOnProfit(e.target.value)}
            disabled={isRunning}
            className={styles.numberInput}
          />
        </div>
        <div className={styles.stopBlock}>
          <label className={styles.fieldLabel}>Stop on Loss ($)</label>
          <input
            type="number" min={0} step={0.01} placeholder="Disabled"
            value={stopOnLoss}
            onChange={e => setStopOnLoss(e.target.value)}
            disabled={isRunning}
            className={styles.numberInput}
          />
        </div>
      </div>

      {/* On Win */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>On Win</label>
        <select
          value={onWin} onChange={e => setOnWin(e.target.value)}
          disabled={isRunning} className={styles.selectInput}
        >
          <option value="reset">↩ Reset to Base Bet</option>
          <option value="same">= Keep Same</option>
          <option value="increase">↑ Increase by %</option>
        </select>
        {onWin === 'increase' && (
          <div className={styles.pctRow}>
            <input type="number" min={1} max={500} value={onWinPct}
              onChange={e => setOnWinPct(e.target.value)}
              className={styles.pctInput} disabled={isRunning} />
            <span className={styles.pctLabel}>%</span>
          </div>
        )}
      </div>

      {/* On Loss */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>On Loss</label>
        <select
          value={onLoss} onChange={e => setOnLoss(e.target.value)}
          disabled={isRunning} className={styles.selectInput}
        >
          <option value="same">= Keep Same</option>
          <option value="increase">↑ Martingale (increase by %)</option>
          <option value="reset">↩ Reset to Base Bet</option>
        </select>
        {onLoss === 'increase' && (
          <div className={styles.pctRow}>
            <input type="number" min={1} max={500} value={onLossPct}
              onChange={e => setOnLossPct(e.target.value)}
              className={styles.pctInput} disabled={isRunning} />
            <span className={styles.pctLabel}>%</span>
          </div>
        )}
      </div>

      {/* Progress card (visible when running) */}
      {isRunning && (
        <div className={styles.progressCard}>
          <div className={styles.progressRow}>
            <span>Rounds Played</span>
            <strong>{roundsDone} / {totalRounds === Infinity ? '∞' : totalRounds}</strong>
          </div>
          <div className={styles.progressRow}>
            <span>Session P&L</span>
            <strong style={{ color: pnlColor }}>
              {sessionPnl >= 0 ? '+' : ''}${Math.abs(sessionPnl).toFixed(2)}
              {sessionPnl < 0 ? ' loss' : ''}
            </strong>
          </div>
          {totalRounds !== Infinity && (
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${Math.min((roundsDone / totalRounds) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Start / Stop */}
      {!isRunning ? (
        <button className={styles.startBtn} onClick={handleStart} id="auto-start-btn">
          ▶ Start Auto
        </button>
      ) : (
        <button className={styles.stopBtn} onClick={onStop} id="auto-stop-btn">
          ⏹ Stop Auto
        </button>
      )}
    </div>
  );
}
