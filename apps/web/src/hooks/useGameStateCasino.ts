/**
 * useGameStateCasino - Compositor hook for VyreJackCore game state
 *
 * Combines:
 * - Read-only game state from useGameServiceCasino (NO POLLING)
 * - WebSocket events from useGameEventsCasino (real-time updates)
 * - Card accumulation from CardDealt events
 * - Snapshot mechanism for result preservation
 *
 * This follows the same architecture as useGameState for VyreJack ETH.
 *
 * ⚡ PERFORMANCE:
 * - NO POLLING - WebSocket events trigger state updates
 * - Card accumulation for smooth UI updates
 * - 50ms delay allows all CardDealt events to arrive before processing GameResolved
 *
 * 🔧 MAINTAINABILITY:
 * - Single compositor hook combines all state sources
 * - Clean separation: reads (service) vs events (WebSocket) vs writes (actions)
 * - Reusable for CHIP and USDC games
 */

import { useState, useCallback, useRef, useMemo } from 'preact/hooks';
import { useGameServiceCasino } from './useGameServiceCasino';
import {
  useGameEventsCasino,
  type GameResolvedEvent,
  type CardDealtEvent,
} from './useGameEventsCasino';
import { logger } from '@/lib/logger';
import type { VyreJackGame, GameResult } from '@vyrejack/shared';

// =============================================================================
// TYPES
// =============================================================================

// VyreJackGameState enum values (from VyreJackCore.sol)
const IDLE = 0;
const PLAYER_TURN = 2;
// Final states
const PLAYER_WIN = 5;
const DEALER_WIN = 6;
const PUSH = 7;
const PLAYER_BLACKJACK = 8;

// Card accumulator for smooth display
interface CardAccumulator {
  playerCards: number[];
  dealerCards: number[];
  dealerHiddenCard: number | null; // Second card, revealed at end
}

// Snapshot of hand when game ends
interface HandSnapshot {
  playerCards: number[];
  dealerCards: number[];
  playerValue: number;
  dealerValue: number;
  bet: bigint;
  result: GameResult;
  payout: bigint;
}

export interface UseGameStateCasinoReturn {
  // Game state
  game: VyreJackGame | null;
  playerValue: number;
  dealerValue: number;
  isFetching: boolean;

  // Card accumulator for display
  accumulatedCards: CardAccumulator;

  // Last game result with snapshot
  lastGameResult: HandSnapshot | null;
  clearLastResult: () => void;

  // WebSocket status
  isEventConnected: boolean;

  // Derived state
  hasActiveGame: boolean;
  isPlayerTurn: boolean;
  isGameEnded: boolean;
  showingResult: boolean;

