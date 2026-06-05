'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '@/lib/audio';
import styles from './VipLevelUpCelebration.module.css';

export default function VipLevelUpCelebration() {
  const [activeTier, setActiveTier] = useState(null);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLevelUp = (e) => {
      const tier = e.detail;
      setActiveTier(tier);
      playSound('win');

      // Generate random particles radiating outward from the center
      const newParticles = Array.from({ length: 45 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 220; // travel distance
        return {
          id: i,
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed - 60, // slight upward offset
          size: 6 + Math.random() * 10,
          color: i % 2 === 0 ? tier.color : i % 3 === 0 ? '#ffd700' : '#ffffff',
          shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'square' : 'diamond',
          rotation: Math.random() * 360,
        };
      });
      setParticles(newParticles);
    };

    window.addEventListener('vip-level-up', handleLevelUp);
    return () => window.removeEventListener('vip-level-up', handleLevelUp);
  }, []);

  if (!activeTier) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay}>
        {/* Background Overlay click closes the celebration */}
        <div className={styles.clickOutsideGuard} onClick={() => setActiveTier(null)} />

        {/* Confetti particle elements container */}
        <div className={styles.particleContainer}>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className={`${styles.particle} ${styles[p.shape]}`}
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              initial={{ x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 1 }}
              animate={{
                x: p.x,
                y: p.y + 120, // gravity drag down
                rotate: p.rotation + 360,
                scale: 1,
                opacity: 0,
              }}
              transition={{
                duration: 1.2 + Math.random() * 0.8,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>

        {/* Level Up Congrats Card */}
        <motion.div
          className={styles.modal}
          style={{
            borderColor: activeTier.color,
            boxShadow: `0 0 35px ${activeTier.glow}`,
          }}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
        >
          <div className={styles.badgeWrap}>
            <motion.div
              className={styles.emojiCircle}
              style={{
                borderColor: activeTier.color,
                backgroundColor: activeTier.glow,
              }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              {activeTier.emoji}
            </motion.div>
          </div>

          <h2 className={styles.title}>VIP Level Up!</h2>
          <p className={styles.subtitle}>Congratulations! Your wagering history has unlocked a new status tier.</p>

          <div className={styles.tierName} style={{ color: activeTier.color }}>
            {activeTier.name} Member
          </div>

          <div className={styles.benefitsCard}>
            <div className={styles.benefitRow}>
              <span className={styles.benefitLabel}>Rakeback Percentage:</span>
              <span className={styles.benefitValue} style={{ color: activeTier.color }}>
                {activeTier.rakebackPct}%
              </span>
            </div>
            <div className={styles.benefitRow}>
              <span className={styles.benefitLabel}>Required Wager:</span>
              <span className={styles.benefitValue}>
                ${activeTier.minWager.toLocaleString()}+
              </span>
            </div>
          </div>

          <p className={styles.disclaimer}>
            VIP levels are permanent. Climb tiers to secure lifetime rakeback!
          </p>

          <button
            className={styles.closeBtn}
            onClick={() => setActiveTier(null)}
            style={{
              background: `linear-gradient(135deg, ${activeTier.color}, #ffffff)`,
              color: '#000000',
            }}
          >
            AWESOME!
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
