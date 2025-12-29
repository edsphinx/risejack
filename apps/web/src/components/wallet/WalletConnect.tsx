import type { WalletMode } from '../../hooks/useBlackjack';
import type { TimeRemaining } from '@risejack/shared';

interface WalletConnectProps {
  account: `0x${string}` | null;
  isConnected: boolean;
  walletMode: WalletMode;
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateSession: () => Promise<boolean>;
  onModeChange: (mode: WalletMode) => void;
  isConnecting?: boolean;
}

export function WalletConnect({
  account,
  isConnected,
  walletMode,
  hasSessionKey,
  sessionExpiry,
  onConnect,
  onDisconnect,
  onCreateSession,
  onModeChange,
  isConnecting = false,
}: WalletConnectProps) {
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTime = (time: TimeRemaining | null) => {
    if (!time || time.expired) return 'Expired';
    const parts = [];
    if (time.hours > 0) parts.push(`${time.hours}h`);
    if (time.minutes > 0) parts.push(`${time.minutes}m`);
    if (time.hours === 0) parts.push(`${time.seconds}s`);
    return parts.join(' ');
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700">
      {/* Wallet Mode Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => onModeChange('rise')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            walletMode === 'rise'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          ⚡ Rise Wallet
        </button>
        <button
          onClick={() => onModeChange('metamask')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            walletMode === 'metamask'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          🦊 MetaMask
        </button>
      </div>

      {/* Connection Status */}
      {!isConnected ? (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full py-3 rounded-lg font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="space-y-3">
          {/* Connected Address */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-white font-mono text-sm">{shortenAddress(account!)}</span>
            </div>
            <button
              onClick={onDisconnect}
              className="text-sm text-slate-400 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Session Key Status (Rise Wallet only) */}
          {walletMode === 'rise' && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              {hasSessionKey ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm">🔑 Session Active</span>
                  </div>
                  <span className="text-sm text-slate-400">{formatTime(sessionExpiry)}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">
                    Enable popup-free transactions for 1 hour
                  </p>
                  <button
                    onClick={onCreateSession}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    🚀 Create Session Key
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Session Key Benefits */}
          {walletMode === 'rise' && hasSessionKey && (
            <p className="text-xs text-slate-500 text-center">
              ⚡ Instant transactions • No popups • Gas-free gameplay
            </p>
          )}
        </div>
      )}
    </div>
  );
}
