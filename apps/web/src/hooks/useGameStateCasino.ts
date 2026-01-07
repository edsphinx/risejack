/**
 * useGameStateCasino Hook
 *
 * Reactive game state from VyreJackCore with optimized polling.
 *
 * ⚡ PERFORMANCE OPTIMIZATIONS:
 * 1. Fast polling during active game (2s)
 * 2. Slow polling when idle (10s)
 * 3. No polling when no address
 * 4. Tab visibility aware
 * 5. Memoized derived values
 *
 * 🔧 MAINTAINABILITY:
 * - Uses GameService for all reads (DRY)
 * - Types from @vyrejack/shared (centralized)
 * - Clean separation from action hooks
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useTabFocus } from './useTabFocus';
import { GameService } from '@/services';
import type { VyreJackGame } from '@vyrejack/shared';

interface UseGameStateCasinoOptions {
  /** Fast poll interval during active game (default: 2000ms) */
  activePollInterval?: number;
  /** Slow poll interval when idle (default: 10000ms) */
  idlePollInterval?: number;
}

interface UseGameStateCasinoReturn {
  game: VyreJackGame | null;
  playerValue: number;
  dealerValue: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Whether player has active game */
  hasActiveGame: boolean;
  /** Whether it's player's turn */
  isPlayerTurn: boolean;
  /** Whether game just ended */
  isGameEnded: boolean;
}

/**
 * Hook for reactive VyreJackCore game state
 *
 * @example
 * const { game, isPlayerTurn, refresh } = useGameStateCasino(account);
 */
export function useGameStateCasino(
  player: `0x${string}` | null,
  options: UseGameStateCasinoOptions = {}
): UseGameStateCasinoReturn {
  const { activePollInterval = 2000, idlePollInterval = 10000 } = options;

  const [game, setGame] = useState<VyreJackGame | null>(null);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActiveTab = useTabFocus();

  // Import GameState enum value for comparison
  const PLAYER_TURN = 2; // VyreJackGameState.PlayerTurn
  const GAME_ENDED = 5; // VyreJackGameState.GameEnded

  // Fetch game state
  const refresh = useCallback(async () => {
    if (!player) {
      setGame(null);
      setPlayerValue(0);
      setDealerValue(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await GameService.getFullGameData(player);

      if (result) {
        setGame(result.game);
        setPlayerValue(result.playerValue.value);
        setDealerValue(result.dealerValue);
      } else {
        setGame(null);
        setPlayerValue(0);
        setDealerValue(0);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch game';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [player]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ⚡ OPTIMIZATION: Adaptive polling - fast when active, slow when idle
  const hasActiveGame = useMemo(() => {
    return game !== null && game.state !== GAME_ENDED;
  }, [game]);

  useEffect(() => {
    if (!isActiveTab || !player) {
      return;
    }

    // Use faster polling during active game
    const interval = hasActiveGame ? activePollInterval : idlePollInterval;
    const timer = setInterval(refresh, interval);
    return () => clearInterval(timer);
  }, [isActiveTab, player, hasActiveGame, activePollInterval, idlePollInterval, refresh]);

  // ⚡ OPTIMIZATION: Memoized derived values
  const isPlayerTurn = useMemo(() => {
    return game?.state === PLAYER_TURN;
  }, [game]);

  const isGameEnded = useMemo(() => {
    return game?.state === GAME_ENDED;
  }, [game]);

  return {
    game,
    playerValue,
    dealerValue,
    isLoading,
    error,
    refresh,
    hasActiveGame,
    isPlayerTurn,
    isGameEnded,
  };
}
