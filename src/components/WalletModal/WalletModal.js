'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaBitcoin, FaCopy, FaCheck, FaArrowDown, FaArrowUp, FaHistory, FaCog, FaExclamationTriangle, FaInfoCircle, FaPlusCircle, FaTag, FaGift } from 'react-icons/fa';
import { parseShorthand } from '@/lib/utils';
import { fetchCryptoPrice, usdToCrypto, formatCryptoAmount } from '@/lib/price';
import { COIN_NETWORKS, LEDGER_STEP_LABELS } from '@/hooks/useWallet';
import { addLedgerEntry } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import styles from './WalletModal.module.css';

// Crypto asset metadata with vector styled badges
const COINS = [
  { id: 'BTC', label: 'Bitcoin', symbol: '₿', network: 'Bitcoin Mainnet', color: '#f7931a', bg: 'rgba(247,147,26,0.1)' },
  { id: 'ETH', label: 'Ethereum', symbol: '♦', network: 'ERC-20 Ethereum', color: '#627eea', bg: 'rgba(98,126,234,0.1)' },
  { id: 'LTC', label: 'Litecoin', symbol: 'Ł', network: 'Litecoin Mainnet', color: '#bebebe', bg: 'rgba(190,190,190,0.1)' },
  { id: 'SOL', label: 'Solana', symbol: '◎', network: 'Solana SPL', color: '#14f195', bg: 'rgba(20,241,149,0.1)' },
  { id: 'DOGE', label: 'Dogecoin', symbol: 'Ð', network: 'Dogecoin Mainnet', color: '#c2a633', bg: 'rgba(194,166,51,0.1)' },
  { id: 'POL', label: 'Polygon', symbol: '⬡', network: 'Polygon POS Mainnet', color: '#8247e5', bg: 'rgba(130,71,229,0.1)' },
  { id: 'USDT', label: 'Tether', symbol: '₮', network: 'Multi-Chain (ERC20/TRC20/SPL/Polygon)', color: '#26a17b', bg: 'rgba(38,161,123,0.1)' },
  { id: 'USDC', label: 'USD Coin', symbol: '$', network: 'Multi-Chain (ERC20/SOL/Polygon)', color: '#2775ca', bg: 'rgba(39,117,202,0.1)' },
];

// Robust syntactic wallet address validator based on both coin type and active blockchain network!
const validateAddress = (address, coin, networkId) => {
  if (!address) return false;
  const cleaned = address.trim();

  // If TRC-20, use TRON network validation rules (starts with T, 34 base58 characters)
  if (networkId === 'TRC-20') {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleaned);
  }
  // If SPL, use Solana network validation rules (32 to 44 base58 characters)
  if (networkId === 'SPL') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleaned);
  }
  // If BEP-20, ERC-20, Arbitrum, Optimism, or Polygon network, use standard EVM validation (starts with 0x, 40 hex characters)
  if (
    networkId === 'BEP-20' ||
    networkId === 'ERC-20' ||
    networkId === 'Arbitrum' ||
    networkId === 'Optimism' ||
    networkId === 'Polygon' ||
    coin === 'ETH' ||
    coin === 'POL'
  ) {
    return /^0x[a-fA-F0-9]{40}$/.test(cleaned);
  }

  // Native mainnet fallbacks
  switch (coin) {
    case 'BTC':
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(cleaned);
    case 'LTC':
      return /^(L|M|ltc1)[a-zA-HJ-NP-Z0-9]{26,43}$/.test(cleaned);
    case 'DOGE':
      return /^D[5-9A-HJ-NP-Za-km-z]{1,3}[a-zA-HJ-NP-Za-km-z]{30,33}$/.test(cleaned);
    default:
      return true;
  }
};

