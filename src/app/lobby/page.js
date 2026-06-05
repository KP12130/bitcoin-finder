'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaBitcoin, 
  FaDice, 
  FaRocket, 
  FaBomb, 
  FaBolt, 
  FaBuilding, 
  FaSort, 
  FaGamepad, 
  FaRoad, 
  FaCoins, 
  FaDotCircle, 
  FaSearch, 
  FaTrophy, 
  FaUsers, 
  FaDiceD6,
  FaTicketAlt,
  FaKey
} from 'react-icons/fa';
import { GiRollingDices } from 'react-icons/gi';
import Navbar from '@/components/Navbar/Navbar';
import LiveBetsFeed from '@/components/LiveBetsFeed/LiveBetsFeed';
import { useBalance } from '@/hooks/useBalance';
import styles from './page.module.css';

// ─── Constants & Icon Mapping ───────────────────────────────────────────────
const iconMap = {
  FaBitcoin: <FaBitcoin />,
  FaDice: <FaDice />,
  FaRocket: <FaRocket />,
  FaBomb: <FaBomb />,
  FaBolt: <FaBolt />,
  FaBuilding: <FaBuilding />,
  FaSort: <FaSort />,
  FaGamepad: <FaGamepad />,
  FaRoad: <FaRoad />,
  FaCoins: <FaCoins />,
  FaDotCircle: <FaDotCircle />,
  GiRollingDices: <GiRollingDices />,
  FaTicketAlt: <FaTicketAlt />,
  FaKey: <FaKey />,
};

const FEATURED_GAMES = [
  {
    id: 'crash',
    name: 'Crash Rocket 🚀',
    desc: 'Wager, ride the rising rocket, and cash out before it implodes! High volatility multipliers.',
    href: '/crash',
    color: '#ff4757',
    icon: <FaRocket />,
    tag: 'Trending Game 🔥',
  },
  {
    id: 'blackjack',
    name: 'Blackjack Table 🃏',
    desc: 'Double down, split, hit or stand. Beat the premium virtual card dealer to a perfect 21!',
    href: '/blackjack',
    color: '#00ff88',
    icon: <FaGamepad />,
    tag: 'Classic Pick 👑',
  },
  {
    id: 'slots',
    name: 'Satoshi Slots 🎰',
    desc: 'Spin for legendary combinations and massive progressive payouts on standard 5-reels!',
    href: '/slots',
    color: '#ffcc00',
    icon: <FaDice />,
    tag: 'Big Wins Jackpots 🏆',
  },
  {
    id: 'chickenroad',
    name: 'Chicken Road 🐓',
    desc: 'Dash step-by-step across busy road lanes! Avoid incoming crashes to compound your payouts.',
    href: '/chickenroad',
    color: '#ee5a24',
    icon: <FaRoad />,
    tag: 'Most Volatile 🌾',
  }
];

