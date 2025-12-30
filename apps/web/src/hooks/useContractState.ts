/**
 * useContractState - Contract state reading
 * Single responsibility: read game state from the contract
 *
 * NOTE: No polling! Game state updates come via:
 * 1. WebSocket events (GameEnded, CardDealt, etc.)
 * 2. Manual refetch after user actions
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { ContractService } from '@/services';
import type { GameData, HandValue, BetLimits } from '@risejack/shared';

export interface UseContractStateReturn {
  gameData: GameData | null;
  playerValue: HandValue | null;
  dealerValue: number | null;
  betLimits: BetLimits;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export function useContractState(address: `0x${string}` | null): UseContractStateReturn {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [playerValue, setPlayerValue] = useState<HandValue | null>(null);
  const [dealerValue, setDealerValue] = useState<number | null>(null);
  const [betLimits, setBetLimits] = useState<BetLimits>({ min: 0n, max: 0n });
  const [isFetching, setIsFetching] = useState(false);

  // Use ref to avoid stale closure in callbacks
  const addressRef = useRef(address);
  addressRef.current = address;

  // Fetch bet limits (once on mount)
  useEffect(() => {
    ContractService.getBetLimits()
      .then(setBetLimits)
      .catch((err) => console.error('Failed to fetch bet limits:', err));
  }, []);

  // Fetch game state - stable callback (no deps that change)
  const refetch = useCallback(async () => {
    const addr = addressRef.current;
    if (!addr) return;

    setIsFetching(true);
    try {
      const {
        gameData: gd,
        playerValue: pv,
        dealerValue: dv,
      } = await ContractService.getFullGameData(addr);

      console.log('[ContractState] 🔍 Game state:', {
        state: gd?.state,
        stateLabel: gd
          ? [
              'Idle',
              'WaitingVRF',
              'PlayerTurn',
              'DealerTurn',
              'PlayerWin',
              'DealerWin',
              'Push',
              'Blackjack',
            ][gd.state]
          : 'null',
        playerCards: gd?.playerCards,
        bet: gd?.bet?.toString(),
      });
      setGameData(gd);
      setPlayerValue(pv);
      setDealerValue(dv);
    } catch (err) {
      console.error('[ContractState] Failed to fetch game state:', err);
    } finally {
      setIsFetching(false);
    }
  }, []); // Empty deps - uses ref for address

  // Initial fetch only when address changes
  useEffect(() => {
    if (!address) {
      setGameData(null);
      setPlayerValue(null);
      setDealerValue(null);
      return;
    }

    // Single fetch on connect - no polling!
    console.log('[ContractState] 🔍 Initial fetch for address:', address);
    refetch().then(() => {
      console.log('[ContractState] 🔍 Initial gameData fetched');
    });
  }, [address, refetch]);

  return {
    gameData,
    playerValue,
    dealerValue,
    betLimits,
    isFetching,
    refetch,
  };
}