export default function WalletModal({ isOpen, onClose, balance, wallet }) {
  const [tab, setTab] = useState('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [lastTxid, setLastTxid] = useState('');
  const [lastDepositAmount, setLastDepositAmount] = useState(0); // track for promo

  // Promo code states
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [promoMessage, setPromoMessage] = useState('');
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoRedeemed, setPromoRedeemed] = useState(false);

  // ROP (Real-time Online Pricing) hooks
  const [prices, setPrices] = useState({
    BTC: 65000, ETH: 3400, LTC: 85, SOL: 150, DOGE: 0.15, POL: 0.45, USDT: 1.00, USDC: 1.00
  });

  // Settings State Hooks
  const [configMode, setConfigMode] = useState(wallet.walletMode);
  const [configUrl, setConfigUrl] = useState(wallet.nowpaymentsUrl);
  const [configApiKey, setConfigApiKey] = useState(wallet.nowpaymentsApiKey);
  const [savedConfig, setSavedConfig] = useState(false);

  // Sync spot prices when wallet modal opens
  useEffect(() => {
    if (isOpen) {
      const getPrices = async () => {
        const fetched = {};
        for (const coin of COINS) {
          fetched[coin.id] = await fetchCryptoPrice(coin.id);
        }
        setPrices(fetched);
      };
      getPrices();
    }
  }, [isOpen]);

  // Sync configurations when tabs update
  useEffect(() => {
    setConfigMode(wallet.walletMode);
    setConfigUrl(wallet.nowpaymentsUrl);
    setConfigApiKey(wallet.nowpaymentsApiKey);
  }, [tab, wallet.walletMode, wallet.nowpaymentsUrl, wallet.nowpaymentsApiKey]);

  // Auto-populate withdrawal address with mock EVM, BTC, SOL, LTC, etc. address in demo mode
  useEffect(() => {
    if (tab === 'withdraw') {
      const currentMock = wallet.getDepositAddress(wallet.selectedCoin, wallet.selectedNetwork);
      const isCurrentlyMock = !withdrawAddress || (
        withdrawAddress.startsWith('bc1q') || 
        withdrawAddress.startsWith('T') || 
        withdrawAddress.startsWith('Sol') || 
        withdrawAddress.startsWith('0x') ||
        withdrawAddress.startsWith('L') ||
        withdrawAddress.startsWith('D')
      );
      if (isCurrentlyMock && withdrawAddress !== currentMock) {
        setWithdrawAddress(currentMock);
      }
    }
  }, [tab, wallet.selectedCoin, wallet.selectedNetwork, wallet, withdrawAddress]);

  // Active Coin & Network derived selectors
  const activeCoinMeta = useMemo(() => COINS.find(c => c.id === wallet.selectedCoin) || COINS[0], [wallet.selectedCoin]);
  const activePrice = prices[wallet.selectedCoin] || 1.00;
  
  const networks = useMemo(() => COIN_NETWORKS[wallet.selectedCoin] || [], [wallet.selectedCoin]);
  const activeNetworkMeta = useMemo(() => {
    return networks.find(n => n.id === wallet.selectedNetwork) || networks[0] || { label: 'Native Network', feeUsd: 0.10, speed: 'Fast' };
  }, [networks, wallet.selectedNetwork]);
  
  const activeGasFee = activeNetworkMeta.feeUsd;

  // Real-time deposit conversions
  const depositCryptoEst = useMemo(() => {
    const usd = parseShorthand(depositAmount) || 0;
    return usd / activePrice;
  }, [depositAmount, activePrice]);

  // Real-time withdrawal calculations (Gross USD - Net Gas Fee)
  const withdrawNetUsd = useMemo(() => {
    const usd = parseShorthand(withdrawAmount) || 0;
    return Math.max(0, usd - activeGasFee);
  }, [withdrawAmount, activeGasFee]);

  const withdrawCryptoNetEst = useMemo(() => {
    return withdrawNetUsd / activePrice;
  }, [withdrawNetUsd, activePrice]);

  const isWithdrawAddressValid = useMemo(() => {
    if (!withdrawAddress) return true; // don't show warning on empty
    return validateAddress(withdrawAddress, wallet.selectedCoin, wallet.selectedNetwork);
  }, [withdrawAddress, wallet.selectedCoin, wallet.selectedNetwork]);

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDeposit = useCallback(async () => {
    setError('');
    const parsed = parseShorthand(depositAmount);
    if (!parsed || parsed < 0.01) {
      setError('Minimum deposit amount is $0.01');
      return;
    }
    
    if (wallet.walletMode === 'real') {
      const result = await wallet.createRealPayment(parsed, wallet.selectedCoin, wallet.selectedNetwork);
      if (result?.error) setError(result.error);
    } else {
      const result = await wallet.simulateDeposit(parsed, wallet.selectedCoin, wallet.selectedNetwork);
      if (result?.error) setError(result.error);
      else {
        setLastTxid(result.txid);
        setLastDepositAmount(parsed);
        setDepositAmount('');
        setPromoStatus('idle');
        setPromoRedeemed(false);
        setPromoMessage('');
      }
    }
  }, [depositAmount, wallet]);

  const handleWithdraw = useCallback(async () => {
    setError('');
    const parsed = parseShorthand(withdrawAmount);
    if (!parsed || parsed < 1.0) {
      setError('Minimum withdrawal amount is $1.00');
      return;
    }
    if (parsed > balance) {
      setError('Insufficient balance');
      return;
    }
    if (!withdrawAddress) {
      setError('Please enter a destination wallet address');
      return;
    }
    if (!validateAddress(withdrawAddress, wallet.selectedCoin, wallet.selectedNetwork)) {
      setError(`Invalid address format for selected ${wallet.selectedCoin} Network (${activeNetworkMeta.label})`);
      return;
    }

    const result = await wallet.simulateWithdraw(parsed, withdrawAddress, wallet.selectedCoin, wallet.selectedNetwork);
    if (result?.error) setError(result.error);
    else {
      setLastTxid(result.txid);
      setWithdrawAmount('');
      setWithdrawAddress('');
    }
  }, [withdrawAmount, withdrawAddress, balance, wallet, activeNetworkMeta.label]);

  const handleAddCash = useCallback(async () => {
    setError('');
    const parsed = parseShorthand(depositAmount);
    if (!parsed || parsed <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    try {
      if (wallet.addBalance) {
        await wallet.addBalance(parsed);
        
        addLedgerEntry({
          type: 'deposit',
          amount: parsed,
          status: 'completed',
          label: 'Instant Cash Injection',
          crypto_currency: 'USD',
          crypto_amount: 0,
        });

        if (wallet.refreshLedger) {
          wallet.refreshLedger();
        }

        setLastDepositAmount(parsed);
        setPromoStatus('idle');
        setPromoRedeemed(false);
        setPromoMessage('');
        setDepositAmount('');
        alert(`Successfully injected $${parsed.toLocaleString()} into your balance!`);
      } else {
        setError('Wallet system is not ready');
      }
    } catch (err) {
      setError(err.message || 'Failed to inject cash');
    }
  }, [depositAmount, wallet, setLastDepositAmount, setPromoStatus, setPromoRedeemed, setPromoMessage]);

  const handlePromoRedeem = useCallback(async () => {
    if (!promoCode.trim() || promoRedeemed || promoStatus === 'loading') return;
    setPromoStatus('loading');
    setPromoMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPromoStatus('error');
        setPromoMessage('You must be logged in to use a promo code.');
        return;
      }

      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode.trim().toUpperCase(),
          depositAmount: lastDepositAmount,
          accessToken: session.access_token,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPromoStatus('error');
        setPromoMessage(data.error || 'Invalid promo code.');
        return;
      }

      // Credit bonus locally
      if (wallet.addBalance) {
        await wallet.addBalance(data.bonus);
        addLedgerEntry({
          type: 'deposit',
          amount: data.bonus,
          status: 'completed',
          label: `🎁 Promo Bonus — Code: ${promoCode.trim().toUpperCase()}`,
          crypto_currency: 'USD',
          crypto_amount: 0,
        });
        if (wallet.refreshLedger) wallet.refreshLedger();
      }

      setPromoBonus(data.bonus);
      setPromoStatus('success');
      setPromoMessage(data.message);
      setPromoRedeemed(true);
    } catch (err) {
      setPromoStatus('error');
      setPromoMessage('Server error. Please try again.');
    }
  }, [promoCode, promoRedeemed, promoStatus, lastDepositAmount, wallet]);

  const handleSaveConfig = () => {
    wallet.saveWalletConfig({
      mode: configMode,
      url: configUrl,
      apiKey: configApiKey,
    });
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
    setError('');
  };

  const isDepositBusy = wallet.depositStep !== 'idle';
  const isWithdrawBusy = wallet.withdrawStep !== 'idle';

  // Determine standard URI prefix for QR code
  const getQrUri = () => {
    const address = wallet.getDepositAddress(wallet.selectedCoin, wallet.selectedNetwork);
    if (wallet.selectedNetwork === 'TRC-20') return `tron:${address}`;
    if (wallet.selectedNetwork === 'SPL') return `solana:${address}`;
    if (wallet.selectedCoin === 'BTC' && wallet.selectedNetwork === 'Native') return `bitcoin:${address}`;
    if (wallet.selectedCoin === 'LTC') return `litecoin:${address}`;
    if (wallet.selectedCoin === 'DOGE') return `dogecoin:${address}`;
    if (wallet.selectedCoin === 'POL' || wallet.selectedNetwork === 'Polygon') return `polygon:${address}`;
    return `ethereum:${address}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(620px, 100%)' }} // slightly wider for multi-crypto grid
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: activeCoinMeta.color }}>
                  <span style={{ fontSize: '1.4rem' }}>{activeCoinMeta.symbol}</span>
                  <span>{activeCoinMeta.label} Wallet</span>
                </div>
              </div>
              <div className={styles.headerBalance}>
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button className={styles.closeBtn} onClick={onClose}>
                <FaTimes />
              </button>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {[
                { id: 'deposit',  label: 'Deposit',  icon: FaArrowDown },
                { id: 'withdraw', label: 'Withdraw', icon: FaArrowUp },
                { id: 'ledger',   label: 'History',  icon: FaHistory },
                { id: 'add_cash', label: 'Add Cash', icon: FaPlusCircle },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
                  onClick={() => { setTab(id); setError(''); }}
                  disabled={isDepositBusy || isWithdrawBusy}
                >
                  <Icon /> {label}
                </button>
              ))}
            </div>

            {/* Multi-Crypto & Multi-Network Selectors */}
            {(tab === 'deposit' || tab === 'withdraw') && (
              <div style={{ padding: '1.2rem 1.4rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                
                {/* 1. Crypto Coin Selector Grid */}
                <div>
                  <p className={styles.sectionLabel} style={{ marginBottom: '0.5rem' }}>Select Cryptocurrency</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {COINS.map(coin => {
                      const isSelected = wallet.selectedCoin === coin.id;
                      const priceFormatted = prices[coin.id] !== undefined 
                        ? prices[coin.id] < 1.01 
                          ? `$${prices[coin.id].toFixed(4)}` 
                          : `$${prices[coin.id].toLocaleString()}`
                        : 'Loading...';
                      
                      return (
                        <motion.button
                          key={coin.id}
                          onClick={() => { wallet.setSelectedCoin(coin.id); setError(''); }}
                          disabled={isDepositBusy || isWithdrawBusy}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.7rem',
                            background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.01)',
                            border: isSelected ? `1.5px solid ${coin.color}` : '1.5px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
                            cursor: (isDepositBusy || isWithdrawBusy) ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                          whileHover={!(isDepositBusy || isWithdrawBusy) ? { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.03)' } : {}}
                          whileTap={!(isDepositBusy || isWithdrawBusy) ? { scale: 0.98 } : {}}
                        >
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: coin.bg,
                            color: coin.color,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: '800',
                            fontSize: '1.0rem',
                            boxShadow: isSelected ? `0 0 10px ${coin.color}40` : 'none'
                          }}>
                            {coin.symbol}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#fff' }}>{coin.id}</div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {priceFormatted}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Network Selection Box (only if multiple networks exist) */}
                {networks.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.8rem' }}>
                    <p className={styles.sectionLabel} style={{ marginBottom: '0.5rem' }}>Select Blockchain Network</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {networks.map(net => {
                        const isNetSelected = wallet.selectedNetwork === net.id;
                        return (
                          <motion.button
                            key={net.id}
                            onClick={() => { wallet.setSelectedNetwork(net.id); setError(''); }}
                            disabled={isDepositBusy || isWithdrawBusy}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              padding: '0.5rem 0.8rem',
                              background: isNetSelected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                              border: isNetSelected ? `1.5px solid ${activeCoinMeta.color}` : '1.5px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px',
                              cursor: (isDepositBusy || isWithdrawBusy) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              minWidth: '100px'
                            }}
                            whileHover={!(isDepositBusy || isWithdrawBusy) ? { scale: 1.02 } : {}}
                            whileTap={!(isDepositBusy || isWithdrawBusy) ? { scale: 0.98 } : {}}
                          >
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: isNetSelected ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                              {net.id}
                            </span>
                            <span style={{ fontSize: '0.55rem', color: isNetSelected ? activeCoinMeta.color : 'rgba(255,255,255,0.3)', marginTop: '0.1rem', whiteSpace: 'nowrap' }}>
                              fee: ${net.feeUsd.toFixed(2)} | {net.speed}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

              </div>
            )}

            {/* Tab Content */}
            <div className={styles.body}>
              <AnimatePresence mode="wait">
                
                {/* ── DEPOSIT PANEL ── */}
                {tab === 'deposit' && (
                  <motion.div key="deposit" className={styles.panel}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    
                    {wallet.walletMode === 'real' && !wallet.realDepositAddress ? (
                      // REAL MODE - Enter amount to generate real deposit address
                      <div>
                        <p className={styles.sectionLabel}>Enter {wallet.selectedCoin} Deposit Amount (USD)</p>
                        <div className={styles.inputRow}>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="Amount to deposit (e.g. 50, 100)"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            disabled={wallet.isGeneratingPayment}
                          />
                          <motion.button
                            className={styles.actionBtn}
                            style={{ background: `linear-gradient(135deg, ${activeCoinMeta.color}, ${activeCoinMeta.color}dd)`, minWidth: '160px' }}
                            onClick={handleDeposit}
                            disabled={wallet.isGeneratingPayment}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {wallet.isGeneratingPayment ? 'Connecting...' : 'Generate Address'}
                          </motion.button>
                        </div>
                        {depositAmount && (
                          <p className={styles.parsedHint}>
                            Estimated Payout: <strong>{formatCryptoAmount(depositCryptoEst, wallet.selectedCoin)} {wallet.selectedCoin}</strong> (~${(parseShorthand(depositAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.8rem', width: '100%', boxSizing: 'border-box', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: '1rem' }}>
                          <FaInfoCircle style={{ color: activeCoinMeta.color, fontSize: '0.9rem', flexShrink: 0, marginTop: '1px' }} />
                          <span>This generates a real, unique cryptocurrency deposit address dynamically via NOWPayments. Miner transfer fees apply.</span>
                        </div>
                      </div>
                    ) : wallet.walletMode === 'real' && wallet.realDepositAddress ? (
                      // REAL MODE - Show generated real address, exact coin amount, and status checker
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <p className={styles.sectionLabel} style={{ color: '#00ff88', fontWeight: '800', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <span>Send Exactly</span>
                          <span style={{ color: '#00ff88', textDecoration: 'underline', fontSize: '1.3rem', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            {wallet.selectedCoin === 'BTC' ? Number(wallet.realDepositAmount).toFixed(8) :
                             (wallet.selectedCoin === 'USDT' || wallet.selectedCoin === 'USDC' || wallet.selectedCoin === 'DOGE') ? Number(wallet.realDepositAmount).toFixed(4) :
                             Number(wallet.realDepositAmount).toFixed(6)}
                          </span>
                          <span>**{wallet.selectedCoin}**</span>
                        </p>
                        
                        <div className={styles.qrWrap} style={{ borderColor: activeCoinMeta.color + '40', boxShadow: `0 0 20px ${activeCoinMeta.color}15` }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=${activeCoinMeta.color.replace('#', '')}&bgcolor=0e1320&data=${encodeURIComponent(
                              wallet.selectedNetwork === 'TRC-20' ? `tron:${wallet.realDepositAddress}` :
                              wallet.selectedNetwork === 'SPL' ? `solana:${wallet.realDepositAddress}` :
                              wallet.selectedCoin === 'BTC' ? `bitcoin:${wallet.realDepositAddress}?amount=${wallet.realDepositAmount}` :
                              wallet.selectedCoin === 'POL' || wallet.selectedNetwork === 'Polygon' ? `polygon:${wallet.realDepositAddress}` :
                              `ethereum:${wallet.realDepositAddress}`
                            )}`}
                            alt="Deposit QR Code"
                            className={styles.qrImage}
                          />
                        </div>

                        <div className={styles.addressBox} style={{ width: '100%', boxSizing: 'border-box' }}>
                          <code className={styles.address} style={{ fontSize: '0.68rem', wordBreak: 'break-all' }}>{wallet.realDepositAddress}</code>
                          <button className={styles.copyBtn} style={{ color: activeCoinMeta.color, borderColor: activeCoinMeta.color + '30', background: activeCoinMeta.color + '0c' }} onClick={() => copyText(wallet.realDepositAddress)}>
                            {copied ? <FaCheck className={styles.iconGreen} /> : <FaCopy />}
                          </button>
                        </div>

                        {/* Real-time status display */}
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.8rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: 
                                wallet.realPaymentStatus === 'waiting' ? '#f7931a' :
                                (wallet.realPaymentStatus === 'confirming' || wallet.realPaymentStatus === 'confirmed') ? '#00d4ff' :
                                (wallet.realPaymentStatus === 'finished') ? '#00ff88' : '#ff4757',
                              boxShadow: `0 0 8px ${
                                wallet.realPaymentStatus === 'waiting' ? '#f7931a' :
                                (wallet.realPaymentStatus === 'confirming' || wallet.realPaymentStatus === 'confirmed') ? '#00d4ff' :
                                (wallet.realPaymentStatus === 'finished') ? '#00ff88' : '#ff4757'
                              }60`
                            }} />
                            <span>Payment: <strong style={{ color: '#fff', textTransform: 'uppercase' }}>{wallet.realPaymentStatus}</strong></span>
                          </div>
                          
                          <motion.button 
                            className={styles.copyBtn} 
                            style={{ color: '#00ff88', borderColor: '#00ff8840', background: '#00ff880c', padding: '0.2rem 0.6rem', height: 'auto', borderRadius: '6px', fontSize: '0.65rem' }} 
                            onClick={async () => {
                              const check = await wallet.checkRealPaymentStatus();
                              if (check?.credited) {
                                alert(`🎉 Successfully credited $${check.amount.toFixed(2)} USD to your balance!`);
                                setDepositAmount('');
                              }
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Check Status
                          </motion.button>
                        </div>

                        <button 
                          onClick={() => {
                            // Reset local states
                            setDepositAmount('');
                            location.reload(); // simple and completely resets active states
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', textDecoration: 'underline', fontSize: '0.65rem', cursor: 'pointer', marginTop: '0.2rem' }}
                        >
                          Cancel & Create New Deposit
                        </button>
                      </div>
                    ) : (
                      // DEMO MODE - Normal simulated deposit
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <p className={styles.sectionLabel}>Scan QR to Deposit {wallet.selectedCoin}</p>
                          
                          <div className={styles.qrWrap} style={{ borderColor: activeCoinMeta.color + '40', boxShadow: `0 0 20px ${activeCoinMeta.color}15` }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=${activeCoinMeta.color.replace('#', '')}&bgcolor=0e1320&data=${encodeURIComponent(getQrUri())}`}
                              alt={`${wallet.selectedCoin} Deposit QR Code`}
                              className={styles.qrImage}
                            />
                          </div>

                          <div className={styles.addressBox} style={{ width: '100%', boxSizing: 'border-box' }}>
                            <code className={styles.address}>{wallet.getDepositAddress(wallet.selectedCoin, wallet.selectedNetwork)}</code>
                            <button className={styles.copyBtn} style={{ color: activeCoinMeta.color, borderColor: activeCoinMeta.color + '30', background: activeCoinMeta.color + '0c' }} onClick={() => copyText(wallet.getDepositAddress(wallet.selectedCoin, wallet.selectedNetwork))}>
                              {copied ? <FaCheck className={styles.iconGreen} /> : <FaCopy />}
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.8rem', width: '100%', boxSizing: 'border-box', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
                            <FaInfoCircle style={{ color: activeCoinMeta.color, fontSize: '0.9rem', flexShrink: 0, marginTop: '1px' }} />
                            <span>Send only **{wallet.selectedCoin}** to this address on the **{activeNetworkMeta.label}**. Network transaction miner fees apply.</span>
                          </div>
                        </div>

                        <div className={styles.divider} />

                        <p className={styles.sectionLabel}>Simulate {wallet.selectedCoin} Deposit Amount (USD)</p>
                        <div className={styles.inputRow}>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="Amount (e.g. 50, 1.5k)"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            disabled={isDepositBusy}
                          />
                          <motion.button
                            className={styles.actionBtn}
                            style={{ background: `linear-gradient(135deg, ${activeCoinMeta.color}, ${activeCoinMeta.color}dd)` }}
                            onClick={handleDeposit}
                            disabled={isDepositBusy}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Simulate Deposit
                          </motion.button>
                        </div>
                        {depositAmount && (
                          <p className={styles.parsedHint}>
                            Estimated Coin Payout: <strong>{formatCryptoAmount(depositCryptoEst, wallet.selectedCoin)} {wallet.selectedCoin}</strong> (~${(parseShorthand(depositAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)
                          </p>
                        )}

                        <StatusBar step={wallet.depositStep} lastTxid={lastTxid} />

                        {/* ── PROMO CODE SECTION — shows after a successful deposit ── */}
                        {lastDepositAmount > 0 && !promoRedeemed && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: 'rgba(247,147,26,0.05)',
                            border: '1px solid rgba(247,147,26,0.2)',
                            borderRadius: '12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                              <FaTag style={{ color: '#f7931a', fontSize: '0.85rem' }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#f7931a' }}>Got a Promo Code?</span>
                              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>(optional — first deposit only)</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                style={{
                                  flex: 1,
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(247,147,26,0.3)',
                                  borderRadius: '8px',
                                  padding: '0.55rem 0.8rem',
                                  color: '#fff',
                                  fontSize: '0.85rem',
                                  fontFamily: 'Orbitron, monospace',
                                  letterSpacing: '2px',
                                  textTransform: 'uppercase',
                                  outline: 'none',
                                }}
                                placeholder="ENTER CODE"
                                value={promoCode}
                                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                                disabled={promoStatus === 'loading'}
                                onKeyDown={e => e.key === 'Enter' && handlePromoRedeem()}
                              />
                              <motion.button
                                onClick={handlePromoRedeem}
                                disabled={!promoCode.trim() || promoStatus === 'loading'}
                                style={{
                                  background: 'linear-gradient(135deg, #f7931a, #e07b0a)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '0.55rem 1rem',
                                  color: '#000',
                                  fontWeight: '800',
                                  fontSize: '0.78rem',
                                  cursor: !promoCode.trim() ? 'not-allowed' : 'pointer',
                                  opacity: !promoCode.trim() ? 0.5 : 1,
                                  whiteSpace: 'nowrap',
                                }}
                                whileHover={promoCode.trim() ? { scale: 1.03 } : {}}
                                whileTap={promoCode.trim() ? { scale: 0.97 } : {}}
                              >
                                {promoStatus === 'loading' ? '...' : 'Apply'}
                              </motion.button>
                            </div>
                            {promoMessage && (
                              <p style={{
                                marginTop: '0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: promoStatus === 'success' ? '#00ff88' : '#ff4757',
                              }}>
                                {promoMessage}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Promo already redeemed success banner */}
                        {promoRedeemed && promoBonus > 0 && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '0.8rem 1rem',
                            background: 'rgba(0,255,136,0.06)',
                            border: '1px solid rgba(0,255,136,0.2)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                          }}>
                            <FaGift style={{ color: '#00ff88', fontSize: '1.1rem' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#00ff88' }}>
                              🎁 +${promoBonus.toFixed(2)} bonus credited to your balance!
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {error && <p className={styles.error}>{error}</p>}
                  </motion.div>
                )}

                {/* ── WITHDRAW PANEL ── */}
                {tab === 'withdraw' && (
                  <motion.div key="withdraw" className={styles.panel}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    
                    <p className={styles.sectionLabel}>Destination {wallet.selectedCoin} Address ({activeNetworkMeta.label})</p>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder={`Paste your private ${wallet.selectedCoin} (${activeNetworkMeta.label}) address`}
                        value={withdrawAddress}
                        onChange={e => setWithdrawAddress(e.target.value)}
                        disabled={isWithdrawBusy}
                        style={{
                          borderColor: !isWithdrawAddressValid ? '#ff4757' : 'rgba(255,255,255,0.1)',
                          background: !isWithdrawAddressValid ? 'rgba(255,71,87,0.03)' : 'rgba(255,255,255,0.04)'
                        }}
                      />
                      {!isWithdrawAddressValid && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ff4757', fontSize: '0.68rem', marginTop: '0.35rem', paddingLeft: '0.2rem' }}>
                          <FaExclamationTriangle />
                          <span>Invalid address format for selected {wallet.selectedCoin} Network ({activeNetworkMeta.label})</span>
                        </div>
                      )}
                    </div>

                    <p className={styles.sectionLabel} style={{ marginTop: '0.25rem' }}>Withdrawal Amount (USD)</p>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Min $1.00 (e.g. 100, 2.5k)"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      disabled={isWithdrawBusy}
                    />

                    {/* Real-time on-chain gas fee calculations card */}
                    {withdrawAmount && (
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '0.8rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        marginTop: '0.2rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                          <span>Wager Gross Payout:</span>
                          <span style={{ color: '#fff' }}>${(parseShorthand(withdrawAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                          <span>On-Chain Gas Fee ({activeNetworkMeta.label} Network):</span>
                          <span style={{ color: '#ff4757', fontWeight: '700' }}>-${activeGasFee.toFixed(2)} USD</span>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.1rem 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '800' }}>
                          <span style={{ color: activeCoinMeta.color }}>Net Player Settlement Payout:</span>
                          <span style={{ color: '#00ff88' }}>
                            {formatCryptoAmount(withdrawCryptoNetEst, wallet.selectedCoin)} {wallet.selectedCoin}
                          </span>
                        </div>
                        <div style={{ textShadow: `0 0 10px ${activeCoinMeta.color}25`, textAlign: 'right', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '-0.15rem' }}>
                          (~${withdrawNetUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD net value)
                        </div>
                      </div>
                    )}

                    <motion.button
                      className={`${styles.actionBtn} ${styles.actionBtnFull}`}
                      style={{
                        background: `linear-gradient(135deg, ${activeCoinMeta.color}, ${activeCoinMeta.color}dd)`,
                        opacity: (!isWithdrawAddressValid || !withdrawAddress) ? 0.35 : 1
                      }}
                      onClick={handleWithdraw}
                      disabled={isWithdrawBusy || !isWithdrawAddressValid || !withdrawAddress}
                      whileHover={(!isWithdrawBusy && isWithdrawAddressValid && withdrawAddress) ? { scale: 1.02 } : {}}
                      whileTap={(!isWithdrawBusy && isWithdrawAddressValid && withdrawAddress) ? { scale: 0.98 } : {}}
                    >
                      Withdraw Net crypto
                    </motion.button>

                    {wallet.walletMode === 'real' && (
                      <p className={styles.parsedHint} style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: '0.6rem', textAlign: 'center', fontSize: '0.65rem' }}>
                        ℹ️ Real Mode is active. Payout will be logged as **PENDING** in the database ledger, and transferred manually by the administrator to your address after standard security review.
                      </p>
                    )}

                    <StatusBar step={wallet.withdrawStep} lastTxid={lastTxid} />
                    {error && <p className={styles.error}>{error}</p>}
                  </motion.div>
                )}

                {/* ── HISTORY LEDGER PANEL ── */}
                {tab === 'ledger' && (
                  <motion.div key="ledger" className={styles.panel}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {wallet.ledger.length === 0 ? (
                      <p className={styles.empty}>No transaction records found.</p>
                    ) : (
                      <div className={styles.ledgerList} style={{ maxHeight: '42vh', overflowY: 'auto', paddingRight: '0.2rem' }}>
                        {wallet.ledger.map(entry => {
                          const coinMeta = COINS.find(c => c.id === entry.crypto_currency) || { color: '#00ff88', symbol: '$' };
                          const isPos = entry.type === 'deposit' || entry.type === 'rakeback';
                          
                          return (
                            <div key={entry.id} className={`${styles.ledgerRow} ${styles[`ledger_${entry.type}`]}`}>
                              <div className={styles.ledgerIcon} style={
                                entry.type === 'deposit' ? { background: 'rgba(0,255,136,0.06)', color: '#00ff88' } :
                                entry.type === 'withdrawal' ? { background: 'rgba(255,71,87,0.06)', color: '#ff4757' } :
                                { background: 'rgba(247,147,26,0.06)', color: '#f7931a' }
                              }>
                                {entry.type === 'deposit' ? '↓' : entry.type === 'withdrawal' ? '↑' : '♻'}
                              </div>
                              <div className={styles.ledgerInfo}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span className={styles.ledgerLabel}>{entry.label}</span>
                                  {entry.crypto_currency && entry.crypto_currency !== 'USD' && (
                                    <span style={{
                                      fontSize: '0.62rem',
                                      fontWeight: '800',
                                      color: coinMeta.color,
                                      background: coinMeta.color + '10',
                                      border: `1px solid ${coinMeta.color}25`,
                                      borderRadius: '4px',
                                      padding: '0.05rem 0.3rem',
                                      fontFamily: 'Orbitron'
                                    }}>
                                      {entry.crypto_currency}
                                    </span>
                                  )}
                                </div>
                                {entry.txid && (
                                  <div className={styles.ledgerTxid}>
                                    TxID: {entry.txid.slice(0, 16)}...{entry.txid.slice(-8)}
                                  </div>
                                )}
                                <div className={styles.ledgerDate}>
                                  {new Date(entry.timestamp).toLocaleString()}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div className={`${styles.ledgerAmount} ${isPos ? styles.amountPos : styles.amountNeg}`}>
                                  {entry.type === 'withdrawal' ? '-' : '+'}${entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {entry.crypto_amount > 0 && entry.crypto_currency !== 'USD' && (
                                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Courier New', marginTop: '0.05rem' }}>
                                    {entry.type === 'withdrawal' ? '-' : '+'}{formatCryptoAmount(entry.crypto_amount, entry.crypto_currency)} {entry.crypto_currency}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── ADD CASH PANEL ── */}
                {tab === 'add_cash' && (
                  <motion.div key="add_cash" className={styles.panel}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    
                    <p className={styles.sectionLabel}>Inject Free Cash to Balance (USD)</p>
                    <div className={styles.inputRow}>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Enter amount (e.g. 500, 10k, 100000)"
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                      />
                      <motion.button
                        className={styles.actionBtn}
                        style={{ background: 'linear-gradient(135deg, #00ff88, #00b35f)', color: '#000', fontWeight: '800', minWidth: '150px' }}
                        onClick={handleAddCash}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Inject Cash
                      </motion.button>
                    </div>
                    {error && <p className={styles.error}>{error}</p>}

                    {/* ── PROMO CODE SECTION — shows after a successful add cash ── */}
                    {lastDepositAmount > 0 && !promoRedeemed && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'rgba(247,147,26,0.05)',
                        border: '1px solid rgba(247,147,26,0.2)',
                        borderRadius: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                          <FaTag style={{ color: '#f7931a', fontSize: '0.85rem' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#f7931a' }}>Got a Promo Code?</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>(optional — first deposit only)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(247,147,26,0.3)',
                              borderRadius: '8px',
                              padding: '0.55rem 0.8rem',
                              color: '#fff',
                              fontSize: '0.85rem',
                              fontFamily: 'Orbitron, monospace',
                              letterSpacing: '2px',
                              textTransform: 'uppercase',
                              outline: 'none',
                            }}
                            placeholder="ENTER CODE"
                            value={promoCode}
                            onChange={e => setPromoCode(e.target.value.toUpperCase())}
                            disabled={promoStatus === 'loading'}
                            onKeyDown={e => e.key === 'Enter' && handlePromoRedeem()}
                          />
                          <motion.button
                            onClick={handlePromoRedeem}
                            disabled={!promoCode.trim() || promoStatus === 'loading'}
                            style={{
                              background: 'linear-gradient(135deg, #f7931a, #e07b0a)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '0.55rem 1rem',
                              color: '#000',
                              fontWeight: '800',
                              fontSize: '0.78rem',
                              cursor: !promoCode.trim() ? 'not-allowed' : 'pointer',
                              opacity: !promoCode.trim() ? 0.5 : 1,
                              whiteSpace: 'nowrap',
                            }}
                            whileHover={promoCode.trim() ? { scale: 1.03 } : {}}
                            whileTap={promoCode.trim() ? { scale: 0.97 } : {}}
                          >
                            {promoStatus === 'loading' ? '...' : 'Apply'}
                          </motion.button>
                        </div>
                        {promoMessage && (
                          <p style={{
                            marginTop: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: promoStatus === 'success' ? '#00ff88' : '#ff4757',
                          }}>
                            {promoMessage}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Promo already redeemed success banner */}
                    {promoRedeemed && promoBonus > 0 && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.8rem 1rem',
                        background: 'rgba(0,255,136,0.06)',
                        border: '1px solid rgba(0,255,136,0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                      }}>
                        <FaGift style={{ color: '#00ff88', fontSize: '1.1rem' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#00ff88' }}>
                          🎁 +${promoBonus.toFixed(2)} bonus credited to your balance!
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── GATEWAY CONFIG SETTINGS PANEL ── */}
                {tab === 'settings' && (
                  <motion.div key="settings" className={styles.panel}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    
                    <p className={styles.sectionLabel}>Wallet Mode</p>
                    <div className={styles.feeGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '0.25rem' }}>
                      <button
                        className={`${styles.feeOption} ${configMode === 'demo' ? styles.feeActive : ''}`}
                        onClick={() => setConfigMode('demo')}
                      >
                        <span className={styles.feeLabel}>Simulated Blockchain</span>
                        <span className={styles.feeSub}>Tactile block confirmations</span>
                      </button>
                      <button
                        className={`${styles.feeOption} ${configMode === 'real' ? styles.feeActive : ''}`}
                        onClick={() => setConfigMode('real')}
                        style={{ borderBottomColor: configMode === 'real' ? activeCoinMeta.color : 'rgba(255,255,255,0.08)' }}
                      >
                        <span className={styles.feeLabel} style={configMode === 'real' ? { color: activeCoinMeta.color } : {}}>NOWPayments API</span>
                        <span className={styles.feeSub}>On-chain merchant gateway</span>
                      </button>
                    </div>

                    {configMode === 'real' && (
                      <>
                        <p className={styles.sectionLabel} style={{ marginTop: '0.4rem' }}>Gateway REST Endpoint</p>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="https://api.nowpayments.io/v1"
                          value={configUrl}
                          onChange={e => setConfigUrl(e.target.value)}
                        />

                        <p className={styles.sectionLabel} style={{ marginTop: '0.4rem' }}>NOWPayments API Key</p>
                        <input
                          className={styles.input}
                          type="password"
                          placeholder="Paste your merchant panel api key"
                          value={configApiKey}
                          onChange={e => setConfigApiKey(e.target.value)}
                        />
                        
                        <p className={styles.parsedHint} style={{ color: 'rgba(255, 255, 255, 0.25)' }}>
                          Create a free merchant account on <a href="https://nowpayments.io" target="_blank" rel="noreferrer" style={{ color: activeCoinMeta.color, textDecoration: 'underline' }}>NOWPayments</a> to retrieve keys. Kept fully client-side.
                        </p>
                      </>
                    )}

                    <motion.button
                      className={`${styles.actionBtn} ${styles.actionBtnFull}`}
                      onClick={handleSaveConfig}
                      style={{ marginTop: '0.75rem', background: `linear-gradient(135deg, ${activeCoinMeta.color}, ${activeCoinMeta.color}dd)` }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {savedConfig ? '✅ Configuration Saved!' : 'Save Configuration'}
                    </motion.button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Real-Time Blockchain Confirmation Status Bar ──
function StatusBar({ step, lastTxid }) {
  if (!step || step === 'idle') return null;
  const isDone = step === 'done';
  const label = LEDGER_STEP_LABELS[step] || '📡 Syncing transaction...';
  
  return (
    <motion.div
      className={styles.statusBar}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: isDone ? 'rgba(0,255,136,0.05)' : 'rgba(247,147,26,0.03)',
        borderColor: isDone ? 'rgba(0,255,136,0.15)' : 'rgba(247,147,26,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        borderRadius: '12px',
        padding: '0.8rem 1.1rem',
        marginTop: '0.5rem'
      }}
    >
      {!isDone && (
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid rgba(247,147,26,0.2)',
          borderTopColor: '#f7931a',
          borderRadius: '50%',
          animation: `${styles.spin} 0.7s linear infinite`,
          flexShrink: 0
        }} />
      )}
      <div>
        <div style={{ fontSize: '0.82rem', color: isDone ? '#00ff88' : '#f7931a', fontWeight: '600' }}>
          {label}
        </div>
        {lastTxid && (
          <div style={{ fontFamily: 'Courier New', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
            TxHash: {lastTxid}
          </div>
        )}
      </div>
    </motion.div>
  );
}
