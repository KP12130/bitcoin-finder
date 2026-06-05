'use client';

import { motion } from 'framer-motion';
import { FaLock } from 'react-icons/fa';
import styles from './AchievementCard.module.css';

export default function AchievementCard({ icon, name, description, unlocked }) {
  return (
    <motion.div
      className={`${styles.card} ${unlocked ? styles.unlocked : styles.locked}`}
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
    >
      <div className={styles.iconWrapper}>
        {unlocked ? (
          <span className={styles.icon}>{icon}</span>
        ) : (
          <span className={styles.lockOverlay}>
            <FaLock />
          </span>
        )}
      </div>

      <div className={styles.info}>
        <h4 className={styles.name}>{name}</h4>
        <p className={styles.description}>{description}</p>
      </div>

      {unlocked && <div className={styles.glowBar} />}
    </motion.div>
  );
}
