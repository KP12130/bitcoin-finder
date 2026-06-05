'use client';

import { useState, useCallback, useEffect } from 'react';
import { getLedger, addLedgerEntry } from '@/lib/storage';
import { usdToCrypto, cryptoToUsd, fetchCryptoPrice, formatCryptoAmount } from '@/lib/price';
import { supabase, isDbEnabled } from '@/lib/supabase';
import { playSound } from '@/lib/audio';

// Dynamic transaction delay simulation
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Comprehensive Roster of Blockchain Networks per Cryptocurrency
export const COIN_NETWORKS = {
  BTC: [
    { id: 'Native', label: 'Bitcoin Mainnet (SegWit)', speed: '~10-60 min', feeUsd: 2.50 },
    { id: 'BEP-20', label: 'BNB Smart Chain (BEP-20)', speed: '~1-2 min', feeUsd: 0.15 }
  ],
  ETH: [
    { id: 'ERC-20', label: 'Ethereum Mainnet', speed: '~1-5 min', feeUsd: 1.80 },
    { id: 'Arbitrum', label: 'Arbitrum One L2', speed: 'Instant', feeUsd: 0.05 },
    { id: 'Optimism', label: 'Optimism L2', speed: 'Instant', feeUsd: 0.05 },
    { id: 'Polygon', label: 'Polygon Bridge L2', speed: 'Instant', feeUsd: 0.02 }
  ],
  LTC: [
    { id: 'Native', label: 'Litecoin Mainnet', speed: '~2-10 min', feeUsd: 0.05 }
  ],
  SOL: [
    { id: 'Native', label: 'Solana Mainnet', speed: 'Instant', feeUsd: 0.02 }
  ],
  DOGE: [
    { id: 'Native', label: 'Dogecoin Mainnet', speed: '~5 min', feeUsd: 0.10 }
  ],
  POL: [
    { id: 'Native', label: 'Polygon POS Mainnet', speed: 'Instant', feeUsd: 0.02 }
  ],
  USDT: [
    { id: 'TRC-20', label: 'Tron (TRC-20)', speed: 'Instant', feeUsd: 0.10 },
    { id: 'Polygon', label: 'Polygon (EVM)', speed: 'Instant', feeUsd: 0.02 },
    { id: 'ERC-20', label: 'Ethereum (ERC-20)', speed: '~1-5 min', feeUsd: 1.80 },
    { id: 'SPL', label: 'Solana (SPL)', speed: 'Instant', feeUsd: 0.02 },
    { id: 'BEP-20', label: 'BNB Smart Chain (BEP-20)', speed: '~1-2 min', feeUsd: 0.10 }
  ],
  USDC: [
    { id: 'SPL', label: 'Solana (SPL)', speed: 'Instant', feeUsd: 0.02 },
    { id: 'Polygon', label: 'Polygon (EVM)', speed: 'Instant', feeUsd: 0.02 },
    { id: 'ERC-20', label: 'Ethereum (ERC-20)', speed: '~1-5 min', feeUsd: 1.80 },
    { id: 'BEP-20', label: 'BNB Smart Chain (BEP-20)', speed: '~1-2 min', feeUsd: 0.10 }
  ]
};

// Deterministic mock address generator based on selected coin, network, and player ID
function getDeterministicAddress(coin, networkId, userId) {
  const hash = String(userId || 'guest_satoshi_finder_2026').slice(0, 12).toLowerCase();
  
  if (networkId === 'TRC-20') {
    return `T${hash.toUpperCase()}n4f7pyk2hqy58sncfw29xpks7y`;
  }
  if (networkId === 'SPL') {
    return `Sol${hash}R6wK3hCjP19wB94aF7y6mN54wP28`;
  }
  if (networkId === 'BEP-20' || networkId === 'ERC-20' || networkId === 'Arbitrum' || networkId === 'Optimism' || networkId === 'Polygon' || coin === 'ETH' || coin === 'POL') {
    return `0x${hash}94f796d11f26a1df8bc0a2bdf6fa5e9b`;
  }
  if (coin === 'BTC' && networkId === 'Native') {
    return `bc1q${hash}p76v6rtpyk2hyqy58sncfswj9xpks7y`;
  }
  if (coin === 'LTC') {
    return `L${hash.toUpperCase()}n4f7pyk2hqy58sncfw29xpks7y`;
  }
  if (coin === 'DOGE') {
    return `D${hash.toUpperCase()}8sncfw7y6p76v6rtyk2hyqy59xp`;
  }
  return `0x${hash}94f796d11f26a1df8bc0a2bdf6fa5e9b`;
}

