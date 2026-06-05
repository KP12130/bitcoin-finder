'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useMinesEngine } from '@/hooks/useMinesEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { getMinesMultiplier } from '@/lib/combinations';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

export default function MinesPage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();

  const [sessionWagered, setSessionWagered] = useState(0);
  const [sessionWon, setSessionWon] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [peakWin, setPeakWin] = useState(0);
  const [error, setError] = useState('');

  const handleGameFinished = useCallback(({ win, payout, multiplier }) => {
    if (win) {
      setSessionWon((p) => p + payout);
      setPeakWin((p) => Math.max(p, multiplier));
    }
    checkAchievements();
  }, [checkAchievements]);

  const game = useMinesEngine(balance, subtractBalance, addBalance, handleGameFinished);

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;
    
    setBetInput(cleanValue);
    
    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed)) {
      const usdBet = convertActiveToUsd(parsed);
      game.setBetAmount(usdBet);
    }
  }, [game, convertActiveToUsd]);

  const handleStart = useCallback(() => {
    setError('');
    const result = game.startGame();
    if (result?.error) {
      setError(result.error);
    } else {
      setGamesPlayed((p) => p + 1);
      setSessionWagered((p) => p + game.betAmount);
    }
  }, [game]);

  const handleCashout = useCallback(() => {
    game.cashOut();
  }, [game]);

  // Beta shortcuts: Max, Min, Half, Double
  const handleHalfBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount((prev) => Math.max(0.10, Math.round((prev / 2) * 100) / 100));
  }, [game]);

  const handleDoubleBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount((prev) => Math.min(balance, Math.round(prev * 2 * 100) / 100));
  }, [balance, game]);

  const handleMaxBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount(balance);
  }, [balance, game]);

  const handleMinBet = useCallback(() => {
    if (game.gameState === 'playing') return;
    game.setBetAmount(0.10);
  }, [game]);

  const currentMultiplier = getMinesMultiplier(game.minesCount, game.gemsFound);
  const nextMultiplier = getMinesMultiplier(game.minesCount, game.gemsFound + 1);
  const currentPayout = Math.round(game.betAmount * currentMultiplier * 100) / 100;
  const isPlaying = game.gameState === 'playing';

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">

          {/* Grid Split */}
          <div className={styles.grid}>

            {/* Left Controls column */}
            <div className={styles.controlsPanel}>
              <h1 className={styles.title}>Satoshi Mines 💣💎</h1>
              <p className={styles.subtitle}>Flipping cells for gems. Cash out at any time. Avoid hidden mines!</p>

              {/* Bet amount */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount</div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={betInput}
                    onChange={handleBetInput}
                    disabled={isPlaying}
                  />
                  <div className={styles.quickBetGrid}>
                    <button className={styles.quickBetBtn} onClick={handleHalfBet} disabled={isPlaying}>½</button>
                    <button className={styles.quickBetBtn} onClick={handleDoubleBet} disabled={isPlaying}>2x</button>
                    <button className={styles.quickBetBtn} onClick={handleMinBet} disabled={isPlaying}>Min</button>
                    <button className={styles.quickBetBtn} onClick={handleMaxBet} disabled={isPlaying}>Max</button>
                  </div>
                </div>
              </div>

              {/* Mines selector */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Mines: {game.minesCount}</div>
                <input
                  type="range"
                  className={styles.slider}
                  min={1}
                  max={24}
                  value={game.minesCount}
                  onChange={(e) => game.setMinesCount(Number(e.target.value))}
                  disabled={isPlaying}
                />
                <div className={styles.oddsPreview}>
                  <div>Win Chance: {(( (25 - game.minesCount) / 25 ) * 100).toFixed(0)}%</div>
                  <div>Next Gem: {nextMultiplier}x</div>
                </div>
              </div>

              {/* Master Bet Action Button */}
              {!isPlaying ? (
                <motion.button
                  className={styles.betBtn}
                  onClick={handleStart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  💣 Start Game
                </motion.button>
              ) : (
                <motion.button
                  className={`${styles.betBtn} ${styles.cashoutBtn}`}
                  onClick={handleCashout}
                  disabled={game.gemsFound === 0}
                  whileHover={game.gemsFound > 0 ? { scale: 1.02 } : {}}
                  whileTap={game.gemsFound > 0 ? { scale: 0.97 } : {}}
                  animate={game.gemsFound > 0 ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)'] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  💰 Cash Out ({formatBTC(currentPayout)})
                </motion.button>
              )}

              {error && <div className={styles.error}>{error}</div>}

              {/* Stats card */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Mines Session Stats</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{gamesPlayed}</span>
                    <span className={styles.statLabel}>Games Played</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{formatBTC(sessionWagered)}</span>
                    <span className={styles.statLabel}>Total Wagered</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>+{formatBTC(sessionWon)}</span>
                    <span className={styles.statLabel}>Total Won</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#ffd700' }}>{peakWin}x</span>
                    <span className={styles.statLabel}>Peak Multiplier</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 5x5 Mines Grid */}
            <div className={styles.gridColumn}>

              {/* Multiplier status bar */}
              <div className={styles.statusBar}>
                {isPlaying ? (
                  <div className={styles.statusRow}>
                    <div className={styles.statusIndicator}>
                      💎 Gems found: <strong>{game.gemsFound} / {25 - game.minesCount}</strong>
                    </div>
                    <div className={styles.multiplierLabel}>
                      Current: <strong style={{ color: '#ffd700' }}>{currentMultiplier}x</strong>
                    </div>
                    <div className={styles.multiplierLabel}>
                      Next Gem: <strong style={{ color: '#00ff88' }}>{nextMultiplier}x</strong>
                    </div>
                  </div>
                ) : game.gameState === 'won' ? (
                  <div className={styles.winBar}>🎉 Cashout Successful! Won <strong>{formatBTC(currentPayout)} ({currentMultiplier}x)</strong></div>
                ) : game.gameState === 'lost' ? (
                  <div className={styles.lostBar}>💥 Exploded! Better luck next round!</div>
                ) : (
                  <div className={styles.idleBar}>Select bet amount, choose mine count, and click Start!</div>
                )}
              </div>

              {/* The 5x5 Matrix */}
              <div className={`${styles.minesGrid} ${game.gameState === 'lost' ? styles.gridExploded : ''}`}>
                {Array(25).fill(null).map((_, i) => {
                  const isRevealed = game.revealed[i];
                  const item = game.grid[i];

                  return (
                    <div
                      key={i}
                      className={styles.cardContainer}
                      onClick={() => game.revealCell(i)}
                    >
                      <motion.div
                        className={`${styles.card} ${isRevealed ? styles.cardFlipped : ''}`}
                        animate={{ rotateY: isRevealed ? 180 : 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                      >
                        {/* Front (Facedown) */}
                        <div className={styles.cardFront}>
                          <div className={styles.satoshiDot} />
                        </div>

                        {/* Back (Revealed) */}
                        <div className={`${styles.cardBack} ${
                          isRevealed 
                            ? (item === 'mine' ? styles.backMine : styles.backGem) 
                            : ''
                        }`}>
                          {isRevealed && (item === 'mine' ? '💣' : '💎')}
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
              <VerificationPanel gameType="mines" />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
