'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useBaccaratEngine } from '@/hooks/useBaccaratEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUndo, FaCheck } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

function BaccaratCard({ card }) {
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

export default function BaccaratPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const game = useBaccaratEngine(balance, subtractBalance, addBalance);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet amount from engine
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  const isIdle = game.gameState === 'idle';
  const isDealing = game.gameState === 'dealing';
  const isResult = game.gameState === 'result';

  const handleDeal = useCallback(() => {
    if (!isIdle) return;
    game.playRound();
    setTimeout(() => checkAchievements(), 2000);
  }, [game, isIdle, checkAchievements]);

  const handleReset = useCallback(() => {
    game.reset();
  }, [game]);

  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;

    setBetInput(cleanValue);

    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed) && parsed > 0) {
      const usdBet = convertActiveToUsd(parsed);
      game.setBetAmount(usdBet);
    }
  }, [game, convertActiveToUsd]);

  const handleQuickBet = useCallback((action) => {
    if (!isIdle) return;
    let newBet = game.betAmount;
    switch (action) {
      case 'half':
        newBet = Math.max(0.10, Math.round((game.betAmount / 2) * 100) / 100);
        break;
      case 'double':
        newBet = Math.round(game.betAmount * 2 * 100) / 100;
        break;
      case 'min':
        newBet = 0.10;
        break;
      case 'max':
        newBet = Math.min(balance, 1000000);
        break;
      default:
        break;
    }
    game.setBetAmount(newBet);
  }, [game, balance, isIdle]);

  if (!mounted) return null;

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.mainContent}>
          <h1 className={styles.title}>Satoshi's Baccarat</h1>
          <p className={styles.subtitle}>Place your bet on Player, Banker, or Tie. Follows standard 8-deck shoe rules.</p>

          <div className={styles.gameGrid}>
            {/* Left Control Panel */}
            <div className={styles.controlPanel}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Bet Amount</label>
                <div className={styles.betInputWrapper}>
                  <span className={styles.currencySymbol}>{activeSymbol}</span>
                  <input
                    type="text"
                    className={styles.betInput}
                    value={betInput}
                    onChange={handleBetInput}
                    disabled={!isIdle}
                  />
                </div>
                <div className={styles.quickBetGrid}>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('half')} disabled={!isIdle}>½</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('double')} disabled={!isIdle}>2×</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('min')} disabled={!isIdle}>MIN</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('max')} disabled={!isIdle}>MAX</button>
                </div>
              </div>

              {/* Bet Spot Selectors */}
              <div className={styles.spotGroup}>
                <label className={styles.label}>Bet Placement</label>
                <div className={styles.spotsGrid}>
                  <button
                    className={`${styles.spotBtn} ${styles.playerSpot} ${game.betType === 'player' ? styles.activePlayer : ''}`}
                    onClick={() => isIdle && game.setBetType('player')}
                    disabled={!isIdle}
                  >
                    <span className={styles.spotLabel}>PLAYER</span>
                    <span className={styles.spotOdds}>Pays 1:1</span>
                  </button>

                  <button
                    className={`${styles.spotBtn} ${styles.bankerSpot} ${game.betType === 'banker' ? styles.activeBanker : ''}`}
                    onClick={() => isIdle && game.setBetType('banker')}
                    disabled={!isIdle}
                  >
                    <span className={styles.spotLabel}>BANKER</span>
                    <span className={styles.spotOdds}>Pays 0.95:1</span>
                  </button>

                  <button
                    className={`${styles.spotBtn} ${styles.tieSpot} ${game.betType === 'tie' ? styles.activeTie : ''}`}
                    onClick={() => isIdle && game.setBetType('tie')}
                    disabled={!isIdle}
                  >
                    <span className={styles.spotLabel}>TIE</span>
                    <span className={styles.spotOdds}>Pays 8:1</span>
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <div className={styles.actionWrapper}>
                {isIdle ? (
                  <button className={styles.dealBtn} onClick={handleDeal}>
                    DEAL CARDS
                  </button>
                ) : isDealing ? (
                  <button className={`${styles.dealBtn} ${styles.dealingBtn}`} disabled>
                    DEALING...
                  </button>
                ) : (
                  <button className={styles.resetBtn} onClick={handleReset}>
                    <FaUndo /> NEW ROUND
                  </button>
                )}
              </div>

              {game.error && <div className={styles.errorText}>{game.error}</div>}

              {/* History Row */}
              <div className={styles.historyPanel}>
                <span className={styles.historyTitle}>Recent Results</span>
                <div className={styles.historyChips}>
                  {game.history.length === 0 ? (
                    <span className={styles.emptyHistory}>No games yet</span>
                  ) : (
                    game.history.map((h, i) => (
                      <span
                        key={i}
                        className={`${styles.historyChip} ${
                          h === 'P' ? styles.historyPlayer : h === 'B' ? styles.historyBanker : styles.historyTie
                        }`}
                      >
                        {h}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Session Stats */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Session Statistics</div>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <span className={styles.statVal}>{game.sessionRounds}</span>
                    <span className={styles.statLabel}>Rounds</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statVal} style={{ color: '#00ff88' }}>
                      {game.sessionWins}
                    </span>
                    <span className={styles.statLabel}>Wins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Felt Table Column */}
            <div className={styles.tableColumn}>
              <div className={styles.tableFelt}>
                <div className={styles.shoeContainer}>
                  <div className={styles.shoeCardBack} />
                  <div className={styles.shoeCardBack} />
                  <div className={styles.shoeCardBack} />
                </div>

                {/* Result overlay banner */}
                <AnimatePresence>
                  {isResult && game.resultType && (
                    <motion.div
                      className={styles.resultBanner}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: 'spring', damping: 15 }}
                    >
                      <div className={`${styles.resultCard} ${
                        game.won ? styles.winCard : styles.loseCard
                      }`}>
                        <span className={styles.resultText}>
                          {game.resultType === 'player' ? '👤 PLAYER WINS!' :
                           game.resultType === 'banker' ? '🏦 BANKER WINS!' :
                           '🤝 TIE RESULT!'}
                        </span>
                        <span className={styles.resultPayout}>
                          {game.payout > 0 ? `+${formatBTC(game.payout)}` : 'No Payout'}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hands Row */}
                <div className={styles.feltContent}>
                  {/* Player Hand */}
                  <div className={styles.handSection}>
                    <div className={styles.handHeader}>
                      <span className={styles.handTitle}>PLAYER</span>
                      {(isDealing || isResult) && (
                        <span className={`${styles.scoreBadge} ${styles.playerBadge}`}>
                          {game.playerTotal}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardsRow}>
                      {game.playerHand.length === 0 ? (
                        <div className={styles.emptyFeltSpot}>Bet on Player 👤</div>
                      ) : (
                        game.playerHand.slice(0, game.visiblePlayerCount).map((card, idx) => (
                          <motion.div
                            key={card.id}
                            className={styles.cardContainer}
                            style={{ marginLeft: idx > 0 ? '-35px' : '0' }}
                            initial={{ x: 200, y: -150, scale: 0.5, rotate: -30, opacity: 0 }}
                            animate={{ x: 0, y: 0, scale: 1, rotate: idx === 2 ? 90 : 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          >
                            <BaccaratCard card={card} />
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Felt Divider */}
                  <div className={styles.feltDivider} />

                  {/* Banker Hand */}
                  <div className={styles.handSection}>
                    <div className={styles.handHeader}>
                      <span className={styles.handTitle}>BANKER</span>
                      {(isDealing || isResult) && (
                        <span className={`${styles.scoreBadge} ${styles.bankerBadge}`}>
                          {game.bankerTotal}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardsRow}>
                      {game.bankerHand.length === 0 ? (
                        <div className={styles.emptyFeltSpot}>Bet on Banker 🏦</div>
                      ) : (
                        game.bankerHand.slice(0, game.visibleBankerCount).map((card, idx) => (
                          <motion.div
                            key={card.id}
                            className={styles.cardContainer}
                            style={{ marginLeft: idx > 0 ? '-35px' : '0' }}
                            initial={{ x: 200, y: -150, scale: 0.5, rotate: -30, opacity: 0 }}
                            animate={{ x: 0, y: 0, scale: 1, rotate: idx === 2 ? 90 : 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          >
                            <BaccaratCard card={card} />
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <VerificationPanel gameType="baccarat" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
