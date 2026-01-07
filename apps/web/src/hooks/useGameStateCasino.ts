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
 * 6. Result snapshot preserved for display
 *
 * 🔧 MAINTAINABILITY:
 * - Uses GameService for all reads (DRY)
 * - Types from @vyrejack/shared (centralized)
 * - Clean separation from action hooks
 * - Business logic (result calculation) in hook, not component
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { useTabFocus } from './useTabFocus';
import { GameService } from '@/services';
import { logger } from '@/lib/logger';
import type { VyreJackGame, GameResult } from '@vyrejack/shared';

interface UseGameStateCasinoOptions {
  /** Fast poll interval during active game (default: 2000ms) */
  activePollInterval?: number;
  /** Slow poll interval when idle (default: 10000ms) */
  idlePollInterval?: number;
  /** How long to display result before clearing (default: 4000ms) */
  resultDisplayDuration?: number;
}

// Snapshot of hand when game ends for display during result
interface HandSnapshot {
  playerCards: readonly number[];
  dealerCards: readonly number[];
  playerValue: number;
  dealerValue: number;
  bet: bigint;
  result: GameResult;
}

interface UseGameStateCasinoReturn {
  // Current or snapshot game data
  game: VyreJackGame | null;
  playerValue: number;
  dealerValue: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Derived state
  hasActiveGame: boolean;
  isPlayerTurn: boolean;
  isGameEnded: boolean;

  // Result display
  showingResult: boolean;
  gameResult: GameResult;
  lastHand: HandSnapshot | null;
  clearResult: () => void;
}

// VyreJackGameState enum values
const PLAYER_TURN = 2;
const GAME_ENDED = 5;

/**
 * Calculate game result from hand values
 */
function calculateResult(
  playerValue: number,
  dealerValue: number,
  playerCards: readonly number[]
): GameResult {
  // Check for blackjack (21 with 2 cards)
  if (playerValue === 21 && playerCards.length === 2) {
    return 'blackjack';
  }
  // Player bust
  if (playerValue > 21) {
    return 'lose';
  }
  // Dealer bust
  if (dealerValue > 21) {
    return 'win';
  }
  // Compare values
  if (playerValue > dealerValue) {
    return 'win';
  }
  if (playerValue < dealerValue) {
    return 'lose';
  }
  // Equal values = push
  return 'push';
}

/**
 * Hook for reactive VyreJackCore game state with result preservation
 *
 * @example
 * const { game, isPlayerTurn, showingResult, gameResult, clearResult } = useGameStateCasino(account);
 */
export function useGameStateCasino(
  player: `0x${string}` | null,
  options: UseGameStateCasinoOptions = {}
): UseGameStateCasinoReturn {
  const {
    activePollInterval = 2000,
    idlePollInterval = 10000,
    resultDisplayDuration = 4000,
  } = options;

  const [game, setGame] = useState<VyreJackGame | null>(null);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result display state
  const [lastHand, setLastHand] = useState<HandSnapshot | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGameIdRef = useRef<string | null>(null);

  const isActiveTab = useTabFocus();

  // Fetch game state
  const refresh = useCallback(async () => {
    if (!player) {
      setGame(null);
      setPlayerValue(0);
      setDealerValue(0);
      return;
    }

    // Don't refresh while showing result
    if (showingResult) return;

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
  }, [player, showingResult]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ⚡ OPTIMIZATION: Memoized derived values
  const isGameEnded = useMemo(() => {
    return game?.state === GAME_ENDED;
  }, [game]);

  const hasActiveGame = useMemo(() => {
    return game !== null && game.state !== GAME_ENDED;
  }, [game]);

  const isPlayerTurn = useMemo(() => {
    return game?.state === PLAYER_TURN;
  }, [game]);

  // Detect game end and create snapshot
  useEffect(() => {
    if (!isGameEnded || !game) return;

    // Create unique game ID to prevent duplicate snapshots
    const gameId = `${game.player}-${game.timestamp}-${game.bet}`;
    if (lastGameIdRef.current === gameId) return;
    lastGameIdRef.current = gameId;

    logger.log('[useGameStateCasino] Game ended, creating snapshot');

    const result = calculateResult(playerValue, dealerValue, game.playerCards);

    // Create snapshot before game data resets
    setLastHand({
      playerCards: [...game.playerCards],
      dealerCards: [...game.dealerCards],
      playerValue,
      dealerValue,
      bet: game.bet,
      result,
    });
    setShowingResult(true);

    // Clear result after delay
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    resultTimeoutRef.current = setTimeout(() => {
      logger.log('[useGameStateCasino] Auto-clearing result display');
      setShowingResult(false);
      setLastHand(null);
      lastGameIdRef.current = null;
    }, resultDisplayDuration);
  }, [isGameEnded, game, playerValue, dealerValue, resultDisplayDuration]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  // Manual clear result (for "New Game" button)
  const clearResult = useCallback(() => {
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    setShowingResult(false);
    setLastHand(null);
    lastGameIdRef.current = null;
  }, []);

  // ⚡ OPTIMIZATION: Adaptive polling - fast when active, slow when idle
  useEffect(() => {
    if (!isActiveTab || !player || showingResult) {
      return;
    }

    // Use faster polling during active game
    const interval = hasActiveGame ? activePollInterval : idlePollInterval;
    const timer = setInterval(refresh, interval);
    return () => clearInterval(timer);
  }, [
    isActiveTab,
    player,
    hasActiveGame,
    showingResult,
    activePollInterval,
    idlePollInterval,
    refresh,
  ]);

  // Game result (from snapshot when showing result)
  const gameResult: GameResult = showingResult && lastHand ? lastHand.result : null;

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
    showingResult,
    gameResult,
    lastHand,
    clearResult,
  };
}
