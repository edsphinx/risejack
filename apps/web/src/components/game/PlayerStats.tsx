/**
 * PlayerStats Component
 *
 * Displays current XP, level, and progress bar.
 * Visible when wallet is connected.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { getUserProfile } from '@/lib/api';
import './styles/player-stats.css';

interface UserStats {
  xp: number;
  level: number;
  displayName?: string;
}

const XP_PER_LEVEL = 100;

export function PlayerStats() {
  const { address, isConnected } = useWallet();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      const response = (await getUserProfile(address)) as {
        profile: { xp?: number; level?: number; displayName?: string };
      };
      const profile = response.profile || response;
      setStats({
        xp: profile.xp || 0,
        level: profile.level || 0,
        displayName: profile.displayName,
      });
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Fetch on connect
  useEffect(() => {
    if (isConnected && address) {
      fetchStats();
    } else {
      setStats(null);
    }
  }, [isConnected, address, fetchStats]);

  // Listen for game end events to refresh stats
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleGameEnd = () => {
      // Small delay to allow backend to update
      timeoutId = setTimeout(fetchStats, 1000);
    };

    window.addEventListener('risecasino:gameend', handleGameEnd);
    return () => {
      window.removeEventListener('risecasino:gameend', handleGameEnd);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchStats]);

  if (!isConnected || !stats) {
    return null;
  }

  const currentLevelXp = stats.xp % XP_PER_LEVEL;
  const progressPercent = (currentLevelXp / XP_PER_LEVEL) * 100;
  const xpToNext = XP_PER_LEVEL - currentLevelXp;

  return (
    <div className="player-stats">
      {isLoading ? (
        <div className="player-stats-loading">
          <span className="loading-dot" />
        </div>
      ) : (
        <>
          <div className="player-stats-level">
            <span className="level-badge">Lv.{stats.level}</span>
          </div>
          <div className="player-stats-xp">
            <div className="xp-bar-container">
              <div className="xp-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="xp-text">
              {stats.xp.toLocaleString()} XP
              <span className="xp-to-next">({xpToNext} to next)</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default PlayerStats;
