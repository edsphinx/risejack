/**
 * useGameState - Compositor hook for game state and actions
 * Combines useContractState and useGameActions
 *
 * NOTE: GameEnded event now includes final hand values directly from contract,
 * so we no longer need client-side card tracking.
 */

import { useState, useCallback } from 'preact/hooks';
import { useContractState } from './useContractState';
import { useGameActions, type GameEndData } from './useGameActions';
import { useGameEvents, type GameEndEvent } from './useGameEvents';
import type { UseRiseWalletReturn } from './useRiseWallet';
import type { GameData, HandValue, BetLimits, GameResult } from '@risejack/shared';

export interface UseGameStateReturn {
  // State
  gameData: GameData | null;
  playerValue: HandValue | null;
  dealerValue: number | null;
  betLimits: BetLimits;
  isFetching: boolean;

  // Last game result with final hand values (from contract event)
  lastGameResult: {
    result: GameResult;
    payout: bigint;
    playerFinalValue: number;
    dealerFinalValue: number;
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

  // Utils
  fetchGameState: () => Promise<void>;
  formatBet: (value: bigint) => string;
}

export function useGameState(wallet: UseRiseWalletReturn): UseGameStateReturn {
  const state = useContractState(wallet.address);
  const [lastGameResult, setLastGameResult] = useState<UseGameStateReturn['lastGameResult']>(null);

  // Handle CardDealt event - just refetch to update UI
  const handleCardDealt = useCallback(() => {
    console.log('[GameState] Card dealt via WebSocket, refetching...');
    state.refetch();
  }, [state.refetch]);

  // Handle game end event from WebSocket
  // Event now includes final hand values directly from contract!
  const handleGameEnd = useCallback((event: GameEndEvent) => {
    console.log('[GameState] Game ended with result:', event);

    setLastGameResult({
      result: event.result,
      payout: event.payout,
      playerFinalValue: event.playerFinalValue,
      dealerFinalValue: event.dealerFinalValue,
    });
  }, []);

  const clearLastResult = useCallback(() => {
    setLastGameResult(null);
  }, []);

  // WebSocket listener for game events (GameEnded + CardDealt)
  const { isConnected: isEventConnected } = useGameEvents(wallet.address, {
    onGameEnd: handleGameEnd,
    onCardDealt: handleCardDealt,
  });

  // Also handle GameEndData from transaction parsing (fallback)
  const handleGameEndFromTx = useCallback((data: GameEndData) => {
    console.log('[GameState] Game ended from TX (fallback):', data);
    // This is the old format without hand values - use 0 as fallback
    setLastGameResult({
      result: data.result,
      payout: data.payout,
      playerFinalValue: 0,
      dealerFinalValue: 0,
    });
  }, []);

  const actions = useGameActions({
    address: wallet.address,
    hasSessionKey: wallet.hasSessionKey,
    keyPair: wallet.keyPair,
    betLimits: state.betLimits,
    onSuccess: state.refetch,
    onGameEnd: handleGameEndFromTx,
  });

  // Wrap double to use current bet from state
  const double = async (): Promise<boolean> => {
    if (!state.gameData?.bet) {
      return false;
    }
    return actions.double(state.gameData.bet);
  };

  return {
    // State
    gameData: state.gameData,
    playerValue: state.playerValue,
    dealerValue: state.dealerValue,
    betLimits: state.betLimits,
    isFetching: state.isFetching,

    // Last result with hand values from event
    lastGameResult,
    clearLastResult,

    // WebSocket
    isEventConnected,

    // Actions
    isLoading: actions.isLoading,
    error: actions.error,
    placeBet: actions.placeBet,
    hit: actions.hit,
    stand: actions.stand,
    double,
    surrender: actions.surrender,

    // Utils
    fetchGameState: state.refetch,
    formatBet: actions.formatBet,
  };
}
