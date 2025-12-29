import { useState } from 'preact/hooks';
import { useBalance } from 'wagmi';
import { formatEther } from 'viem';
import type { TimeRemaining } from '@risejack/shared';

interface WalletConnectProps {
  account: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateSession: () => Promise<boolean>;
}

export function WalletConnect({
  account,
  isConnected,
  isConnecting,
  hasSessionKey,
  sessionExpiry,
  error,
  onConnect,
  onDisconnect,
  onCreateSession,
}: WalletConnectProps) {
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Fetch balance
  const { data: balanceData } = useBalance({ address: account ?? undefined });

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTime = (time: TimeRemaining | null) => {
    if (!time || time.expired) return 'Expired';
    const parts = [];
    if (time.hours > 0) parts.push(`${time.hours}h`);
    if (time.minutes > 0) parts.push(`${time.minutes}m`);
    if (time.hours === 0) parts.push(`${time.seconds}s`);
    return parts.join(' ');
  };

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      await onCreateSession();
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Not connected state - simple button
  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
        >
          {isConnecting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>⚡</span>
              Connect Rise Wallet
            </span>
          )}
        </button>
        {error && <span className="text-xs text-red-400 max-w-[200px] text-right">{error}</span>}
      </div>
    );
  }

  // Connected state - show address and session status
  return (
    <div className="flex items-center gap-3">
      {/* Session Key Badge */}
      {hasSessionKey ? (
        <div className="px-3 py-1.5 rounded-lg bg-green-900/50 border border-green-500/30 flex items-center gap-2">
          <span className="text-green-400 text-sm">🔑</span>
          <span className="text-green-400 text-xs font-medium">{formatTime(sessionExpiry)}</span>
        </div>
      ) : (
        <button
          onClick={handleCreateSession}
          disabled={isCreatingSession}
          className="px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-800/50 transition-colors disabled:opacity-50"
        >
          {isCreatingSession ? '⏳ Creating...' : '🔑 Enable Fast Mode'}
        </button>
      )}

      {/* Balance Badge */}
      {balanceData && (
        <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600">
          <span className="text-yellow-400 font-mono text-sm font-medium">
            {Number(formatEther(balanceData.value)).toFixed(5)} ETH
          </span>
        </div>
      )}

      {/* Address Badge - Click to copy */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(account!);
          // Optional: show copied feedback
          const btn = document.activeElement as HTMLElement;
          btn.setAttribute('data-copied', 'true');
          setTimeout(() => btn.removeAttribute('data-copied'), 1500);
        }}
        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer group"
        title={`Click to copy: ${account}`}
      >
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="text-white font-mono text-sm">{shortenAddress(account!)}</span>
        <span className="text-slate-500 group-hover:text-slate-300 text-xs">📋</span>
      </button>

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        title="Disconnect"
      >
        ✕
      </button>
    </div>
  );
}
