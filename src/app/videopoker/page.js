'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useVideoPokerEngine } from '@/hooks/useVideoPokerEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { formatBTC } from '@/lib/utils';
import styles from './page.module.css';

// ─── Pay Table Data ───────────────────────────────────────────────────────────

const PAY_TABLE_ROWS = [
  { name: 'Royal Flush',     mult: 800,  tier: 'high'   },
  { name: 'Straight Flush',  mult: 50,   tier: 'high'   },
  { name: 'Four of a Kind',  mult: 25,   tier: 'high'   },
  { name: 'Full House',      mult: 9,    tier: 'medium' },
  { name: 'Flush',           mult: 6,    tier: 'medium' },
  { name: 'Straight',        mult: 4,    tier: 'medium' },
  { name: 'Three of a Kind', mult: 3,    tier: ''       },
  { name: 'Two Pair',        mult: 2,    tier: ''       },
  { name: 'Jacks or Better', mult: 1,    tier: ''       },
  { name: 'High Card',       mult: 0,    tier: ''       },
];

// ─── Card Component ───────────────────────────────────────────────────────────

function PokerCard({ card, isHeld, isWinner, onClick, clickable, dealIndex }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? styles.cardRed : styles.cardBlack;

  return (
    <motion.div
      className={`${styles.cardWrapper} ${clickable ? styles.clickable : ''}`}
      onClick={clickable ? onClick : undefined}
      initial={{ y: -120, opacity: 0, rotate: -10 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 180,
        damping: 18,
        delay: dealIndex * 0.07,
      }}
    >
      <div className={`${styles.card} ${colorClass} ${isHeld ? styles.held : ''} ${isWinner ? styles.winner : ''}`}>
        {/* Top left corner */}
        <div className={styles.cardCornerTop}>
          <span className={styles.cardRank}>{card.rank}</span>
          <span className={styles.cardSuitSmall}>{card.suitSymbol}</span>
        </div>

        {/* Center suit */}
        <div className={styles.cardCenterSuit}>{card.suitSymbol}</div>

        {/* Bottom right corner (rotated) */}
        <div className={styles.cardCornerBottom}>
          <span className={styles.cardRank}>{card.rank}</span>
          <span className={styles.cardSuitSmall}>{card.suitSymbol}</span>
        </div>
      </div>

      {/* HOLD / empty label below card */}
      {clickable ? (
        isHeld ? (
          <div className={styles.holdLabel}>HOLD</div>
        ) : (
          <div className={styles.holdLabelEmpty} />
        )
      ) : (
        <div className={styles.holdLabelEmpty} />
      )}
    </motion.div>
  );
}

// ─── Empty Card Placeholder ───────────────────────────────────────────────────

