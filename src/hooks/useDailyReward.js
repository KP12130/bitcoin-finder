'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDailyRewardData, claimDailyReward as storeClaim } from '@/lib/storage';
import { getTimeUntilReward, calculateDailyReward } from '@/lib/utils';

export function useDailyReward() {
  const [rewardData, setRewardData] = useState({ lastClaim: null, streak: 0 });
  const [canClaim, setCanClaim] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = getDailyRewardData();
    setRewardData(data);

    const remaining = getTimeUntilReward(data.lastClaim);
    setCanClaim(!remaining);
    setTimeRemaining(remaining);
    setIsLoaded(true);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (canClaim || !rewardData.lastClaim) return;

    const interval = setInterval(() => {
      const remaining = getTimeUntilReward(rewardData.lastClaim);
      if (!remaining) {
        setCanClaim(true);
        setTimeRemaining(null);
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [canClaim, rewardData.lastClaim]);

  const claimReward = useCallback(() => {
    if (!canClaim) return null;

    const newData = storeClaim();
    if (!newData) return null;

    const rewardAmount = calculateDailyReward(newData.streak);
    setRewardData(newData);
    setCanClaim(false);
    setTimeRemaining(getTimeUntilReward(newData.lastClaim));

    return { amount: rewardAmount, streak: newData.streak };
  }, [canClaim]);

  const currentRewardAmount = calculateDailyReward(rewardData.streak + 1);

  return {
    rewardData,
    canClaim,
    timeRemaining,
    claimReward,
    currentRewardAmount,
    isLoaded,
  };
}
