/**
 * TokenApprovalModal - Modal for approving tokens before playing
 *
 * Shows when user tries to play CHIP/USDC version without approval
 */

import { useState } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { useWallet } from '@/context/WalletContext';
import { TokenService } from '@/services/token.service';
import { getProvider } from '@/lib/riseWallet';
import {
  CHIP_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  VYRECASINO_ADDRESS,
  riseTestnet,
} from '@/lib/contract';
import { ERC20_ABI } from '@vyrejack/shared';
import { logger } from '@/lib/logger';
import type { TokenType } from '@/hooks/useGameNavigation';
import './styles/approval-modal.css';

interface TokenApprovalModalProps {
  tokenType: TokenType;
  onClose: () => void;
  onApproved: () => void;
}

const TOKEN_INFO: Record<
  Exclude<TokenType, 'eth'>,
  { name: string; icon: string; address: `0x${string}` }
> = {
  chip: { name: 'CHIP', icon: '🟡', address: CHIP_TOKEN_ADDRESS },
  usdc: { name: 'USDC', icon: '💵', address: USDC_TOKEN_ADDRESS },
};

const ROUTES: Record<TokenType, string> = {
  chip: '/games/vyrejack-chip',
  usdc: '/games/vyrejack-usdc',
  eth: '/games/vyrejack-eth',
};

export function TokenApprovalModal({ tokenType, onClose, onApproved }: TokenApprovalModalProps) {
  const [, setLocation] = useLocation();
  const wallet = useWallet();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (tokenType === 'eth') return null;

  const tokenInfo = TOKEN_INFO[tokenType];

  const handleApprove = async () => {
    if (!wallet.address) return;

    setIsApproving(true);
    setError(null);

    try {
      // Get Rise Wallet provider (not window.ethereum)
      const provider = getProvider();

      const { createWalletClient, custom } = await import('viem');

      const walletClient = createWalletClient({
        chain: riseTestnet,
        transport: custom(provider),
      });

      // Request unlimited approval
      const maxApproval = BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      );

      logger.log('[TokenApprovalModal] Requesting approval for:', tokenInfo.name);

      const hash = await walletClient.writeContract({
        address: tokenInfo.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VYRECASINO_ADDRESS, maxApproval],
        account: wallet.address as `0x${string}`,
      });

      logger.log('[TokenApprovalModal] Approval tx sent:', hash);

      // Wait for confirmation
      await TokenService.publicClient.waitForTransactionReceipt({ hash });

      logger.log('[TokenApprovalModal] Approval confirmed!');

      // Navigate to game
      onApproved();
      setLocation(ROUTES[tokenType]);
    } catch (err) {
      logger.error('[TokenApprovalModal] Approval failed:', err);
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="approval-modal-overlay" onClick={onClose}>
      <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="approval-icon">{tokenInfo.icon}</div>

        <h2 className="approval-title">Approve {tokenInfo.name}</h2>

        <p className="approval-description">
          To play VyreJack with {tokenInfo.name}, you need to approve the casino contract to spend
          your tokens. This is a one-time approval.
        </p>

        {error && (
          <div className="approval-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="approval-actions">
          <button className="approval-btn-cancel" onClick={onClose} disabled={isApproving}>
            Cancel
          </button>
          <button className="approval-btn-approve" onClick={handleApprove} disabled={isApproving}>
            {isApproving ? 'Approving...' : `Approve ${tokenInfo.name}`}
          </button>
        </div>

        <p className="approval-note">
          💡 This allows VyreCasino to deduct bets from your {tokenInfo.name} balance.
        </p>
      </div>
    </div>
  );
}
