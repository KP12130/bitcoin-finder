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
import AutoPanel from '@/components/AutoPanel/AutoPanel';
import styles from './page.module.css';

export default function ChickenRoadPage() {
  const { balance, isLoaded, addBalance, subtractBalance, isBankrupt, claimBailout } = useBalance();
  const { checkAchievements } = useAchievements();
  const { addBet } = useLiveBets();
  const { profile, user } = useProfile();
  const [mounted, setMounted] = useState(false);
  const roadScrollRef = useRef(null);
  const [activeTab, setActiveTab] = useState('manual');

  useEffect(() => { setMounted(true); }, []);

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
  const gameRef = useRef(null);
  gameRef.current = game; // always-current snapshot

  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  const [betInput, setBetInput] = useState('');

  // Sync bet display
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.betAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.betAmount, currency]);

  // Auto-scroll chicken
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
            const startScroll = scrollContainer.scrollLeft;
            const distance = targetScroll - startScroll;
            if (Math.abs(distance) > 1) {
              const duration = 300;
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

  // ─── Auto mode state ──────────────────────────────────────────────────────
  const [autoActive, setAutoActive] = useState(false);
  const [autoRoundsDone, setAutoRoundsDone] = useState(0);
  const [autoTotalRounds, setAutoTotalRounds] = useState(0);
  const [autoSessionPnl, setAutoSessionPnl] = useState(0);
  const [autoStepsTarget, setAutoStepsTarget] = useState(3); // UI: how many steps before cashout

  const autoActiveRef = useRef(false);
  const autoPhaseRef = useRef('idle');
  const autoConfigRef = useRef(null);
  const autoBaseBetRef = useRef(10);
  const autoRoundsDoneRef = useRef(0);
  const autoSessionPnlRef = useRef(0);
  const autoTimerRef = useRef(null);
  const autoStepsTargetRef = useRef(3);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  // ─── Manual handlers ──────────────────────────────────────────────────────
  const isPlaying = game.gameState === 'playing';
  const isIdle = game.gameState === 'idle';
  const isLost = game.gameState === 'lost';
  const isWon = game.gameState === 'won';

  const handleTakeStep = useCallback(() => { game.takeManualStep(); }, [game]);

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
      case 'half': game.setBetAmount(Math.max(0.10, Math.round((game.betAmount / 2) * 100) / 100)); break;
      case 'double': game.setBetAmount(Math.min(balance, Math.round(game.betAmount * 2 * 100) / 100)); break;
      case 'min': game.setBetAmount(0.10); break;
      case 'max': game.setBetAmount(balance); break;
    }
  }, [game, balance]);

  // ─── Auto mode state machine ──────────────────────────────────────────────

  const stopAuto = useCallback(() => {
    autoActiveRef.current = false;
    autoPhaseRef.current = 'idle';
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    setAutoActive(false);
  }, []);

  const applyBetAdjustment = useCallback((won) => {
    const cfg = autoConfigRef.current;
    if (!cfg) return;
    const g = gameRef.current;
    const base = autoBaseBetRef.current;
    const cur = g.betAmount;
    if (won) {
      if (cfg.onWin === 'reset') g.setBetAmount(base);
      else if (cfg.onWin === 'increase') g.setBetAmount(Math.min(balanceRef.current, Math.round(cur * (1 + cfg.onWinPct / 100) * 100) / 100));
    } else {
      if (cfg.onLoss === 'reset') g.setBetAmount(base);
      else if (cfg.onLoss === 'increase') g.setBetAmount(Math.min(balanceRef.current, Math.round(cur * (1 + cfg.onLossPct / 100) * 100) / 100));
    }
  }, []);

  const handleAutoRoundEndRef = useRef(null);
  handleAutoRoundEndRef.current = (won, pnlDelta) => {
    autoSessionPnlRef.current += pnlDelta;
    setAutoSessionPnl(autoSessionPnlRef.current);
    autoRoundsDoneRef.current += 1;
    setAutoRoundsDone(autoRoundsDoneRef.current);

    const cfg = autoConfigRef.current;
    if (!cfg) { stopAuto(); return; }
    const done = autoRoundsDoneRef.current;
    const pnl = autoSessionPnlRef.current;

    if (cfg.rounds !== Infinity && done >= cfg.rounds) { stopAuto(); return; }
    if (cfg.stopOnProfit > 0 && pnl >= cfg.stopOnProfit) { stopAuto(); return; }
    if (cfg.stopOnLoss > 0 && pnl <= -cfg.stopOnLoss) { stopAuto(); return; }
    if (balanceRef.current <= 0) { stopAuto(); return; }

    applyBetAdjustment(won);

    autoPhaseRef.current = 'starting';
    autoTimerRef.current = setTimeout(() => {
      if (!autoActiveRef.current) return;
      const g = gameRef.current;
      g.reset();
      setTimeout(async () => {
        if (!autoActiveRef.current) return;
        await gameRef.current.startGame();
      }, 200);
    }, 1200);
  };

  // State machine: watch gameState + currentStep
  useEffect(() => {
    if (!autoActiveRef.current) return;
    const phase = autoPhaseRef.current;

    if (game.gameState === 'playing' && phase === 'starting') {
      autoPhaseRef.current = 'playing';
      // Schedule first step
      autoTimerRef.current = setTimeout(async () => {
        if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
        await gameRef.current.takeManualStep();
      }, 700);
      return;
    }

    if (game.gameState === 'playing' && phase === 'playing') {
      const g = gameRef.current;
      if (g.currentStep >= autoStepsTargetRef.current) {
        // Target steps reached — cash out
        autoPhaseRef.current = 'cashing-out';
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = setTimeout(() => {
          if (!autoActiveRef.current) return;
          gameRef.current.cashOut();
        }, 400);
      } else {
        // Take next step
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = setTimeout(async () => {
          if (!autoActiveRef.current || autoPhaseRef.current !== 'playing') return;
          await gameRef.current.takeManualStep();
        }, 700);
      }
      return;
    }

    if (game.gameState === 'lost' && (phase === 'playing') && phase !== 'finishing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      const pnlDelta = -(gameRef.current?.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(false, pnlDelta);
      return;
    }

    if (game.gameState === 'won' && (phase === 'playing' || phase === 'cashing-out') && phase !== 'finishing') {
      autoPhaseRef.current = 'finishing';
      clearTimeout(autoTimerRef.current);
      const g = gameRef.current;
      const cfg = STAKE_CHICKEN_CONFIG[g.difficulty] || STAKE_CHICKEN_CONFIG.medium;
      const step = g.currentStep;
      const mult = step > 0 ? (cfg.multipliers[step - 1] ?? 0) : 0;
      const payout = Math.round((g.betAmount ?? 0) * mult * 100) / 100;
      const pnlDelta = payout - (g.betAmount ?? 0);
      handleAutoRoundEndRef.current?.(true, pnlDelta);
      return;
    }
  }, [game.gameState, game.currentStep]);

  const startAuto = useCallback(async (config) => {
    if (game.gameState === 'playing') return;
    autoConfigRef.current = config;
    autoRoundsDoneRef.current = 0;
    autoSessionPnlRef.current = 0;
    autoBaseBetRef.current = game.betAmount;
    autoStepsTargetRef.current = autoStepsTarget;
    autoPhaseRef.current = 'starting';
    autoActiveRef.current = true;

    setAutoActive(true);
    setAutoRoundsDone(0);
    setAutoTotalRounds(config.rounds);
    setAutoSessionPnl(0);

    game.reset();
    setTimeout(async () => {
      if (!autoActiveRef.current) return;
      await gameRef.current.startGame();
    }, 200);
  }, [game, autoStepsTarget]);

  const maxAutoSteps = Math.min(10, config.maxSteps);

  if (!mounted || !isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Chicken Road...</p>
      </div>
    );
  }

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
              <motion.div className={styles.bankruptBanner}
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p>📉 You&apos;re broke! Claim a bailout to keep playing.</p>
                <button className={styles.bailoutBtn} onClick={claimBailout}>Claim bailout</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Master Layout */}
          <div className={styles.highwayLayout}>
            {/* Left panel */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsCard}>

                {/* Manual / Auto tab */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem',
                  background: 'rgba(255,255,255,0.02)', padding: '0.3rem',
                  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)',
                  marginBottom: '0.8rem'
                }}>
                  {['manual', 'auto'].map(tab => (
                    <button key={tab}
                      onClick={() => setActiveTab(tab)}
                      disabled={(tab === 'manual' && autoActive) || (tab === 'auto' && isPlaying && !autoActive)}
                      style={{
                        padding: '0.5rem', border: activeTab === tab ? '1px solid rgba(247,147,26,0.3)' : 'none',
                        borderRadius: '8px', fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem',
                        fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
                        background: activeTab === tab ? 'rgba(247,147,26,0.1)' : 'transparent',
                        color: activeTab === tab ? '#f7931a' : 'rgba(255,255,255,0.35)',
                        opacity: ((tab === 'manual' && autoActive) || (tab === 'auto' && isPlaying && !autoActive)) ? 0.35 : 1
                      }}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* ── MANUAL TAB ── */}
                {activeTab === 'manual' && (
                  <>
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
                        <input type="text" className={styles.monospaceTextField}
                          value={betInput} onChange={handleBetInput}
                          disabled={isPlaying} placeholder="0.00" />
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
                        <button className={styles.dashGoBtnPrimaryBlue}
                          onClick={game.startGame}
                          disabled={balance <= 0 || game.betAmount > balance}>
                          Bet
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.8rem', width: '100%' }}>
                          <button
                            className={`${styles.dashCashoutBtn} ${game.currentStep > 0 ? styles.dashCashoutEnabled : ''}`}
                            onClick={handleCashOut} disabled={game.currentStep === 0}>
                            <div className={styles.cashLabel}>CASH OUT</div>
                            <div className={styles.cashAmt}>{game.getStepMultiplier(game.currentStep, game.difficulty).toFixed(2)}x</div>
                          </button>
                          <button className={styles.stepManualBtn} onClick={handleTakeStep}>STEP</button>
                        </div>
                      )}
                    </div>

                    {/* Difficulty presets */}
                    <div className={styles.presetsPanelGrid} style={{ marginTop: '0.5rem' }}>
                      {[
                        { key: 'easy', label: 'SAFE MODE', emoji: '🟢' },
                        { key: 'medium', label: 'BALANCED', emoji: '🟡' },
                        { key: 'hard', label: 'RISKY', emoji: '🔴' },
                        { key: 'expert', label: 'YOLO', emoji: '💀' }
                      ].map(opt => (
                        <button key={opt.key}
                          className={`${styles.presetBtnOption} ${game.difficulty === opt.key ? styles.presetActive : ''}`}
                          onClick={() => game.setDifficulty(opt.key)}
                          disabled={isPlaying}>
                          <span className={styles.presetDot}>{opt.emoji}</span>
                          <span className={styles.presetText}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── AUTO TAB ── */}
                {activeTab === 'auto' && (
                  <AutoPanel
                    isRunning={autoActive}
                    onStart={startAuto}
                    onStop={stopAuto}
                    roundsDone={autoRoundsDone}
                    totalRounds={autoTotalRounds}
                    sessionPnl={autoSessionPnl}
                  >
                    {/* Game-specific: step target */}
                    <div>
                      <div style={{
                        fontFamily: "'Orbitron', sans-serif", fontSize: '0.59rem', fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
                        marginBottom: '0.4rem'
                      }}>
                        🐔 Cross {autoStepsTarget} obstacle{autoStepsTarget !== 1 ? 's' : ''} then cash out
                      </div>
                      <input type="range" min={1} max={maxAutoSteps}
                        value={autoStepsTarget}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setAutoStepsTarget(v);
                          autoStepsTargetRef.current = v;
                        }}
                        disabled={autoActive}
                        style={{ width: '100%', accentColor: '#f7931a', display: 'block' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                        <span>Steps: {autoStepsTarget}</span>
                        <span>Mult: {config.multipliers[autoStepsTarget - 1]?.toFixed(2) ?? '?'}x</span>
                      </div>
                      {/* Difficulty selector (also needed for auto) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginTop: '0.6rem' }}>
                        {[
                          { key: 'easy', label: '🟢 Safe' },
                          { key: 'medium', label: '🟡 Balanced' },
                          { key: 'hard', label: '🔴 Risky' },
                          { key: 'expert', label: '💀 Yolo' }
                        ].map(opt => (
                          <button key={opt.key}
                            onClick={() => game.setDifficulty(opt.key)}
                            disabled={autoActive}
                            style={{
                              padding: '0.35rem', fontSize: '0.68rem', fontWeight: 600,
                              border: game.difficulty === opt.key ? '1px solid rgba(247,147,26,0.4)' : '1px solid rgba(255,255,255,0.06)',
                              background: game.difficulty === opt.key ? 'rgba(247,147,26,0.08)' : 'rgba(255,255,255,0.02)',
                              color: game.difficulty === opt.key ? '#f7931a' : 'rgba(255,255,255,0.4)',
                              borderRadius: '7px', cursor: 'pointer', transition: 'all 0.15s'
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </AutoPanel>
                )}

              </div>
            </div>

            {/* Right: highway */}
            <div className={styles.displayPanel} style={{ flex: 1.5 }}>
              <div ref={roadScrollRef} className={`${styles.roadScrollWrapper} ${isLost ? styles.cardBurst : ''} ${isWon ? styles.cardCashout : ''}`}>
                <div className={styles.highwayCorridor}>

                  {/* Start Arch */}
                  <div className={styles.startSegment}>
                    <div className={styles.startArchDoor} />
                    {game.currentStep === 0 && !isLost && (
                      <motion.div className={styles.chickStandby}
                        animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
                        🐥
                      </motion.div>
                    )}
                  </div>

                  {/* Road columns */}
                  {Array.from({ length: config.maxSteps }).map((_, cIdx) => {
                    const stepMult = config.multipliers[cIdx];
                    const stepNum = cIdx + 1;
                    const isCurrentActive = cIdx === game.currentStep && isPlaying;
                    const isPassed = cIdx < game.currentStep;
                    const isDiedHere = game.trapIndex === cIdx;
                    const showTraps = isLost || isWon;
                    const isAutoTargetStep = autoActive && cIdx === autoStepsTarget - 1;

                    return (
                      <div key={cIdx}
                        className={`${styles.roadColumn} ${isCurrentActive ? styles.roadColumnActive : ''} ${isPassed ? styles.roadColumnPassed : ''}`}
                        style={isAutoTargetStep ? { outline: '1px dashed rgba(247,147,26,0.35)', outlineOffset: '-2px' } : {}}>
                        <div className={styles.dividerStripe} />

                        <div className={styles.tileCellWrapper}>
                          {!isPassed && !isDiedHere && (
                            <button
                              className={`${styles.archBtn} ${isCurrentActive ? styles.archBtnActive : ''}`}
                              disabled={!isCurrentActive || autoActive}
                              onClick={handleTakeStep}>
                              {isCurrentActive ? (
                                <span className={styles.potentialBadge}>?</span>
                              ) : (
                                <span className={styles.futureBadge}>{stepMult.toFixed(2)}x</span>
                              )}
                            </button>
                          )}

                          {isPassed && !isDiedHere && (
                            <motion.div className={styles.safeArchedContainer}
                              initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <div className={styles.safeBadgeRing}>{stepMult.toFixed(2)}x</div>
                              {cIdx === game.currentStep - 1 && (
                                <motion.div className={styles.chickenCharacter}
                                  animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                  🐔
                                </motion.div>
                              )}
                            </motion.div>
                          )}

                          {isDiedHere && (
                            <motion.div className={styles.trapCoinContainer}
                              initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 0 }}>
                              <div className={styles.trapCoin}><span>😵</span></div>
                            </motion.div>
                          )}

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

                  {/* Finish */}
                  <div className={styles.finishSegment}>
                    <div className={styles.finishArch} />
                    {isWon && (
                      <motion.div className={styles.chickStandby}
                        animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                        👑🐥
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom info */}
              <div className={styles.boardLowerMeta}>
                {game.chickenHistory.length > 0 && (
                  <div className={styles.historySection}>
                    <div className={styles.historyTitle}>Recent Runs</div>
                    <div className={styles.historyPills}>
                      {game.chickenHistory.map((r, i) => (
                        <div key={i} className={`${styles.historyPill} ${r.won ? styles.pillWin : styles.pillLoss}`}>
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
