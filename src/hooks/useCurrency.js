'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCryptoPrice, formatCryptoAmount } from '@/lib/price';

const CurrencyContext = createContext(null);

export const CURRENCY_DETAILS = {
  USD: { symbol: '$', label: 'USD', name: 'US Dollar' },
  BTC: { symbol: '₿', label: 'BTC', name: 'Bitcoin' },
  ETH: { symbol: '♦', label: 'ETH', name: 'Ethereum' },
  SOL: { symbol: '◎', label: 'SOL', name: 'Solana' },
  DOGE: { symbol: 'Ð', label: 'DOGE', name: 'Dogecoin' },
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState('USD');
  const [prices, setPrices] = useState({
    USD: 1.0,
    BTC: 65000.0,
    ETH: 3400.0,
    SOL: 150.0,
    DOGE: 0.15,
  });

  // Load from localStorage on mount and sync to window variables
  useEffect(() => {
    const saved = localStorage.getItem('btcfinder_active_currency');
    if (saved && CURRENCY_DETAILS[saved]) {
      setCurrencyState(saved);
      if (typeof window !== 'undefined') {
        window.__activeCurrency = saved;
      }
    } else {
      if (typeof window !== 'undefined') {
        window.__activeCurrency = 'USD';
      }
    }
  }, []);

  // Update window variables when currency or prices change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__activeCurrency = currency;
      window.__activeCurrencyPrice = prices[currency] || 1.0;
      // Trigger a custom event to notify external listeners (e.g. formatBTC calls)
      window.dispatchEvent(new Event('currency-change'));
    }
  }, [currency, prices]);

  // Fetch prices on mount and periodically
  useEffect(() => {
    let active = true;

    const updatePrices = async () => {
      try {
        const [btc, eth, sol, doge] = await Promise.all([
          fetchCryptoPrice('BTC'),
          fetchCryptoPrice('ETH'),
          fetchCryptoPrice('SOL'),
          fetchCryptoPrice('DOGE'),
        ]);

        if (active) {
          setPrices({
            USD: 1.0,
            BTC: btc,
            ETH: eth,
            SOL: sol,
            DOGE: doge,
          });
        }
      } catch (err) {
        console.error('Failed to fetch crypto spot prices:', err);
      }
    };

    updatePrices();
    const interval = setInterval(updatePrices, 30000); // Poll every 30s
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const setCurrency = (cur) => {
    if (CURRENCY_DETAILS[cur]) {
      setCurrencyState(cur);
      localStorage.setItem('btcfinder_active_currency', cur);
    }
  };

  const getPrice = (cur) => {
    return prices[cur] || 1.0;
  };

  const convertUsdToActive = (usdAmount) => {
    const rate = getPrice(currency);
    return Number(usdAmount) / rate;
  };

  const convertActiveToUsd = (activeAmount) => {
    const rate = getPrice(currency);
    return Number(activeAmount) * rate;
  };

  const formatAmount = (usdAmount) => {
    if (usdAmount === undefined || usdAmount === null) return '$0.00';
    const rate = getPrice(currency);
    const amt = Number(usdAmount) / rate;
    const detail = CURRENCY_DETAILS[currency];
    const formatted = formatCryptoAmount(amt, currency);
    return `${detail.symbol}${formatted}`;
  };

  const value = {
    currency,
    setCurrency,
    prices,
    activeSymbol: CURRENCY_DETAILS[currency].symbol,
    convertUsdToActive,
    convertActiveToUsd,
    formatAmount,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
