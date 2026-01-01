import { useState, useEffect, useRef } from 'preact/hooks';
import { formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import type { WalletConnectProps, TimeRemaining } from '@risejack/shared';
import './styles/header.css';
import './styles/desktop-dropdown.css';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Connected state with dropdown
  return (
    <div className="wallet-section" ref={dropdownRef}>
      {/* Clickable wallet button */}
      <button className="wallet-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
        <div className="wallet-trigger-left">
          <span className="wallet-trigger-dot" />
          <span className="wallet-trigger-balance">
            {balance !== null ? `${Number(formatEther(balance)).toFixed(4)} ETH` : '...'}
          </span>
        </div>
        <div className="wallet-trigger-right">
          <span className="wallet-trigger-address">{shortenAddress(account!)}</span>
          <span className={`wallet-trigger-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
        </div>
        {hasSessionKey && <span className="wallet-trigger-session">🔑</span>}
      </button>

      {/* Dropdown panel */}
      {dropdownOpen && (
        <div className="wallet-dropdown">
          {/* Wallet Info */}
          <div className="dropdown-section">
            <div className="dropdown-section-header">
              <span className="dropdown-status-dot" />
              <span className="dropdown-status-text">Connected</span>
            </div>

            <div className="dropdown-address-row">
              <span className="dropdown-address">{account}</span>
              <button className="dropdown-copy-btn" onClick={copyAddress}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="dropdown-balance-row">
              <span className="dropdown-balance-label">Balance</span>
              <span className="dropdown-balance-value">
                {balance !== null ? `${Number(formatEther(balance)).toFixed(6)} ETH` : '-- ETH'}
              </span>
            </div>
          </div>

          {/* Session Key */}
          <div className="dropdown-section session-section">
            <div className="dropdown-session-header">
              <div className="dropdown-session-info">
                <span className="dropdown-session-icon">🔑</span>
                <div>
                  <div className="dropdown-session-label">Fast Mode</div>
                  <div className="dropdown-session-desc">
                    {hasSessionKey ? 'Active - no popups!' : 'Enable for instant gameplay'}
                  </div>
                </div>
              </div>

              {hasSessionKey ? (
                <div className="dropdown-session-actions">
                  <span className="dropdown-session-time">{formatTime(sessionExpiry)}</span>
                  <button className="dropdown-btn-revoke" onClick={onRevokeSession}>
                    Revoke
                  </button>
                </div>
              ) : (
                <button
                  className="dropdown-btn-enable"
                  onClick={handleCreateSession}
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? '...' : 'Enable'}
                </button>
              )}
            </div>
          </div>

          {/* Disconnect */}
          <button
            className="dropdown-disconnect"
            onClick={() => {
              onDisconnect();
              setDropdownOpen(false);
            }}
          >
            🚪 Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
}
