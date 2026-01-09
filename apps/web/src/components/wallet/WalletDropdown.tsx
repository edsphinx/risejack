/**
 * WalletDropdown - The dropdown panel showing wallet details
 *
 * 🆕 Features:
 * - CHIP and USDC balances with approval status
 * - Manual approval button for unapproved tokens
 * - Visual indicators for approved/unapproved assets
 */

import { useState } from 'preact/hooks';
import { formatEthBalance, formatSessionTime } from '@/lib/formatters';
import { ChipIcon } from '@/components/icons/ChipIcon';
import { TokenService } from '@/services/token.service';
import { CHIP_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, VYRECASINO_ADDRESS } from '@/lib/contract';
import { ERC20_ABI } from '@vyrejack/shared';
import { logger } from '@/lib/logger';
import type { TimeRemaining } from '@vyrejack/shared';
import type { AssetInfo } from '@/hooks/useAssetBalances';

interface WalletDropdownProps {
  address: string;
  balance: string; // ETH balance
  assets: AssetInfo[]; // Array of assets with approval status
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  copied: boolean;
  isCreatingSession: boolean;
  onCopyAddress: () => void;
  onCreateSession: () => void;
  onRevokeSession: () => void;
  onDisconnect: () => void;
  onResetWallet: () => void;
  onRefreshAssets: () => Promise<void>;
}

export function WalletDropdown({
  address,
  balance,
  assets,
  hasSessionKey,
  sessionExpiry,
  copied,
  isCreatingSession,
  onCopyAddress,
  onCreateSession,
  onRevokeSession,
  onDisconnect,
  onResetWallet,
  onRefreshAssets,
}: WalletDropdownProps) {
  return (
    <div className="wallet-dropdown">
      {/* Wallet Info Section */}
      <WalletInfoSection
        address={address}
        balance={balance}
        assets={assets}
        copied={copied}
        onCopyAddress={onCopyAddress}
        onRefreshAssets={onRefreshAssets}
      />

      {/* Session Key Section */}
      <SessionKeySection
        hasSessionKey={hasSessionKey}
        sessionExpiry={sessionExpiry}
        isCreatingSession={isCreatingSession}
        onCreateSession={onCreateSession}
        onRevokeSession={onRevokeSession}
      />

      {/* Reset Wallet Button - for fixing session key issues */}
      <button
        className="dropdown-reset"
        onClick={onResetWallet}
        title="Clear wallet data and reconnect (fixes session key issues)"
      >
        🔧 Reset Wallet
      </button>

      {/* Disconnect Button */}
      <button className="dropdown-disconnect" onClick={onDisconnect}>
        🚪 Disconnect Wallet
      </button>
    </div>
  );
}

// === Sub-components (private to this module) ===

interface WalletInfoSectionProps {
  address: string;
  balance: string;
  assets: AssetInfo[];
  copied: boolean;
  onCopyAddress: () => void;
  onRefreshAssets: () => Promise<void>;
}

function WalletInfoSection({
  address,
  balance,
  assets,
  copied,
  onCopyAddress,
  onRefreshAssets,
}: WalletInfoSectionProps) {
  return (
    <div className="dropdown-section">
      <div className="dropdown-section-header">
        <span className="dropdown-status-dot" />
        <span className="dropdown-status-text">Connected</span>
      </div>

      <div className="dropdown-address-row">
        <span className="dropdown-address">{address}</span>
        <button className="dropdown-copy-btn" onClick={onCopyAddress}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Asset Balances with Approval Status */}
      <div className="dropdown-assets">
        {assets.map((asset) => (
          <AssetBalanceRow
            key={asset.symbol}
            asset={asset}
            accountAddress={address}
            onApproved={onRefreshAssets}
          />
        ))}
      </div>

      {/* ETH Balance */}
      <div className="dropdown-balance-row dropdown-balance-eth">
        <span className="dropdown-balance-label">ETH Balance</span>
        <span className="dropdown-balance-value">{formatEthBalance(balance, 6)} Ξ</span>
      </div>
    </div>
  );
}

interface AssetBalanceRowProps {
  asset: AssetInfo;
  accountAddress: string;
  onApproved: () => Promise<void>;
}

function AssetBalanceRow({ asset, accountAddress, onApproved }: AssetBalanceRowProps) {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);

    try {
      const { getProvider } = await import('@/lib/riseWallet');
      const { encodeFunctionData } = await import('viem');

      const provider = getProvider();

      const tokenAddress = asset.symbol === 'CHIP' ? CHIP_TOKEN_ADDRESS : USDC_TOKEN_ADDRESS;
      const maxApproval = BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      );

      // Encode the approve function call
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VYRECASINO_ADDRESS, maxApproval],
      });

      // Use eth_sendTransaction (works with Rise Wallet Porto)
      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: accountAddress as `0x${string}`,
            to: tokenAddress,
            data,
            value: '0x0',
          },
        ],
      })) as `0x${string}`;

      logger.log('[AssetBalanceRow] Approval tx sent:', hash);

      await TokenService.publicClient.waitForTransactionReceipt({ hash });

      logger.log('[AssetBalanceRow] Approval confirmed!');

      await onApproved();
    } catch (error) {
      logger.error('[AssetBalanceRow] Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="dropdown-balance-row dropdown-balance-asset">
      <div className="asset-info">
        <span className="asset-icon">{asset.icon}</span>
        <span className="dropdown-balance-label">{asset.symbol}</span>
        {asset.isApproved ? (
          <span className="asset-approved" title="Approved for VyreCasino">
            ✓
          </span>
        ) : (
          <button
            className="asset-approve-btn"
            onClick={handleApprove}
            disabled={isApproving}
            title={`Approve ${asset.symbol} for VyreCasino`}
          >
            {isApproving ? '...' : '🔓'}
          </button>
        )}
      </div>
      <span className="dropdown-balance-value">
        {asset.balance} {asset.symbol === 'CHIP' && <ChipIcon size={16} />}
      </span>
    </div>
  );
}

interface SessionKeySectionProps {
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  isCreatingSession: boolean;
  onCreateSession: () => void;
  onRevokeSession: () => void;
}

function SessionKeySection({
  hasSessionKey,
  sessionExpiry,
  isCreatingSession,
  onCreateSession,
  onRevokeSession,
}: SessionKeySectionProps) {
  return (
    <div className="dropdown-section session-section">
      <div className="dropdown-session-header">
        <div className="dropdown-session-info">
          <span className="dropdown-session-icon">🔑</span>
          <div>
            <div className="dropdown-session-label">Fast Mode</div>
            <div className="dropdown-session-desc">
              {hasSessionKey ? 'Active' : 'Enable for instant gameplay'}
            </div>
          </div>
        </div>

        {hasSessionKey ? (
          <div className="dropdown-session-actions">
            <span className="dropdown-session-time">{formatSessionTime(sessionExpiry)}</span>
            <button className="dropdown-btn-revoke" onClick={onRevokeSession}>
              Revoke
            </button>
          </div>
        ) : (
          <button
            className="dropdown-btn-enable"
            onClick={onCreateSession}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? '...' : 'Enable'}
          </button>
        )}
      </div>
    </div>
  );
}