function EmptyCard() {
  return (
    <div className={styles.cardWrapper}>
      <div className={styles.cardEmpty}>
        <div className={styles.cardEmptyInner}>🃏</div>
      </div>
      <div className={styles.holdLabelEmpty} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideoPokerPage() {
  const game = useVideoPokerEngine();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Bet input handler ────────────────────────────────────────────────────────
  const handleBetChange = useCallback((e) => {
    game.handleBetInput(e.target.value);
  }, [game]);

  // ── Main action button ───────────────────────────────────────────────────────
  const handleMainAction = useCallback(() => {
    if (game.gamePhase === 'idle') {
      game.deal();
    } else if (game.gamePhase === 'dealt') {
      game.draw();
    } else if (game.gamePhase === 'result') {
      game.resetGame();
      checkAchievements();
    }
  }, [game, checkAchievements]);

  if (!mounted || !game.isLoaded) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Video Poker…</p>
      </div>
    );
  }

  const isIdle    = game.gamePhase === 'idle';
  const isDealt   = game.gamePhase === 'dealt';
  const isResult  = game.gamePhase === 'result';

  const canDeal = isIdle && game.balance >= game.betAmount && game.betAmount >= 0.10;

  // Determine winning/losing state for styling
  const didWin = isResult && game.lastResult?.won;
  const didLose = isResult && !game.lastResult?.won;

  // ── Determine which cards are "winners" (for glow on result) ────────────────
  // All cards glow green on a win
  const winnerMask = [didWin, didWin, didWin, didWin, didWin];

  // ── Main action button label ─────────────────────────────────────────────────
  let mainBtnLabel = '🃏 DEAL CARDS';
  let mainBtnClass = styles.dealBtn;
  if (isDealt) {
    mainBtnLabel = '🔄 DRAW CARDS';
    mainBtnClass = styles.drawBtn;
  } else if (isResult) {
    mainBtnLabel = '🔁 NEW HAND';
    mainBtnClass = styles.newGameBtn;
  }

  return (
    <>
      <Navbar balance={game.balance} />
      <div className={styles.page}>
        <div className="page-container">
          <div className={styles.grid}>

            {/* ── Left Column ── */}
            <div className={styles.controlsPanel}>
              <div>
                <h1 className={styles.title}>Video Poker 🃏</h1>
                <p className={styles.subtitle}>
                  Jacks or Better · 5-card draw · 0.99 RTP
                </p>
              </div>

              {/* Bet Amount */}
              <div className={styles.controlGroup}>
                <div className={styles.controlLabel}>Bet Amount</div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    type="text"
                    value={game.betInput}
                    onChange={handleBetChange}
                    disabled={!isIdle}
                    placeholder="0.10"
                  />
                  <div className={styles.quickBetGrid}>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => game.applyQuickBet('half')}
                      disabled={!isIdle}
                    >½</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => game.applyQuickBet('double')}
                      disabled={!isIdle}
                    >2×</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => game.applyQuickBet('min')}
                      disabled={!isIdle}
                    >Min</button>
                    <button
                      className={styles.quickBetBtn}
                      onClick={() => game.applyQuickBet('max')}
                      disabled={!isIdle}
                    >Max</button>
                  </div>
                </div>
              </div>

              {/* Error */}
              {game.error && <div className={styles.error}>{game.error}</div>}

              {/* Hold controls (during dealt phase) */}
              {isDealt && (
                <div className={styles.holdActionsRow}>
                  <button className={styles.holdAllBtn} onClick={game.holdAll}>
                    Hold All
                  </button>
                  <button className={styles.discardAllBtn} onClick={game.discardAll}>
                    Discard All
                  </button>
                </div>
              )}

              {/* Main Action Button */}
              <div className={styles.actionSection}>
                <motion.button
                  className={mainBtnClass}
                  onClick={handleMainAction}
                  disabled={isIdle && !canDeal}
                  whileHover={(isIdle && canDeal) || !isIdle ? { scale: 1.02 } : {}}
                  whileTap={(isIdle && canDeal) || !isIdle ? { scale: 0.98 } : {}}
                >
                  {mainBtnLabel}
                </motion.button>
              </div>

              {/* Pay Table */}
              <div className={styles.payTableCard}>
                <div className={styles.payTableHeader}>Pay Table (per bet)</div>
                {PAY_TABLE_ROWS.map(({ name, mult, tier }) => {
                  const isActive = isResult && game.handName === name;
                  return (
                    <div
                      key={name}
                      className={`${styles.payRow} ${isActive ? styles.active : ''}`}
                    >
                      <span className={styles.payName}>{name}</span>
                      <span className={`${styles.payMult} ${isActive ? '' : styles[tier]}`}>
                        {mult > 0 ? `${mult}×` : 'Loss'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Session Stats */}
              <div className={styles.statsCard}>
                <div className={styles.statsHeader}>Session</div>
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
                    <span
                      className={styles.statVal}
                      style={{ color: game.sessionProfit >= 0 ? '#00ff88' : '#ff4757' }}
                    >
                      {game.sessionProfit >= 0 ? '+' : ''}{formatBTC(game.sessionProfit)}
                    </span>
                    <span className={styles.statLabel}>Profit</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column — Table ── */}
            <div className={styles.tableColumn}>
              <div className={styles.tableFelt}>

                {/* Hand Name Banner */}
                <div className={styles.handNameBanner}>
                  <AnimatePresence mode="wait">
                    {isResult && game.handName ? (
                      <motion.div
                        key={game.handName}
                        className={`${styles.handNameText} ${didWin ? styles.win : styles.loss}`}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        {didWin ? '🏆 ' : '💔 '}
                        {game.handName.toUpperCase()}
                      </motion.div>
                    ) : isDealt ? (
                      <motion.div
                        key="select"
                        className={`${styles.handNameText} ${styles.idle}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Select cards to hold, then DRAW
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        className={`${styles.handNameText} ${styles.idle}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Place your bet and DEAL
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Cards Row */}
                <div className={styles.cardsRow}>
                  <AnimatePresence mode="wait">
                    {game.hand.length === 5 ? (
                      game.hand.map((card, i) => (
                        <PokerCard
                          key={card.id}
                          card={card}
                          isHeld={game.held[i]}
                          isWinner={winnerMask[i]}
                          onClick={() => game.toggleHold(i)}
                          clickable={isDealt}
                          dealIndex={i}
                        />
                      ))
                    ) : (
                      // Empty placeholders
                      [0, 1, 2, 3, 4].map((i) => (
                        <EmptyCard key={i} />
                      ))
                    )}
                  </AnimatePresence>
                </div>

                {/* Payout Display */}
                <AnimatePresence>
                  {isResult && game.lastResult && (
                    <motion.div
                      className={styles.payoutDisplay}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className={styles.payoutLabel}>
                        {didWin ? 'Payout' : 'Lost'}
                      </div>
                      <div className={`${styles.payoutAmount} ${didWin ? styles.win : styles.loss}`}>
                        {didWin
                          ? `+${formatBTC(game.lastResult.payout)}`
                          : `-${formatBTC(game.lastResult.bet)}`}
                      </div>
                      {didWin && game.lastResult.multiplier > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron, sans-serif' }}>
                          {game.lastResult.multiplier}× MULTIPLIER
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Idle prompt */}
                {isIdle && game.hand.length === 0 && (
                  <div className={styles.idlePrompt}>
                    Enter a bet amount and click DEAL to start
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
