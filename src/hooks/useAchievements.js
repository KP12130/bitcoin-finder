'use client';

import { useState, useEffect, useCallback } from 'react';
import { ACHIEVEMENTS } from '@/lib/constants';
import { getAchievements, unlockAchievement, getStats } from '@/lib/storage';

export function useAchievements() {
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setUnlockedIds(getAchievements());
    setIsLoaded(true);
  }, []);

  const checkAchievements = useCallback(() => {
    const stats = getStats();
    const currentUnlocked = getAchievements();
    let justUnlocked = null;

    ACHIEVEMENTS.forEach((achievement) => {
      if (!currentUnlocked.includes(achievement.id) && achievement.condition(stats)) {
        const wasNew = unlockAchievement(achievement.id);
        if (wasNew) {
          justUnlocked = achievement;
        }
      }
    });

    setUnlockedIds(getAchievements());

    if (justUnlocked) {
      setNewlyUnlocked(justUnlocked);
      // Auto-dismiss after 4 seconds
      setTimeout(() => setNewlyUnlocked(null), 4000);
    }

    return justUnlocked;
  }, []);

  const dismissNotification = useCallback(() => {
    setNewlyUnlocked(null);
  }, []);

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedIds.includes(a.id),
  }));

  const completionRate = ACHIEVEMENTS.length > 0
    ? Math.round((unlockedIds.length / ACHIEVEMENTS.length) * 100)
    : 0;

  return {
    achievements,
    unlockedIds,
    newlyUnlocked,
    checkAchievements,
    dismissNotification,
    completionRate,
    isLoaded,
  };
}
