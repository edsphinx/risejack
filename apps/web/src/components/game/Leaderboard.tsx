/**
 * Leaderboard Component
 *
 * Displays top players by different metrics (XP, Volume, Wins, PnL)
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getLiveLeaderboard } from '@/lib/api';
import { formatEther } from 'viem';

type LeaderboardMetric = 'xp' | 'volume' | 'wins' | 'pnl';

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName?: string;
  value: string;
}

interface LeaderboardData {
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  generatedAt: string;
}

const METRIC_LABELS: Record<
  LeaderboardMetric,
  { label: string; icon: string; format: (v: string) => string }
> = {
  xp: {
    label: 'XP',
    icon: '⭐',
    format: (v) => `${Number(v).toLocaleString()} XP`,
  },
  volume: {
    label: 'Volume',
    icon: '💰',
    format: (v) => `${parseFloat(formatEther(BigInt(v))).toFixed(2)} ETH`,
  },
  wins: {
    label: 'Wins',
    icon: '🏆',
    format: (v) => `${Number(v)} wins`,
  },
  pnl: {
    label: 'Profit',
    icon: '📈',
    format: (v) => {
      const eth = parseFloat(formatEther(BigInt(v)));
      return `${eth >= 0 ? '+' : ''}${eth.toFixed(3)} ETH`;
    },
  },
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return 'text-yellow-400 font-bold';
    case 2:
      return 'text-gray-300 font-semibold';
    case 3:
      return 'text-amber-600 font-semibold';
    default:
      return 'text-gray-400';
  }
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `#${rank}`;
  }
}

export function Leaderboard() {
  const [metric, setMetric] = useState<LeaderboardMetric>('xp');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getLiveLeaderboard(metric, 10);
      setData(result as LeaderboardData);
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Leaderboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [metric]);

  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const metricConfig = METRIC_LABELS[metric];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">🏆 Leaderboard</h2>

        {/* Metric Tabs */}
        <div className="flex gap-2 mt-3">
          {(Object.keys(METRIC_LABELS) as LeaderboardMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                metric === m
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-gray-200'
              }`}
            >
              {METRIC_LABELS[m].icon} {METRIC_LABELS[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-400">
            {error}
            <button
              type="button"
              onClick={fetchLeaderboard}
              className="block mx-auto mt-2 text-sm text-purple-400 hover:text-purple-300"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="space-y-2">
            {data.entries.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No players yet. Be the first!</div>
            ) : (
              data.entries.map((entry) => (
                <div
                  key={entry.walletAddress}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    entry.rank <= 3 ? 'bg-slate-700/50' : 'bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 text-center ${getRankStyle(entry.rank)}`}>
                      {getRankEmoji(entry.rank)}
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        {entry.displayName || truncateAddress(entry.walletAddress)}
                      </div>
                      {entry.displayName && (
                        <div className="text-xs text-gray-500">
                          {truncateAddress(entry.walletAddress)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`font-mono font-semibold ${
                      metric === 'pnl' && BigInt(entry.value) < 0n
                        ? 'text-red-400'
                        : 'text-green-400'
                    }`}
                  >
                    {metricConfig.format(entry.value)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {data?.generatedAt && (
        <div className="px-4 py-2 border-t border-slate-700/50 text-xs text-gray-500 text-center">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
