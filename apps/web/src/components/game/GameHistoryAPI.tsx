/**
 * GameHistoryAPI - Enhanced history panel with API data
 *
 * Hybrid approach:
 * - Local storage for instant UX (current session)
 * - API data for persistence (cross-device)
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { getUserGames } from '@/lib/api';
import { formatEther } from 'viem';

interface APIGame {
  id: string;
  gameType: string;
  txHash: string;
  betAmount: string;
  payout: string;
  outcome: string;
  endedAt: string;
}

interface GameHistoryAPIProps {
  /** Show only count */
  compact?: boolean;
}

export function GameHistoryAPI({ compact = false }: GameHistoryAPIProps) {
  const { address, isConnected } = useWallet();
  const [games, setGames] = useState<APIGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchGames = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      const result = (await getUserGames(address, 10, 0)) as {
        games?: APIGame[];
        total?: number;
      } | null;
      if (result && Array.isArray(result.games)) {
        setGames(result.games);
        setTotalCount(result.total || result.games.length);
      }
    } catch (error) {
      console.error('Failed to fetch game history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Fetch on connect
  useEffect(() => {
    if (isConnected && address) {
      fetchGames();
    }
  }, [isConnected, address, fetchGames]);

  // Refresh on game end event
  useEffect(() => {
    const handleGameEnd = () => {
      // Delay to allow indexer to process
      setTimeout(fetchGames, 3000);
    };
    window.addEventListener('risejack:gameEnd', handleGameEnd);
    return () => window.removeEventListener('risejack:gameEnd', handleGameEnd);
  }, [fetchGames]);

  const getOutcomeEmoji = (outcome: string) => {
    switch (outcome) {
      case 'blackjack':
        return '💎';
      case 'win':
        return '💰';
      case 'lose':
        return '💀';
      case 'push':
        return '🤝';
      case 'surrender':
        return '🏳️';
      default:
        return '🎲';
    }
  };

  const getOutcomeClass = (outcome: string) => {
    switch (outcome) {
      case 'blackjack':
      case 'win':
        return 'text-green-400';
      case 'lose':
        return 'text-red-400';
      case 'push':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatAmount = (wei: string): string => {
    try {
      const eth = parseFloat(formatEther(BigInt(wei)));
      return eth.toFixed(5);
    } catch {
      return '0';
    }
  };

  const formatTime = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Stats
  const stats = {
    total: totalCount,
    wins: games.filter((g) => g.outcome === 'win' || g.outcome === 'blackjack').length,
  };
  const winRate = games.length > 0 ? Math.round((stats.wins / games.length) * 100) : 0;

  if (!isConnected) {
    return null;
  }

  if (compact) {
    return (
      <div className="text-sm text-gray-400">
        {totalCount > 0 ? `${totalCount} games played` : 'No games yet'}
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-48'}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="font-semibold text-white">History</span>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-gray-400">
            {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-400">{winRate}% W</span>
          <span className="text-gray-500">{isExpanded ? '▼' : '▲'}</span>
        </div>
      </button>

      {/* Content */}
      <div className="overflow-y-auto max-h-64">
        {isLoading && games.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-pulse">Loading history...</div>
          </div>
        )}

        {!isLoading && games.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            <p>No games yet</p>
            <p className="text-xs">Play to see your history!</p>
          </div>
        )}

        {games.slice(0, isExpanded ? 10 : 3).map((game) => (
          <div
            key={game.id}
            className="px-3 py-2 border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{getOutcomeEmoji(game.outcome)}</span>
                <span className={`font-semibold ${getOutcomeClass(game.outcome)}`}>
                  {game.outcome.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-500">{formatTime(game.endedAt)}</div>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Bet: {formatAmount(game.betAmount)} ETH</span>
              <span className={game.outcome === 'lose' ? 'text-red-400' : 'text-green-400'}>
                {game.outcome === 'lose' ? '-' : '+'}
                {formatAmount(game.payout)} ETH
              </span>
            </div>
            {/* TX Link */}
            <a
              href={`https://testnet.explorer.risechain.gg/tx/${game.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
            >
              View TX ↗
            </a>
          </div>
        ))}
      </div>

      {/* Footer */}
      {totalCount > 3 && (
        <div className="p-2 border-t border-slate-700/50 text-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            {isExpanded ? 'Show less' : `Show all ${totalCount} games`}
          </button>
        </div>
      )}
    </div>
  );
}
