/**
 * WalletTrigger - The clickable wallet button (presentation only)
 * Shows connection status, balance, and address
 */

import { shortenAddress, formatEthBalance } from '@/lib/formatters';

interface WalletTriggerProps {
  balance: string;
  address: string;
  hasSessionKey: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export function WalletTrigger({
  balance,
  address,
  hasSessionKey,
  isOpen,
  onClick,
}: WalletTriggerProps) {
  return (
    <button className="wallet-trigger" onClick={onClick}>
      <div className="wallet-trigger-left">
        <span className="wallet-trigger-dot" />
        <span className="wallet-trigger-balance">{formatEthBalance(balance, 4)}</span>
      </div>
      <div className="wallet-trigger-right">
        <span className="wallet-trigger-address">{shortenAddress(address)}</span>
        <span className={`wallet-trigger-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      {hasSessionKey && <span className="wallet-trigger-session">🔑</span>}
    </button>
  );
}
