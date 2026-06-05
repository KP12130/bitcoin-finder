'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useChickenRoadEngine, STAKE_CHICKEN_CONFIG } from '@/hooks/useChickenRoadEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { useLiveBets } from '@/hooks/useLiveBets';
import { useProfile } from '@/hooks/useProfile';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaInfoCircle } from 'react-icons/fa';
import VerificationPanel from '@/components/VerificationPanel/VerificationPanel';
import styles from './page.module.css';

export default function ChickenRoadPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements, newlyUnlocked, dismissNotification } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);
  const roadScrollRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGameFinished = useCallback((result) => {
    addBet({
      name: profile?.username || 'Player',
      avatarEmoji: profile?.avatarEmoji || '⛏️',
      game: 'Chicken Road',
      bet: result.bet,
      multiplier: result.multiplier > 0 ? `${parseFloat(result.multiplier).toFixed(2)}x` : '0.00x',
      payout: result.payout,
      won: result.won,
      isPlayer: true,
      user_id: user?.id || null
    });
  }, [addBet, profile, user]);

  const game = useChickenRoadEngine(balance, subtractBalance, addBalance, handleGameFinished);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet amount
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  // Center scroll chicken horizontally
  useEffect(() => {
    if (roadScrollRef.current) {
      const scrollContainer = roadScrollRef.current;
      
      const timeoutId = setTimeout(() => {
        const corridor = scrollContainer.children[0];
        if (!corridor) return;

        if (game.gameState === 'idle' || (game.gameState === 'playing' && game.currentStep === 0)) {
          scrollContainer.scrollLeft = 0;
        } else if (game.gameState === 'playing' && game.currentStep > 0) {
          const chickenCol = corridor.children[game.currentStep]; 
          if (chickenCol) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const colRect = chickenCol.getBoundingClientRect();
            
            const relativeLeft = (colRect.left - containerRect.left) + scrollContainer.scrollLeft;
            const targetScroll = Math.max(0, relativeLeft - (containerRect.width / 2) + (colRect.width / 2));
            
            // Manual smooth scroll animation to bypass browser bugs
            const startScroll = scrollContainer.scrollLeft;
            const distance = targetScroll - startScroll;
            if (Math.abs(distance) > 1) {
              const duration = 300; // ms
              const startTime = performance.now();
              const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOutQuad = progress * (2 - progress);
                scrollContainer.scrollLeft = startScroll + distance * easeOutQuad;
                if (progress < 1) requestAnimationFrame(animate);
              };
              requestAnimationFrame(animate);
            }
          }
        }
      }, 60);

      return () => clearTimeout(timeoutId);
    }
  }, [game.currentStep, game.gameState]);

  const config = STAKE_CHICKEN_CONFIG[game.difficulty] || STAKE_CHICKEN_CONFIG.medium;

  const handleTakeStep = useCallback(() => {
    game.takeManualStep();
  }, [game]);

  const handleCashOut = useCallback(() => {
    game.cashOut();
    setTimeout(() => checkAchievements(), 800);
  }, [game, checkAchievements]);

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
        <p>Loading Chicken Road...</p>
      </div>
    );
  }

  const isPlaying = game.gameState === 'playing';
  const isIdle = game.gameState === 'idle';
  const isLost = game.gameState === 'lost';
  const isWon = game.gameState === 'won';



  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.cryptopopPage}>
        <div className="page-container">
          {/* Header */}
          <div className={styles.pageHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className={styles.pageTitle}>🐓 CHICKEN ROAD</h1>
              <div className={styles.liveMeta}>
                <span className={styles.onlineBadge}>● Online: 3889</span>
                <span className={styles.liveBetsLink}>Live wins</span>
              </div>
            </div>
            <div className={styles.headerRightActions}>
              <button className={styles.helpBtn}><FaInfoCircle /> How to play?</button>
            </div>
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
                  Claim bailout
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Master Layout */}
          <div className={styles.highwayLayout}>
            {/* ─── Left: Unified standard casino bet panel ──────────────────── */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>
                
                {/* Bet Amount Row */}
                <div className={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.unifiedLabelHeader}>
                      <span className={styles.goldBitcoinIcon}>₿</span> BET AMOUNT
                    </div>
                    <span className={styles.usdValueLabel}>Balance: <strong style={{ color: '#ffd666' }}>${balance.toFixed(2)}</strong></span>
                  </div>
                  <div className={styles.unifiedInputArea}>
                    <span className={styles.goldDollarIcon}>$</span>
                    <input
                      type="text"
                      className={styles.monospaceTextField}
                      value={betInput}
                      onChange={handleBetInput}
                      disabled={isPlaying}
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.unifiedQuickBetButtons}>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('half')} disabled={isPlaying}>½</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('double')} disabled={isPlaying}>2x</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('min')} disabled={isPlaying}>Min</button>
                    <button className={styles.fractionQuickBtn} onClick={() => handleQuickBet('max')} disabled={isPlaying}>Max</button>
                  </div>
                </div>

                {/* Triggers */}
                <div className={styles.actionBlock} style={{ marginTop: '0.8rem' }}>
                  {isIdle || isLost || isWon ? (
                    <button
                      className={styles.dashGoBtnPrimaryBlue}
                      onClick={game.startGame}
                      disabled={balance <= 0 || game.betAmount > balance}
                    >
                      Bet
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.8rem', width: '100%' }}>
                      <button
                        className={`${styles.dashCashoutBtn} ${game.currentStep > 0 ? styles.dashCashoutEnabled : ''}`}
                        onClick={handleCashOut}
                        disabled={game.currentStep === 0}
                      >
                        <div className={styles.cashLabel}>CASH OUT</div>
                        <div className={styles.cashAmt}>{game.getStepMultiplier(game.currentStep, game.difficulty).toFixed(2)}x</div>
                      </button>

                      <button
                        className={styles.stepManualBtn}
                        onClick={handleTakeStep}
                      >
                        STEP
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom presets */}
                <div className={styles.presetsPanelGrid} style={{ marginTop: '0.5rem' }}>
                  {[
                    { key: 'easy', label: 'SAFE MODE', color: '#00ff88', emoji: '🟢' },
                    { key: 'medium', label: 'BALANCED', color: '#ffd666', emoji: '🟡' },
                    { key: 'hard', label: 'RISKY', color: '#ff4757', emoji: '🔴' },
                    { key: 'expert', label: 'YOLO', color: '#a0a0ff', emoji: '💀' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      className={`${styles.presetBtnOption} ${game.difficulty === opt.key ? styles.presetActive : ''}`}
                      onClick={() => game.setDifficulty(opt.key)}
                      disabled={isPlaying}
                    >
                      <span className={styles.presetDot}>{opt.emoji}</span>
                      <span className={styles.presetText}>{opt.label}</span>
                    </button>
                  ))}
                </div>

              </div>
            </div>

            {/* ─── Right: Single path horizonal highway corridor ─────────────── */}
            <div className={styles.displayPanel} style={{ flex: 1.5 }}>
              <div ref={roadScrollRef} className={`${styles.roadScrollWrapper} ${isLost ? styles.cardBurst : ''} ${isWon ? styles.cardCashout : ''}`}>
                <div className={styles.highwayCorridor}>
                  
                  {/* Start Arch */}
                  <div className={styles.startSegment}>
                    <div className={styles.startArchDoor} />
                    {game.currentStep === 0 && !isLost && (
                      <motion.div 
                        className={styles.chickStandby}
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                      >
                        🐥
                      </motion.div>
                    )}
                  </div>

                  {/* N Columns along the single horizontal path */}
                  {Array.from({ length: config.maxSteps }).map((_, cIdx) => {
                    const stepMult = config.multipliers[cIdx];
                    const stepNum = cIdx + 1;
                    const isCurrentActive = cIdx === game.currentStep && isPlaying;
                    const isPassed = cIdx < game.currentStep;
                    const isFuture = cIdx > game.currentStep;
                    const isDiedHere = game.trapIndex === cIdx;
                    const showTraps = isLost || isWon;

                    return (
                      <div 
                        key={cIdx} 
                        className={`
                          ${styles.roadColumn} 
                          ${isCurrentActive ? styles.roadColumnActive : ''} 
                          ${isPassed ? styles.roadColumnPassed : ''}
                        `}
                      >
                        <div className={styles.dividerStripe} />

                        <div className={styles.tileCellWrapper}>
                          {/* Future / Active state button */}
                          {!isPassed && !isDiedHere && (
                            <button
                              className={`${styles.archBtn} ${isCurrentActive ? styles.archBtnActive : ''}`}
                              disabled={!isCurrentActive}
                              onClick={handleTakeStep}
                            >
                              {isCurrentActive ? (
                                <span className={styles.potentialBadge}>?</span>
                              ) : (
                                <span className={styles.futureBadge}>{stepMult.toFixed(2)}x</span>
                              )}
                            </button>
                          )}

                          {/* Clicked & Safe */}
                          {isPassed && !isDiedHere && (
                            <motion.div 
                              className={styles.safeArchedContainer}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <div className={styles.safeBadgeRing}>{stepMult.toFixed(2)}x</div>
                              {cIdx === game.currentStep - 1 && (
                                <motion.div 
                                  className={styles.chickenCharacter}
                                  animate={{ y: [0, -3, 0] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                >
                                  🐔
                                </motion.div>
                              )}
                            </motion.div>
                          )}

                          {/* Trap hit */}
                          {isDiedHere && (
                            <motion.div 
                              className={styles.trapCoinContainer}
                              initial={{ scale: 0, rotate: 45 }}
                              animate={{ scale: 1, rotate: 0 }}
                            >
                              <div className={styles.trapCoin}>
                                <span>😵</span>
                              </div>
                            </motion.div>
                          )}

                          {/* trap reveal on other tiles */}
                          {showTraps && game.trapIndex !== -1 && game.trapIndex !== cIdx && cIdx > game.trapIndex && (
                            <div className={styles.revealedTrapIcon}>🚘</div>
                          )}
                        </div>

                        <div className={styles.sewerFloorSection}>
                          <span className={styles.stepIndicatorLabel}>Step {stepNum}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Finishing tunnel */}
                  <div className={styles.finishSegment}>
                    <div className={styles.finishArch} />
                    {isWon && (
                      <motion.div 
                        className={styles.chickStandby}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      >
                        👑🐥
                      </motion.div>
                    )}
                  </div>

                </div>
              </div>

              {/* Other details */}
              <div className={styles.boardLowerMeta}>
                {game.chickenHistory.length > 0 && (
                  <div className={styles.historySection}>
                    <div className={styles.historyTitle}>Recent Runs</div>
                    <div className={styles.historyPills}>
                      {game.chickenHistory.map((r, i) => (
                        <div
                          key={i}
                          className={`${styles.historyPill} ${r.won ? styles.pillWin : styles.pillLoss}`}
                        >
                          🏃 {r.difficulty.toUpperCase()} → {r.multiplier.toFixed(2)}x
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <VerificationPanel gameType="chickenroad" />
                <LiveBetsFeed />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
