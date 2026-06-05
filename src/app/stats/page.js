'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import StatsChart from '@/components/StatsChart/StatsChart';
import GameHistory from '@/components/GameHistory/GameHistory';
import { useBalance } from '@/hooks/useBalance';
import { useStats } from '@/hooks/useStats';
import { formatBTC, formatNumber } from '@/lib/utils';
import { motion } from 'framer-motion';
import styles from './page.module.css';

export default function StatsPage() {
  const { balance } = useBalance();
  const { stats, history, winRate, netProfit, isLoaded } = useStats();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded || !stats) return null;

  const statCards = [
    { label: 'Total Games', value: formatNumber(stats.totalGames), color: 'blue' },
    { label: 'Wins', value: formatNumber(stats.totalWins), color: 'green' },
    { label: 'Losses', value: formatNumber(stats.totalLosses), color: 'red' },
    { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'green' : 'gold' },
    { label: 'Net Profit', value: `${netProfit >= 0 ? '+' : ''}${formatBTC(netProfit)}`, color: netProfit >= 0 ? 'green' : 'red' },
    { label: 'Biggest Win', value: `+${formatBTC(stats.biggestWin)}`, color: 'green' },
    { label: 'Biggest Loss', value: `-${formatBTC(stats.biggestLoss)}`, color: 'red' },
    { label: 'Peak Balance', value: formatBTC(stats.peakBalance), color: 'gold' },
    { label: 'Total Wagered', value: formatBTC(stats.totalBet), color: 'blue' },
    { label: 'Best Win Streak', value: `${stats.maxWinStreak} games`, color: 'gold' },
    { label: 'Times Bankrupt', value: formatNumber(stats.timesBankrupt), color: 'red' },
    { label: 'YOLO Wins', value: formatNumber(stats.yoloWins), color: 'purple' },
  ];

  return (
    <>
      <Navbar balance={balance} />
      <div className="page-container">
        <h1 className="page-title">📊 Mining Statistics</h1>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              className={`${styles.statCard} ${styles[card.color]}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className={styles.statLabel}>{card.label}</div>
              <div className={styles.statValue}>{card.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Profit Chart */}
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatsChart profitHistory={stats.profitHistory} />
        </motion.div>

        {/* Game History */}
        <motion.div
          className={styles.historySection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className={styles.sectionTitle}>Game History</h2>
          <GameHistory history={history} />
        </motion.div>
      </div>
    </>
  );
}
