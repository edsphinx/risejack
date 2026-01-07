/**
 * WalletDropdown - The dropdown panel showing wallet details (presentation only)
 * All event handlers are passed as props
 */

import { formatEthBalance, formatSessionTime } from '@/lib/formatters';
import { ChipIcon } from '@/components/icons/ChipIcon';
import type { TimeRemaining } from '@vyrejack/shared';

interface WalletDropdownProps {
  address: string;
  balance: string; // ETH balance
  chipBalance: string; // CHIP balance (display formatted)
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  copied: boolean;
  isCreatingSession: boolean;
  onCopyAddress: () => void;
  onCreateSession: () => void;
  onRevokeSession: () => void;
  onDisconnect: () => void;
  onResetWallet: () => void;
}

export function WalletDropdown({
  address,
  balance,
  chipBalance,
  hasSessionKey,
  sessionExpiry,
  copied,
  isCreatingSession,
  onCopyAddress,
  onCreateSession,
  onRevokeSession,
  onDisconnect,
  onResetWallet,
}: WalletDropdownProps) {
  return (
    <div className="wallet-dropdown">
      {/* Wallet Info Section */}
      <WalletInfoSection
        address={address}
        balance={balance}
        chipBalance={chipBalance}
        copied={copied}
        onCopyAddress={onCopyAddress}
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
  chipBalance: string;
  copied: boolean;
  onCopyAddress: () => void;
}

function WalletInfoSection({
  address,
  balance,
  chipBalance,
  copied,
  onCopyAddress,
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

      {/* CHIP Balance: amount + chip icon */}
      <div className="dropdown-balance-row dropdown-balance-chip">
        <span className="dropdown-balance-label">CHIP Balance</span>
        <span className="dropdown-balance-value">
          {chipBalance} <ChipIcon size={18} />
        </span>
      </div>

      {/* ETH Balance */}
      <div className="dropdown-balance-row dropdown-balance-eth">
        <span className="dropdown-balance-label">ETH Balance</span>
        <span className="dropdown-balance-value">{formatEthBalance(balance, 6)} Ξ</span>
      </div>
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