  // Actions
  refetch: () => Promise<void>;
  snapshotCards: () => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isFinalState(state: number | undefined): boolean {
  return (
    state === PLAYER_WIN || state === DEALER_WIN || state === PUSH || state === PLAYER_BLACKJACK
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useGameStateCasino(player: `0x${string}` | null): UseGameStateCasinoReturn {
  // Read-only game state (NO POLLING)
  const service = useGameServiceCasino(player);

  // Last game result snapshot
  const [lastGameResult, setLastGameResult] = useState<HandSnapshot | null>(null);

  // Card accumulator - tracks cards from CardDealt events
  const [accumulatedCards, setAccumulatedCards] = useState<CardAccumulator>({
    playerCards: [],
    dealerCards: [],
    dealerHiddenCard: null,
  });

  // Snapshot ref - backup of cards before action
  const cardSnapshotRef = useRef<CardAccumulator | null>(null);

  // Refs to get latest values in delayed callback
  const accumulatedCardsRef = useRef(accumulatedCards);
  accumulatedCardsRef.current = accumulatedCards;

  const serviceRef = useRef(service);
  serviceRef.current = service;

  // Take snapshot of current cards (call before actions)
  const snapshotCards = useCallback(() => {
    const snapshot: CardAccumulator = {
      playerCards:
        accumulatedCards.playerCards.length > 0
          ? [...accumulatedCards.playerCards]
          : [...(service.game?.playerCards ?? [])],
      dealerCards:
        accumulatedCards.dealerCards.length > 0
          ? [...accumulatedCards.dealerCards]
          : [...(service.game?.dealerCards ?? [])],
      dealerHiddenCard: accumulatedCards.dealerHiddenCard,
    };
    cardSnapshotRef.current = snapshot;
    logger.log('[GameStateCasino] Cards snapshot taken:', snapshot);
  }, [accumulatedCards, service.game]);

  // Handle CardDealt event - accumulate cards
  const handleCardDealt = useCallback(
    (event: CardDealtEvent) => {
      logger.log('[GameStateCasino] CardDealt:', event);

      setAccumulatedCards((prev) => {
        if (event.isDealer) {
          // Dealer card
          if (!event.faceUp && prev.dealerCards.length === 1) {
            // This is the hidden second card
            return { ...prev, dealerHiddenCard: event.card };
          }
          return { ...prev, dealerCards: [...prev.dealerCards, event.card] };
        } else {
          // Player card
          return { ...prev, playerCards: [...prev.playerCards, event.card] };
        }
      });

      // Also refetch contract state
      service.refetch();
    },
    [service.refetch]
  );

  // Handle GameResolved event from WebSocket
  const handleGameResolved = useCallback(
    (event: GameResolvedEvent) => {
      logger.log('[GameStateCasino] GameResolved:', event);

      // Delay 50ms to allow CardDealt events to be processed first
      // Rise is very fast, events may arrive nearly simultaneously
      setTimeout(() => {
        const currentAccumulated = accumulatedCardsRef.current;
        const currentService = serviceRef.current;
        const currentSnapshot = cardSnapshotRef.current;

        // Get cards from multiple sources (best available)
        // Priority: accumulated > snapshot > contract state
        let playerCards: number[] = [];
        let dealerCards: number[] = [];

        if (currentAccumulated.playerCards.length >= 2) {
          playerCards = [...currentAccumulated.playerCards];
          logger.log('[GameStateCasino] Using accumulated player cards:', playerCards);
        } else if (currentSnapshot?.playerCards.length) {
          playerCards = [...currentSnapshot.playerCards];
          logger.log('[GameStateCasino] Using snapshot player cards:', playerCards);
        } else if (currentService.game?.playerCards?.length) {
          playerCards = [...currentService.game.playerCards];
          logger.log('[GameStateCasino] Using contract player cards:', playerCards);
        }

        if (currentAccumulated.dealerCards.length >= 1) {
          dealerCards = [...currentAccumulated.dealerCards];
          // Add hidden card if exists
          if (
            currentAccumulated.dealerHiddenCard !== null &&
            !dealerCards.includes(currentAccumulated.dealerHiddenCard)
          ) {
            dealerCards.splice(1, 0, currentAccumulated.dealerHiddenCard);
          }
          logger.log('[GameStateCasino] Using accumulated dealer cards:', dealerCards);
        } else if (currentSnapshot?.dealerCards.length) {
          dealerCards = [...currentSnapshot.dealerCards];
          if (currentSnapshot.dealerHiddenCard !== null) {
            dealerCards.splice(1, 0, currentSnapshot.dealerHiddenCard);
          }
          logger.log('[GameStateCasino] Using snapshot dealer cards:', dealerCards);
        } else if (currentService.game?.dealerCards?.length) {
          dealerCards = [...currentService.game.dealerCards];
          logger.log('[GameStateCasino] Using contract dealer cards:', dealerCards);
        }

        setLastGameResult({
          result: event.result,
          payout: event.payout,
          playerValue: event.playerFinalValue,
          dealerValue: event.dealerFinalValue,
          playerCards,
          dealerCards,
          bet: currentService.game?.bet ?? 0n,
        });

        // Clear accumulated cards for next game
        setAccumulatedCards({ playerCards: [], dealerCards: [], dealerHiddenCard: null });
        cardSnapshotRef.current = null;

        // Refetch to update contract state
        currentService.refetch();
      }, 50); // 50ms delay to allow CardDealt events to arrive
    },
    [] // No dependencies - we use refs for current values
  );

  const clearLastResult = useCallback(() => {
    setLastGameResult(null);
    // Reset accumulated cards for new game
    setAccumulatedCards({ playerCards: [], dealerCards: [], dealerHiddenCard: null });
    cardSnapshotRef.current = null;
  }, []);

  // WebSocket listener for game events
  const { isConnected: isEventConnected } = useGameEventsCasino(player, {
    onGameResolved: handleGameResolved,
    onCardDealt: handleCardDealt,
  });

  // Derived state
  const isGameEnded = useMemo(() => {
    return isFinalState(service.game?.state);
  }, [service.game]);

  const hasActiveGame = useMemo(() => {
    return (
      service.game !== null && service.game.state !== IDLE && !isFinalState(service.game.state)
    );
  }, [service.game]);

  const isPlayerTurn = useMemo(() => {
    return service.game?.state === PLAYER_TURN;
  }, [service.game]);

  const showingResult = lastGameResult !== null;

  return {
    // Game state
    game: service.game,
    playerValue: service.playerValue,
    dealerValue: service.dealerValue,
    isFetching: service.isFetching,

    // Card accumulator
    accumulatedCards,

    // Last result with snapshot
    lastGameResult,
    clearLastResult,

    // WebSocket
    isEventConnected,

    // Derived state
    hasActiveGame,
    isPlayerTurn,
    isGameEnded,
    showingResult,

    // Actions
    refetch: service.refetch,
    snapshotCards,
  };
}
