'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { getLeaderboard, getPlayerLeaderboardEntry } from '@/lib/storage';
import { formatBTC, formatNumber } from '@/lib/utils';
import { motion } from 'framer-motion';
import { FaCrown, FaMedal, FaTrophy } from 'react-icons/fa';
import { supabase, isDbEnabled } from '@/lib/supabase';
import styles from './page.module.css';

export default function LeaderboardPage() {
  const { balance } = useBalance();
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadLeaderboard() {
      try {
        if (isDbEnabled()) {
          // Get current user session
          const sessionRes = await supabase.auth.getSession();
          const activeUser = sessionRes.data.session?.user || null;
          setUser(activeUser);

          // Fetch from Supabase leaderboard view
          const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('profit', { ascending: false })
            .limit(20);

          if (!error && data && data.length > 0) {
            const mapped = data.map(item => ({
              ...item,
              winRate: item.win_rate !== undefined ? item.win_rate : 0,
            }));
            setEntries(mapped);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to load database leaderboard, falling back to local simulation:', err);
      }

      // Fallback: Local simulated players
      const npcPlayers = getLeaderboard();
      const playerEntry = getPlayerLeaderboardEntry();
      const all = [...npcPlayers, playerEntry];
      all.sort((a, b) => b.profit - a.profit);
      setEntries(all);
      setLoading(false);
    }

    loadLeaderboard();
  }, [mounted]);

  if (!mounted) return null;

  const getRankIcon = (rank) => {
    if (rank === 1) return <FaCrown className={styles.rankGold} />;
    if (rank === 2) return <FaMedal className={styles.rankSilver} />;
    if (rank === 3) return <FaMedal className={styles.rankBronze} />;
    return <span className={styles.rankNum}>#{rank}</span>;
  };

  return (
    <>
      <Navbar balance={balance} />
      <div className="page-container">
        <h1 className="page-title">👑 Leaderboard</h1>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-dim)' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              Loading rankings...
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Miner</th>
                  <th>Profit</th>
                  <th>Games</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const rank = i + 1;
                  const isPlayer = entry.isPlayer || (user && entry.user_id === user.id);
                  return (
                    <motion.tr
                      key={entry.user_id || entry.name || i}
                      className={`${styles.row} ${isPlayer ? styles.playerRow : ''} ${rank <= 3 ? styles.topThree : ''}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <td className={styles.rankCell}>{getRankIcon(rank)}</td>
                      <td className={styles.nameCell}>
                        {entry.name}
                        {isPlayer && <span className={styles.youBadge}>YOU</span>}
                      </td>
                      <td className={`${styles.profitCell} ${entry.profit >= 0 ? styles.positive : styles.negative}`}>
                        {entry.profit >= 0 ? '+' : ''}{formatBTC(entry.profit)}
                      </td>
                      <td>{formatNumber(entry.games)}</td>
                      <td>{entry.winRate}%</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
