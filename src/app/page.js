'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaBitcoin, FaChartLine, FaTrophy, FaGamepad, FaUser } from 'react-icons/fa';
import { getMultiplier, getWinChance } from '@/lib/utils';
import { supabase, isDbEnabled } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal/AuthModal';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setMounted(true);
    if (!isDbEnabled()) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handlePlayClick = (e) => {
    if (isDbEnabled() && !user) {
      e.preventDefault();
      setAuthOpen(true);
    }
  };

  if (!mounted) return null;

  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className={styles.bitcoinIcon}
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <FaBitcoin />
          </motion.div>

          <h1 className={styles.title}>
            <span className={styles.titleGold}>Bitcoin</span>{' '}
            <span className={styles.titleBlue}>Finder</span>
          </h1>

          <p className={styles.subtitle}>
            Mine for the hidden block number. Pick your risk. Win big.
          </p>

          <p className={styles.tagline}>
            Can you find the number? Choose your guesses, place your bet, and start mining.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/lobby" className={styles.ctaPrimary} onClick={handlePlayClick}>
              <FaGamepad /> Enter Casino Lobby
            </Link>
            <a href="#how-it-works" className={styles.ctaSecondary}>
              How It Works ↓
            </a>

            {/* Auth buttons — only shown when DB is configured */}
            {isDbEnabled() && (
              user ? (
                <motion.button
                  className={styles.ctaAccount}
                  onClick={() => supabase.auth.signOut().then(() => setUser(null))}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <FaUser /> Sign Out
                </motion.button>
              ) : (
                <motion.button
                  className={styles.ctaAccount}
                  onClick={() => setAuthOpen(true)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <FaUser /> Sign In / Register
                </motion.button>
              )
            )}
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>980x</span>
              <span className={styles.heroStatLabel}>Max Multiplier</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>98%</span>
              <span className={styles.heroStatLabel}>RTP</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>$1,000</span>
              <span className={styles.heroStatLabel}>Free Start</span>
            </div>
          </div>
        </motion.div>

        {/* Floating particles */}
        <div className={styles.particles}>
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className={styles.particle}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
                opacity: 0.1 + Math.random() * 0.3,
                fontSize: `${8 + Math.random() * 14}px`,
              }}
            >
              ₿
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className={styles.howItWorks}>
        <motion.h2
          className={styles.sectionTitle}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How It Works
        </motion.h2>

        <div className={styles.steps}>
          {[
            { num: '01', title: 'Place Your Bet', desc: 'Choose how much $ to wager on this block', icon: '💰' },
            { num: '02', title: 'Pick Your Risk', desc: 'Select 1–500 guesses. Fewer guesses = bigger payout', icon: '🎯' },
            { num: '03', title: 'Start Mining', desc: 'Watch your numbers get checked against the hidden block', icon: '⛏️' },
            { num: '04', title: 'Win Big', desc: 'If any guess matches, you win the payout minus 2% house edge', icon: '🏆' },
          ].map((step, i) => (
            <motion.div
              key={step.num}
              className={styles.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className={styles.stepIcon}>{step.icon}</div>
              <div className={styles.stepNum}>{step.num}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Payout Table */}
      <section className={styles.payoutSection}>
        <motion.h2
          className={styles.sectionTitle}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Payout Table
        </motion.h2>

        <motion.div
          className={styles.payoutTable}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <table>
            <thead>
              <tr>
                <th>Guesses</th>
                <th>Win Chance</th>
                <th>Multiplier</th>
                <th>Bet $100 → Win</th>
              </tr>
            </thead>
            <tbody>
              {[1, 5, 10, 50, 100, 250, 500].map((g) => (
                <tr key={g}>
                  <td>{g}</td>
                  <td>{getWinChance(g)}%</td>
                  <td className={styles.multiplier}>{getMultiplier(g)}x</td>
                  <td className={styles.payout}>${Math.floor(100 * (1000 / g) * 0.98).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <motion.h2
          className={styles.sectionTitle}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Features
        </motion.h2>

        <div className={styles.featureGrid}>
          {[
            { icon: <FaGamepad />, title: 'Instant Play', desc: 'Start with $1,000 free. No download needed.' },
            { icon: <FaChartLine />, title: 'Track Stats', desc: 'Full history, win rates, and profit charts.' },
            { icon: <FaTrophy />, title: 'Achievements', desc: 'Unlock badges for milestones and bragging rights.' },
            { icon: <FaBitcoin />, title: 'Daily Rewards', desc: 'Login daily for bonus $. Build streaks for bigger rewards.' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              className={styles.featureCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.finalCta}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2>Ready to Mine?</h2>
          <p>Start with $1,000 free and see if you can beat the odds.</p>
          <Link href="/lobby" className={styles.ctaPrimary} onClick={handlePlayClick}>
            <FaGamepad /> Enter Lobby Now
          </Link>
        </motion.div>
      </section>
      {/* Footer */}
      <footer className={styles.landingFooter}>
        <div className={styles.footerLinks}>
          <Link href="/terms">Terms of Service</Link>
          <span className={styles.footerLinkDivider}>•</span>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
        <p className={styles.footerDisclaimer}>
          Disclaimer: Virtual asset wagers carry high financial risk. Cryptographic balances on this platform hold zero intrinsic fiat value. Play responsibly. Strictly 18+ only.
        </p>
        <p className={styles.footerCopyright}>
          © 2026 Satoshi Secure Gate. All Rights Reserved.
        </p>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(u) => {
          setAuthOpen(false);
          setUser(u);
          router.push('/lobby');
        }}
      />
    </div>
  );
}
