'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaLock, FaUsers, FaArrowDown, FaArrowUp, FaChartLine, FaCheck, FaTimes, FaCoins, FaClock, FaShieldAlt, FaKey, FaSignOutAlt, FaTerminal } from 'react-icons/fa';
import { supabase, isDbEnabled } from '@/lib/supabase';
import { playSound } from '@/lib/audio';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Custom Gate Lock Authentication States
  const [isLocked, setIsLocked] = useState(true);
  const [gateEmail, setGateEmail] = useState('');
  const [gateCode1, setGateCode1] = useState('');
  const [gateCode2, setGateCode2] = useState('');
  const [gateError, setGateError] = useState('');
  const [isVerifyingGate, setIsVerifyingGate] = useState(false);

  // Tab Navigation
  const [activeTab, setActiveTab] = useState('withdrawals'); // 'withdrawals' | 'sessions' | 'stats' | 'fairness' | 'players' | 'promos'

  // Data States
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalWagered: 0,
    totalPayouts: 0,
    netHouseProfit: 0,
    marginPercentage: '0.00'
  });
  
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Players tab state
  const [players, setPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Promo codes tab state
  const [promoCodes, setPromoCodes] = useState([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPct, setNewPromoPct] = useState('5');
  const [newPromoMax, setNewPromoMax] = useState('10');
  const [promoActionMsg, setPromoActionMsg] = useState('');

  // Dialog States
  const [activeDialog, setActiveDialog] = useState(null); // null | 'approve' | 'reject'
  const [selectedTx, setSelectedTx] = useState(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [dialogError, setDialogError] = useState('');

  // Provably Fair Verification State
  const [clientSeed, setClientSeed] = useState('DefaultClientSeed');
  const [serverSeed, setServerSeed] = useState('YourUnhashedServerSeed');
  const [nonce, setNonce] = useState(1);
  const [selectedGame, setSelectedGame] = useState('limbo');
  const [auditResult, setAuditResult] = useState('');

  // Check if credentials exist in sessionStorage (tab session)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedEmail = sessionStorage.getItem('btcfinder_admin_email');
        const storedCode1 = sessionStorage.getItem('btcfinder_admin_code1');
        const storedCode2 = sessionStorage.getItem('btcfinder_admin_code2');
        
        if (storedEmail && storedCode1 && storedCode2) {
          setIsLocked(false);
        }
      } catch (e) {}
    }
  }, []);

  // 1. Auth and Session verification
  const verifyAdmin = useCallback(async () => {
    if (!isDbEnabled()) {
      // Offline Sandbox Fallback
      setIsAdmin(true);
      setIsCheckingAuth(false);
      loadOfflineData();
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setIsCheckingAuth(false);
        return;
      }

      setUser(session.user);

      // If unlocked, fetch live stats passing our double passcodes in headers
      if (!isLocked) {
        const storedCode1 = sessionStorage.getItem('btcfinder_admin_code1') || '';
        const storedCode2 = sessionStorage.getItem('btcfinder_admin_code2') || '';

        const res = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'x-admin-code-1': storedCode1,
            'x-admin-code-2': storedCode2
          }
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Unauthorized admin access');
        }

        const data = await res.json();
        if (data.success) {
          setIsAdmin(true);
          setStats(data.stats);
          await loadWithdrawalsAndSessions(session.access_token, storedCode1, storedCode2);
        }
      } else {
        // If locked but authenticated, check email prefix
        const envEmail = 'patrik12130@gmail.com';
        if (session.user.email?.toLowerCase() === envEmail) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    } catch (err) {
      console.error('Verify Admin Error:', err);
      setAuthError(err.message);
      setIsAdmin(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [isLocked]);

  useEffect(() => {
    verifyAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      verifyAdmin();
    });

    return () => subscription.unsubscribe();
  }, [verifyAdmin]);

  const loadWithdrawalsAndSessions = async (accessToken, c1, c2) => {
    try {
      setIsLoadingData(true);
      const sessionData = (await supabase.auth.getSession()).data.session;
      const token = accessToken || sessionData?.access_token;
      if (!token) return;

      const code1 = c1 || sessionStorage.getItem('btcfinder_admin_code1') || '';
      const code2 = c2 || sessionStorage.getItem('btcfinder_admin_code2') || '';

      const res = await fetch('/api/admin/withdrawals', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-admin-code-1': code1,
          'x-admin-code-2': code2
        }
      });

      if (!res.ok) throw new Error('Failed to fetch ledger transactions');
      const data = await res.json();
      if (data.success) {
        setWithdrawals(data.withdrawals);
        setActiveSessions(data.activeSessions);
      }
    } catch (err) {
      console.error('Failed to load admin logs:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadPlayers = async () => {
    setIsLoadingPlayers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/players', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.success) setPlayers(data.players || []);
    } catch (e) {
      console.error('loadPlayers error', e);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const loadPromos = async () => {
    setIsLoadingPromos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/promos', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.success) setPromoCodes(data.codes || []);
    } catch (e) {
      console.error('loadPromos error', e);
    } finally {
      setIsLoadingPromos(false);
    }
  };

  const handleBanPlayer = async (userId, isBanned) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: isBanned ? 'unban' : 'ban', userId }),
      });
      loadPlayers();
    } catch (e) { console.error(e); }
  };

  const handleCreatePromo = async () => {
    if (!newPromoCode.trim()) return;
    setPromoActionMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'create', code: newPromoCode, bonusPct: newPromoPct, maxBonus: newPromoMax }),
      });
      const data = await res.json();
      if (data.success) {
        setPromoActionMsg(`✅ Code ${newPromoCode.toUpperCase()} created!`);
        setNewPromoCode(''); setNewPromoPct('5'); setNewPromoMax('10');
        loadPromos();
      } else {
        setPromoActionMsg(`❌ ${data.error}`);
      }
    } catch (e) { setPromoActionMsg('❌ Server error'); }
  };

  const handleTogglePromo = async (code, isActive) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'toggle', code, is_active: isActive }),
      });
      loadPromos();
    } catch (e) { console.error(e); }
  };

  const loadOfflineData = () => {
    setIsLoadingData(true);
    if (typeof window !== 'undefined') {
      try {
        const localLedger = JSON.parse(localStorage.getItem('btcfinder_ledger') || '[]');
        const mockWithdrawals = localLedger.filter(item => item.type === 'withdrawal');
        setWithdrawals(mockWithdrawals);
        
        let offlineDep = 0;
        let offlineWd = 0;
        localLedger.forEach(item => {
          if (item.status === 'completed') {
            if (item.type === 'deposit') offlineDep += item.amount;
            else if (item.type === 'withdrawal') offlineWd += item.amount;
          }
        });

        setStats({
          totalPlayers: 1,
          totalDeposited: offlineDep || 500,
          totalWithdrawn: offlineWd || 120,
          totalWagered: 1540,
          totalPayouts: 1420,
          netHouseProfit: 120,
          marginPercentage: '7.79'
        });
      } catch (e) {}
    }
    setIsLoadingData(false);
  };

  // 3. Security Gate Form Submission
  const handleVerifyGatePasscodes = async (e) => {
    e.preventDefault();
    setGateError('');
    setIsVerifyingGate(true);
    playSound('flip');

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: gateEmail,
          code1: gateCode1,
          code2: gateCode2
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Security credentials invalid');
      }

      const data = await res.json();
      if (data.success) {
        playSound('win');
        
        // Save in sessionStorage (cleared when closing the browser tab!)
        sessionStorage.setItem('btcfinder_admin_email', gateEmail.trim().toLowerCase());
        sessionStorage.setItem('btcfinder_admin_code1', gateCode1.trim());
        sessionStorage.setItem('btcfinder_admin_code2', gateCode2.trim());

        setIsLocked(false);
        setGateEmail('');
        setGateCode1('');
        setGateCode2('');
        
        // Trigger balance and stats reload
        if (isDbEnabled()) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const statsRes = await fetch('/api/admin/stats', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'x-admin-code-1': sessionStorage.getItem('btcfinder_admin_code1'),
                'x-admin-code-2': sessionStorage.getItem('btcfinder_admin_code2')
              }
            });
            const statsData = await statsRes.json();
            if (statsData.success) {
              setIsAdmin(true);
              setStats(statsData.stats);
            }
            await loadWithdrawalsAndSessions(session.access_token);
          }
        } else {
          loadOfflineData();
        }
      }
    } catch (err) {
      console.error(err);
      playSound('loss');
      setGateError(err.message || 'Verification failed. Denied.');
    } finally {
      setIsVerifyingGate(false);
    }
  };

  const handleAdminLock = () => {
    playSound('loss');
    sessionStorage.removeItem('btcfinder_admin_email');
    sessionStorage.removeItem('btcfinder_admin_code1');
    sessionStorage.removeItem('btcfinder_admin_code2');
    setIsLocked(true);
    setWithdrawals([]);
    setActiveSessions([]);
  };

  // 4. Withdrawal Settlement Approvals / Rejections
  const handleProcessWithdrawal = async () => {
    if (!selectedTx) return;
    setDialogError('');
    setIsSubmittingAction(true);

    try {
      if (!isDbEnabled()) {
        // Offline sandbox flow
        if (activeDialog === 'approve' && !txHashInput) {
          throw new Error('Transaction Hash is required');
        }
        
        if (typeof window !== 'undefined') {
          const localLedger = JSON.parse(localStorage.getItem('btcfinder_ledger') || '[]');
          const idx = localLedger.findIndex(item => item.id === selectedTx.id || item.txid === selectedTx.txid);
          if (idx !== -1) {
            if (activeDialog === 'approve') {
              localLedger[idx].status = 'completed';
              localLedger[idx].txid = txHashInput.trim();
              localLedger[idx].label += ' (Approved)';
            } else {
              localLedger[idx].status = 'failed';
              localLedger[idx].label += ` - Rejected: ${rejectReasonInput || 'Declined'}`;
              
              const storedBal = parseFloat(localStorage.getItem('btcfinder_balance') || '1000');
              localStorage.setItem('btcfinder_balance', String(storedBal + selectedTx.amount));
              window.dispatchEvent(new CustomEvent('balance-update', { detail: storedBal + selectedTx.amount }));
            }
            localStorage.setItem('btcfinder_ledger', JSON.stringify(localLedger));
          }
        }
        playSound('win');
        loadOfflineData();
        closeDialog();
        return;
      }

      // Live Supabase API call
      const { data: { session } } = await supabase.auth.getSession();
      const storedCode1 = sessionStorage.getItem('btcfinder_admin_code1') || '';
      const storedCode2 = sessionStorage.getItem('btcfinder_admin_code2') || '';

      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-admin-code-1': storedCode1,
          'x-admin-code-2': storedCode2
        },
        body: JSON.stringify({
          ledgerId: selectedTx.id,
          action: activeDialog,
          txHash: txHashInput,
          rejectReason: rejectReasonInput
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned error ${res.status}`);
      }

      const outcome = await res.json();
      if (outcome.success) {
        playSound('win');
        await loadWithdrawalsAndSessions(session.access_token);
        
        // Fetch updated stats to sync dashboard aggregates
        const statsRes = await fetch('/api/admin/stats', {
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'x-admin-code-1': storedCode1,
            'x-admin-code-2': storedCode2
          }
        });
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.stats);

        closeDialog();
      }

    } catch (err) {
      console.error('Error processing withdrawal:', err);
      setDialogError(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setSelectedTx(null);
    setTxHashInput('');
    setRejectReasonInput('');
    setDialogError('');
  };

  // 5. Provably Fair Verification Audit Calculator
  const handleVerifySeedOutcome = useCallback(async () => {
    if (!serverSeed || !clientSeed) return;
    
    try {
      const combined = `${serverSeed}-${clientSeed}-${nonce}`;
      
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      let resultText = '';

      if (selectedGame === 'limbo') {
        const hexSlice = hashHex.slice(0, 8);
        const randInt = parseInt(hexSlice, 16);
        const maxInt = Math.pow(2, 32) - 1;
        const rand = randInt / maxInt;
        const mult = 0.99 / (1.0 - rand);
        const finalMult = Math.max(1.00, Math.round(mult * 100) / 100);
        resultText = `Calculated Limbo Outcome: ${finalMult.toFixed(2)}x`;
      } else if (selectedGame === 'dice') {
        const hexSlice = hashHex.slice(0, 8);
        const randInt = parseInt(hexSlice, 16);
        const maxInt = Math.pow(2, 32) - 1;
        const rand = randInt / maxInt;
        const finalDice = Math.round(rand * 10000) / 100;
        resultText = `Calculated Dice Roll: ${finalDice.toFixed(2)}`;
      } else if (selectedGame === 'mines') {
        const tiles = Array.from({ length: 25 }, (_, i) => i);
        let sliceIdx = 0;
        for (let i = tiles.length - 1; i > 0; i--) {
          const hexSlice = hashHex.slice(sliceIdx % 60, (sliceIdx % 60) + 4);
          const offset = parseInt(hexSlice, 16);
          const j = offset % (i + 1);
          const temp = tiles[i];
          tiles[i] = tiles[j];
          tiles[j] = temp;
          sliceIdx += 4;
        }
        resultText = `Mine Positions: [${tiles.slice(0, 3).join(', ')}] (for 3 mines configuration)`;
      }

      setAuditResult({
        hash: hashHex,
        outcome: resultText
      });
    } catch (err) {
      console.error(err);
    }
  }, [clientSeed, serverSeed, nonce, selectedGame]);

  useEffect(() => {
    handleVerifySeedOutcome();
  }, [clientSeed, serverSeed, nonce, selectedGame, handleVerifySeedOutcome]);

  // Auth loading state
  if (isCheckingAuth) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            🔐 Verifying administrator credentials...
          </div>
        </div>
      </div>
    );
  }

  // ── Render 1: Custom Admin Security Gate Login Portal ──
  if (isLocked) {
    return (
      <div className={styles.container}>
        <div className={styles.lockBox} style={{ width: 'min(480px, 100%)' }}>
          <div className={styles.terminalHeader}>
            <FaTerminal style={{ color: '#00ff88', marginRight: '0.4rem' }} />
            <span>Satoshi Secure Gate v4.2</span>
          </div>
          <FaLock className={styles.lockIcon} style={{ fontSize: '2.5rem', color: '#00ff88', textShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }} />
          <h2>Security Decryption Portal</h2>
          <p>Please enter your authorized email and double passcode sequences to decrypt the server dashboard.</p>
          
          <form onSubmit={handleVerifyGatePasscodes} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Admin Email Address</label>
              <input
                className={styles.input}
                type="email"
                placeholder="e.g. admin@casino.com"
                value={gateEmail}
                onChange={e => setGateEmail(e.target.value)}
                required
                disabled={isVerifyingGate}
                style={{ marginTop: '0.25rem', padding: '0.65rem 0.8rem' }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Passcode Sequence 1</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={gateCode1}
                onChange={e => setGateCode1(e.target.value)}
                required
                disabled={isVerifyingGate}
                style={{ marginTop: '0.25rem', padding: '0.65rem 0.8rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Passcode Sequence 2</label>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={gateCode2}
                onChange={e => setGateCode2(e.target.value)}
                required
                disabled={isVerifyingGate}
                style={{ marginTop: '0.25rem', padding: '0.65rem 0.8rem' }}
              />
            </div>

            {gateError && <p style={{ color: '#ff4757', fontSize: '0.72rem', margin: '0 0 0.5rem', textAlign: 'center', fontWeight: '700' }}>{gateError}</p>}

            <button 
              type="submit" 
              className={styles.btn} 
              style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)', color: '#0f172a', padding: '0.75rem', width: '100%', justifyContent: 'center', fontSize: '0.85rem' }} 
              disabled={isVerifyingGate}
            >
              <FaKey /> {isVerifyingGate ? 'Decrypting Secure Gate...' : 'Verify & Decrypt'}
            </button>
          </form>
          
          <button 
            onClick={() => window.location.href = '/'}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', textDecoration: 'underline', fontSize: '0.68rem', cursor: 'pointer', marginTop: '1.2rem' }}
          >
            Back to Casino Hub
          </button>
        </div>
      </div>
    );
  }

  // Auth Failure Screen Render
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.lockBox}>
          <FaLock className={styles.lockIcon} />
          <h2>Access Denied</h2>
          <p>This panel is restricted exclusively to the authorized casino owner. Please log in with your registered email via Supabase to access the secure gate.</p>
          {authError && <p style={{ color: '#ff4757', fontSize: '0.75rem', marginTop: '-1rem' }}>Error: {authError}</p>}
          <button className={styles.btn} style={{ background: '#ff4757', color: '#fff', padding: '0.6rem 1.4rem' }} onClick={() => window.location.href = '/'}>
            Back to Casino Hub
          </button>
        </div>
      </div>
    );
  }

  // ── Render 2: Complete Dashboard Panel ──
  return (
    <div className={styles.container}>
      <div className={styles.wrap}>
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaShieldAlt style={{ color: '#00ff88', fontSize: '1.6rem' }} />
              <h1>Satoshi Secure Gate</h1>
            </div>
            <p>Direct-to-wallet deposit audits and manual withdrawal settlement panel</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              background: isDbEnabled() ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isDbEnabled() ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.06)'}`,
              color: isDbEnabled() ? '#00ff88' : 'rgba(255,255,255,0.4)'
            }}>
              {isDbEnabled() ? 'LIVE DATABASE' : 'OFFLINE SANDBOX'}
            </span>
            <button className={styles.btn} style={{ background: 'rgba(255,71,87,0.1)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.2)' }} onClick={handleAdminLock}>
              <FaSignOutAlt /> Lock Panel
            </button>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.statCard_deposits}`}>
            <div className={`${styles.statIcon} ${styles.statIcon_deposits}`}><FaArrowDown /></div>
            <div>
              <div className={styles.statLabel}>Total Deposited</div>
              <h2 className={styles.statVal}>${stats.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.statCard_withdrawals}`}>
            <div className={`${styles.statIcon} ${styles.statIcon_withdrawals}`}><FaArrowUp /></div>
            <div>
              <div className={styles.statLabel}>Total Withdrawn</div>
              <h2 className={styles.statVal}>${stats.totalWithdrawn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.statCard_profits}`}>
            <div className={`${styles.statIcon} ${styles.statIcon_profits}`}><FaChartLine /></div>
            <div>
              <div className={styles.statLabel}>House Margin Profit</div>
              <h2 className={styles.statVal} style={stats.netHouseProfit < 0 ? { color: '#ff4757' } : { color: '#00ff88' }}>
                {stats.netHouseProfit < 0 ? '-' : ''}${Math.abs(stats.netHouseProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.statCard_players}`}>
            <div className={`${styles.statIcon} ${styles.statIcon_players}`}><FaUsers /></div>
            <div>
              <div className={styles.statLabel}>Active Players</div>
              <h2 className={styles.statVal}>{stats.totalPlayers}</h2>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          {[
            { id: 'withdrawals', label: 'Withdrawal Payouts', count: withdrawals.filter(w => w.status === 'pending').length, icon: FaArrowUp },
            { id: 'sessions', label: 'Mempool Sessions', count: activeSessions.length, icon: FaClock },
            { id: 'stats', label: 'Gaming Stats Volume', icon: FaCoins },
            { id: 'fairness', label: 'Provably Fair Auditing', icon: FaShieldAlt },
            { id: 'players', label: 'Player Management', icon: FaUsers },
            { id: 'promos', label: 'Promo Codes', icon: FaCoins },
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  background: tab.id === 'withdrawals' ? '#ff4757' : '#f7931a',
                  color: '#fff',
                  fontSize: '0.62rem',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontWeight: '800',
                  marginLeft: '0.2rem'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className={styles.panel}>
          <AnimatePresence mode="wait">
            
            {/* ── 1. WITHDRAWAL PAYOUTS TAB ── */}
            {activeTab === 'withdrawals' && (
              <motion.div key="withdrawals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className={styles.panelTitle}><FaArrowUp style={{ color: '#ff4757' }} /> Manual Withdrawal Settlement</h3>
                
                {isLoadingData ? (
                  <p className={styles.empty}>Syncing with database logs...</p>
                ) : withdrawals.length === 0 ? (
                  <p className={styles.empty}>No withdrawal requests logged.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Date & Time</th>
                          <th className={styles.th}>Player Address</th>
                          <th className={styles.th}>USD Amount</th>
                          <th className={styles.th}>Crypto Payout</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(tx => (
                          <tr key={tx.id} className={styles.tr}>
                            <td className={styles.td}>{new Date(tx.timestamp).toLocaleString()}</td>
                            <td className={styles.td}>
                              <code style={{ fontSize: '0.72rem', color: '#8247e5' }}>{tx.address}</code>
                            </td>
                            <td className={styles.td} style={{ fontWeight: '800' }}>${tx.amount !== undefined && tx.amount !== null ? Number(tx.amount).toFixed(2) : '0.00'}</td>
                            <td className={styles.td} style={{ color: '#00ff88', fontWeight: '800', fontFamily: 'monospace' }}>
                              {tx.crypto_amount !== undefined && tx.crypto_amount !== null ? Number(tx.crypto_amount).toFixed(6) : '0.000000'} {tx.crypto_currency}
                            </td>
                            <td className={styles.td}>
                              <span className={`${styles.badge} ${styles[`badge_${tx.status}`]}`}>{tx.status}</span>
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                              {tx.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                  <button
                                    className={`${styles.btn} ${styles.btn_approve}`}
                                    onClick={() => { setSelectedTx(tx); setActiveDialog('approve'); }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className={`${styles.btn} ${styles.btn_reject}`}
                                    onClick={() => { setSelectedTx(tx); setActiveDialog('reject'); }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <code style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', wordBreak: 'break-all' }}>
                                  {tx.txid ? `TxID: ${tx.txid.slice(0, 10)}...` : 'Settled'}
                                </code>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── 2. ACTIVE MEMPOOL SESSIONS ── */}
            {activeTab === 'sessions' && (
              <motion.div key="sessions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className={styles.panelTitle}><FaClock style={{ color: '#f7931a' }} /> Outstanding Active Deposit Sessions</h3>
                
                {isLoadingData ? (
                  <p className={styles.empty}>Syncing active sessions...</p>
                ) : activeSessions.length === 0 ? (
                  <p className={styles.empty}>No active pending sessions in the tracking table.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Date Created</th>
                          <th className={styles.th}>Session ID</th>
                          <th className={styles.th}>Coin/Network</th>
                          <th className={styles.th}>USD Target</th>
                          <th className={styles.th}>Exact Crypto amount</th>
                          <th className={styles.th}>Expires At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSessions.map(sess => {
                          const expired = new Date() > new Date(sess.expires_at);
                          return (
                            <tr key={sess.id} className={styles.tr}>
                              <td className={styles.td}>{new Date(sess.created_at).toLocaleString()}</td>
                              <td className={styles.td}><code style={{ fontSize: '0.7rem' }}>{sess.id}</code></td>
                              <td className={styles.td}>
                                <span style={{ fontWeight: '800' }}>{sess.crypto_currency}</span>
                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.25rem' }}>({sess.network})</span>
                              </td>
                              <td className={styles.td} style={{ fontWeight: '800' }}>${sess.usd_amount !== undefined && sess.usd_amount !== null ? Number(sess.usd_amount).toFixed(2) : '0.00'}</td>
                              <td className={styles.td} style={{ color: '#00ff88', fontWeight: '800', fontFamily: 'monospace', textDecoration: 'underline' }}>
                                {sess.crypto_amount !== undefined && sess.crypto_amount !== null ? Number(sess.crypto_amount).toFixed(8) : '0.00000000'}
                              </td>
                              <td className={styles.td} style={expired ? { color: '#ff4757', fontWeight: '700' } : { color: '#f7931a' }}>
                                {new Date(sess.expires_at).toLocaleTimeString()} {expired ? '(Expired)' : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── 3. GAMING VOLUME STATS ── */}
            {activeTab === 'stats' && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className={styles.panelTitle}><FaCoins style={{ color: '#f7931a' }} /> Casino Profit Metrics</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase' }}>Total Wagered Bets</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Orbitron', marginTop: '0.3rem' }}>
                      ${stats.totalWagered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase' }}>Total Won Payouts</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Orbitron', marginTop: '0.3rem', color: '#00ff88' }}>
                      ${stats.totalPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase' }}>Statistical Casino Edge</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Orbitron', marginTop: '0.3rem', color: '#f7931a' }}>
                      {stats.marginPercentage}%
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── 4. PROVABLY FAIR SEED AUDITOR ── */}
            {activeTab === 'fairness' && (
              <motion.div key="fairness" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className={styles.panelTitle}><FaShieldAlt style={{ color: '#00ff88' }} /> Cryptographic Provably Fair Auditor</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '-0.8rem', marginBottom: '1.2rem' }}>
                  Input unhashed round seeds and nonces directly to audit and verify round results math independently of the client UI.
                </p>

                <div className={styles.auditGrid}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Game Selection</label>
                      <select
                        className={styles.input}
                        value={selectedGame}
                        onChange={e => setSelectedGame(e.target.value)}
                        style={{ marginTop: '0.25rem', padding: '0.6rem 0.8rem' }}
                      >
                        <option value="limbo">Limbo (Target Multiplier)</option>
                        <option value="dice">Dice (Roll Number)</option>
                        <option value="mines">Mines (Mines Array Shuffles)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Unhashed Server Seed</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Enter Server Seed"
                        value={serverSeed}
                        onChange={e => setServerSeed(e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Client Seed</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Enter Client Seed"
                        value={clientSeed}
                        onChange={e => setClientSeed(e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Nonce</label>
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="Enter Nonce"
                        value={nonce}
                        onChange={e => setNonce(Number(e.target.value))}
                        style={{ marginTop: '0.25rem' }}
                      />
                    </div>
                  </div>

                  <div className={styles.auditOutput}>
                    <div className={styles.auditLabel}>Combined Verification String</div>
                    <div className={styles.auditVal}>{serverSeed}-{clientSeed}-{nonce}</div>

                    <div className={styles.auditLabel}>SHA-256 Hash Outcome</div>
                    <div className={styles.auditVal} style={{ color: '#8247e5', fontWeight: '700' }}>{auditResult.hash}</div>

                    <div className={styles.auditLabel} style={{ marginTop: '1.2rem', fontSize: '0.75rem' }}>Independently Verified Result</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#00ff88', marginTop: '0.25rem', fontFamily: 'Orbitron' }}>
                      {auditResult.outcome}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── 5. PLAYER MANAGEMENT ── */}
            {activeTab === 'players' && (
              <motion.div key="players" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <h3 className={styles.panelTitle} style={{ margin: 0 }}><FaUsers style={{ color: '#00d4ff' }} /> Player Management</h3>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <input
                      className={styles.input}
                      placeholder="Search username or email..."
                      value={playerSearch}
                      onChange={e => setPlayerSearch(e.target.value)}
                      style={{ padding: '0.45rem 0.8rem', width: '220px', fontSize: '0.78rem' }}
                    />
                    <button className={styles.btn} style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }} onClick={loadPlayers}>
                      {isLoadingPlayers ? 'Loading...' : '↻ Refresh'}
                    </button>
                  </div>
                </div>

                {players.length === 0 ? (
                  <p className={styles.empty}>{isLoadingPlayers ? 'Loading players...' : 'No players found. Click Refresh to load.'}</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Username</th>
                          <th className={styles.th}>Email</th>
                          <th className={styles.th}>VIP</th>
                          <th className={styles.th}>Balance</th>
                          <th className={styles.th}>Wagered</th>
                          <th className={styles.th}>Joined</th>
                          <th className={styles.th} style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players
                          .filter(p => !playerSearch || (p.username?.toLowerCase().includes(playerSearch.toLowerCase()) || p.email?.toLowerCase().includes(playerSearch.toLowerCase())))
                          .map(p => (
                          <tr key={p.id} className={styles.tr} style={{ opacity: p.is_banned ? 0.45 : 1 }}>
                            <td className={styles.td}>
                              <span style={{ fontWeight: '800', color: p.is_banned ? '#ff4757' : '#fff' }}>
                                {p.is_banned ? '🚫 ' : ''}{p.username || 'N/A'}
                              </span>
                            </td>
                            <td className={styles.td} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{p.email || '—'}</td>
                            <td className={styles.td}>
                              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#f7931a' }}>{p.vip_tier || 'wood'}</span>
                            </td>
                            <td className={styles.td} style={{ fontWeight: '800', color: '#00ff88' }}>
                              ${(p.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={styles.td} style={{ fontWeight: '700' }}>
                              ${(p.total_wagered || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={styles.td} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                              <button
                                className={`${styles.btn} ${p.is_banned ? styles.btn_approve : styles.btn_reject}`}
                                style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem' }}
                                onClick={() => handleBanPlayer(p.id, p.is_banned)}
                              >
                                {p.is_banned ? 'Unban' : 'Ban'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── 6. PROMO CODE MANAGER ── */}
            {activeTab === 'promos' && (
              <motion.div key="promos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h3 className={styles.panelTitle} style={{ margin: 0 }}><FaCoins style={{ color: '#f7931a' }} /> Promo Code Manager</h3>
                  <button className={styles.btn} style={{ background: 'rgba(247,147,26,0.1)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.2)' }} onClick={loadPromos}>
                    {isLoadingPromos ? 'Loading...' : '↻ Refresh'}
                  </button>
                </div>

                {/* Create New Code Form */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.4rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.8rem' }}>✨ Create New Promo Code</div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '120px' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Code</label>
                      <input className={styles.input} placeholder="e.g. WELCOME10" value={newPromoCode} onChange={e => setNewPromoCode(e.target.value.toUpperCase())} style={{ padding: '0.5rem 0.7rem', fontFamily: 'Orbitron', letterSpacing: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100px' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Bonus %</label>
                      <input className={styles.input} type="number" min="1" max="100" value={newPromoPct} onChange={e => setNewPromoPct(e.target.value)} style={{ padding: '0.5rem 0.7rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '120px' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Max Bonus $</label>
                      <input className={styles.input} type="number" min="1" value={newPromoMax} onChange={e => setNewPromoMax(e.target.value)} style={{ padding: '0.5rem 0.7rem' }} />
                    </div>
                    <button className={`${styles.btn} ${styles.btn_approve}`} onClick={handleCreatePromo} style={{ padding: '0.5rem 1.2rem', whiteSpace: 'nowrap' }}>
                      + Create Code
                    </button>
                  </div>
                  {promoActionMsg && (
                    <p style={{ marginTop: '0.6rem', fontSize: '0.75rem', fontWeight: '700', color: promoActionMsg.startsWith('✅') ? '#00ff88' : '#ff4757' }}>
                      {promoActionMsg}
                    </p>
                  )}
                </div>

                {/* Existing Codes Table */}
                {promoCodes.length === 0 ? (
                  <p className={styles.empty}>{isLoadingPromos ? 'Loading codes...' : 'No promo codes yet. Create one above.'}</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Code</th>
                          <th className={styles.th}>Bonus %</th>
                          <th className={styles.th}>Max Bonus</th>
                          <th className={styles.th}>Redemptions</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th} style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoCodes.map(code => (
                          <tr key={code.code} className={styles.tr}>
                            <td className={styles.td}>
                              <code style={{ fontFamily: 'Orbitron', fontSize: '0.82rem', color: '#f7931a', letterSpacing: '2px' }}>{code.code}</code>
                            </td>
                            <td className={styles.td} style={{ fontWeight: '800' }}>{code.bonus_pct}%</td>
                            <td className={styles.td} style={{ fontWeight: '800', color: '#00ff88' }}>${code.max_bonus}</td>
                            <td className={styles.td} style={{ fontWeight: '700', color: '#00d4ff' }}>{code.redemption_count ?? 0} uses</td>
                            <td className={styles.td}>
                              <span className={`${styles.badge} ${code.is_active ? styles.badge_completed : styles.badge_failed}`}>
                                {code.is_active ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                              <button
                                className={`${styles.btn} ${code.is_active ? styles.btn_reject : styles.btn_approve}`}
                                style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem' }}
                                onClick={() => handleTogglePromo(code.code, code.is_active)}
                              >
                                {code.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* ── SETTLEMENT DIALOG MODALS ── */}
      <AnimatePresence>
        {activeDialog && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDialog}
          >
            <motion.div
              className={styles.dialog}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={e => e.stopPropagation()}
            >
              {activeDialog === 'approve' ? (
                <div>
                  <h2>Approve Withdrawal</h2>
                  <p className={styles.dialogText}>
                    Confirm that you have manually executed the transaction of <strong>{selectedTx?.crypto_amount !== undefined && selectedTx?.crypto_amount !== null ? Number(selectedTx.crypto_amount).toFixed(6) : '0.000000'} {selectedTx?.crypto_currency}</strong> directly to the user's address:
                  </p>
                  
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <code style={{ fontSize: '0.68rem', wordBreak: 'break-all', color: '#8247e5' }}>{selectedTx.address}</code>
                  </div>

                  <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Transaction Hash (TxID)</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Paste the on-chain txID / signature"
                    value={txHashInput}
                    onChange={e => setTxHashInput(e.target.value)}
                    disabled={isSubmittingAction}
                    style={{ marginTop: '0.25rem' }}
                  />

                  {dialogError && <p style={{ color: '#ff4757', fontSize: '0.72rem', margin: '-0.5rem 0 0.8rem' }}>{dialogError}</p>}

                  <div className={styles.dialogActions}>
                    <button className={styles.btn} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={closeDialog} disabled={isSubmittingAction}>
                      Cancel
                    </button>
                    <button className={`${styles.btn} ${styles.btn_approve}`} onClick={handleProcessWithdrawal} disabled={isSubmittingAction}>
                      {isSubmittingAction ? 'Processing...' : 'Complete & Mark Approved'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2>Reject & Refund Withdrawal</h2>
                  <p className={styles.dialogText}>
                    Declining this payout will instantly mark it as failed and **automatically refund the player's profile balance** back by the exact USD value of <strong>${selectedTx?.amount !== undefined && selectedTx?.amount !== null ? Number(selectedTx.amount).toFixed(2) : '0.00'}</strong>.
                  </p>

                  <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Reason for Rejection</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. gameplay audit failure / suspicious activity"
                    value={rejectReasonInput}
                    onChange={e => setRejectReasonInput(e.target.value)}
                    disabled={isSubmittingAction}
                    style={{ marginTop: '0.25rem' }}
                  />

                  {dialogError && <p style={{ color: '#ff4757', fontSize: '0.72rem', margin: '-0.5rem 0 0.8rem' }}>{dialogError}</p>}

                  <div className={styles.dialogActions}>
                    <button className={styles.btn} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={closeDialog} disabled={isSubmittingAction}>
                      Cancel
                    </button>
                    <button className={`${styles.btn} ${styles.btn_reject}`} onClick={handleProcessWithdrawal} disabled={isSubmittingAction}>
                      {isSubmittingAction ? 'Refunding...' : 'Confirm Reject & Refund'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
