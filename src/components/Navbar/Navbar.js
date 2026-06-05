'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBitcoin, FaWallet, FaDice, FaRocket, FaUser, FaDotCircle, FaChevronDown, FaBomb, FaBolt, FaBuilding, FaSort, FaGamepad, FaComments, FaCoins, FaRoad, FaTicketAlt, FaCircle, FaKey } from 'react-icons/fa';
import { GiRollingDices } from 'react-icons/gi';
import {
  BiJoystick,
  BiBarChartAlt2,
  BiTrophy,
  BiCrown,
} from 'react-icons/bi';
import { formatBTC } from '@/lib/utils';
import { useBalance } from '@/hooks/useBalance';
import { useProfile } from '@/hooks/useProfile';
import { useWallet } from '@/hooks/useWallet';
import { useCurrency, CURRENCY_DETAILS } from '@/hooks/useCurrency';
import VipSettings from '@/components/VipSettings/VipSettings';
import VipLevelUpCelebration from '@/components/VipLevelUpCelebration/VipLevelUpCelebration';
import ChatSidebar from '@/components/ChatSidebar/ChatSidebar';
import LiveStats from '@/components/LiveStats/LiveStats';
import { useChat } from '@/hooks/useChat';
import { supabase, isDbEnabled } from '@/lib/supabase';
import WalletModal from '@/components/WalletModal/WalletModal';
import AuthModal from '@/components/AuthModal/AuthModal';
import styles from './Navbar.module.css';
 
const GAMES_ITEMS = [
  { href: '/play',      label: 'Mine ⛏️',      desc: 'Find the hidden block & win big', icon: BiJoystick },
  { href: '/slots',     label: 'Slots 🎰',     desc: 'Spin for legendary multipliers', icon: FaDice },
  { href: '/crash',     label: 'Crash 🚀',     desc: 'Multiply bets in real-time drops', icon: FaRocket },
  { href: '/dice',      label: 'Dice 🎲',      desc: 'Provably fair high-low custom odds', icon: GiRollingDices },
  { href: '/plinko',    label: 'Plinko 🟢',    desc: 'Peg-board vector physics drops', icon: FaDotCircle },
  { href: '/mines',     label: 'Mines 💣',     desc: 'Sweep tiles for gems & avoid mines', icon: FaBomb },
  { href: '/limbo',     label: 'Limbo 🎯',     desc: 'Predict high target multipliers', icon: FaBolt },
  { href: '/tower',     label: 'Tower 🏰',     desc: 'Climb blocks and avoid traps', icon: FaBuilding },
  { href: '/hilo',      label: 'Hi-Lo 📈',      desc: 'Guess higher or lower cards', icon: FaSort },
  { href: '/blackjack', label: 'Blackjack 🃏', desc: 'Beat the dealer and hit 21', icon: FaGamepad },
  { href: '/coinflip',  label: 'Coin Flip 🪙',  desc: 'Provably fair 50/50 double-ups', icon: FaBitcoin },
  { href: '/cryptopop', label: 'Token Pop 🪙', desc: 'Pop crypto tokens for compounding payouts', icon: FaCoins },
  { href: '/chickenroad',label: 'Chicken Road 🐓', desc: 'Cross traffic lanes and win wagers', icon: FaRoad },
  { href: '/snakeroll',   label: 'Snake Roll 🐍',   desc: 'Roll dice to navigate the board track', icon: FaDice },
  { href: '/videopoker',  label: 'Video Poker 🃏',  desc: 'Hold, draw and hit Jacks or Better', icon: FaGamepad },
  { href: '/keno',        label: 'Keno 🎯',          desc: 'Pick numbers and match for big wins', icon: FaCircle },
  { href: '/roulette',    label: 'Roulette 🎡',      desc: 'Spin the wheel and pick your fate', icon: FaCircle },
  { href: '/scratch',     label: 'Scratch Cards 🎟️', desc: 'Scratch panels and match 3 to win', icon: FaTicketAlt },
  { href: '/bullrun',     label: 'Bull Run 📈',      desc: 'Trade volatile crypto market candles', icon: BiBarChartAlt2 },
  { href: '/baccarat',    label: "Satoshi's Baccarat 🃏", desc: 'Classic card game with an 8-deck shoe', icon: FaGamepad },
  { href: '/lottery',     label: 'Progressive Lottery 🎟️', desc: 'Match 3 digits for a progressive pot (halved if duplicates!)', icon: FaTicketAlt },
];

