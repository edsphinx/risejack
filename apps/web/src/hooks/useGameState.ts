/**
 * useGameState - Compositor hook for game state and actions
 *
 * Implements hybrid card tracking:
 * 1. Accumulates CardDealt events for smooth display
 * 2. Takes snapshot before actions as fallback
 * 3. Preserves cards at game end for result display
 */

import { useState, useCallback, useRef } from 'preact/hooks';
import { useContractState } from './useContractState';
import { useGameActions, type GameEndData } from './useGameActions';
import { useGameEvents, type GameEndEvent, type CardDealtEvent } from './useGameEvents';
import type { UseRiseWalletReturn } from './useRiseWallet';
import type { GameData, HandValue, BetLimits, GameResult } from '@risejack/shared';

// Card accumulator for smooth display
interface CardAccumulator {
  playerCards: number[];
  dealerCards: number[];
  dealerHiddenCard: number | null; // Second card, revealed at end
}

export interface UseGameStateReturn {
  // State
  gameData: GameData | null;
  playerValue: HandValue | null;
  dealerValue: number | null;
  betLimits: BetLimits;
  isFetching: boolean;

  // Card accumulator for display (from CardDealt events)
  accumulatedCards: CardAccumulator;

  // Last game result with final hand values and cards
  lastGameResult: {
    result: GameResult;
    payout: bigint;
    playerFinalValue: number;
    dealerFinalValue: number;
    playerCards: number[];
    dealerCards: number[];
  } | null;
  clearLastResult: () => void;

  // WebSocket status
  isEventConnected: boolean;

  // Actions
  isLoading: boolean;
  error: string | null;
  placeBet: (betAmount: string) => Promise<boolean>;
  hit: () => Promise<boolean>;
  stand: () => Promise<boolean>;
  double: () => Promise<boolean>;
  surrender: () => Promise<boolean>;
  cancelTimedOutGame: () => Promise<boolean>;

  // Utils
  fetchGameState: () => Promise<void>;
  formatBet: (value: bigint) => string;
  snapshotCards: () => void; // Take snapshot before actions
}