const GAMES = [
  {
    id: 'mine',
    name: 'Block Finder ⛏️',
    href: '/play',
    desc: 'Mine hidden blocks & win multiplier prizes',
    category: 'originals',
    volatility: 'Medium',
    colorClass: 'green',
    iconName: 'FaBitcoin',
  },
  {
    id: 'slots',
    name: 'Satoshi Slots 🎰',
    href: '/slots',
    desc: 'Spin the reels for progressive jackpots',
    category: 'slots',
    volatility: 'High',
    colorClass: 'gold',
    iconName: 'FaDice',
  },
  {
    id: 'crash',
    name: 'Crash Rocket 🚀',
    href: '/crash',
    desc: 'Cash out before the multiplier falls',
    category: 'originals',
    volatility: 'High',
    colorClass: 'red',
    iconName: 'FaRocket',
  },
  {
    id: 'dice',
    name: 'Satoshi Dice 🎲',
    href: '/dice',
    desc: 'Provably fair custom odds slider wagers',
    category: 'originals',
    volatility: 'Customizable',
    colorClass: 'blue',
    iconName: 'GiRollingDices',
  },
  {
    id: 'plinko',
    name: 'Plinko Board 🟢',
    href: '/plinko',
    desc: 'Peg-board vector physics drop multipliers',
    category: 'originals',
    volatility: 'Customizable',
    colorClass: 'pink',
    iconName: 'FaDotCircle',
  },
  {
    id: 'mines',
    name: 'Minesweeper 💣',
    href: '/mines',
    desc: 'Sweep tile gems and avoid hidden traps',
    category: 'originals',
    volatility: 'Customizable',
    colorClass: 'orange',
    iconName: 'FaBomb',
  },
  {
    id: 'limbo',
    name: 'Limbo Target 🎯',
    href: '/limbo',
    desc: 'Predict high target multipliers up to 1,000,000x',
    category: 'originals',
    volatility: 'High',
    colorClass: 'cyan',
    iconName: 'FaBolt',
  },
  {
    id: 'tower',
    name: 'Tower Climb 🏰',
    href: '/tower',
    desc: 'Climb vertical safety blocks step by step',
    category: 'originals',
    volatility: 'Customizable',
    colorClass: 'purple',
    iconName: 'FaBuilding',
  },
  {
    id: 'hilo',
    name: 'Hi-Lo Cards 📈',
    href: '/hilo',
    desc: 'Guess higher or lower on playing cards',
    category: 'originals',
    volatility: 'Medium',
    colorClass: 'orange',
    iconName: 'FaSort',
  },
  {
    id: 'blackjack',
    name: 'Blackjack Table 🃏',
    href: '/blackjack',
    desc: 'Beat the dealer and hit a perfect 21',
    category: 'table',
    volatility: 'Low',
    colorClass: 'darkgreen',
    iconName: 'FaGamepad',
  },
  {
    id: 'coinflip',
    name: 'Coin Flip 🪙',
    href: '/coinflip',
    desc: 'Instant provably fair 50/50 flip wagers',
    category: 'table',
    volatility: 'Low',
    colorClass: 'gold',
    iconName: 'FaBitcoin',
  },
  {
    id: 'cryptopop',
    name: 'Token Pop 🪙',
    href: '/cryptopop',
    desc: 'Pop crypto block clusters for rewards',
    category: 'slots',
    volatility: 'Medium',
    colorClass: 'orange',
    iconName: 'FaCoins',
  },
  {
    id: 'chickenroad',
    name: 'Chicken Road 🐓',
    href: '/chickenroad',
    desc: 'Navigate chicken safely through traffic lanes',
    category: 'originals',
    volatility: 'Medium',
    colorClass: 'yellow',
    iconName: 'FaRoad',
  },
  {
    id: 'snakeroll',
    name: 'Snake Roll 🐍',
    href: '/snakeroll',
    desc: 'Roll dice to navigate the multiplier board',
    category: 'originals',
    volatility: 'Medium',
    colorClass: 'green',
    iconName: 'FaDice',
  },
  {
    id: 'videopoker',
    name: 'Video Poker 🃏',
    href: '/videopoker',
    desc: 'Hold, draw and hit Jacks or Better',
    category: 'table',
    volatility: 'Medium',
    colorClass: 'blue',
    iconName: 'FaGamepad',
  },
  {
    id: 'keno',
    name: 'Keno 🎯',
    href: '/keno',
    desc: 'Pick numbers and match for big wins',
    category: 'originals',
    volatility: 'High',
    colorClass: 'pink',
    iconName: 'FaBolt',
  },
  {
    id: 'roulette',
    name: 'Roulette 🎡',
    href: '/roulette',
    desc: 'Spin the wheel and pick your fate',
    category: 'table',
    volatility: 'Medium',
    colorClass: 'purple',
    iconName: 'FaDice',
  },
  {
    id: 'scratch',
    name: 'Scratch Cards 🎟️',
    href: '/scratch',
    desc: 'Scratch panels and match 3 to win',
    category: 'originals',
    volatility: 'Medium',
    colorClass: 'gold',
    iconName: 'FaTicketAlt',
  },
  {
    id: 'bullrun',
    name: 'Bull Run 📈',
    href: '/bullrun',
    desc: 'Open leveraged positions on live crypto candles',
    category: 'originals',
    volatility: 'High',
    colorClass: 'cyan',
    iconName: 'FaRocket',
  },
  {
    id: 'baccarat',
    name: "Satoshi's Baccarat 🃏",
    href: '/baccarat',
    desc: 'Play classic baccarat with an 8-deck shoe',
    category: 'table',
    volatility: 'Low',
    colorClass: 'green',
    iconName: 'FaGamepad',
  },
  {
    id: 'lottery',
    name: 'Progressive Lottery 🎟️',
    href: '/lottery',
    desc: 'Match 3 numbers for a progressive pot (halved if duplicates!)',
    category: 'table',
    volatility: 'High',
    colorClass: 'orange',
    iconName: 'FaTicketAlt',
  },
];

