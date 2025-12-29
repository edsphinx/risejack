import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { RISEJACK_ABI, getRiseJackAddress, riseTestnet } from '../lib/contract';
import { useRiseWallet } from './useRiseWallet';
import type { GameData, GameState, HandValue, BetLimits } from '@risejack/shared';

export function useGameState(address: `0x${string}` | null) {
  const wallet = useRiseWallet();

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [playerValue, setPlayerValue] = useState<HandValue | null>(null);
  const [dealerValue, setDealerValue] = useState<number | null>(null);
  const [betLimits, setBetLimits] = useState<BetLimits>({ min: 0n, max: 0n });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = useMemo(() => getRiseJackAddress(), []);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: riseTestnet,
        transport: http(),
      }),
    []
  );

  // Fetch bet limits
  const fetchBetLimits = useCallback(async () => {
    try {
      const [min, max] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: RISEJACK_ABI,
          functionName: 'minBet',
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: RISEJACK_ABI,
          functionName: 'maxBet',
        }),
      ]);
      setBetLimits({ min, max });
    } catch (err: unknown) {
      console.error('Failed to fetch bet limits:', err);
    }
  }, [publicClient, contractAddress]);

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    if (!address) return;

    try {
      const [game, handValue, dealerVal] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: RISEJACK_ABI,
          functionName: 'getGameState',
          args: [address],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: RISEJACK_ABI,
          functionName: 'getPlayerHandValue',
          args: [address],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: RISEJACK_ABI,
          functionName: 'getDealerVisibleValue',
          args: [address],
        }),
      ]);

      setGameData({
        player: game.player,
        bet: game.bet,
        playerCards: game.playerCards,
        dealerCards: game.dealerCards,
        state: game.state as GameState,
        timestamp: game.timestamp,
        isDoubled: game.isDoubled,
      });
      setPlayerValue({ value: handValue[0], isSoft: handValue[1] });
      setDealerValue(dealerVal);
    } catch (err: unknown) {
      console.error('Failed to fetch game state:', err);
    }
  }, [address, publicClient, contractAddress]);

  // Execute game action
  const executeAction = useCallback(
    async (
      functionName: 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
      value?: bigint
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const hash = await wallet.sendTransaction(functionName, value);

        if (hash) {
          // Wait a bit for chain to update, then refresh state
          await new Promise((resolve) => setTimeout(resolve, 500));
          await fetchGameState();
          return true;
        }

        return false;
      } catch (err: unknown) {
        const errorMessage = (err as Error).message || 'Transaction failed';
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, fetchGameState]
  );

  // Game actions
  const placeBet = useCallback(
    (betAmount: string): Promise<boolean> => {
      if (!betAmount || isNaN(parseFloat(betAmount)) || parseFloat(betAmount) <= 0) {
        setError('Invalid bet amount');
        return Promise.resolve(false);
      }
      return executeAction('placeBet', parseEther(betAmount));
    },
    [executeAction]
  );

  const hit = useCallback(() => executeAction('hit'), [executeAction]);
  const stand = useCallback(() => executeAction('stand'), [executeAction]);

  const double = useCallback((): Promise<boolean> => {
    if (!gameData) {
      setError('No active game');
      return Promise.resolve(false);
    }
    return executeAction('double', gameData.bet);
  }, [executeAction, gameData]);

  const surrender = useCallback(() => executeAction('surrender'), [executeAction]);

  // Format bet amount
  const formatBet = useCallback((value: bigint): string => {
    return formatEther(value);
  }, []);

  // Initialize
  useEffect(() => {
    fetchBetLimits();
  }, [fetchBetLimits]);

  // Poll game state when connected
  useEffect(() => {
    if (!address) return;

    fetchGameState();
    const interval = setInterval(fetchGameState, 2000);
    return () => clearInterval(interval);
  }, [address, fetchGameState]);

  return {
    gameData,
    playerValue,
    dealerValue,
    betLimits,
    isLoading,
    error,

    placeBet,
    hit,
    stand,
    double,
    surrender,
    fetchGameState,
    formatBet,
  };
}