// Friendly step progression displays
export const LEDGER_STEP_LABELS = {
  broadcasting: '📡 Broadcasting transaction to Mempool...',
  mining: '⛏️ Transaction picked up by miners. Mining block...',
  confirming1: '🔗 Confirmation (1/3)... Awaiting next block.',
  confirming2: '🔗 Confirmation (2/3)... Block successfully appended.',
  confirming3: '✅ Confirmation (3/3)... Transaction credited!',
};

function fakeTxId() {
  return Array.from({ length: 64 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
}

// Mapping coins and networks to CryptAPI tickers
function getCryptapiTicker(coin, network) {
  const c = coin.toLowerCase();
  const n = network.toLowerCase();
  
  if (c === 'usdt') {
    if (n.includes('trc')) return 'trc20/usdt';
    if (n.includes('erc')) return 'erc20/usdt';
    if (n.includes('bep') || n.includes('bsc')) return 'bep20/usdt';
    if (n.includes('sol') || n.includes('spl')) return 'sol/usdt';
    if (n.includes('polygon') || n.includes('evm')) return 'polygon/usdt';
    return 'trc20/usdt';
  }
  if (c === 'usdc') {
    if (n.includes('erc')) return 'erc20/usdc';
    if (n.includes('sol') || n.includes('spl')) return 'sol/usdc';
    if (n.includes('bep') || n.includes('bsc')) return 'bep20/usdc';
    if (n.includes('polygon') || n.includes('evm')) return 'polygon/usdc';
    return 'erc20/usdc';
  }
  if (c === 'eth') {
    if (n.includes('arbitrum')) return 'arbitrum/eth';
    if (n.includes('optimism')) return 'optimism/eth';
    if (n.includes('polygon')) return 'polygon/eth';
    return 'eth';
  }
  if (c === 'btc') {
    if (n.includes('bep') || n.includes('bsc')) return 'bep20/btcb';
    return 'btc';
  }
  if (c === 'pol') {
    return 'polygon/pol';
  }
  return c;
}

// Get Casino Owner Payout address from environment variables
function getCasinoPayoutAddress(coin, network) {
  const c = coin.toUpperCase();
  const n = network.toUpperCase();
  
  if (c === 'BTC') return process.env.NEXT_PUBLIC_BTC_PAYOUT_ADDRESS;
  if (c === 'ETH') return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
  if (c === 'LTC') return process.env.NEXT_PUBLIC_LTC_PAYOUT_ADDRESS;
  if (c === 'SOL') return process.env.NEXT_PUBLIC_SOL_PAYOUT_ADDRESS;
  if (c === 'DOGE') return process.env.NEXT_PUBLIC_DOGE_PAYOUT_ADDRESS;
  if (c === 'POL') return process.env.NEXT_PUBLIC_POL_PAYOUT_ADDRESS;
  
  if (c === 'USDT' || c === 'USDC') {
    if (n.includes('TRC')) return process.env.NEXT_PUBLIC_TRX_PAYOUT_ADDRESS || process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
    if (n.includes('SPL')) return process.env.NEXT_PUBLIC_SOL_PAYOUT_ADDRESS;
    return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS || process.env.NEXT_PUBLIC_POL_PAYOUT_ADDRESS;
  }
  
  return process.env.NEXT_PUBLIC_ETH_PAYOUT_ADDRESS;
}

export function useWallet(balance, addBalance, subtractBalance) {
  const [ledger, setLedger] = useState([]);
  const [depositStep, setDepositStep] = useState('idle'); // idle | broadcasting | mining | confirming1 | confirming2 | confirming3 | done
  const [withdrawStep, setWithdrawStep] = useState('idle'); // idle | broadcasting | mining | confirming1 | confirming2 | confirming3 | done
  const [user, setUser] = useState(null);

  // Configuration States
  const [walletMode, setWalletMode] = useState('real'); // default to 'real'
  const [nowpaymentsUrl, setNowpaymentsUrl] = useState('https://api.nowpayments.io/v1');
  const [nowpaymentsApiKey, setNowpaymentsApiKey] = useState(process.env.NEXT_PUBLIC_NOWPAYMENTS_API_KEY || '');

  // Real CryptAPI State variables
  const [realDepositAddress, setRealDepositAddress] = useState('');
  const [realDepositAmount, setRealDepositAmount] = useState(0);
  const [realPaymentId, setRealPaymentId] = useState('');
  const [realPaymentStatus, setRealPaymentStatus] = useState('idle'); // idle | waiting | confirming | confirmed | finished | failed | expired
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);

  // Multi-Crypto & Multi-Network State variables
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('Native');

  // Auth session listener
  useEffect(() => {
    if (isDbEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const activeUser = session?.user || null;
        setUser(activeUser);
        if (!activeUser) {
          setWalletMode('demo');
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const activeUser = session?.user || null;
        setUser(activeUser);
        if (!activeUser) {
          setWalletMode('demo');
        } else {
          try {
            const stored = localStorage.getItem('btcfinder_real_wallet_config_v3');
            const parsed = stored ? JSON.parse(stored) : {};
            setWalletMode(parsed.mode || 'real');
          } catch (e) {
            setWalletMode('real');
          }
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setWalletMode('demo');
    }
  }, []);

  const refreshLedger = useCallback(async () => {
    if (isDbEnabled() && user) {
      const { data, error } = await supabase
        .from('ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          timestamp: new Date(item.timestamp).getTime(),
          type: item.type,
          amount: Number(item.amount),
          fee: Number(item.fee),
          crypto_currency: item.crypto_currency || 'USD',
          crypto_amount: Number(item.crypto_amount || 0),
          status: item.status,
          label: item.label,
          txid: item.txid,
          address: item.address
        }));
        setLedger(formatted);
        return;
      }
    }
    setLedger(getLedger());
  }, [user]);

  // Load configs and transactions
  useEffect(() => {
    refreshLedger();
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('btcfinder_real_wallet_config_v3');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (user) {
            setWalletMode(parsed.mode || 'real');
          } else {
            setWalletMode('demo');
          }
          setNowpaymentsUrl(parsed.url || 'https://api.nowpayments.io/v1');
          setNowpaymentsApiKey(parsed.apiKey || process.env.NEXT_PUBLIC_NOWPAYMENTS_API_KEY || '');
          if (parsed.selectedCoin) {
            setSelectedCoin(parsed.selectedCoin);
            const networks = COIN_NETWORKS[parsed.selectedCoin] || [];
            const hasSavedNet = networks.some(n => n.id === parsed.selectedNetwork);
            setSelectedNetwork(hasSavedNet ? parsed.selectedNetwork : networks[0]?.id || 'Native');
          }
        }
      } catch (e) {}
    }
  }, [refreshLedger, user]);

  // Save configurations helper
  const saveWalletConfig = useCallback((config) => {
    setWalletMode(config.mode);
    setNowpaymentsUrl(config.url || 'https://api.nowpayments.io/v1');
    setNowpaymentsApiKey(config.apiKey || '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('btcfinder_real_wallet_config_v3', JSON.stringify({
        mode: config.mode,
        url: config.url || 'https://api.nowpayments.io/v1',
        apiKey: config.apiKey || '',
        selectedCoin,
        selectedNetwork,
      }));
    }
  }, [selectedCoin, selectedNetwork]);

  // Update selected coin and automatically update default network
  const updateSelectedCoin = useCallback((coin) => {
    setSelectedCoin(coin);
    const networks = COIN_NETWORKS[coin] || [];
    const defaultNet = networks[0]?.id || 'Native';
    setSelectedNetwork(defaultNet);

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('btcfinder_real_wallet_config_v3');
        const parsed = stored ? JSON.parse(stored) : {};
        parsed.selectedCoin = coin;
        parsed.selectedNetwork = defaultNet;
        localStorage.setItem('btcfinder_real_wallet_config_v3', JSON.stringify(parsed));
      } catch (e) {}
    }
  }, []);

  // Update selected network helper
  const updateSelectedNetwork = useCallback((net) => {
    setSelectedNetwork(net);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('btcfinder_real_wallet_config_v3');
        const parsed = stored ? JSON.parse(stored) : {};
        parsed.selectedNetwork = net;
        localStorage.setItem('btcfinder_real_wallet_config_v3', JSON.stringify(parsed));
      } catch (e) {}
    }
  }, []);

  // ── High-Fidelity Blockchain Deposit Simulation ──
  const simulateDeposit = useCallback(async (amountUsd, coin, network) => {
    const usd = Number(amountUsd);
    if (!usd || usd < 0.01) return { error: 'Minimum deposit is $0.01' };

    const selectedAsset = coin || selectedCoin;
    const selectedNet = network || selectedNetwork;
    const netDetails = (COIN_NETWORKS[selectedAsset] || []).find(n => n.id === selectedNet) || { label: 'Network' };

    setDepositStep('confirming3');
    playSound('win');
    
    // Add USD balance
    await addBalance(usd);

    // Calc crypto equivalent amount
    const cryptoAmount = await usdToCrypto(usd, selectedAsset);
    const txid = fakeTxId();
    const address = getDeterministicAddress(selectedAsset, selectedNet, user?.id);

    addLedgerEntry({
      type: 'deposit',
      amount: usd,
      fee: 0,
      crypto_currency: selectedAsset,
      crypto_amount: cryptoAmount,
      txid,
      status: 'completed',
      label: `On-Chain ${selectedAsset} Deposit (${netDetails.label})`,
      address: address,
    });

    // If database is enabled, sync to Supabase (with crypto amount columns)
    if (isDbEnabled() && user) {
      try {
        await supabase
          .from('ledger')
          .insert({
            id: Math.random().toString(36).slice(2, 10).toUpperCase(),
            user_id: user.id,
            type: 'deposit',
            amount: usd,
            fee: 0,
            crypto_currency: selectedAsset,
            crypto_amount: cryptoAmount,
            status: 'completed',
            label: `On-Chain ${selectedAsset} Deposit (${netDetails.label})`,
            txid: txid,
            address: address
          });
      } catch (err) {
        console.error('Error logging Supabase ledger:', err);
      }
    }

    refreshLedger();
    await delay(800);
    setDepositStep('idle');
    return { success: true, txid };
  }, [selectedCoin, selectedNetwork, addBalance, refreshLedger, user]);

  // ── High-Fidelity Blockchain Withdrawal Simulation (Fee Deducted) ──
  const simulateWithdraw = useCallback(async (amountUsd, destinationAddress, coin, network) => {
    const usd = Number(amountUsd);
    if (!usd || usd < 1.0) return { error: 'Minimum withdrawal is $1.00' };
    if (usd > balance) return { error: 'Insufficient balance' };

    const selectedAsset = coin || selectedCoin;
    const selectedNet = network || selectedNetwork;
    const netDetails = (COIN_NETWORKS[selectedAsset] || []).find(n => n.id === selectedNet) || { label: 'Network', feeUsd: 0.10 };
    const gasFeeUsd = netDetails.feeUsd;
    
    // Deduct the real-time gas fee from the withdrawal gross payout
    const netUsd = usd - gasFeeUsd;
    if (netUsd <= 0) {
      return { error: `Withdrawal amount too small to cover the ${selectedAsset} network fee ($${gasFeeUsd.toFixed(2)})` };
    }

    if (!destinationAddress || destinationAddress.length < 15) {
      return { error: `Please enter a valid ${selectedAsset} withdrawal address` };
    }

    // Real mode balance deduction
    await subtractBalance(usd);

    const cryptoNetPayout = await usdToCrypto(netUsd, selectedAsset);
    const txid = `WD_${Date.now()}`;

    addLedgerEntry({
      type: 'withdrawal',
      amount: usd,
      fee: gasFeeUsd,
      crypto_currency: selectedAsset,
      crypto_amount: cryptoNetPayout,
      txid,
      status: walletMode === 'real' ? 'pending' : 'completed',
      label: `${walletMode === 'real' ? 'Real' : 'On-Chain'} ${selectedAsset} Withdrawal (${netDetails.label})`,
      address: destinationAddress,
    });

    // If database is enabled, sync to Supabase (with crypto amount columns)
    if (isDbEnabled() && user) {
      try {
        await supabase
          .from('ledger')
          .insert({
            id: Math.random().toString(36).slice(2, 10).toUpperCase(),
            user_id: user.id,
            type: 'withdrawal',
            amount: usd,
            fee: gasFeeUsd,
            crypto_currency: selectedAsset,
            crypto_amount: cryptoNetPayout,
            status: walletMode === 'real' ? 'pending' : 'completed',
            label: `${walletMode === 'real' ? 'Real' : 'On-Chain'} ${selectedAsset} Withdrawal (${netDetails.label})`,
            txid: txid,
            address: destinationAddress
          });
      } catch (err) {
        console.error('Error logging Supabase ledger:', err);
      }
    }

    playSound('cashout');
    refreshLedger();
    setWithdrawStep('confirming3');
    await delay(800);
    setWithdrawStep('idle');
    return { success: true, txid, pending: walletMode === 'real' };
  }, [selectedCoin, selectedNetwork, balance, subtractBalance, refreshLedger, user, walletMode]);

  // ── Real Casino direct-to-wallet Payment Session Creation Call ──
  const createRealPayment = useCallback(async (amountUsd, coin, network) => {
    const usd = Number(amountUsd);
    if (!usd || usd < 0.01) return { error: 'Minimum deposit is $0.01' };

    const selectedAsset = coin || selectedCoin;
    const selectedNet = network || selectedNetwork;

    setIsGeneratingPayment(true);
    setRealDepositAddress('');
    setRealDepositAmount(0);
    setRealPaymentId('');
    setRealPaymentStatus('idle');

    try {
      // Retrieve access token to satisfy RLS policies on the server insert
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;

      // Call local Payment Session endpoint
      const res = await fetch('/api/payment-session/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        body: JSON.stringify({
          usdAmount: usd,
          coin: selectedAsset,
          network: selectedNet,
          userId: user?.id || 'guest_user'
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API Error status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to generate deposit details');

      setRealDepositAddress(data.payAddress);
      setRealDepositAmount(data.payAmount);
      setRealPaymentId(data.sessionId);
      setRealPaymentStatus('waiting');

      // Add a ledger entry in "pending" status locally
      addLedgerEntry({
        id: data.sessionId,
        type: 'deposit',
        amount: usd,
        fee: 0,
        crypto_currency: selectedAsset,
        crypto_amount: data.payAmount,
        txid: data.sessionId,
        status: 'pending',
        label: `Real ${selectedAsset} Deposit (${selectedNet} Network)`,
        address: data.payAddress,
      });

      refreshLedger();
      return { success: true, address: data.payAddress, payAmount: data.payAmount };
    } catch (err) {
      console.error('Failed to create local payment session:', err);
      return { error: err.message || 'Failed to connect to deposit api' };
    } finally {
      setIsGeneratingPayment(false);
    }
  }, [selectedCoin, selectedNetwork, user, refreshLedger]);

  // ── Real Blockchain Payment Status Checker ──
  const checkRealPaymentStatus = useCallback(async () => {
    if (!realPaymentId) return { error: 'No active transaction session' };

    try {
      // Retrieve access token to satisfy RLS policies on the server select/update
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;

      const res = await fetch(`/api/payment-session/status?sessionId=${realPaymentId}`, {
        headers: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch transaction status');
      
      const data = await res.json();

      if (data.status === 'completed') {
        setRealPaymentStatus('finished');
        
        // Find amount from ledger to update client side
        const ledgerPending = ledger.find(item => item.id === realPaymentId || item.txid === realPaymentId);
        const usdToCredit = ledgerPending ? ledgerPending.amount : 0;

        if (usdToCredit > 0) {
          await addBalance(usdToCredit);
        }
        playSound('win');

        // Update local storage ledger status to completed if using fallback
        if (typeof window !== 'undefined') {
          try {
            const localLedger = JSON.parse(localStorage.getItem('btcfinder_ledger') || '[]');
            const index = localLedger.findIndex(item => item.id === realPaymentId || item.txid === realPaymentId);
            if (index !== -1) {
              localLedger[index].status = 'completed';
              localLedger[index].txid = data.txHash || localLedger[index].txid;
              localStorage.setItem('btcfinder_ledger', JSON.stringify(localLedger));
            }
          } catch (e) {}
        }

        refreshLedger();
        
        // Reset states
        setRealDepositAddress('');
        setRealDepositAmount(0);
        setRealPaymentId('');
        setRealPaymentStatus('idle');

        return { credited: true, amount: usdToCredit };
      } else if (data.status === 'expired') {
        setRealPaymentStatus('expired');
        return { status: 'expired' };
      } else {
        setRealPaymentStatus('waiting');
      }

      return { status: 'waiting' };
    } catch (err) {
      console.error('Failed to check payment status:', err);
      return { error: err.message };
    }
  }, [realPaymentId, ledger, addBalance, refreshLedger]);

  const resetDepositStep = useCallback(() => setDepositStep('idle'), []);
  const resetWithdrawStep = useCallback(() => setWithdrawStep('idle'), []);

  return {
    ledger,
    depositStep,
    withdrawStep,
    simulateDeposit,
    simulateWithdraw,
    refreshLedger,
    resetDepositStep,
    resetWithdrawStep,
    addBalance,

    // Configs & Multi-Crypto variables
    walletMode,
    nowpaymentsUrl,
    nowpaymentsApiKey,
    selectedCoin,
    setSelectedCoin: updateSelectedCoin,
    selectedNetwork,
    setSelectedNetwork: updateSelectedNetwork,
    getDepositAddress: (coin, net) => getDeterministicAddress(coin || selectedCoin, net || selectedNetwork, user?.id),
    saveWalletConfig,

    // Real CryptAPI states and handlers
    realDepositAddress,
    realDepositAmount,
    realPaymentId,
    realPaymentStatus,
    isGeneratingPayment,
    createRealPayment,
    checkRealPaymentStatus
  };
}
