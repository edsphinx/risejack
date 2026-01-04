/**
 * FaucetModal - CHIP Token Faucet Modal
 *
 * Pure presentation component for the faucet UI.
 * Uses useFaucet hook for state management.
 */

import { formatEther } from 'viem';
import { useFaucet } from '@/hooks/useFaucet';
import { useWallet } from '@/context/WalletContext';
import './styles/faucet.css';

interface FaucetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Format seconds into "Xm Ys" format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function FaucetModal({ isOpen, onClose }: FaucetModalProps) {
  const { isConnected } = useWallet();
  const faucet = useFaucet();

  // Handle overlay click to close
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const formattedAmount = faucet.status ? formatEther(faucet.status.amountPerClaim) : '1000';
  const formattedBalance = faucet.status ? formatEther(faucet.status.faucetBalance) : '0';

  return (
    <div className="faucet-overlay" onClick={handleOverlayClick}>
      <div className="faucet-modal">
        <button className="faucet-close" onClick={onClose}>
          ×
        </button>

        <div className="faucet-header">
          <span className="faucet-icon">🚰</span>
          <span className="faucet-title">CHIP Faucet</span>
        </div>

        <p className="faucet-description">Get free CHIP tokens to play RiseJack on testnet!</p>

        {!isConnected ? (
          <FaucetNotConnected />
        ) : faucet.isLoading ? (
          <FaucetLoading />
        ) : (
          <>
            <FaucetInfo amountPerClaim={formattedAmount} />

            {faucet.canClaim ? (
              <FaucetClaimButton onClick={faucet.claim} isLoading={faucet.isClaiming} />
            ) : (
              <FaucetCooldown timeRemaining={faucet.timeUntilClaim} />
            )}

            {faucet.txHash && <FaucetSuccess txHash={faucet.txHash} />}
            {faucet.error && <FaucetError message={faucet.error} />}

            <FaucetFooter balance={formattedBalance} />
          </>
        )}
      </div>
    </div>
  );
}

// Sub-components for clean separation

function FaucetNotConnected() {
  return <div className="faucet-not-connected">⚡ Connect wallet to claim</div>;
}

function FaucetLoading() {
  return <div className="faucet-loading">Loading...</div>;
}

interface FaucetInfoProps {
  amountPerClaim: string;
}

function FaucetInfo({ amountPerClaim }: FaucetInfoProps) {
  return (
    <div className="faucet-info">
      <div className="faucet-stat">
        <span className="faucet-label">You Get</span>
        <span className="faucet-value-large">{Number(amountPerClaim).toLocaleString()} CHIP</span>
      </div>
    </div>
  );
}

interface FaucetClaimButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

function FaucetClaimButton({ onClick, isLoading }: FaucetClaimButtonProps) {
  return (
    <button className="faucet-claim-btn" onClick={onClick} disabled={isLoading}>
      {isLoading ? (
        <>
          <span className="faucet-spinner">⏳</span>
          Claiming...
        </>
      ) : (
        <>
          <span>🎁</span>
          Claim Now
        </>
      )}
    </button>
  );
}

interface FaucetCooldownProps {
  timeRemaining: number;
}

function FaucetCooldown({ timeRemaining }: FaucetCooldownProps) {
  return (
    <div className="faucet-cooldown">
      <span className="cooldown-icon">⏱️</span>
      <span>Next claim in {formatTime(timeRemaining)}</span>
    </div>
  );
}

interface FaucetSuccessProps {
  txHash: string;
}

function FaucetSuccess({ txHash }: FaucetSuccessProps) {
  return (
    <div className="faucet-success">
      ✅ Claimed!{' '}
      <a
        href={`https://explorer.testnet.riselabs.xyz/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View TX
      </a>
    </div>
  );
}

interface FaucetErrorProps {
  message: string;
}

function FaucetError({ message }: FaucetErrorProps) {
  return <div className="faucet-error">❌ {message}</div>;
}

interface FaucetFooterProps {
  balance: string;
}

function FaucetFooter({ balance }: FaucetFooterProps) {
  return (
    <div className="faucet-footer">Faucet Balance: {Number(balance).toLocaleString()} CHIP</div>
  );
}

// Re-export hook for convenience
export { useFaucetCanClaim } from '@/hooks/useFaucet';
