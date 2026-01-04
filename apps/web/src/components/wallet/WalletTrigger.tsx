/**
 * WalletTrigger - The clickable wallet button (presentation only)
 * Shows connection status, CHIP balance, and address
 */

import { shortenAddress } from '@/lib/formatters';
import { ChipIcon } from '@/components/icons/ChipIcon';

interface WalletTriggerProps {
  chipBalance: string; // CHIP balance (display formatted)
  address: string;
  hasSessionKey: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export function WalletTrigger({
  chipBalance,
  address,
  hasSessionKey,
  isOpen,
  onClick,
}: WalletTriggerProps) {
  return (
    <button className="wallet-trigger" onClick={onClick}>
      <div className="wallet-trigger-left">
        <span className="wallet-trigger-dot" />
        {/* CHIP balance: amount + chip icon */}
        <span className="wallet-trigger-balance wallet-trigger-chip">
          <span>{chipBalance}</span>
          <ChipIcon size={16} />
        </span>
      </div>
      <div className="wallet-trigger-right">
        <span className="wallet-trigger-address">{shortenAddress(address)}</span>
        <span className={`wallet-trigger-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      {hasSessionKey && <span className="wallet-trigger-session">🔑</span>}
    </button>
  );
}
