'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCog, FaVolumeUp, FaVolumeMute, FaPalette, FaKey, FaCopy, FaCheck, FaSync } from 'react-icons/fa';
import { getClientSeed, setClientSeed, rollServerSeed, getActiveServerSeedHash, getActiveServerSeed } from '@/lib/provablyFair';
import { playSound } from '@/lib/audio';
import styles from './VipSettings.module.css';

export default function VipSettings() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({ volume: 50, muted: false, feltColor: 'green', theme: 'default' });
  const [clientSeedInput, setClientSeedInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [hashMasked, setHashMasked] = useState(true);
  const [serverHash, setServerHash] = useState('');
  
  const panelRef = useRef(null);

  // Sync settings helper
  const saveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('btcfinder_vip_settings', JSON.stringify(newSettings));
      // Dispatch storage/custom event so audio engine and pages update
      window.dispatchEvent(new Event('vip-settings-update'));
    }
  }, []);

  // Hydrate states on client mount
  useEffect(() => {
    setMounted(true);
    setClientSeedInput(getClientSeed());
    
    // Load setting details
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('btcfinder_vip_settings');
      let currentSettings = { volume: 50, muted: false, feltColor: 'green', theme: 'default' };
      if (raw) {
        try {
          currentSettings = { ...currentSettings, ...JSON.parse(raw) };
        } catch (e) {}
      }
      setSettings(currentSettings);
      document.body.setAttribute('data-felt-color', currentSettings.feltColor);
      const savedTheme = currentSettings.theme || 'default';
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      // Calculate server hash
      setServerHash(getActiveServerSeedHash('blackjack'));
    }

    const handleUpdate = () => {
      setClientSeedInput(getClientSeed());
      setServerHash(getActiveServerSeedHash('blackjack'));
    };

    window.addEventListener('vip-settings-update', handleUpdate);
    return () => window.removeEventListener('vip-settings-update', handleUpdate);
  }, []);

  // Handle outside click to close
  useEffect(() => {
    const handleOutside = (e) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target) && !e.target.closest(`.${styles.vipGearBtn}`)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (!mounted) return null;

  const handleVolume = (e) => {
    const vol = parseInt(e.target.value, 10);
    saveSettings({ ...settings, volume: vol });
  };

  const handleMute = () => {
    saveSettings({ ...settings, muted: !settings.muted });
  };

  const handleFelt = (color) => {
    const newSettings = { ...settings, feltColor: color };
    saveSettings(newSettings);
    document.body.setAttribute('data-felt-color', color);
  };

  const handleTheme = (themeId) => {
    const newSettings = { ...settings, theme: themeId };
    saveSettings(newSettings);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('btcfinder_theme', themeId);
    window.dispatchEvent(new Event('theme-change'));
  };

  const handleClientSeedChange = (e) => {
    const val = e.target.value;
    setClientSeedInput(val);
    setClientSeed(val);
  };

  const handleRollServerSeed = () => {
    rollServerSeed('blackjack');
    rollServerSeed('limbo');
    rollServerSeed('hilo');
    rollServerSeed('mines');
    playSound('cashout');
  };

  const handleCopyHash = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(serverHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleTestSound = () => {
    playSound('win');
  };

  return (
    <>
      {/* Floating Gear Widget */}
      <button 
        className={styles.vipGearBtn} 
        onClick={() => setOpen(!open)}
        aria-label="Casino VIP settings panel"
      >
        <motion.div
          animate={open ? { rotate: 90 } : { rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <FaCog style={{ fontSize: '1.4rem' }} />
        </motion.div>
        <span className={styles.vipBadge}>VIP</span>
      </button>

      {/* Slide-out Sidebar Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className={styles.panel}
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          >
            <div className={styles.header}>
              <h3>💎 VIP Control Deck</h3>
              <button className={styles.closeBtn} onClick={() => setOpen(false)}>×</button>
            </div>

            <div className={styles.content}>
              {/* SECTION: FELT THEME */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>
                  <FaPalette className={styles.sectionIcon} /> TABLE FELT COLOR
                </label>
                <div className={styles.feltGrid}>
                  {[
                    { id: 'green', label: 'Classic felt', color: '#006432' },
                    { id: 'purple', label: 'Royal Lounge', color: '#500078' },
                    { id: 'red', label: 'Red Velvet', color: '#780014' },
                  ].map(felt => (
                    <button
                      key={felt.id}
                      className={`${styles.feltBtn} ${settings.feltColor === felt.id ? styles.feltActive : ''}`}
                      onClick={() => handleFelt(felt.id)}
                    >
                      <span className={styles.feltSample} style={{ backgroundColor: felt.color }} />
                      <span className={styles.feltLabel}>{felt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: CASINO THEME */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>
                  🎨 CASINO THEME
                </label>
                <div className={styles.feltGrid}>
                  {[
                    { id: 'default', label: 'Dark Mode', emoji: '🌑' },
                    { id: 'halloween', label: 'Halloween', emoji: '🎃' },
                    { id: 'christmas', label: 'Christmas', emoji: '🎄' },
                  ].map(t => (
                    <button
                      key={t.id}
                      className={`${styles.feltBtn} ${settings.theme === t.id ? styles.feltActive : ''}`}
                      onClick={() => handleTheme(t.id)}
                    >
                      <span className={styles.feltSample} style={{
                        background: t.id === 'halloween' ? 'linear-gradient(135deg, #ff6b00, #7c3aed)' :
                                    t.id === 'christmas' ? 'linear-gradient(135deg, #dc2626, #16a34a)' :
                                    'linear-gradient(135deg, #0a0e1a, #111827)',
                        borderRadius: '4px',
                      }} />
                      <span className={styles.feltLabel}>{t.emoji} {t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: SOUND VOLUME */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>
                  {settings.muted ? <FaVolumeMute className={styles.sectionIcon} /> : <FaVolumeUp className={styles.sectionIcon} />}
                  CASINO AUDIO
                </label>
                <div className={styles.audioControls}>
                  <button className={styles.muteBtn} onClick={handleMute}>
                    {settings.muted ? 'UNMUTE' : 'MUTE'}
                  </button>
                  <input
                    type="range"
                    className={styles.slider}
                    min="0"
                    max="100"
                    value={settings.volume}
                    onChange={handleVolume}
                    disabled={settings.muted}
                  />
                  <span className={styles.volValue}>{settings.muted ? '0%' : `${settings.volume}%`}</span>
                </div>
                <button className={styles.testBtn} onClick={handleTestSound}>
                  🔊 Test Chimes
                </button>
              </div>

              {/* SECTION: PROVABLY FAIR SEEDS */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>
                  <FaKey className={styles.sectionIcon} /> PROVABLY FAIR SEEDS
                </label>
                
                <div className={styles.seedGroup}>
                  <span className={styles.seedLabel}>Client Seed (Editable)</span>
                  <input
                    type="text"
                    className={styles.seedInput}
                    value={clientSeedInput}
                    onChange={handleClientSeedChange}
                    placeholder="Enter custom seed"
                  />
                </div>

                <div className={styles.seedGroup}>
                  <div className={styles.seedRowHeader}>
                    <span className={styles.seedLabel}>Active Server Hash (SHA-256)</span>
                    <button className={styles.copyBtn} onClick={handleCopyHash} title="Copy SHA-256 Hash">
                      {copied ? <FaCheck style={{ color: '#00ff88' }} /> : <FaCopy />}
                    </button>
                  </div>
                  <div className={styles.seedHashValue}>
                    {serverHash}
                  </div>
                </div>

                <div className={styles.seedGroup}>
                  <button className={styles.rollBtn} onClick={handleRollServerSeed}>
                    <FaSync className={styles.rollIcon} /> Roll Seeds & Reset Nonce
                  </button>
                  <p className={styles.seedHint}>
                    Rolling generates a new random server seed and resets round nonces to 0. The previous seed will be unlocked for audit verification.
                  </p>
                </div>
              </div>
            </div>
            
            <div className={styles.footer}>
              <span>Bitcoin Finder VIP Suite v1.5</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
