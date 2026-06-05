'use client';

import { useState, useCallback, useEffect } from 'react';
import { getRakebackData, claimRakeback as claimRakebackStorage } from '@/lib/storage';

export function useRakeback(addBalance) {
  const [rakebackData, setRakebackData] = useState({ accrued: 0, lifetime: 0 });

  const refresh = useCallback(() => {
    setRakebackData(getRakebackData());
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 2s so it updates live as you bet
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, [refresh]);

  const claim = useCallback(() => {
    if (!addBalance) return 0;
    const amount = claimRakebackStorage(addBalance);
    refresh();
    return amount;
  }, [addBalance, refresh]);

  return { rakebackData, claim, refresh };
}
