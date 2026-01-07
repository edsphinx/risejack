/**
 * useGameNavigation - Navigate to game with token approval check
 *
 * ⚡ PERFORMANCE: Uses TokenService for cached reads
 * 🔧 MAINTAINABILITY: Central navigation logic for all game versions
 *
 * Flow:
 * 1. User clicks "Play" on CHIP/USDC version
 * 2. Check if wallet connected
 * 3. Check token allowance for VyreCasino
 * 4. If no allowance → show approval modal
 * 5. After approval → navigate to game
 * 6. ETH version → skip approval, navigate directly
 */

import { useState, useCallback } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { useWallet } from '@/context/WalletContext';
import { TokenService } from '@/services/token.service';
import { CHIP_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '@/lib/contract';
import { logger } from '@/lib/logger';

export type TokenType = 'chip' | 'usdc' | 'eth';

interface UseGameNavigationReturn {
  navigate: (tokenType: TokenType) => Promise<void>;
  isChecking: boolean;
  needsApproval: boolean;
  pendingToken: TokenType | null;
  clearPending: () => void;
}

const TOKEN_ADDRESSES: Record<TokenType, `0x${string}` | null> = {
  chip: CHIP_TOKEN_ADDRESS,
  usdc: USDC_TOKEN_ADDRESS,
  eth: null, // ETH doesn't need approval
};

const ROUTES: Record<TokenType, string> = {
  chip: '/games/vyrejack-chip',
  usdc: '/games/vyrejack-usdc',
  eth: '/games/vyrejack-eth',
};

export function useGameNavigation(): UseGameNavigationReturn {
  const [, setLocation] = useLocation();
  const wallet = useWallet();

  const [isChecking, setIsChecking] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [pendingToken, setPendingToken] = useState<TokenType | null>(null);

  const navigate = useCallback(
    async (tokenType: TokenType) => {
      // ETH version - no approval needed
      if (tokenType === 'eth') {
        logger.log('[useGameNavigation] ETH version, navigating directly');
        setLocation(ROUTES.eth);
        return;
      }

      // Check if wallet connected
      if (!wallet.address) {
        logger.log('[useGameNavigation] Wallet not connected, prompting connect');
        await wallet.connect();
        // After connect, user needs to click again
        return;
      }

      const tokenAddress = TOKEN_ADDRESSES[tokenType];
      if (!tokenAddress) {
        logger.error('[useGameNavigation] Invalid token type:', tokenType);
        return;
      }

      setIsChecking(true);
      setPendingToken(tokenType);

      try {
        // Check allowance
        const allowance = await TokenService.getAllowance(
          tokenAddress,
          wallet.address as `0x${string}`
        );

        logger.log('[useGameNavigation] Allowance check:', {
          token: tokenType,
          isApproved: allowance.isApproved,
          amount: allowance.amount.toString(),
        });

        if (allowance.isApproved) {
          // Has approval - navigate directly
          setNeedsApproval(false);
          setPendingToken(null);
          setLocation(ROUTES[tokenType]);
        } else {
          // Needs approval - show modal
          setNeedsApproval(true);
          // Don't navigate yet - wait for approval
        }
      } catch (error) {
        logger.error('[useGameNavigation] Error checking allowance:', error);
        // On error, try to navigate anyway (will fail in game if really no approval)
        setLocation(ROUTES[tokenType]);
      } finally {
        setIsChecking(false);
      }
    },
    [wallet.address, wallet.connect, setLocation]
  );

  const clearPending = useCallback(() => {
    setPendingToken(null);
    setNeedsApproval(false);
  }, []);

  return {
    navigate,
    isChecking,
    needsApproval,
    pendingToken,
    clearPending,
  };
}
