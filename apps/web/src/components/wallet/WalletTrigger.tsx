/**
 * WalletTrigger - The clickable wallet button (presentation only)
 * Shows connection status, ETH balance, and address
 */

import { shortenAddress, formatEthBalance } from '@/lib/formatters';

interface WalletTriggerProps {
  ethBalance: string; // ETH balance (raw)
  address: string;
  hasSessionKey: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export function WalletTrigger({
  ethBalance,
  address,
  hasSessionKey,
  isOpen,
  onClick,
}: WalletTriggerProps) {
  return (
    <button className="wallet-trigger" onClick={onClick}>
      <div className="wallet-trigger-left">
        <span className="wallet-trigger-dot" />
        {/* ETH balance */}
        <span className="wallet-trigger-balance wallet-trigger-eth">
          <span>{formatEthBalance(ethBalance, 4)}</span>
          <span className="eth-symbol">Ξ</span>
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
