'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStats, getGameHistory } from '@/lib/storage';
import { supabase, isDbEnabled } from '@/lib/supabase';

// Helper to compile stats dynamically from DB game results
function compileStatsFromDb(dbRows) {
  const stats = {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalBet: 0,
    totalWon: 0,
    totalLost: 0,
    biggestWin: 0,
    biggestLoss: 0,
    highestBet: 0,
    currentStreak: 0,
    maxWinStreak: 0,
    peakBalance: 1000,
    timesBankrupt: 0,
    yoloWins: 0,
    maxLoginStreak: 0,
    profitHistory: [],
  };

  // Sort rows oldest first to rebuild streak and profit history correctly
  const sortedRows = [...dbRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let runningBalance = 1000; 
  
  for (const row of sortedRows) {
    const bet = Number(row.bet);
    const payout = Number(row.payout);
    const won = row.won;
    
    stats.totalGames++;
    if (bet > stats.highestBet) {
      stats.highestBet = bet;
    }
    stats.totalBet += bet;
    
    runningBalance -= bet;

    if (won) {
      stats.totalWins++;
      stats.totalWon += payout;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxWinStreak) {
        stats.maxWinStreak = stats.currentStreak;
      }
      const profit = payout - bet;
      if (profit > stats.biggestWin) {
        stats.biggestWin = profit;
      }
      runningBalance += payout;
    } else {
      stats.totalLosses++;
      stats.totalLost += bet;
      if (bet > stats.biggestLoss) {
        stats.biggestLoss = bet;
      }
      stats.currentStreak = 0;
    }

    if (runningBalance > stats.peakBalance) {
      stats.peakBalance = runningBalance;
    }
    if (runningBalance <= 0) {
      stats.timesBankrupt++;
      runningBalance = 1000; // simulate bailout resetting balance to 1000
    }

    const netProfit = stats.totalWon - stats.totalBet;
    stats.profitHistory.push({ game: stats.totalGames, profit: netProfit });
    if (stats.profitHistory.length > 100) {
      stats.profitHistory.shift();
    }
  }

  return stats;
}

export function useStats() {
  const [stats, setStatsState] = useState(null);
  const [history, setHistory] = useState([]);
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

  const refresh = useCallback(async () => {
    if (isDbEnabled() && user) {
      // Query game results from database
      const { data, error } = await supabase
        .from('game_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Compile stats
        const compiled = compileStatsFromDb(data);
        setStatsState(compiled);

        // Limit game history to last 50 for storage/display
        const mappedHistory = data.slice(0, 50).map(row => ({
          gameType: row.game_type,
          bet: Number(row.bet),
          payout: Number(row.payout),
          multiplier: Number(row.multiplier),
          won: row.won,
          secretNumber: row.secret_number,
          matchedGuess: row.matched_guess,
          timestamp: new Date(row.created_at).getTime(),
        }));
        setHistory(mappedHistory);
        setIsLoaded(true);
        return;
      }
    }

    // Fallback to local storage
    setStatsState(getStats());
    setHistory(getGameHistory());
    setIsLoaded(true);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const winRate = stats && stats.totalGames > 0
    ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1)
    : '0.0';

  const netProfit = stats
    ? stats.totalWon - stats.totalBet
    : 0;

  return {
    stats,
    history,
    winRate,
    netProfit,
    refresh,
    isLoaded,
  };
}
