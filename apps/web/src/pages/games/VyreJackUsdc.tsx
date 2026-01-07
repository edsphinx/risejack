/**
 * VyreJack USDC Version
 *
 * Uses VyreCasino architecture with USDC betting token.
 * Checks token approval before allowing gameplay.
 */
import { useState, useEffect } from 'preact/hooks';
import { GameBoardCasino } from '@/components/game/GameBoardCasino';
import { TokenApprovalModal } from '@/components/home/TokenApprovalModal';
import { useWallet } from '@/context/WalletContext';
import { TokenService } from '@/services/token.service';
import { USDC_TOKEN_ADDRESS } from '@/lib/contract';
import { logger } from '@/lib/logger';

export function VyreJackUsdc() {
  const wallet = useWallet();
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check approval status when wallet connects
  useEffect(() => {
    const checkApproval = async () => {
      if (!wallet.address) {
        setIsApproved(null);
        return;
      }

      setIsChecking(true);
      try {
        const allowance = await TokenService.getAllowance(
          USDC_TOKEN_ADDRESS,
          wallet.address as `0x${string}`
        );
        logger.log('[VyreJackUsdc] Approval check:', allowance.isApproved);
        setIsApproved(allowance.isApproved);
      } catch (error) {
        logger.error('[VyreJackUsdc] Error checking approval:', error);
        setIsApproved(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkApproval();
  }, [wallet.address]);

  const handleApproved = async () => {
    // Re-check approval after user approves
    if (wallet.address) {
      const allowance = await TokenService.getAllowance(
        USDC_TOKEN_ADDRESS,
        wallet.address as `0x${string}`
      );
      setIsApproved(allowance.isApproved);
    }
  };

  return (
    <div className="vyrejack-page relative">
      {/* Game Board - only visible when approved */}
      {wallet.isConnected && isApproved && (
        <GameBoardCasino token={USDC_TOKEN_ADDRESS} tokenSymbol="USDC" />
      )}

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">💵</div>
            <h2 className="text-3xl font-black mb-4 text-white">VyreJack USDC</h2>
            <p className="text-blue-400 mb-2 font-semibold">Play with Stablecoins</p>
            <p className="text-gray-400 mb-8">Bet with USDC for stable value gameplay.</p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 shadow-2xl shadow-blue-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Wallet'}
            </button>
          </div>
        </div>
      )}

      {/* Checking Approval Overlay */}
      {wallet.isConnected && isChecking && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-5xl mb-4 animate-pulse">🔍</div>
            <p className="text-white text-lg">Checking permissions...</p>
          </div>
        </div>
      )}

      {/* Approval Modal - shown when connected but not approved */}
      {wallet.isConnected && isApproved === false && !isChecking && (
        <TokenApprovalModal
          tokenType="usdc"
          onClose={() => window.history.back()}
          onApproved={handleApproved}
        />
      )}
    </div>
  );
}

export default VyreJackUsdc;
