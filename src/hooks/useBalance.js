'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getBalance, setBalance as storeBalance, initializePlayer } from '@/lib/storage';
import { GAME_CONFIG } from '@/lib/constants';
import { supabase, isDbEnabled } from '@/lib/supabase';

// Helper function to broadcast balance changes across the tab/window
function broadcastBalanceUpdate(newBalance) {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('balance-update', { detail: newBalance }));
    }, 0);
  }
}

export function useBalance() {
  const [balance, setBalanceState] = useState(GAME_CONFIG.STARTING_BALANCE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState(null);

  // Auth session listener
  useEffect(() => {
    if (isDbEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user || null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Use a ref to hold the active realtime channel so we can reliably clean it up
  const realtimeChannelRef = useRef(null);

  // Sync balance from DB if authenticated
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();
      if (data && !cancelled) {
        setBalanceState(Number(data.balance));
        storeBalance(Number(data.balance));
        broadcastBalanceUpdate(Number(data.balance));
      }
    };
    fetchProfile();

    // Clean up any previously active channel before creating a new one.
    // This is critical in React StrictMode where effects run twice.
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    // Append a unique suffix so the channel name is never reused while
    // the old subscription is still being torn down by Supabase internally.
    const channelName = `profile-balance-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const channel = supabase.channel(channelName);
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
      (payload) => {
        if (payload.new && payload.new.balance !== undefined && !cancelled) {
          const val = Number(payload.new.balance);
          setBalanceState(val);
          storeBalance(val);
        }
      }
    );
    channel.subscribe();
    realtimeChannelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [user]);


  useEffect(() => {
    initializePlayer();
    const stored = getBalance();
    if (stored !== null && !user) {
      setBalanceState(stored);
    }
    setIsLoaded(true);

    // Event listener for custom balance-update events
    const handleUpdate = (e) => {
      if (e.detail !== undefined && e.detail !== null) {
        setBalanceState((prev) => {
          if (prev === e.detail) return prev;
          return e.detail;
        });
      }
    };

    // Event listener for standard cross-tab storage changes
    const handleStorage = (e) => {
      if (e.key === 'btcfinder_balance' && !user) {
        const stored = getBalance();
        if (stored !== null) {
          setBalanceState(stored);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('balance-update', handleUpdate);
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('balance-update', handleUpdate);
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, [user]);

  const updateBalance = useCallback(async (newBalance) => {
    const clamped = Math.max(0, Math.round(newBalance * 100) / 100);
    setBalanceState(clamped);
    storeBalance(clamped);
    broadcastBalanceUpdate(clamped);

    if (isDbEnabled()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('profiles')
          .update({ balance: clamped })
          .eq('id', session.user.id);
      }
    }
  }, []);

  const addBalance = useCallback(async (amount) => {
    if (isDbEnabled()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase.rpc('increment_profile_balance', {
          user_id: session.user.id,
          amount: amount
        });
        if (!error && data !== null) {
          const next = Number(data);
          setBalanceState(next);
          storeBalance(next);
          broadcastBalanceUpdate(next);
          return next;
        } else {
          console.error('Failed to increment balance in DB:', error);
        }
      }
    }

    const stored = getBalance() ?? GAME_CONFIG.STARTING_BALANCE;
    const next = Math.max(0, Math.round((stored + amount) * 100) / 100);
    setBalanceState(next);
    storeBalance(next);
    broadcastBalanceUpdate(next);
    return next;
  }, []);

  const subtractBalance = useCallback(async (amount) => {
    if (isDbEnabled()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase.rpc('increment_profile_balance', {
          user_id: session.user.id,
          amount: -amount
        });
        if (!error && data !== null) {
          const next = Number(data);
          setBalanceState(next);
          storeBalance(next);
          broadcastBalanceUpdate(next);
          return next;
        } else {
          console.error('Failed to subtract balance in DB:', error);
          if (error && error.message && error.message.includes('Insufficient balance')) {
            throw new Error('Insufficient balance');
          }
        }
      }
    }

    const stored = getBalance() ?? GAME_CONFIG.STARTING_BALANCE;
    if (stored < amount) {
      throw new Error('Insufficient balance');
    }
    const next = Math.max(0, Math.round((stored - amount) * 100) / 100);
    setBalanceState(next);
    storeBalance(next);
    broadcastBalanceUpdate(next);
    return next;
  }, []);

  const canAfford = useCallback((amount) => {
    return balance >= amount;
  }, [balance]);

  const isBankrupt = false; // Always false, disabled bankruptcy mode

  const claimBailout = useCallback(() => {
    return false; // Bailout disabled
  }, []);

  return {
    balance,
    isLoaded,
    updateBalance,
    addBalance,
    subtractBalance,
    canAfford,
    isBankrupt,
    claimBailout,
  };
}
