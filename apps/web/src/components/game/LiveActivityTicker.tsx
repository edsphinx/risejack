/**
 * Live Activity Ticker
 *
 * Shows recent wins and stats to drive FOMO and social proof
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { formatEther } from 'viem';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RecentWin {
  id: string;
  walletAddress: string;
  displayName: string | null;
  payout: string;
  outcome: string;
  timestamp: string;
}

interface ActivityStats {
  todayVolume: string;
  todayGames: number;
  biggestWinToday: {
    payout: string;
    walletAddress: string;
    displayName: string | null;
  } | null;
  topXpPlayer: {
    walletAddress: string;
    displayName: string | null;
    xp: string;
  } | null;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPayout(value: string): string {
  try {
    const eth = parseFloat(formatEther(BigInt(value)));
    return `${eth.toFixed(3)} ETH`;
  } catch {
    return '0 ETH';
  }
}

export function LiveActivityTicker() {
  const [recentWins, setRecentWins] = useState<RecentWin[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [winsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/activity/recent?limit=5`),
        fetch(`${API_URL}/api/activity/stats`),
      ]);

      if (winsRes.ok) {
        const winsData = await winsRes.json();
        setRecentWins(winsData.entries || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Activity ticker error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Rotate through recent wins
  useEffect(() => {
    if (recentWins.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % recentWins.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [recentWins.length]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-y border-purple-500/20 py-2 px-4 overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <div className="animate-pulse">Loading live activity...</div>
        </div>
      </div>
    );
  }

  const currentWin = recentWins[currentIndex];
  const hasActivity = recentWins.length > 0 || stats?.todayGames;

  if (!hasActivity) {
    return (
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-y border-purple-500/20 py-2 px-4">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <span>🎰</span>
          <span>Be the first to play today!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-y border-purple-500/20 py-2 px-4 overflow-hidden">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-sm">
        {/* Recent Win - Animated */}
        {currentWin && (
          <div key={currentWin.id} className="flex items-center gap-2 animate-fade-in">
            <span className="text-yellow-400">🎉</span>
            <span className="text-gray-300">
              <span className="text-white font-semibold">
                {currentWin.displayName || truncateAddress(currentWin.walletAddress)}
              </span>
              {' won '}
              <span className="text-green-400 font-mono font-semibold">
                {formatPayout(currentWin.payout)}
              </span>
              {currentWin.outcome === 'blackjack' && (
                <span className="ml-1 text-yellow-400">🃏</span>
              )}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 text-gray-400">
          {stats?.biggestWinToday && (
            <div className="flex items-center gap-1">
              <span>🏆</span>
              <span className="text-green-400 font-mono">
                {formatPayout(stats.biggestWinToday.payout)}
              </span>
            </div>
          )}
          {stats && (
            <div className="flex items-center gap-1">
              <span>📊</span>
              <span>{stats.todayGames} games today</span>
            </div>
          )}
          {stats?.topXpPlayer && (
            <div className="flex items-center gap-1">
              <span>⭐</span>
              <span>Top: {Number(stats.topXpPlayer.xp).toLocaleString()} XP</span>
            </div>
          )}
        </div>
      </div>

      {/* CSS for fade animation */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
