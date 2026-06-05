'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useLotteryEngine } from '@/hooks/useLotteryEngine';
import { useAchievements } from '@/hooks/useAchievements';
import { parseShorthand, formatBTC } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCryptoAmount } from '@/lib/price';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTicketAlt, FaRandom, FaHourglassHalf } from 'react-icons/fa';
import styles from './page.module.css';

export default function LotteryPage() {
  const { balance, isLoaded, addBalance, subtractBalance } = useBalance();
  const { checkAchievements } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const game = useLotteryEngine(balance, subtractBalance, addBalance);
  const { currency, activeSymbol, convertUsdToActive, convertActiveToUsd } = useCurrency();
  
  // 3 Digit picker states (reverted back to 3 digits)
  const [digit1, setDigit1] = useState('0');
  const [digit2, setDigit2] = useState('0');
  const [digit3, setDigit3] = useState('0');

  // Bulk buy state
  const [bulkQty, setBulkQty] = useState(10);

  // Bet input local state
  const [betInput, setBetInput] = useState('');

  // Sync ticket cost from engine
  useEffect(() => {
    const currentBetInActive = convertUsdToActive(game.ticketAmount);
    const parsedCurrent = parseShorthand(betInput);
    if (Math.abs(parsedCurrent - currentBetInActive) > 0.00000001) {
      setBetInput(formatCryptoAmount(currentBetInActive, currency));
    }
  }, [game.ticketAmount, currency]);

  // Handle buy ticket
  const handleBuy = useCallback(async () => {
    const ticketCode = `${digit1}${digit2}${digit3}`;
    const success = await game.buyTicket(ticketCode);
    if (success) {
      setTimeout(() => checkAchievements(), 1000);
    }
  }, [digit1, digit2, digit3, game, checkAchievements]);

  // Handle Bulk Buy
  const handleBulkBuy = useCallback(async () => {
    const success = await game.buyTicketsBulk(bulkQty);
    if (success) {
      setTimeout(() => checkAchievements(), 1000);
    }
  }, [bulkQty, game, checkAchievements]);

  // Handle Quick Pick
  const handleQuickPick = useCallback(() => {
    const d1 = Math.floor(Math.random() * 10).toString();
    const d2 = Math.floor(Math.random() * 10).toString();
    const d3 = Math.floor(Math.random() * 10).toString();
    setDigit1(d1);
    setDigit2(d2);
    setDigit3(d3);
  }, []);

  const handleBetInput = useCallback((e) => {
    const val = e.target.value;
    const cleanValue = val.replace(/[^0-9.kKmM]/g, '');
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;

    setBetInput(cleanValue);

    const parsed = parseShorthand(cleanValue);
    if (!isNaN(parsed) && parsed > 0) {
      const usdBet = convertActiveToUsd(parsed);
      game.setTicketAmount(usdBet);
    }
  }, [game, convertActiveToUsd]);

  const handleQuickBet = useCallback((action) => {
    let newBet = game.ticketAmount;
    switch (action) {
      case 'half':
        newBet = Math.max(0.10, Math.round((game.ticketAmount / 2) * 100) / 100);
        break;
      case 'double':
        newBet = Math.round(game.ticketAmount * 2 * 100) / 100;
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
    game.setTicketAmount(newBet);
  }, [game, balance]);

  if (!mounted) return null;

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.mainContent}>
          <h1 className={styles.title}>Progressive Crypto Lottery</h1>
          <p className={styles.subtitle}>Select 3 digits or bulk buy! Matches win the progressive pot (halved if winning code contains duplicate digits!).</p>

          {/* Giant Pot Board */}
          <div className={styles.potBoard}>
            <div className={styles.potLabel}>CURRENT ESTIMATED PROGRESSIVE POT</div>
            <div className={styles.potValue}>{formatBTC(game.progressivePot)}</div>
            <div className={styles.potGrowIndicator}>Growing in real-time...</div>
          </div>

          <div className={styles.gameGrid}>
            {/* Left Ticket Builder Panel */}
            <div className={styles.controlPanel}>
              {/* Digit Scrollers */}
              <div className={styles.pickerSection}>
                <label className={styles.label}>Single Ticket Builder</label>
                <div className={styles.digitContainer}>
                  <select
                    className={styles.digitSelect}
                    value={digit1}
                    onChange={(e) => setDigit1(e.target.value)}
                  >
                    {Array.from({ length: 10 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <select
                    className={styles.digitSelect}
                    value={digit2}
                    onChange={(e) => setDigit2(e.target.value)}
                  >
                    {Array.from({ length: 10 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <select
                    className={styles.digitSelect}
                    value={digit3}
                    onChange={(e) => setDigit3(e.target.value)}
                  >
                    {Array.from({ length: 10 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className={styles.quickPickBtn} onClick={handleQuickPick} style={{ flex: 1 }}>
                    <FaRandom /> QUICK PICK
                  </button>
                  <button className={styles.buyBtn} onClick={handleBuy} style={{ flex: 1.5, margin: 0, padding: '0.6rem' }}>
                    <FaTicketAlt /> BUY SINGLE
                  </button>
                </div>
              </div>

              {/* Bulk Buy Section */}
              <div className={styles.pickerSection} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                <label className={styles.label}>Bulk Ticket Purchases</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {[5, 10, 20, 50].map((qty) => (
                    <button
                      key={qty}
                      className={`${styles.quickBtn} ${bulkQty === qty ? styles.activeQuickBtn : ''}`}
                      onClick={() => setBulkQty(qty)}
                      style={{ flex: 1, border: bulkQty === qty ? '1px solid #f7931a' : '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <button className={styles.buyBtn} onClick={handleBulkBuy} style={{ background: 'linear-gradient(135deg, #00c4ff, #0077ff)', boxShadow: '0 4px 15px rgba(0, 119, 255, 0.2)' }}>
                  🎲 BULK BUY {bulkQty} TICKETS
                </button>
              </div>

              {/* Price Per Ticket */}
              <div className={styles.inputGroup} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                <label className={styles.label}>Ticket Cost (Bet Amount)</label>
                <div className={styles.betInputWrapper}>
                  <span className={styles.currencySymbol}>{activeSymbol}</span>
                  <input
                    type="text"
                    className={styles.betInput}
                    value={betInput}
                    onChange={handleBetInput}
                  />
                </div>
                <div className={styles.quickBetGrid}>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('half')}>½</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('double')}>2×</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('min')}>MIN</button>
                  <button className={styles.quickBtn} onClick={() => handleQuickBet('max')}>MAX</button>
                </div>
              </div>

              {game.error && <div className={styles.errorText}>{game.error}</div>}

              {/* My Tickets Board */}
              <div className={styles.ticketsSection}>
                <span className={styles.sectionHeader}>My Active Tickets ({game.myTickets.length})</span>
                {game.myTickets.length === 0 ? (
                  <span className={styles.emptyTickets}>No active tickets purchased for the next draw</span>
                ) : (
                  <div className={styles.ticketsGrid}>
                    {game.myTickets.map((t, idx) => (
                      <span key={idx} className={styles.ticketBadge}>
                        🎟️ {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Live draw column */}
            <div className={styles.drawColumn}>
              <div className={styles.drawBoard}>
                {/* Live Countdown Progress Ring / Badge */}
                <div className={styles.clockHeader}>
                  <FaHourglassHalf className={styles.clockIcon} />
                  <span className={styles.clockTitle}>NEXT DRAW COUNTDOWN</span>
                  <span className={styles.clockTime}>{game.timeLeft}s</span>
                </div>

                {/* Drawing Slot Balls display (Reverted back to 3) */}
                <div className={styles.ballsContainer}>
                  {game.isDrawing ? (
                    <>
                      <motion.div
                        className={`${styles.ball} ${styles.rollingBall}`}
                        animate={{ rotate: 360, y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 0.3 }}
                      >
                        ?
                      </motion.div>
                      <motion.div
                        className={`${styles.ball} ${styles.rollingBall}`}
                        animate={{ rotate: -360, y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 0.3, delay: 0.1 }}
                      >
                        ?
                      </motion.div>
                      <motion.div
                        className={`${styles.ball} ${styles.rollingBall}`}
                        animate={{ rotate: 360, y: [0, -12, 0] }}
                        transition={{ repeat: Infinity, duration: 0.3, delay: 0.2 }}
                      >
                        ?
                      </motion.div>
                    </>
                  ) : game.drawResult ? (
                    <>
                      <motion.div
                        className={styles.ball}
                        initial={{ scale: 0.3, y: -40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                      >
                        {game.drawResult[0]}
                      </motion.div>
                      <motion.div
                        className={styles.ball}
                        initial={{ scale: 0.3, y: -40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', damping: 10, delay: 0.15 }}
                      >
                        {game.drawResult[1]}
                      </motion.div>
                      <motion.div
                        className={styles.ball}
                        initial={{ scale: 0.3, y: -40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', damping: 10, delay: 0.3 }}
                      >
                        {game.drawResult[2]}
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <div className={styles.emptyBall}>-</div>
                      <div className={styles.emptyBall}>-</div>
                      <div className={styles.emptyBall}>-</div>
                    </>
                  )}
                </div>

                {/* Outcome panel overlay */}
                <AnimatePresence>
                  {!game.isDrawing && game.lastDrawState !== 'idle' && game.drawResult && (
                    <motion.div
                      className={styles.outcomePanel}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className={`${styles.outcomeCard} ${
                        game.lastDrawState === 'won' ? styles.winOutcome : styles.loseOutcome
                      }`}>
                        <span className={styles.outcomeText}>
                          {game.lastDrawState === 'won'
                            ? game.lastDrawHalf
                              ? `🏆 MATCH! Duplicate digits detected! You won 50% of the progressive pot (${formatBTC(game.wonPotAmount)})!`
                              : `🏆 JACKPOT! 3 Unique digits match! You won 100% of the progressive pot (${formatBTC(game.wonPotAmount)})!`
                            : `Roll Over! Winning code was ${game.drawResult.join('')}.`}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Feed splits: Live Activity (Left), History (Right) */}
              <div className={styles.feedsGrid}>
                {/* Live Activity Feed */}
                <div className={styles.feedCard}>
                  <div className={styles.feedTitle}>Live Ticket Bets</div>
                  <div className={styles.feedList}>
                    {game.recentActivity.length === 0 ? (
                      <span className={styles.emptyFeed}>Waiting for ticket wagers...</span>
                    ) : (
                      game.recentActivity.map((act, i) => (
                        <div key={i} className={styles.feedItem}>
                          <span className={styles.feedPlayer}>{act.player}</span>
                          <span className={styles.feedTicket}>bought {act.ticket.includes('Bulk') ? act.ticket : `ticket 🎟️ ${act.ticket}`}</span>
                          <span className={styles.feedAmount}>{activeSymbol}{formatCryptoAmount(convertUsdToActive(act.amount), currency)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Draw History */}
                <div className={styles.feedCard}>
                  <div className={styles.feedTitle}>Previous Drawings</div>
                  <div className={styles.feedList}>
                    {game.drawHistory.length === 0 ? (
                      <span className={styles.emptyFeed}>No previous draws yet</span>
                    ) : (
                      game.drawHistory.map((hist, i) => (
                        <div key={i} className={styles.feedItem}>
                          <span className={styles.histDraw}>🎉 DRAW {hist.draw}</span>
                          <span className={styles.histPot}>{formatBTC(hist.pot)}</span>
                          <span className={styles.histWinner} style={{ color: hist.winner === 'You' || hist.winner.includes('You') ? '#00ff88' : 'rgba(255,255,255,0.45)' }}>
                            {hist.winner}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
