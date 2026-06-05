'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar/Navbar';
import { useBalance } from '@/hooks/useBalance';
import { useProfile } from '@/hooks/useProfile';
import { useRakeback } from '@/hooks/useRakeback';
import { getStats, getLedger, getVIPTier } from '@/lib/storage';
import { VIP_CONFIG, PLAYER_AVATARS } from '@/lib/constants';
import { formatBTC } from '@/lib/utils';
import styles from './page.module.css';

export default function ProfilePage() {
  const { balance, isLoaded, addBalance } = useBalance();
  const { profile, updateProfile, mounted: profileMounted } = useProfile();
  const { rakebackData, claim } = useRakeback(addBalance);
  const [tab, setTab] = useState('vip');
  const [stats, setStats] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [username, setUsername] = useState('');
  const [saved, setSaved] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    setStats(getStats());
    setLedger(getLedger());
  }, []);

  useEffect(() => {
    if (profile) setUsername(profile.username);
  }, [profile]);

  const saveUsername = useCallback(() => {
    if (!username.trim()) return;
    updateProfile({ username: username.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [username, updateProfile]);

  const selectAvatar = useCallback((av) => {
    updateProfile({ avatarId: av.id, avatarEmoji: av.emoji });
  }, [updateProfile]);

  const handleClaim = useCallback(async () => {
    const amount = claim();
    if (amount > 0) {
      setClaimed(amount);
      setStats(getStats());
      setTimeout(() => setClaimed(false), 3000);
    }
  }, [claim]);

  if (!isLoaded || !profileMounted || !profile) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
        <p>Loading Profile...</p>
      </div>
    );
  }

  const totalWager = stats?.totalBet || 0;
  const vipTier = getVIPTier(totalWager);
  const tierIndex = VIP_CONFIG.findIndex(t => t.id === vipTier.id);
  const nextTier = VIP_CONFIG[tierIndex + 1];
  const progressPct = nextTier
    ? Math.min(100, ((totalWager - vipTier.minWager) / (nextTier.minWager - vipTier.minWager)) * 100)
    : 100;

  const netProfit = (stats?.totalWon ?? 0) - (stats?.totalBet ?? 0);
  const winRate = stats?.totalGames > 0
    ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1)
    : '0.0';

  const TABS = [
    { id: 'vip',      label: '👑 VIP & Rakeback' },
    { id: 'identity', label: '✏️ Identity' },
    { id: 'stats',    label: '📊 Statistics' },
    { id: 'ledger',   label: '📋 Transaction Log' },
  ];

  return (
    <>
      <Navbar balance={balance} />
      <div className={styles.page}>
        <div className="page-container">

          {/* Hero */}
          <div className={styles.hero}>
            <motion.div
              className={styles.avatarBig}
              animate={{ boxShadow: [`0 0 20px ${vipTier.glow}`, `0 0 40px ${vipTier.glow}`, `0 0 20px ${vipTier.glow}`] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              style={{ borderColor: vipTier.color }}
            >
              {profile.avatarEmoji}
            </motion.div>
            <div className={styles.heroInfo}>
              <h1 className={styles.heroName}>{profile.username}</h1>
              <div className={styles.vipBadge} style={{ color: vipTier.color, borderColor: vipTier.color, background: vipTier.glow }}>
                {vipTier.emoji} {vipTier.name} Member
              </div>
              <div className={styles.heroBalance}>{formatBTC(balance)}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">

            {/* ── VIP & Rakeback ── */}
            {tab === 'vip' && (
              <motion.div key="vip" className={styles.panel}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* VIP Progress */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>VIP Progress</div>
                  <div className={styles.vipTiers}>
                    {VIP_CONFIG.map((tier, i) => (
                      <div key={tier.id} className={`${styles.vipTierItem} ${tier.id === vipTier.id ? styles.vipTierActive : ''}`}
                        style={tier.id === vipTier.id ? { borderColor: tier.color, background: tier.glow } : {}}>
                        <span className={styles.vipTierEmoji}>{tier.emoji}</span>
                        <span className={styles.vipTierName} style={tier.id === vipTier.id ? { color: tier.color } : {}}>{tier.name}</span>
                        <span className={styles.vipTierPct}>{tier.rakebackPct}% RB</span>
                      </div>
                    ))}
                  </div>
                  {nextTier && (
                    <div className={styles.progressWrap}>
                      <div className={styles.progressLabels}>
                        <span>{vipTier.name}</span>
                        <span>{nextTier.name} ({formatBTC(nextTier.minWager - totalWager)} to go)</span>
                      </div>
                      <div className={styles.progressBar}>
                        <motion.div
                          className={styles.progressFill}
                          style={{ background: `linear-gradient(90deg, ${vipTier.color}, ${nextTier.color})` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                  {!nextTier && (
                    <div className={styles.maxTier}>💎 Maximum VIP — Diamond Elite!</div>
                  )}
                </div>

                {/* Rakeback Safe */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>Rakeback Safe</div>
                  <div className={styles.rakebackInfo}>
                    <div className={styles.rakebackStat}>
                      <div className={styles.rakebackValue}>{formatBTC(rakebackData.accrued)}</div>
                      <div className={styles.rakebackLabel}>Claimable Now</div>
                    </div>
                    <div className={styles.rakebackStat}>
                      <div className={styles.rakebackValue}>{vipTier.rakebackPct}%</div>
                      <div className={styles.rakebackLabel}>Your Rate</div>
                    </div>
                    <div className={styles.rakebackStat}>
                      <div className={styles.rakebackValue}>{formatBTC(rakebackData.lifetime)}</div>
                      <div className={styles.rakebackLabel}>Lifetime Earned</div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {claimed && (
                      <motion.div className={styles.claimSuccess}
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        🎉 Claimed {formatBTC(claimed)}!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    className={styles.claimBtn}
                    disabled={rakebackData.accrued <= 0}
                    onClick={handleClaim}
                    whileHover={rakebackData.accrued > 0 ? { scale: 1.03 } : {}}
                    whileTap={rakebackData.accrued > 0 ? { scale: 0.97 } : {}}
                    animate={rakebackData.accrued > 0 ? {
                      boxShadow: ['0 0 10px rgba(0,255,136,0.3)', '0 0 25px rgba(0,255,136,0.6)', '0 0 10px rgba(0,255,136,0.3)']
                    } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    ♻️ Claim {formatBTC(rakebackData.accrued)} Rakeback
                  </motion.button>

                  {vipTier.rakebackPct === 0 && (
                    <p className={styles.upgradeHint}>Wager $100.00+ to unlock Bronze tier (3% rakeback)!</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Identity ── */}
            {tab === 'identity' && (
              <motion.div key="identity" className={styles.panel}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>Username</div>
                  <div className={styles.inputRow}>
                    <input
                      className={styles.input}
                      type="text"
                      maxLength={20}
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Your crypto alias"
                    />
                    <motion.button className={styles.saveBtn} onClick={saveUsername}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      {saved ? '✅ Saved!' : 'Save'}
                    </motion.button>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>Avatar</div>
                  <div className={styles.avatarGrid}>
                    {PLAYER_AVATARS.map(av => (
                      <motion.button
                        key={av.id}
                        className={`${styles.avatarOption} ${profile.avatarId === av.id ? styles.avatarSelected : ''}`}
                        onClick={() => selectAvatar(av)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        style={profile.avatarId === av.id ? { borderColor: vipTier.color, background: vipTier.glow } : {}}
                      >
                        <span className={styles.avatarOptionEmoji}>{av.emoji}</span>
                        <span className={styles.avatarOptionLabel}>{av.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Statistics ── */}
            {tab === 'stats' && (
              <motion.div key="stats" className={styles.panel}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className={styles.statsGrid}>
                  {[
                    { label: 'Total Games', value: (stats?.totalGames ?? 0).toLocaleString(), icon: '🎮' },
                    { label: 'Win Rate',    value: `${winRate}%`,                             icon: '🏆' },
                    { label: 'Net Profit',  value: `${netProfit >= 0 ? '+' : '-'}${formatBTC(Math.abs(netProfit))}`, icon: netProfit >= 0 ? '📈' : '📉', positive: netProfit >= 0 },
                    { label: 'Total Wagered', value: formatBTC(stats?.totalBet ?? 0), icon: '💸' },
                    { label: 'Biggest Win',   value: formatBTC(stats?.biggestWin ?? 0), icon: '🚀' },
                    { label: 'Peak Balance',  value: formatBTC(stats?.peakBalance ?? 0), icon: '📊' },
                    { label: 'Win Streak',    value: `${stats?.maxWinStreak ?? 0}x`,          icon: '🔥' },
                    { label: 'Bankruptcies',  value: stats?.timesBankrupt ?? 0,               icon: '💀' },
                  ].map(({ label, value, icon, positive }) => (
                    <div key={label} className={styles.statCard}>
                      <span className={styles.statIcon}>{icon}</span>
                      <div className={`${styles.statValue} ${positive === false ? styles.statNeg : positive ? styles.statPos : ''}`}>{value}</div>
                      <div className={styles.statLabel}>{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Ledger ── */}
            {tab === 'ledger' && (
              <motion.div key="ledger" className={styles.panel}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>Transaction History</div>
                  {ledger.length === 0 ? (
                    <p className={styles.empty}>No transactions yet. Use the Wallet to deposit or withdraw!</p>
                  ) : (
                    <div className={styles.ledgerList}>
                      {ledger.map(entry => (
                        <div key={entry.id} className={`${styles.ledgerRow} ${styles[`ledger_${entry.type}`]}`}>
                          <div className={styles.ledgerIcon}>
                            {entry.type === 'deposit' ? '↓' : entry.type === 'withdrawal' ? '↑' : '♻'}
                          </div>
                          <div className={styles.ledgerInfo}>
                            <div className={styles.ledgerLabel}>{entry.label}</div>
                            {entry.txid && <div className={styles.ledgerTxid}>{entry.txid.slice(0, 20)}...{entry.txid.slice(-8)}</div>}
                            <div className={styles.ledgerDate}>{new Date(entry.timestamp).toLocaleString()}</div>
                          </div>
                          <div className={`${styles.ledgerAmount} ${entry.type === 'withdrawal' ? styles.amountNeg : styles.amountPos}`}>
                            {entry.type === 'withdrawal' ? '-' : '+'}{formatBTC(entry.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
