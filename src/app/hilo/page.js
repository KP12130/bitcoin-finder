'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useHiLoEngine } from '@/hooks/useHiLoEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowUp, FaArrowDown, FaCoins, FaInfoCircle, FaTrophy, FaHistory } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

// Suit symbol map
const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// Card Component
function PlayingCard({ card, isMini = false, className = '' }) {
  if (!card) return null;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <div className={`${styles.playingCard} ${isMini ? styles.cardMini : ''} ${isRed ? styles.cardRed : styles.cardBlack} ${className}`}>
      <div className={styles.cardCornerTop}>
        <span className={styles.cardVal}>{card.label}</span>
        <span className={styles.cardSuitSymbol}>{suitSymbol}</span>
      </div>
      {!isMini && <div className={styles.cardCenterSuit}>{suitSymbol}</div>}
      <div className={styles.cardCornerBottom}>
        <span className={styles.cardVal}>{card.label}</span>
        <span className={styles.cardSuitSymbol}>{suitSymbol}</span>
      </div>
    </div>
  );
}

export default function HiLoPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const game = useHiLoEngine(balance, subtractBalance, addBalance);

  const { currency, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const isIdle = game.gameState === 'idle';
  const isPlaying = game.gameState === 'playing';
  const isWon = game.gameState === 'won';
  const isLost = game.gameState === 'lost';
  const isFinished = isWon || isLost;

  const odds = useMemo(() => {
    return game.getOdds();
  }, [game]);

  const handleStart = useCallback(() => {
    game.startGame();
  }, [game]);

  const handleGuess = useCallback((direction) => {
    game.guess(direction);
    if (game.gameState === 'lost' || game.gameState === 'won') {
      checkAchievements();
    }
  }, [game, checkAchievements]);

  const handleCashout = useCallback(() => {
    game.cashOut();
    checkAchievements();
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
    if (isPlaying) return;
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
  }, [game, balance, isPlaying]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Hi-Lo...</p>
      </div>
    );
  }

  const canPlay = !isPlaying && balance >= game.betAmount && game.betAmount >= 0.10;
  const currentPayout = Math.round(game.betAmount * game.currentMultiplier * 100) / 100;

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>
            {/* Left Controls column */}
            <div className={styles.controlsPanel}>
              <div>
                <h1 className={styles.title}>Hi-Lo 📈📉</h1>
                <p className={styles.subtitle}>Predict if the next card will be Higher or Lower than the current card. Shuffled 52-card deck.</p>
              </div>

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
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying}>½</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying}>2x</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying}>Min</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying}>Max</button>
                  </div>
                </div>
              </div>

              {/* Stats/Multiplier box */}
              {isPlaying && (
                <div className={styles.statsCard}>
                  <div className={styles.statsHeader}>Round Winnings</div>
                  <div className={styles.streakDetails}>
                    <div className={styles.statBox}>
                      <span className={styles.statVal} style={{ color: '#ffd700' }}>
                        {game.currentMultiplier.toFixed(2)}x
                      </span>
                      <span className={styles.statLabel}>Multiplier</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statVal} style={{ color: '#00ff88' }}>
                        {formatBTC(currentPayout)}
                      </span>
                      <span className={styles.statLabel}>Current Payout</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statVal}>
                        {game.streak} {game.streak >= 3 ? '🔥' : '🃏'}
                      </span>
                      <span className={styles.statLabel}>Streak</span>
                    </div>
                  </div>
                </div>
              )}

              {game.error && <div className={styles.error}>{game.error}</div>}

              {/* Action Buttons */}
              <div className={styles.actionSection}>
                {!isPlaying ? (
                  <motion.button
                    className={styles.betBtn}
                    onClick={handleStart}
                    disabled={!canPlay}
                    whileHover={canPlay ? { scale: 1.02 } : {}}
                    whileTap={canPlay ? { scale: 0.98 } : {}}
                  >
                    🃏 START ROUND
                  </motion.button>
                ) : (
                  <div className={styles.activeActions}>
                    <motion.button
                      className={`${styles.betBtn} ${styles.cashoutBtn}`}
                      onClick={handleCashout}
                      disabled={game.streak === 0}
                      whileHover={game.streak > 0 ? { scale: 1.02 } : {}}
                      whileTap={game.streak > 0 ? { scale: 0.98 } : {}}
                      animate={game.streak > 0 ? { boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)'] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      💰 CASHOUT (+{formatBTC(currentPayout)})
                    </motion.button>

                    <button className={styles.resetBtn} onClick={game.resetGame}>
                      Abort Game
                    </button>
                  </div>
                )}
              </div>

              {/* Rules description */}
              <div className={styles.rulesCard}>
                <div className={styles.rulesTitle}>
                  <FaInfoCircle /> Info
                </div>
                <ul className={styles.rulesList}>
                  <li>Aces are 1 (lowest). Kings are 13 (highest).</li>
                  <li>Ties (same label value) result in a loss.</li>
                  <li>Multipliers are computed using exact odds of remaining deck cards.</li>
                  <li>You can cash out at any time after 1 correct guess.</li>
                </ul>
              </div>
            </div>

            {/* Right Card display column */}
            <div className={styles.cardColumn}>
              {/* Card visualizer container */}
              <div className={styles.deckContainer}>
                {/* Result overlay */}
                <AnimatePresence>
                  {isFinished && (
                    <motion.div
                      className={styles.resultOverlay}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className={`${styles.resultCard} ${isWon ? styles.cardWin : styles.cardLoss}`}>
                        <span className={styles.resultEmoji}>{isWon ? '🏆' : '💀'}</span>
                        <span className={styles.resultTitleText}>
                          {isWon ? 'Successfully Cashed Out!' : 'Busted!'}
                        </span>
                        {isWon ? (
                          <span className={styles.resultDetails}>
                            Streak: {game.streak} | Payout: {game.currentMultiplier.toFixed(2)}x (+{formatBTC(currentPayout)})
                          </span>
                        ) : (
                          <span className={styles.resultDetails}>
                            Unfortunate! Keep guessing to find the streaks.
                          </span>
                        )}
                        <button className={styles.playAgainBtn} onClick={game.resetGame}>
                          Try Again
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* The playing card showcase */}
                <div className={styles.cardShowcase}>
                  <AnimatePresence mode="wait">
                    {game.currentCard ? (
                      <motion.div
                        key={game.currentCard.label + '-' + game.currentCard.suit}
                        initial={{ rotateY: 90, opacity: 0, x: 100 }}
                        animate={{ rotateY: 0, opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ type: 'spring', damping: 15 }}
                        className={styles.cardWrapper}
                      >
                        <PlayingCard card={game.currentCard} />
                      </motion.div>
                    ) : (
                      <div className={styles.deckBackPlaceholder}>
                        <div className={styles.placeholderLogo}>₿</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Higher / Lower action controls */}
                {isPlaying && (
                  <div className={styles.guessControls}>
                    <motion.button
                      className={`${styles.guessBtn} ${styles.btnHigher}`}
                      onClick={() => handleGuess('higher')}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={styles.guessLabelRow}>
                        <FaArrowUp /> HIGHER
                      </div>
                      <span className={styles.guessOddsLabel}>
                        {odds.pHigher > 0 ? `${(odds.pHigher * 100).toFixed(0)}%` : '0%'} Chance
                      </span>
                      <span className={styles.guessMultiplierLabel}>
                        {odds.multHigher > 0 ? `${odds.multHigher}x` : 'N/A'}
                      </span>
                    </motion.button>

                    <motion.button
                      className={`${styles.guessBtn} ${styles.btnLower}`}
                      onClick={() => handleGuess('lower')}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={styles.guessLabelRow}>
                        <FaArrowDown /> LOWER
                      </div>
                      <span className={styles.guessOddsLabel}>
                        {odds.pLower > 0 ? `${(odds.pLower * 100).toFixed(0)}%` : '0%'} Chance
                      </span>
                      <span className={styles.guessMultiplierLabel}>
                        {odds.multLower > 0 ? `${odds.multLower}x` : 'N/A'}
                      </span>
                    </motion.button>
                  </div>
                )}
              </div>

              {/* History Row */}
              {game.history.length > 1 && (
                <div className={styles.historyCard}>
                  <div className={styles.historyLabel}>
                    <FaHistory /> Draw History
                  </div>
                  <div className={styles.historyRow}>
                    {game.history.map((card, i) => (
                      <PlayingCard key={i} card={card} isMini={true} />
                    ))}
                  </div>
                </div>
              )}

              <VerificationPanel gameType="hilo" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
