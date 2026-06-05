'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useCoinFlipEngine } from '@/hooks/useCoinFlipEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaDice, FaCoins, FaInfoCircle } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

export default function CoinFlipPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGameFinished = useCallback((result) => {
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Coin Flip',
      bet: result.bet,
      multiplier: result.won ? '1.96x' : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [addBet, profile, user]);

  const game = useCoinFlipEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet amount between hook and local string state
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const handleFlip = useCallback(() => {
    game.playRound();
    setTimeout(() => checkAchievements(), 1500);
  }, [game, checkAchievements]);

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

  const handleQuickBet = useCallback((action) => {
    switch (action) {
      case 'half':
        game.setBetAmount(Math.max(0.10, Math.round((game.betAmount / 2) * 100) / 100));
        break;
      case 'double':
        game.setBetAmount(Math.min(balance, Math.round(game.betAmount * 2 * 100) / 100));
        break;
      case 'min':
        game.setBetAmount(0.10);
        break;
      case 'max':
        game.setBetAmount(balance);
        break;
    }
  }, [game, balance]);

  const handleBailout = useCallback(() => {
    claimBailout();
  }, [claimBailout]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Coin Flip...</p>
      </div>
    );
  }

  const isFlipping = game.gameState === 'flipping';
  const isResult = game.gameState === 'result';
  const isIdle = game.gameState === 'idle';
  const canBet = !isFlipping && balance > 0 && game.betAmount > 0 && game.betAmount <= balance;

  // Render correct landing angle based on deterministic outcome
  const getCoinRotation = () => {
    if (isFlipping) return {};
    if (game.resultSide === 'tails') {
      return { transform: 'rotateY(180deg)' };
    }
    return { transform: 'rotateY(0deg)' };
  };

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.coinflipPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>🪙 Coin Flip</h1>
            <p className={styles.pageSubtitle}>
              Predict Heads or Tails — double up wagers instantly!
            </p>
          </div>

          {/* Bankrupt Banner */}
          <AnimatePresence>
            {isBankrupt && isIdle && (
              <motion.div
                className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p>📉 You&apos;re broke! Claim a bailout to keep playing.</p>
                <button className={styles.bailoutBtn} onClick={handleBailout}>
                  Claim {formatBTC(10)} Bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Area Grid */}
          <div className={styles.gameLayout}>
            {/* ─── Left Side: Bet & Prediction Choices ───────────────────────── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                {/* Bet Input */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaDice className={styles.fieldIcon} />
                    Bet Amount
                  </label>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      className={styles.betInput}
                      value={betInput}
                      onChange={handleBetInput}
                      disabled={isFlipping}
                      placeholder="0.00"
                    />
                    <span className={styles.inputUnit}>{activeSymbol}</span>
                  </div>
                  <div className={styles.quickBets}>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('half')} disabled={isFlipping}>½</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('double')} disabled={isFlipping}>2×</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('min')} disabled={isFlipping}>Min</button>
                    <button className={styles.quickBtn} onClick={() => handleQuickBet('max')} disabled={isFlipping}>Max</button>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Heads / Tails Selector */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <FaCoins className={styles.fieldIcon} />
                    Choose Side
                  </label>
                  <div className={styles.sideButtons}>
                    <button
                      className={`${styles.sideSelectBtn} ${game.chosenSide === 'heads' ? styles.sideSelectActive : ''}`}
                      onClick={() => game.setChosenSide('heads')}
                      disabled={isFlipping}
                    >
                      <div className={styles.sideBtnLabel}>HEADS</div>
                      <div className={styles.sideBtnSymbol}>₿</div>
                    </button>
                    <button
                      className={`${styles.sideSelectBtn} ${game.chosenSide === 'tails' ? styles.sideSelectActive : ''}`}
                      onClick={() => game.setChosenSide('tails')}
                      disabled={isFlipping}
                    >
                      <div className={styles.sideBtnLabel}>TAILS</div>
                      <div className={styles.sideBtnSymbol}>1</div>
                    </button>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Win Probabilities / Stats Display */}
                <div className={styles.statsCard}>
                  <div className={styles.statRow}>
                    <span>Multiplier</span>
                    <strong className={styles.goldText}>1.96x</strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Win Chance</span>
                    <strong className={styles.blueText}>50.00%</strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Profit on Win</span>
                    <strong className={styles.greenText}>+{formatBTC(game.betAmount * 0.96)}</strong>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Flip Action Button */}
                <motion.button
                  className={`${styles.flipButton} ${isFlipping ? styles.flipButtonActive : ''}`}
                  onClick={handleFlip}
                  disabled={!canBet}
                  whileHover={canBet ? { scale: 1.02 } : {}}
                  whileTap={canBet ? { scale: 0.98 } : {}}
                >
                  {isFlipping ? 'SPINNING COIN...' : 'FLIP COIN'}
                </motion.button>
              </div>
            </div>

            {/* ─── Right Side: 3D Animated Coin Display ──────────────────────── */}
            <div className={styles.displayPanel}>
              <div className={styles.visualizerCard}>
                {/* Visual Glow Layer */}
                <div className={`${styles.glowBackground} ${isResult && game.won ? styles.glowWin : ''} ${isResult && !game.won ? styles.glowLoss : ''}`} />

                {/* 3D Coin Wrapper */}
                <div className={styles.coinScene}>
                  <div 
                    className={`${styles.coin} ${isFlipping ? styles.coinSpinning : ''}`}
                    style={getCoinRotation()}
                  >
                    {/* Front Face (Heads) */}
                    <div className={`${styles.coinFace} ${styles.coinFront}`}>
                      <div className={styles.coinInnerCircle}>
                        <FaBitcoin className={styles.bitcoinLogo} />
                      </div>
                    </div>
                    {/* Back Face (Tails) */}
                    <div className={`${styles.coinFace} ${styles.coinBack}`}>
                      <div className={styles.coinInnerCircle}>
                        <div className={styles.tailsLabel}>SATOSHI</div>
                        <div className={styles.tailsValue}>1</div>
                        <div className={styles.tailsSub}>SECURE</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Result Label Text */}
                <div className={styles.outcomeDisplay}>
                  <AnimatePresence mode="wait">
                    {isFlipping && (
                      <motion.div
                        key="spinning-text"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={styles.flippingLabel}
                      >
                        Spinning...
                      </motion.div>
                    )}
                    {isResult && (
                      <motion.div
                        key={`result-text-${game.resultSide}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={styles.resultLabel}
                      >
                        {game.won ? (
                          <span className={styles.winText}>
                            🏆 WINNER! Landed on {game.resultSide.toUpperCase()} (+{formatBTC(game.payout)})
                          </span>
                        ) : (
                          <span className={styles.lossText}>
                            💥 BUSTED! Landed on {game.resultSide.toUpperCase()}
                          </span>
                        )}
                      </motion.div>
                    )}
                    {isIdle && (
                      <div className={styles.idleLabel}>
                        Pick a side & flip the coin!
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* History Track */}
              {game.lastResults.length > 0 && (
                <div className={styles.historySection}>
                  <div className={styles.historyTitle}>Recent Outcomes</div>
                  <div className={styles.historyPills}>
                    {game.lastResults.map((r, i) => (
                      <motion.div
                        key={i}
                        className={`${styles.historyPill} ${r.won ? styles.pillWin : styles.pillLoss}`}
                        initial={{ opacity: 0, scale: 0.5, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        title={`Result: ${r.result.toUpperCase()} | Chosen: ${r.chosenSide.toUpperCase()}`}
                      >
                        {r.result === 'heads' ? 'H' : 'T'}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Tips Card */}
              <div className={styles.howToPlay}>
                <h3 className={styles.howTitle}>How it works</h3>
                <div className={styles.howBody}>
                  <FaInfoCircle className={styles.howIcon} />
                  <p>
                    Coin Flip is a simple 50/50 chance game. Choose either <strong>Heads</strong> or <strong>Tails</strong> and place your bet. The outcome is generated deterministically using cryptographically secure hashing, guaranteeing a provably fair result. A win awards <strong>1.96x</strong> wagers.
                  </p>
                </div>
              </div>

              {/* Provably Fair Audit Panel */}
              <VerificationPanel gameType="coinflip" />

              {/* Live Bets Ticker */}
              <LiveBetsFeed />
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Celebratory Toast */}
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
