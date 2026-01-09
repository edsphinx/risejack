/**
 * useGameNavigation - Unified entry point for VyreJack USDC
 *
 * Simplified flow:
 * 1. Check if wallet connected → if not, prompt connect
 * 2. Navigate directly to game
 * 3. Game page handles USDC approval via Rise Wallet's native UI
 *
 * No custom approval modal - Rise Wallet has its own approval UI
 */

import { useCallback } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { useWallet } from '@/context/WalletContext';
import { logger } from '@/lib/logger';

// For backwards compatibility
export type TokenType = 'chip' | 'usdc' | 'eth';

interface UseGameNavigationReturn {
  /** Navigate to VyreJack (handles connection) */
  navigate: (tokenType?: TokenType) => Promise<void>;
  /** Direct navigation without any checks */
  navigateToGame: () => void;
}

const GAME_ROUTE = '/vyrejack';

export function useGameNavigation(): UseGameNavigationReturn {
  const [, setLocation] = useLocation();
  const wallet = useWallet();

  // Direct navigation
  const navigateToGame = useCallback(() => {
    setLocation(GAME_ROUTE);
  }, [setLocation]);

  // Main navigate function - just handles connection
  const navigate = useCallback(
    async (_tokenType: TokenType = 'usdc') => {
      // Check if wallet connected
      if (!wallet.address) {
        logger.log('[useGameNavigation] Wallet not connected, prompting connect');
        await wallet.connect();

        // After connect succeeds, navigate
        if (wallet.address) {
          setLocation(GAME_ROUTE);
        }
        return;
      }

      // Already connected - navigate directly
      // USDC approval will be handled by Rise Wallet when needed
      logger.log('[useGameNavigation] Navigating to game');
      setLocation(GAME_ROUTE);
    },
    [wallet.address, wallet.connect, setLocation]
  );

  return {
    navigate,
    navigateToGame,
  };
}