export function useGameState(wallet: UseRiseWalletReturn): UseGameStateReturn {
  const state = useContractState(wallet.address);
  const [lastGameResult, setLastGameResult] = useState<UseGameStateReturn['lastGameResult']>(null);

  // Card accumulator - tracks cards from CardDealt events
  const [accumulatedCards, setAccumulatedCards] = useState<CardAccumulator>({
    playerCards: [],
    dealerCards: [],
    dealerHiddenCard: null,
  });

  // Snapshot ref - backup of cards before action
  const cardSnapshotRef = useRef<CardAccumulator | null>(null);

  // Take snapshot of current cards (call before actions)
  const snapshotCards = useCallback(() => {
    // Prefer accumulated cards, fallback to contract state
    const snapshot: CardAccumulator = {
      playerCards:
        accumulatedCards.playerCards.length > 0
          ? [...accumulatedCards.playerCards]
          : [...(state.gameData?.playerCards ?? [])],
      dealerCards:
        accumulatedCards.dealerCards.length > 0
          ? [...accumulatedCards.dealerCards]
          : [...(state.gameData?.dealerCards ?? [])],
      dealerHiddenCard: accumulatedCards.dealerHiddenCard,
    };
    cardSnapshotRef.current = snapshot;
    console.log('[GameState] Cards snapshot taken:', snapshot);
  }, [accumulatedCards, state.gameData]);

  // Handle CardDealt event - accumulate cards
  const handleCardDealt = useCallback(
    (event: CardDealtEvent) => {
      console.log('[GameState] CardDealt:', event);

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
      state.refetch();
    },
    [state.refetch]
  );

  // Refs to get latest values in delayed callback
  const accumulatedCardsRef = useRef(accumulatedCards);
  accumulatedCardsRef.current = accumulatedCards;

  const stateRef = useRef(state);
  stateRef.current = state;

  // Handle game end event from WebSocket
  const handleGameEnd = useCallback(
    (event: GameEndEvent) => {
      console.log('[GameState] Game ended with result:', event);

      // Delay 50ms to allow CardDealt events to be processed first
      // Rise is very fast, events may arrive nearly simultaneously
      setTimeout(() => {
        const currentAccumulated = accumulatedCardsRef.current;
        const currentState = stateRef.current;
        const currentSnapshot = cardSnapshotRef.current;

        // Get cards from multiple sources (best available)
        // Priority: accumulated > snapshot > contract state
        let playerCards: number[] = [];
        let dealerCards: number[] = [];

        if (currentAccumulated.playerCards.length >= 2) {
          playerCards = [...currentAccumulated.playerCards];
          console.log('[GameState] Using accumulated player cards:', playerCards);
        } else if (currentSnapshot?.playerCards.length) {
          playerCards = [...currentSnapshot.playerCards];
          console.log('[GameState] Using snapshot player cards:', playerCards);
        } else if (currentState.gameData?.playerCards?.length) {
          playerCards = [...currentState.gameData.playerCards];
          console.log('[GameState] Using contract player cards:', playerCards);
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
          console.log('[GameState] Using accumulated dealer cards:', dealerCards);
        } else if (currentSnapshot?.dealerCards.length) {
          dealerCards = [...currentSnapshot.dealerCards];
          if (currentSnapshot.dealerHiddenCard !== null) {
            dealerCards.splice(1, 0, currentSnapshot.dealerHiddenCard);
          }
          console.log('[GameState] Using snapshot dealer cards:', dealerCards);
        } else if (currentState.gameData?.dealerCards?.length) {
          dealerCards = [...currentState.gameData.dealerCards];
          console.log('[GameState] Using contract dealer cards:', dealerCards);
        }

        setLastGameResult({
          result: event.result,
          payout: event.payout,
          playerFinalValue: event.playerFinalValue,
          dealerFinalValue: event.dealerFinalValue,
          playerCards,
          dealerCards,
        });

        // Clear accumulated cards for next game
        setAccumulatedCards({ playerCards: [], dealerCards: [], dealerHiddenCard: null });
        cardSnapshotRef.current = null;
      }, 50); // 50ms delay to allow CardDealt events to arrive
    },
    [] // No dependencies - we use refs for current values
  );

  const clearLastResult = useCallback(() => {
    setLastGameResult(null);
  }, []);

  // WebSocket listener for game events
  const { isConnected: isEventConnected } = useGameEvents(wallet.address, {
    onGameEnd: handleGameEnd,
    onCardDealt: handleCardDealt,
  });

  // Fallback: handle GameEndData from transaction parsing
  const handleGameEndFromTx = useCallback((data: GameEndData) => {
    console.log('[GameState] Game ended from TX (fallback):', data);

    const finalCards = cardSnapshotRef.current ?? {
      playerCards: [],
      dealerCards: [],
      dealerHiddenCard: null,
    };

    setLastGameResult({
      result: data.result,
      payout: data.payout,
      playerFinalValue: 0,
      dealerFinalValue: 0,
      playerCards: finalCards.playerCards,
      dealerCards: finalCards.dealerCards,
    });

    setAccumulatedCards({ playerCards: [], dealerCards: [], dealerHiddenCard: null });
    cardSnapshotRef.current = null;
  }, []);

  const actions = useGameActions({
    address: wallet.address,
    hasSessionKey: wallet.hasSessionKey,
    keyPair: wallet.keyPair,
    betLimits: state.betLimits,
    onSuccess: state.refetch,
    onGameEnd: handleGameEndFromTx,
  });

  // Wrap actions to take snapshot before execution
  const wrappedHit = async (): Promise<boolean> => {
    snapshotCards();
    return actions.hit();
  };

  const wrappedStand = async (): Promise<boolean> => {
    snapshotCards();
    return actions.stand();
  };

  const wrappedDouble = async (): Promise<boolean> => {
    if (!state.gameData?.bet) return false;
    snapshotCards();
    return actions.double(state.gameData.bet);
  };

  const wrappedSurrender = async (): Promise<boolean> => {
    snapshotCards();
    return actions.surrender();
  };

  return {
    // State
    gameData: state.gameData,
    playerValue: state.playerValue,
    dealerValue: state.dealerValue,
    betLimits: state.betLimits,
    isFetching: state.isFetching,

    // Card accumulator
    accumulatedCards,

    // Last result with cards
    lastGameResult,
    clearLastResult,

    // WebSocket
    isEventConnected,

    // Actions (wrapped with snapshot)
    isLoading: actions.isLoading,
    error: actions.error,
    placeBet: actions.placeBet,
    hit: wrappedHit,
    stand: wrappedStand,
    double: wrappedDouble,
    surrender: wrappedSurrender,
    cancelTimedOutGame: actions.cancelTimedOutGame,

    // Utils
    fetchGameState: state.refetch,
    formatBet: actions.formatBet,
    snapshotCards,
  };
}
