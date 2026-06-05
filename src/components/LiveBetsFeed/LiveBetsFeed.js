'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLiveBets } from '@/hooks/useLiveBets';
import { formatBTC, formatNumber } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaUser } from 'react-icons/fa';
import { supabase, isDbEnabled } from '@/lib/supabase';
import styles from './LiveBetsFeed.module.css';

export default function LiveBetsFeed() {
  const { bets } = useLiveBets();
  const [activeTab, setActiveTab] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);

  // Sync user state to highlight player bets
  useEffect(() => {
    if (isDbEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUser(session?.user || null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        setCurrentUser(session?.user || null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Filtered bets based on tabs
  const filteredBets = useMemo(() => {
    if (activeTab === 'all') {
      return bets;
    }
    if (activeTab === 'high_wins') {
      return bets.filter(bet => {
        const multVal = parseFloat(bet.multiplier.replace('x', '')) || 0;
        return (bet.won && multVal >= 5.0) || bet.bet >= 100.0;
      });
    }
    if (activeTab === 'my_bets') {
      return bets.filter(bet => {
        return bet.isPlayer || (currentUser && bet.user_id === currentUser.id);
      });
    }
    return bets;
  }, [bets, activeTab, currentUser]);

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { id: 'all', label: '🌍 All Bets' },
          { id: 'high_wins', label: '🔥 High Wins' },
          { id: 'my_bets', label: '👤 My Bets' }
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bets List */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Game</th>
              <th>Miner</th>
              <th>Time</th>
              <th>Bet</th>
              <th>Multiplier</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filteredBets.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No bets to display in this category.
                  </td>
                </tr>
              ) : (
                filteredBets.slice(0, 10).map((bet) => {
                  const isPlayer = bet.isPlayer || (currentUser && bet.user_id === currentUser.id);
                  const isHighWin = parseFloat(bet.multiplier.replace('x', '')) >= 10.0 && bet.won;
                  
                  return (
                    <motion.tr
                      key={bet.id}
                      className={`${styles.row} ${isPlayer ? styles.playerRow : ''} ${isHighWin ? styles.highWinRow : ''}`}
                      initial={{ opacity: 0, y: -15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <td className={styles.gameCell}>
                        <span className={styles.gameIcon}>
                          {bet.game === 'Mine' ? '⛏️' : 
                           bet.game === 'Slots' ? '🎰' : 
                           bet.game === 'Crash' ? '🚀' : 
                           bet.game === 'Dice' ? '🎲' : 
                           bet.game === 'Plinko' ? '🟢' : 
                           bet.game === 'Mines' ? '💣' : 
                           bet.game === 'Limbo' ? '🎯' : 
                           bet.game === 'Tower' ? '🏰' : 
                           bet.game === 'Hi-Lo' ? '📈' : 
                           bet.game === 'Coin Flip' ? '🪙' : 
                           bet.game === 'Balloon Pop' ? '🎈' : '🃏'}
                        </span>
                        <span className={styles.gameName}>{bet.game}</span>
                      </td>
                      <td className={styles.minerCell}>
                        <span className={styles.minerAvatar}>{bet.avatarEmoji || '⛏️'}</span>
                        <span className={styles.minerName}>
                          {bet.name}
                          {isPlayer && <span className={styles.youBadge}>YOU</span>}
                        </span>
                      </td>
                      <td className={styles.timeCell}>
                        {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className={styles.betCell}>
                        ${bet.bet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`${styles.multiplierCell} ${bet.won ? styles.positive : styles.negative}`}>
                        {bet.multiplier}
                      </td>
                      <td className={`${styles.payoutCell} ${bet.won ? styles.positive : styles.negative}`}>
                        {bet.won ? `+$${bet.payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
