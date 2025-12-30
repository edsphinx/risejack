import { useState, useEffect } from 'preact/hooks';
import { formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import type { WalletConnectProps, TimeRemaining } from '@risejack/shared';
import './styles/header.css';

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

  const copyAddress = async () => {
    await navigator.clipboard.writeText(account!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="wallet-section">
        <button onClick={onConnect} disabled={isConnecting} className="header-cta">
          {isConnecting ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Connect Wallet</span>
            </>
          )}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  // Connected state
  return (
    <div className="wallet-section">
      {/* Session Key */}
      {hasSessionKey ? (
        <div className="header-badge session-active">
          <span>🔑</span>
          <span className="badge-text badge-time">{formatTime(sessionExpiry)}</span>
          <span className="badge-separator">|</span>
          <span onClick={onRevokeSession} className="badge-disconnect" title="Revoke session">
            ✕
          </span>
        </div>
      ) : (
        <button
          onClick={handleCreateSession}
          disabled={isCreatingSession}
          className="header-badge create-session"
        >
          <span>🔑</span>
          <span className="badge-text">{isCreatingSession ? '...' : 'Fast Mode'}</span>
        </button>
      )}

      {/* Balance */}
      {balance !== null && (
        <div className="header-badge balance">
          <span className="badge-balance">{Number(formatEther(balance)).toFixed(4)} ETH</span>
        </div>
      )}

      {/* Address + Disconnect (integrated like session key) */}
      <button onClick={copyAddress} className="header-badge" title="Copy address">
        <div className="status-dot" />
        <span className="badge-address">{shortenAddress(account!)}</span>
        <span className="text-slate-500">{copied ? '✓' : '⧉'}</span>
        <span className="badge-separator">|</span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="badge-disconnect"
          title="Disconnect"
        >
          ✕
        </span>
      </button>
    </div>
  );
}
