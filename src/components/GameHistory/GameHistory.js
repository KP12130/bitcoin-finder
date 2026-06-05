'use client';

import { motion } from 'framer-motion';
import { FaHistory, FaShareAlt } from 'react-icons/fa';
import styles from './GameHistory.module.css';

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function GameHistory({ history = [] }) {
  const hasHistory = history.length > 0;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.header}>
        <FaHistory className={styles.headerIcon} />
        <h3 className={styles.title}>Game History</h3>
      </div>

      {!hasHistory ? (
        <div className={styles.empty}>
          <p>No games played yet</p>
          <span>Your recent results will appear here.</span>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Game</th>
                <th>Bet</th>
                <th>Lines/Guesses</th>
                <th>Result</th>
                <th>Payout</th>
                <th>Time</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => {
                const gameType = entry.gameType || 'mine';
                const isSlot = gameType === 'slots' || gameType === 'slot';
                const isMines = gameType === 'mines';
                const isCrash = gameType === 'crash';
                const isDice = gameType === 'dice';
                const isLimbo = gameType === 'limbo';
                const isTower = gameType === 'tower';
                const isHiLo = gameType === 'hilo';
                const isBlackjack = gameType === 'blackjack';

                return (
                  <tr
                    key={index}
                    className={entry.won ? styles.rowWin : styles.rowLoss}
                  >
                    <td className={styles.cellIndex}>{index + 1}</td>
                    <td>
                      <span className={`${styles.gameBadge} ${
                        isSlot ? styles.badgeSlot :
                        isMines ? styles.badgeMines :
                        isCrash ? styles.badgeCrash :
                        isDice ? styles.badgeDice :
                        isLimbo ? styles.badgeLimbo :
                        isTower ? styles.badgeTower :
                        isHiLo ? styles.badgeHiLo :
                        isBlackjack ? styles.badgeBlackjack :
                        styles.badgeMine
                      }`}>
                        {isSlot ? 'Slots 🎰' :
                         isMines ? 'Mines 💣' :
                         isCrash ? 'Crash 🚀' :
                         isDice ? 'Dice 🎲' :
                         isLimbo ? 'Limbo 🎯' :
                         isTower ? 'Tower 🏰' :
                         isHiLo ? 'Hi-Lo 📈' :
                         isBlackjack ? 'Blackjack 🃏' :
                         'Mining ⛏️'}
                      </span>
                    </td>
                    <td className={styles.cellBet}>
                      {Number(entry.bet).toFixed(0)}
                    </td>
                    <td>
                      {isMines ? `${entry.guessCount} gems 💎` :
                       isSlot ? `${entry.guessCount} lines` :
                       isCrash ? `${entry.multiplier}x cash` :
                       isDice ? `Roll: ${entry.secretNumber}` :
                       isLimbo ? `Target: ${entry.matchedGuess}x` :
                       isTower ? `Cleared: ${entry.guessCount} lvls` :
                       isHiLo ? `Streak: ${entry.guessCount} cards` :
                       isBlackjack ? `Dealer: ${entry.secretNumber}` :
                       `${entry.guessCount} guesses`}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          entry.won ? styles.badgeWin : styles.badgeLoss
                        }`}
                      >
                        {entry.won ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td
                      className={
                        entry.won ? styles.payoutWin : styles.payoutLoss
                      }
                    >
                      {entry.won ? '+' : '-'}
                      {Math.abs(entry.payout).toFixed(0)}
                    </td>
                    <td className={styles.cellTime}>
                      {formatRelativeTime(entry.timestamp)}
                    </td>
                    <td>
                      <button
                        className={styles.shareBtn}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('share-bet', { detail: entry }));
                          }
                        }}
                        title="Share this bet slip in chat"
                      >
                        <FaShareAlt />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
