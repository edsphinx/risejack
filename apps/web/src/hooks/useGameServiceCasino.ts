/**
 * useGameServiceCasino - Read-only game state hook for VyreJackCore
 *
 * Single responsibility: read game state from VyreJackCore contract
 *
 * ⚡ PERFORMANCE: NO POLLING!
 * Game state updates come via:
 * 1. WebSocket events (GameResolved, CardDealt)
 * 2. Manual refetch after user actions
 *
 * This follows the same pattern as useContractState for VyreJack ETH.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { GameService } from '@/services';
import { logger } from '@/lib/logger';
import type { VyreJackGame } from '@vyrejack/shared';

export interface UseGameServiceCasinoReturn {
  /** Current game data from contract */
  game: VyreJackGame | null;
  /** Player hand value */
  playerValue: number;
  /** Dealer visible hand value */
  dealerValue: number;
  /** Is currently fetching */
  isFetching: boolean;
  /** Refetch game state (force=true bypasses throttle) */
  refetch: (force?: boolean) => Promise<void>;
}

/**
 * Hook for reading VyreJackCore game state
 * NO POLLING - only fetches on demand
 */
export function useGameServiceCasino(player: `0x${string}` | null): UseGameServiceCasinoReturn {
  const [game, setGame] = useState<VyreJackGame | null>(null);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // Use ref to avoid stale closure in callbacks
  const playerRef = useRef(player);
  playerRef.current = player;

  // Throttle guard - prevent excessive refetch calls
  const lastFetchRef = useRef<number>(0);
  const FETCH_THROTTLE_MS = 500;

  // Fetch game state - stable callback (no deps that change)
  // force=true bypasses throttle (used after game actions)
  const refetch = useCallback(async (force = false) => {
    const addr = playerRef.current;
    if (!addr) return;

    // Throttle: skip if called too recently (unless forced)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < FETCH_THROTTLE_MS) {
      return;
    }
    lastFetchRef.current = now;

    setIsFetching(true);
    try {
      const result = await GameService.getFullGameData(addr);

      if (result) {
        logger.log('[GameServiceCasino] 🔍 Game state:', {
          state: result.game.state,
          playerCards: result.game.playerCards,
          dealerCards: result.game.dealerCards,
          bet: result.game.bet.toString(),
        });
        setGame(result.game);
        setPlayerValue(result.playerValue.value);
        setDealerValue(result.dealerValue);
      } else {
        setGame(null);
        setPlayerValue(0);
        setDealerValue(0);
      }
    } catch (err) {
      logger.error('[GameServiceCasino] Failed to fetch game state:', err);
    } finally {
      setIsFetching(false);
    }
  }, []); // Empty deps - uses ref for player address

  // Initial fetch only when player changes
  useEffect(() => {
    if (!player) {
      setGame(null);
      setPlayerValue(0);
      setDealerValue(0);
      return;
    }

    // Single fetch on connect - NO POLLING!
    logger.log('[GameServiceCasino] 🔍 Initial fetch for:', player);
    refetch();
  }, [player, refetch]);

  return {
    game,
    playerValue,
    dealerValue,
    isFetching,
    refetch,
  };
}
