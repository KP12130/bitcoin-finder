'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import AchievementCard from '@/components/AchievementCard/AchievementCard';
import { useBalance } from '@/hooks/useBalance';
import { useAchievements } from '@/hooks/useAchievements';
import { motion } from 'framer-motion';
import styles from './page.module.css';

export default function AchievementsPage() {
  const { balance } = useBalance();
  const { achievements, completionRate, isLoaded } = useAchievements();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded) return null;

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <>
      <Navbar balance={balance} />
      <div className="page-container">
        <h1 className="page-title">🏆 Achievements</h1>

        {/* Progress Bar */}
        <motion.div
          className={styles.progressCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Completion</span>
            <span className={styles.progressPercent}>{completionRate}%</span>
          </div>
          <div className={styles.progressBar}>
            <motion.div
              className={styles.progressFill}
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <p className={styles.progressSubtext}>
            {unlocked.length} of {achievements.length} achievements unlocked
          </p>
        </motion.div>

        {/* Unlocked */}
        {unlocked.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>✅ Unlocked</h2>
            <div className={styles.achievementGrid}>
              {unlocked.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AchievementCard
                    icon={a.icon}
                    name={a.name}
                    description={a.description}
                    unlocked={true}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Locked */}
        {locked.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔒 Locked</h2>
            <div className={styles.achievementGrid}>
              {locked.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 + 0.2 }}
                >
                  <AchievementCard
                    icon={a.icon}
                    name={a.name}
                    description={a.description}
                    unlocked={false}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
