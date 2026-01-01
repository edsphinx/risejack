/**
 * Referrals Dashboard Component
 *
 * Shows user's referral code, invite link, stats, and pending earnings
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getReferralStats } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';

interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  earnings: {
    total: string;
    pending: string;
    claimed: string;
  };
}

export function ReferralsDashboard() {
  const { address, isConnected } = useWallet();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getReferralStats(address);
      setStats(result as ReferralStats);
    } catch (err) {
      setError('Failed to load referral stats');
      console.error('Referral stats error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchStats();
    }
  }, [isConnected, address, fetchStats]);

  const referralLink = stats?.referralCode
    ? `${window.location.origin}/r/${stats.referralCode}`
    : '';

  const copyToClipboard = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
        <p className="text-gray-400">Connect your wallet to view referrals</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">🎁 Invite Friends</h2>
        <p className="text-sm text-gray-400 mt-1">
          Earn 10% of house edge from every game your friends play
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-400">
            {error}
            <button
              type="button"
              onClick={fetchStats}
              className="block mx-auto mt-2 text-sm text-purple-400 hover:text-purple-300"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && stats && (
          <>
            {/* Referral Code & Link */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider">
                Your Referral Link
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Code: <span className="font-mono text-purple-400">{stats.referralCode}</span>
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-white">{stats.totalReferrals}</div>
                <div className="text-sm text-gray-400">Friends Invited</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">
                  {formatEarnings(stats.earnings.total)}
                </div>
                <div className="text-sm text-gray-400">Total Earned</div>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-4 border border-purple-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">Earnings</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Pending (CHIP)</span>
                  <span className="text-yellow-400 font-mono">
                    {formatEarnings(stats.earnings.pending)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Claimed</span>
                  <span className="text-green-400 font-mono">
                    {formatEarnings(stats.earnings.claimed)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="w-full mt-4 py-2 rounded-lg bg-slate-600/50 text-gray-400 text-sm cursor-not-allowed"
              >
                🔒 Claim Available Monthly
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Rewards are distributed via monthly CHIP airdrops
              </p>
            </div>

            {/* How it works */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                💡 <strong>How it works:</strong>
              </p>
              <p>• Share your link with friends</p>
              <p>• They play RiseJack and you earn 10% of house edge</p>
              <p>• Earnings accumulate and are claimable monthly in CHIP</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatEarnings(value: string): string {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    if (num < 0.001) return '<0.001';
    return num.toFixed(3);
  } catch {
    return '0';
  }
}
