'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useBlackjackEngine } from '@/hooks/useBlackjackEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaHandPaper, FaUndo } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import { playSound } from '@/lib/audio';
import styles from './page.module.css';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// Blackjack Card Component
function BlackjackCard({ card, isHidden = false }) {
  if (isHidden) {
    return (
      <div className={`${styles.card} ${styles.cardBack}`}>
        <div className={styles.cardBackPattern}>
          <span className={styles.bitcoinLogo}>₿</span>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <div className={`${styles.card} ${isRed ? styles.cardRed : styles.cardBlack}`}>
      <div className={styles.cardCornerTop}>
        <span className={styles.cardVal}>{card.label}</span>
        <span className={styles.cardSuitSymbol}>{suitSymbol}</span>
      </div>
      <div className={styles.cardCenterSuit}>{suitSymbol}</div>
      <div className={styles.cardCornerBottom}>
        <span className={styles.cardVal}>{card.label}</span>
        <span className={styles.cardSuitSymbol}>{suitSymbol}</span>
      </div>
    </div>
  );
}

export default function BlackjackPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const game = useBlackjackEngine(balance, subtractBalance, addBalance);

  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
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
  const isDealerTurn = game.gameState === 'dealerTurn';
  const isResolved = game.gameState === 'resolved';

  // Staggered deals sound effect syncing
  useEffect(() => {
    if (game.gameState === 'playing' && game.playerHand.length === 2 && game.dealerHand.length === 2) {
      const t1 = setTimeout(() => playSound('slide'), 100);
      const t2 = setTimeout(() => playSound('slide'), 200);
      const t3 = setTimeout(() => playSound('slide'), 300);
      const t4 = setTimeout(() => playSound('slide'), 400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [game.gameState, game.playerHand.length, game.dealerHand.length]);

  const handleDeal = useCallback(() => {
    game.deal();
  }, [game]);

  const handleHit = useCallback(() => {
    game.hit();
  }, [game]);

  const handleStand = useCallback(() => {
    game.stand();
    checkAchievements();
  }, [game, checkAchievements]);

  const handleDouble = useCallback(() => {
    game.doubleDown();
    checkAchievements();
  }, [game, checkAchievements]);

  const handleReset = useCallback(() => {
    game.resetGame();
  }, [game]);

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
    if (!isIdle) return;
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
  }, [game, balance, isIdle]);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Blackjack...</p>
      </div>
    );
  }

  const canDeal = isIdle && balance >= game.betAmount && game.betAmount >= 0.10;
  const canDouble = isPlaying && balance >= game.currentBet;

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>
            {/* Left Controls column */}
            <div className={styles.controlsPanel}>
              <div>
                <h1 className={styles.title}>Blackjack 🃏</h1>
                <p className={styles.subtitle}>Bitcoin felt tables. Dealer stands on soft 17. Blackjack pays 3:2.</p>
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
                    disabled={!isIdle}
                  />
                  <div className={styles.quickBetGrid}>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('half')} disabled={!isIdle}>½</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('double')} disabled={!isIdle}>2x</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('min')} disabled={!isIdle}>Min</button>
                    <button className={styles.quickBetBtn} onClick={() => handleQuickBet('max')} disabled={!isIdle}>Max</button>
                  </div>
                </div>
              </div>

              {/* Current Round Bet display */}
              {!isIdle && (
                <div className={styles.currentBetBox}>
                  <span className={styles.betLabel}>ACTIVE WAGER</span>
                  <span className={styles.betVal}>{formatBTC(game.currentBet)}</span>
                </div>
              )}

              {game.error && <div className={styles.error}>{game.error}</div>}

              {/* Action buttons */}
              <div className={styles.actionSection}>
                {isIdle ? (
                  <motion.button
                    className={styles.betBtn}
                    onClick={handleDeal}
                    disabled={!canDeal}
                    whileHover={canDeal ? { scale: 1.02 } : {}}
                    whileTap={canDeal ? { scale: 0.98 } : {}}
                  >
                    🃏 DEAL CARDS
                  </motion.button>
                ) : isPlaying ? (
                  <div className={styles.playActionsGrid}>
                    <motion.button
                      className={`${styles.playActionBtn} ${styles.btnHit}`}
                      onClick={handleHit}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <FaPlus /> HIT
                    </motion.button>

                    <motion.button
                      className={`${styles.playActionBtn} ${styles.btnStand}`}
                      onClick={handleStand}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <FaHandPaper /> STAND
                    </motion.button>

                    <motion.button
                      className={`${styles.playActionBtn} ${styles.btnDouble}`}
                      onClick={handleDouble}
                      disabled={!canDouble}
                      whileHover={canDouble ? { scale: 1.03 } : {}}
                      whileTap={canDouble ? { scale: 0.97 } : {}}
                    >
                      2× DOUBLE
                    </motion.button>
                  </div>
                ) : (
                  <button className={styles.betBtn} onClick={handleReset}>
                    <FaUndo /> NEW ROUND
                  </button>
                )}
              </div>

              {/* Session Stats */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Session Statistics</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{game.sessionHands}</span>
                    <span className={styles.statLabel}>Hands</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>
                      {game.sessionWins}
                    </span>
                    <span className={styles.statLabel}>Wins</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00d4ff' }}>
                      {game.sessionPushes}
                    </span>
                    <span className={styles.statLabel}>Pushes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Table Felt column */}
            <div className={styles.tableColumn}>
              <div className={styles.tableFelt}>
                {/* Visual Dealer Shoe */}
                <div className={styles.dealerShoe}>
                  <div className={styles.shoeDeckBack} />
                  <div className={styles.shoeDeckBack} />
                  <div className={styles.shoeDeckBack} />
                </div>

                {/* Result overlay banner */}
                <AnimatePresence>
                  {isResolved && game.result && (
                    <motion.div
                      className={styles.resultBanner}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', damping: 12 }}
                    >
                      <div className={`${styles.resultCard} ${
                        game.result === 'win' || game.result === 'blackjack' ? styles.winCard :
                        game.result === 'push' ? styles.pushCard :
                        styles.loseCard
                      }`}>
                        <span className={styles.resultText}>
                          {game.result === 'blackjack' ? '👑 BLACKJACK!' :
                           game.result === 'win' ? '🎉 YOU WIN!' :
                           game.result === 'push' ? '🤝 PUSH' :
                           game.result === 'bust' ? '💥 BUSTED!' :
                           '❌ DEALER WINS'}
                        </span>
                        <span className={styles.resultPayout}>
                          {game.payout > 0 ? `+${formatBTC(game.payout)}` : 'No payout'}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hand layouts: Dealer top, Player bottom */}
                <div className={styles.feltContent}>
                  {/* Dealer Section */}
                  <div className={styles.handSection}>
                    <div className={styles.handHeader}>
                      <span className={styles.handTitle}>DEALER HAND</span>
                      {!isIdle && (
                        <span className={styles.scoreBadge}>
                          {game.dealerHidden ? '?' : game.dealerTotal}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardsRow}>
                      {game.dealerHand.length === 0 ? (
                        <div className={styles.emptyFeltSpot}>Place your bet</div>
                      ) : (
                        game.dealerHand.map((card, idx) => {
                          const delay = idx < 2 ? 0.2 + idx * 0.2 : 0; // Dealer card 1 (0.2s), Dealer card 2 (0.4s)
                          return (
                            <motion.div
                              key={card.id}
                              className={styles.cardContainer}
                              style={{ marginLeft: idx > 0 ? '-45px' : '0' }}
                              initial={{ x: 250, y: -200, scale: 0.2, rotate: -45, opacity: 0 }}
                              animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 100, damping: 13, delay }}
                            >
                              <BlackjackCard card={card} isHidden={idx === 1 && game.dealerHidden} />
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className={styles.feltDivider} />

                  {/* Player Section */}
                  <div className={styles.handSection}>
                    <div className={styles.handHeader}>
                      <span className={styles.handTitle}>YOUR HAND</span>
                      {!isIdle && (
                        <span className={styles.scoreBadge}>
                          {game.playerTotal}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardsRow}>
                      {game.playerHand.length === 0 ? (
                        <div className={styles.emptyFeltSpot}>Your cards will appear here</div>
                      ) : (
                        game.playerHand.map((card, idx) => {
                          const delay = idx < 2 ? 0.1 + idx * 0.2 : 0; // Player card 1 (0.1s), Player card 2 (0.3s)
                          return (
                            <motion.div
                              key={card.id}
                              className={styles.cardContainer}
                              style={{ marginLeft: idx > 0 ? '-45px' : '0' }}
                              initial={{ x: 250, y: -200, scale: 0.2, rotate: -45, opacity: 0 }}
                              animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 100, damping: 13, delay }}
                            >
                              <BlackjackCard card={card} />
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <VerificationPanel gameType="blackjack" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