const ACCOUNT_ITEMS = [
  { href: '/profile',     label: 'My Profile',      desc: 'VIP stats, safe & identity details', icon: FaUser },
  { href: '/stats',       label: 'Session Stats',   desc: 'Analyze payout gains & graphs', icon: BiBarChartAlt2 },
  { href: '/achievements',label: 'Achievements',  desc: 'Unlockable limited mining trophies', icon: BiTrophy },
  { href: '/leaderboard', label: 'Leaderboard',   desc: 'Climb the global crypto rich-list', icon: BiCrown },
];

export default function Navbar({ balance = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [mySessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Date.now().toString(36));



  // Accordion triggers for mobile
  const [mobileGamesOpen, setMobileGamesOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);

  // New balance chip popover states
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);
  const [mobileBalancePopoverOpen, setMobileBalancePopoverOpen] = useState(false);
  const balancePopoverRef = useRef(null);

  const { balance: liveBalance, addBalance, subtractBalance } = useBalance();
  const { profile, user } = useProfile();
  const wallet = useWallet(liveBalance ?? balance, addBalance, subtractBalance);
  
  const { currency, setCurrency, activeSymbol, prices } = useCurrency();
  const { chatOpen, toggleChat } = useChat();
  const [liveStatsOpen, setLiveStatsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('btcfinder_livestats_open') === 'true';
      setLiveStatsOpen(saved);

      const handleToggle = (e) => {
        setLiveStatsOpen(e.detail);
      };
      window.addEventListener('livestats-toggle-state', handleToggle);
      return () => window.removeEventListener('livestats-toggle-state', handleToggle);
    }
  }, []);

  const toggleLiveStats = () => {
    const next = !liveStatsOpen;
    setLiveStatsOpen(next);
    localStorage.setItem('btcfinder_livestats_open', String(next));
    window.dispatchEvent(new CustomEvent('livestats-toggle-state', { detail: next }));
  };

  const displayBalance = liveBalance ?? balance;

  const formatActiveCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0.00';
    const price = prices[currency] || 1.0;
    const converted = amount / price;
    const dec = { USD: 2, BTC: 8, ETH: 6, SOL: 4, DOGE: 2 }[currency] ?? 2;
    const sym = { USD: '$', BTC: '₿', ETH: '♦', SOL: '◎', DOGE: 'Ð' }[currency] ?? '$';
    return `${sym}${converted.toLocaleString(undefined, {
      minimumFractionDigits: Math.min(2, dec),
      maximumFractionDigits: dec
    })}`;
  };

  const gamesRef = useRef(null);
  const profileRef = useRef(null);

  const handleSignOut = async () => {
    if (isDbEnabled()) {
      await supabase.auth.signOut();
      // AuthGuard listens to onAuthStateChange and handles the redirect to /
    }
  };

  // Close menus on path changes
  useEffect(() => {
    setMobileOpen(false);
    setGamesOpen(false);
    setProfileOpen(false);
    setBalancePopoverOpen(false);
  }, [pathname]);

  // Realtime Broadcast Single Account / Session Lock
  useEffect(() => {
    if (!isDbEnabled() || !user) return;

    const channelName = `user-sessions-${user.id}`;
    const sessionChannel = supabase.channel(channelName);
    
    let active = true;

    sessionChannel
      .on('broadcast', { event: 'new-session' }, (payload) => {
        if (payload?.payload?.sessionId && payload.payload.sessionId !== mySessionId && active) {
          // A new session opened on another device/tab! Lock our local session!
          setIsSessionLocked(true);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && active) {
          // Broadcast our presence so that any older open sessions can lock themselves
          sessionChannel.send({
            type: 'broadcast',
            event: 'new-session',
            payload: { sessionId: mySessionId }
          });
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(sessionChannel);
    };
  }, [user, mySessionId]);

  // Click outside to close desktop popups
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (gamesRef.current && !gamesRef.current.contains(e.target)) {
        setGamesOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }

      if (balancePopoverRef.current && !balancePopoverRef.current.contains(e.target)) {
        setBalancePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (href) => {
    if (!pathname) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  const activeGame = GAMES_ITEMS.find((g) => isActive(g.href));

  return (
    <>
      <motion.nav
        className={styles.navbar}
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* ---- Brand ---- */}
        <Link href="/" className={styles.brand}>
          <motion.span
            className={styles.logoIcon}
            whileHover={{ rotate: 15, scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <FaBitcoin />
          </motion.span>
          <span className={styles.brandName}>Bitcoin Finder</span>
        </Link>

        {/* ---- Desktop Nav Links ---- */}
        <ul className={styles.navLinks}>
          {/* Lobby Hub */}
          <li>
            <Link 
              href="/lobby" 
              className={`${styles.navLink} ${isActive('/lobby') ? styles.navLinkActive : ''}`}
            >
              <BiJoystick className={styles.linkIcon} />
              <span>Lobby</span>
            </Link>
          </li>

          {/* 🎮 Games Dropdown Trigger */}
          <li className={styles.dropdownParent} ref={gamesRef}>
            <button
              className={`${styles.navLink} ${gamesOpen || activeGame ? styles.navLinkActive : ''}`}
              onClick={() => setGamesOpen((prev) => !prev)}
            >
              <FaDice className={styles.linkIcon} />
              <span>Games</span>
              <FaChevronDown className={`${styles.chevron} ${gamesOpen ? styles.chevronOpen : ''}`} />
            </button>

            {/* Games Dropdown popover */}
            <AnimatePresence>
              {gamesOpen && (
                <motion.div
                  className={styles.dropdownPopover}
                  initial={{ opacity: 0, y: 15, scale: 0.97, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 15, scale: 0.97, x: "-50%" }}
                  transition={{ type: 'spring', damping: 20, stiffness: 250 }}
                >
                  <div className={styles.popoverGrid}>
                    {GAMES_ITEMS.map(({ href, label, desc, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`${styles.popoverLink} ${isActive(href) ? styles.popoverLinkActive : ''}`}
                        onClick={() => setGamesOpen(false)}
                      >
                        <div className={styles.popoverIconWrap}>
                          <Icon />
                        </div>
                        <div className={styles.popoverText}>
                          <div className={styles.popoverLabel}>{label}</div>
                          <div className={styles.popoverDesc}>{desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        </ul>

        {/* ---- Desktop Balance + Wallet ---- */}
        <div className={styles.navRight}>
          {isDbEnabled() && !user && (
            <motion.button
              className={styles.signInBtn}
              onClick={() => setAuthOpen(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Sign In
            </motion.button>
          )}

          {/* Profile Dropdown (For both logged-in users and guests) */}
          <div className={styles.authMenuParent} ref={profileRef}>
            <motion.button
              className={styles.profileBtn}
              onClick={() => setProfileOpen((prev) => !prev)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className={styles.avatarEmoji}>{profile?.avatarEmoji ?? '⛏️'}</span>
              <span className={styles.usernameText}>
                {user ? (profile?.username || 'Player') : 'Guest / Demo'}
              </span>
              <FaChevronDown className={`${styles.chevron} ${profileOpen ? styles.chevronOpen : ''}`} />
            </motion.button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className={styles.profilePopover}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link href="/profile" className={styles.popoverMenuLink} onClick={() => setProfileOpen(false)}>
                    <FaUser className={styles.popoverMenuIcon} /> My Profile
                  </Link>
                  <Link href="/stats" className={styles.popoverMenuLink} onClick={() => setProfileOpen(false)}>
                    <BiBarChartAlt2 className={styles.popoverMenuIcon} /> Session Stats
                  </Link>
                  <Link href="/achievements" className={styles.popoverMenuLink} onClick={() => setProfileOpen(false)}>
                    <BiTrophy className={styles.popoverMenuIcon} /> Achievements
                  </Link>
                  <Link href="/leaderboard" className={styles.popoverMenuLink} onClick={() => setProfileOpen(false)}>
                    <BiCrown className={styles.popoverMenuIcon} /> Leaderboard
                  </Link>
                  {isDbEnabled() && (
                    <>
                      <div className={styles.divider} />
                      {user ? (
                        <button onClick={() => { handleSignOut(); setProfileOpen(false); }} className={styles.popoverMenuBtn}>
                          Sign Out
                        </button>
                      ) : (
                        <button onClick={() => { setAuthOpen(true); setProfileOpen(false); }} className={styles.popoverMenuBtn}>
                          Sign In
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            className={styles.walletBtn}
            onClick={() => setWalletOpen(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <FaWallet />
            <span>Wallet</span>
          </motion.button>

          <motion.button
            className={`${styles.chatToggleBtn} ${chatOpen ? styles.chatToggleBtnActive : ''}`}
            onClick={toggleChat}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            title="Toggle Social Chat"
          >
            <FaComments />
            <span className={styles.chatBtnText}>Chat</span>
          </motion.button>

          {/* Live Stats Toggle */}
          <motion.button
            className={`${styles.statsToggleBtn} ${liveStatsOpen ? styles.statsToggleBtnActive : ''}`}
            onClick={toggleLiveStats}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            title="Toggle Live Stats"
          >
            <BiBarChartAlt2 />
            <span className={styles.statsBtnText}>Stats</span>
          </motion.button>

          {/* Multi-Currency Balance Chip & Popover */}
          <div className={styles.balanceChipContainer} ref={balancePopoverRef}>
            <motion.button
              className={styles.balanceChip}
              onClick={() => setBalancePopoverOpen((p) => !p)}
              whileHover={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className={styles.avatarEmoji}>{profile?.avatarEmoji ?? '⛏️'}</span>
                <span className={styles.balanceAmount}>{formatActiveCurrency(displayBalance)}</span>
              </div>
              <FaChevronDown className={`${styles.chevron} ${balancePopoverOpen ? styles.chevronOpen : ''}`} />
            </motion.button>
            <AnimatePresence>
              {balancePopoverOpen && (
                <motion.div
                  className={styles.balancePopover}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.balancePopoverHeader}>
                    <h4>Converted Balances</h4>
                  </div>
                  <div className={styles.balancePopoverList}>
                    {['USD', 'BTC', 'ETH', 'SOL', 'DOGE'].map((cur) => {
                      const price = prices[cur] || 1.0;
                      const converted = displayBalance / price;
                      const dec = { USD: 2, BTC: 8, ETH: 6, SOL: 4, DOGE: 2 }[cur];
                      const sym = { USD: '$', BTC: '₿', ETH: '♦', SOL: '◎', DOGE: 'Ð' }[cur];
                      const formatted = converted.toLocaleString(undefined, {
                        minimumFractionDigits: Math.min(2, dec),
                        maximumFractionDigits: dec
                      });

                      return (
                        <button
                          key={cur}
                          className={`${styles.balancePopoverRow} ${cur === currency ? styles.balancePopoverRowActive : ''}`}
                          onClick={() => {
                            setCurrency(cur);
                            setBalancePopoverOpen(false);
                          }}
                        >
                          <span className={styles.balanceRowSym} style={{ color: cur === currency ? '#00ff88' : '#ffffff' }}>
                            {sym}
                          </span>
                          <span className={styles.balanceRowLabel}>{cur}</span>
                          <span className={styles.balanceRowValue}>{formatted}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---- Mobile Hamburger ---- */}
        <button
          className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>
      </motion.nav>

      {/* ---- Mobile Menu Panel ---- */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              className={`${styles.mobileOverlay} ${styles.mobileOverlayOpen}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileOpen(false)}
            />

            {/* Collapsible Mobile Menu */}
            <motion.ul
              className={`${styles.mobileMenu} ${styles.mobileMenuOpen}`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Mobile Lobby Link */}
              <li className={styles.mobileCategory} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Link
                  href="/lobby"
                  className={`${styles.mobileNavLink} ${isActive('/lobby') ? styles.mobileNavLinkActive : ''}`}
                  onClick={() => setMobileOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 1.25rem', width: '100%', textDecoration: 'none', color: '#ffffff', fontWeight: 600 }}
                >
                  <BiJoystick className={styles.linkIcon} />
                  Lobby Hub 🎡
                </Link>
              </li>

              {/* Mobile Games Accordion */}
              <li className={styles.mobileCategory}>
                <button
                  className={styles.mobileAccordionBtn}
                  onClick={() => setMobileGamesOpen((p) => !p)}
                >
                  <span>🎮 Games Selection</span>
                  <FaChevronDown className={`${styles.chevron} ${mobileGamesOpen ? styles.chevronOpen : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileGamesOpen && (
                    <motion.div
                      className={styles.mobileAccordionContent}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {GAMES_ITEMS.map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`${styles.mobileNavLink} ${isActive(href) ? styles.mobileNavLinkActive : ''}`}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon className={styles.linkIcon} />
                          {label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>

              {/* Mobile Account Accordion */}
              <li className={styles.mobileCategory}>
                <button
                  className={styles.mobileAccordionBtn}
                  onClick={() => setMobileAccountOpen((p) => !p)}
                >
                  <span>👤 Account Dashboard</span>
                  <FaChevronDown className={`${styles.chevron} ${mobileAccountOpen ? styles.chevronOpen : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileAccountOpen && (
                    <motion.div
                      className={styles.mobileAccordionContent}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {ACCOUNT_ITEMS.map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`${styles.mobileNavLink} ${isActive(href) ? styles.mobileNavLinkActive : ''}`}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon className={styles.linkIcon} />
                          {label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>

              {isDbEnabled() && (
                <li className={styles.mobileAuthSection}>
                  {user ? (
                    <div className={styles.mobileAuthRow}>
                      <span className={styles.mobileUserLabel}>Signed in as: <strong>{profile?.username || 'Player'}</strong></span>
                      <button
                        className={styles.mobileSignOutBtn}
                        onClick={() => { handleSignOut(); setMobileOpen(false); }}
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.mobileSignInBtn}
                      onClick={() => { setAuthOpen(true); setMobileOpen(false); }}
                    >
                      Sign In to Sync Profile
                    </button>
                  )}
                </li>
              )}

              {/* Mobile Wallet Balance & Currency Selector */}
              <li className={styles.mobileBalanceSection}>
                <div className={styles.mobileBalanceTitle}>Active Wallet Balance</div>
                <div className={styles.mobileBalanceRow}>
                  <button
                    className={styles.mobileBalanceChipBtn}
                    onClick={() => setMobileBalancePopoverOpen((p) => !p)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className={styles.avatarEmoji}>{profile?.avatarEmoji ?? '⛏️'}</span>
                      <span className={styles.balanceAmount}>{formatActiveCurrency(displayBalance)}</span>
                    </div>
                    <FaChevronDown className={`${styles.chevron} ${mobileBalancePopoverOpen ? styles.chevronOpen : ''}`} />
                  </button>
                  <button
                    className={styles.mobileWalletDepositBtn}
                    onClick={() => { setMobileOpen(false); setWalletOpen(true); }}
                  >
                    Wallet
                  </button>
                </div>

                <AnimatePresence>
                  {mobileBalancePopoverOpen && (
                    <motion.div
                      className={styles.mobileBalanceList}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {['USD', 'BTC', 'ETH', 'SOL', 'DOGE'].map((cur) => {
                        const price = prices[cur] || 1.0;
                        const converted = displayBalance / price;
                        const dec = { USD: 2, BTC: 8, ETH: 6, SOL: 4, DOGE: 2 }[cur];
                        const sym = { USD: '$', BTC: '₿', ETH: '♦', SOL: '◎', DOGE: 'Ð' }[cur];
                        const formatted = converted.toLocaleString(undefined, {
                          minimumFractionDigits: Math.min(2, dec),
                          maximumFractionDigits: dec
                        });

                        return (
                          <button
                            key={cur}
                            className={`${styles.mobileBalanceRow} ${cur === currency ? styles.mobileBalanceRowActive : ''}`}
                            onClick={() => {
                              setCurrency(cur);
                              setMobileBalancePopoverOpen(false);
                            }}
                          >
                            <span className={styles.balanceRowSym} style={{ color: cur === currency ? '#00ff88' : '#ffffff' }}>
                              {sym}
                            </span>
                            <span className={styles.balanceRowLabel}>{cur}</span>
                            <span className={styles.balanceRowValue}>{formatted}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            </motion.ul>
          </>
        )}
      </AnimatePresence>

      {/* ---- Wallet Modal ---- */}
      <WalletModal
        isOpen={walletOpen}
        onClose={() => setWalletOpen(false)}
        balance={displayBalance}
        wallet={wallet}
      />

      {/* ---- Auth Modal ---- */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(u) => {
          setAuthOpen(false);
          router.push('/lobby');
        }}
      />
      <VipSettings />
      <VipLevelUpCelebration />
      <ChatSidebar />
      <LiveStats />

      {/* ---- Multi-Device Blocker Overlay ---- */}
      <AnimatePresence>
        {isSessionLocked && (
          <motion.div
            className={styles.sessionBlockerOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.sessionBlockerCard}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className={styles.sessionBlockerIcon}>⚠️</div>
              <h2 className={styles.sessionBlockerTitle}>Session Locked</h2>
              <p className={styles.sessionBlockerDesc}>
                This account has been opened on another device or browser tab.
                To protect your wallet and balance, gameplay and bet controls have been locked on this session.
              </p>
              <button
                className={styles.sessionBlockerActionBtn}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
              >
                Reconnect This Tab
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
