import { useState, useEffect } from 'preact/hooks';
import { formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import type { WalletConnectProps, TimeRemaining } from '@risejack/shared';

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
  onRevokeSession,
}: WalletConnectProps) {
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);

  // Fetch balance using direct provider call
  useEffect(() => {
    if (!account) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const provider = getProvider();
        const result = await provider.request({
          method: 'eth_getBalance',
          params: [account, 'latest'],
        });
        setBalance(BigInt(result as string));
      } catch {
        setBalance(null);
      }
    };

    fetchBalance();
    // Poll every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [account]);

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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 max-w-[200px] sm:max-w-none justify-end">
      {/* Session Key Badge */}
      {hasSessionKey ? (
        <div className="flex items-center gap-1">
          <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-l-lg bg-green-900/50 border border-green-500/30 flex items-center gap-1">
            <span className="text-green-400 text-xs sm:text-sm">🔑</span>
            <span className="text-green-400 text-[10px] sm:text-xs font-medium">
              {formatTime(sessionExpiry)}
            </span>
          </div>
          <button
            onClick={onRevokeSession}
            className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-r-lg bg-red-900/30 border border-red-500/30 text-red-400 text-xs hover:bg-red-900/50 transition-colors"
            title="Revoke session key"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreateSession}
          disabled={isCreatingSession}
          className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/30 text-purple-300 text-[10px] sm:text-xs font-medium hover:bg-purple-800/50 transition-colors disabled:opacity-50"
        >
          {isCreatingSession ? '⏳...' : '🔑 Fast'}
        </button>
      )}

      {/* Balance Badge - hide on very small screens */}
      {balance !== null && (
        <div className="hidden sm:block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-800 border border-slate-600">
          <span className="text-yellow-400 font-mono text-xs sm:text-sm font-medium">
            {Number(formatEther(balance)).toFixed(4)} ETH
          </span>
        </div>
      )}

      {/* Address Badge - Click to copy */}
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(account!);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800/80 border border-slate-600/50 flex items-center gap-1 hover:border-purple-500/50 hover:bg-slate-700/80 transition-all cursor-pointer"
        title="Click to copy address"
      >
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        <span className="text-slate-300 font-mono text-[10px] sm:text-xs">
          {shortenAddress(account!)}
        </span>
        <span className="text-slate-500 text-[10px] transition-colors">{copied ? '✓' : '⧉'}</span>
      </button>

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        title="Disconnect"
      >
        ✕
      </button>
    </div>
  );
}