export default function GameLobby() {
  const { balance } = useBalance();
  const [mounted, setMounted] = useState(false);
  
  // Carousel state
  const [activeSlide, setActiveSlide] = useState(0);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [volatilityFilter, setVolatilityFilter] = useState('all');

  // Dynamic Ticking Live Stats
  const [activePlayers, setActivePlayers] = useState(4128);
  const [totalBets, setTotalBets] = useState(2458912);
  const [totalPaidOut, setTotalPaidOut] = useState(2409733);

  useEffect(() => {
    setMounted(true);

    // Auto-slide Featured Carousel
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % FEATURED_GAMES.length);
    }, 6000);

    // Live Stats Simulation Loops
    const statsTimer = setInterval(() => {
      // Fluctuate active players naturally (+/- 12)
      setActivePlayers((p) => {
        const delta = Math.floor(Math.random() * 25) - 12;
        const next = p + delta;
        return next < 3900 || next > 4350 ? p - delta : next;
      });

      // Increment wagers & payouts
      const betAmt = Math.round((Math.random() * 215 + 10) * 100) / 100;
      const rtpPayout = Math.round(betAmt * 0.982 * 100) / 100;

      setTotalBets((b) => b + 1);
      setTotalPaidOut((p) => p + rtpPayout);
    }, 1800);

    return () => {
      clearInterval(slideTimer);
      clearInterval(statsTimer);
    };
  }, []);

  if (!mounted) return null;

  // Filter & Search Logic
  const filteredGames = GAMES.filter((game) => {
    const matchesTab = activeTab === 'all' || game.category === activeTab;
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          game.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVolatility = volatilityFilter === 'all' || 
                              game.volatility.toLowerCase() === volatilityFilter.toLowerCase();
    
    return matchesTab && matchesSearch && matchesVolatility;
  });

  return (
    <>
      <Navbar balance={balance} />

      <div className={styles.lobbyPage}>
        <div className="page-container">
          
          {/* ─── Hero Section & Featured Carousel ──────────────────────── */}
          <section className={styles.heroSection}>
            <div className={styles.carouselContainer}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide}
                  className={styles.slide}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  style={{ '--slide-theme': FEATURED_GAMES[activeSlide].color }}
                >
                  <div className={styles.slideContent}>
                    <span className={styles.slideTag}>{FEATURED_GAMES[activeSlide].tag}</span>
                    <h2 className={styles.slideTitle}>{FEATURED_GAMES[activeSlide].name}</h2>
                    <p className={styles.slideDesc}>{FEATURED_GAMES[activeSlide].desc}</p>
                    <Link href={FEATURED_GAMES[activeSlide].href} className={styles.slideCta}>
                      Play Now 🚀
                    </Link>
                  </div>
                  <div className={styles.slideVisual} style={{ color: FEATURED_GAMES[activeSlide].color }}>
                    {FEATURED_GAMES[activeSlide].icon}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Carousel Indicators */}
              <div className={styles.carouselIndicators}>
                {FEATURED_GAMES.map((_, idx) => (
                  <button
                    key={idx}
                    className={`${styles.indicator} ${idx === activeSlide ? styles.indicatorActive : ''}`}
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Show slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ─── Live Casino Activity Counters ────────────────────────── */}
          <section className={styles.statsSection}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIconWrap} style={{ color: '#00ff88' }}>
                  <FaUsers />
                </div>
                <div className={styles.statInfo}>
                  <div className={styles.statLabel}>Active Players</div>
                  <div className={styles.statValue}>
                    {activePlayers.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIconWrap} style={{ color: '#ffcc00' }}>
                  <FaDiceD6 />
                </div>
                <div className={styles.statInfo}>
                  <div className={styles.statLabel}>Bets Today</div>
                  <div className={styles.statValue}>
                    {totalBets.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIconWrap} style={{ color: '#ff4757' }}>
                  <FaTrophy />
                </div>
                <div className={styles.statInfo}>
                  <div className={styles.statLabel}>Payouts Today</div>
                  <div className={styles.statValue}>
                    ${totalPaidOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Game Filters & Search Toggles ────────────────────────── */}
          <section className={styles.filterSection}>
            <div className={styles.filterBar}>
              
              {/* Category tabs */}
              <div className={styles.tabs}>
                {[
                  { id: 'all', label: 'All Games 🎡' },
                  { id: 'originals', label: 'Originals ⛏️' },
                  { id: 'slots', label: 'Slots 🎰' },
                  { id: 'table', label: 'Table Games 🃏' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search and Volatility */}
              <div className={styles.filterControls}>
                <div className={styles.searchWrapper}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search game..."
                    className={styles.searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className={styles.selectWrapper}>
                  <select
                    className={styles.filterSelect}
                    value={volatilityFilter}
                    onChange={(e) => setVolatilityFilter(e.target.value)}
                  >
                    <option value="all">All Volatility</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Volatility</option>
                    <option value="customizable">Customizable</option>
                  </select>
                </div>
              </div>

            </div>
          </section>

          {/* ─── Games Responsive Grid ────────────────────────────────── */}
          <section className={styles.gamesSection}>
            {filteredGames.length > 0 ? (
              <div className={styles.gamesGrid}>
                {filteredGames.map((game, i) => (
                  <motion.div
                    key={game.id}
                    className={`${styles.gameCard} ${styles[`card_${game.colorClass}`]}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                  >
                    {/* Glowing effect inside CSS */}
                    <div className={styles.cardHeader}>
                      <span className={`${styles.volBadge} ${styles[`badge_${game.volatility.toLowerCase()}`]}`}>
                        {game.volatility}
                      </span>
                    </div>

                    <div className={styles.cardMain}>
                      <div className={styles.gameIcon}>
                        {iconMap[game.iconName] || <FaDice />}
                      </div>
                      <h3 className={styles.gameName}>{game.name}</h3>
                      <p className={styles.gameDesc}>{game.desc}</p>
                    </div>

                    <div className={styles.cardOverlay}>
                      <Link href={game.href} className={styles.playBtn}>
                        Play Now ⚡
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className={styles.noResults}>
                <div className={styles.noResultsIcon}>🔍</div>
                <h3>No games found</h3>
                <p>Try refining your search text or filters.</p>
              </div>
            )}
          </section>

          {/* ─── Live Bets Ledger Feed ────────────────────────────────── */}
          <section className={styles.betsSection}>
            <LiveBetsFeed />
          </section>

        </div>
      </div>
    </>
  );
}
