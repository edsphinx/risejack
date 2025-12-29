import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { RISEJACK_ABI, getRiseJackAddress, riseTestnet } from '../lib/contract';
import { useRiseWallet } from './useRiseWallet';
import type { GameData, GameState, HandValue, BetLimits } from '@risejack/shared';

// Polling interval - reduced for better performance (5 seconds instead of 2)
const GAME_STATE_POLL_INTERVAL = 5000;

// Max retries for transaction confirmation
const MAX_TX_RETRIES = 10;
const TX_RETRY_DELAY = 1000;

// Safe error messages (prevent info leakage)
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'Invalid bet amount': 'Invalid bet amount',
  'Insufficient balance': 'Insufficient balance',
  'Game not in correct state': 'Cannot perform this action now',
  'user rejected': 'Transaction was cancelled',
  'User rejected': 'Transaction was cancelled',
};

function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Check for known safe messages
  for (const [key, safeMessage] of Object.entries(SAFE_ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return safeMessage;
    }
  }

  // Generic fallback - don't expose internal details
  return 'Transaction failed. Please try again.';
}

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

  // Wait for transaction confirmation with retries
  const waitForTransaction = useCallback(
    async (hash: `0x${string}`): Promise<boolean> => {
      for (let i = 0; i < MAX_TX_RETRIES; i++) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash });
          if (receipt) {
            return receipt.status === 'success';
          }
        } catch {
          // Transaction not yet mined, continue waiting
        }
        await new Promise((resolve) => setTimeout(resolve, TX_RETRY_DELAY));
      }
      return false;
    },
    [publicClient]
  );

  // Execute game action
  const executeAction = useCallback(
    async (
      functionName: 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
      value?: bigint
    ): Promise<boolean> => {
      // Validate wallet is connected
      if (!wallet.isConnected || !wallet.address) {
        setError('Please connect your wallet first');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const hash = await wallet.sendTransaction(functionName, value);

        if (!hash) {
          setError('Transaction failed to submit');
          return false;
        }

        // Wait for actual transaction confirmation
        const success = await waitForTransaction(hash);

        if (success) {
          await fetchGameState();
          return true;
        } else {
          setError('Transaction failed on-chain');
          return false;
        }
      } catch (err: unknown) {
        setError(getSafeErrorMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, fetchGameState, waitForTransaction]
  );

  // Game actions with proper validation
  const placeBet = useCallback(
    (betAmount: string): Promise<boolean> => {
      // Validate input
      if (!betAmount || betAmount.trim() === '') {
        setError('Please enter a bet amount');
        return Promise.resolve(false);
      }

      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Bet amount must be a positive number');
        return Promise.resolve(false);
      }

      // Validate against bet limits if available
      try {
        const betWei = parseEther(betAmount);
        if (betLimits.min > 0n && betWei < betLimits.min) {
          setError(`Minimum bet is ${formatEther(betLimits.min)} ETH`);
          return Promise.resolve(false);
        }
        if (betLimits.max > 0n && betWei > betLimits.max) {
          setError(`Maximum bet is ${formatEther(betLimits.max)} ETH`);
          return Promise.resolve(false);
        }
        return executeAction('placeBet', betWei);
      } catch {
        setError('Invalid bet amount format');
        return Promise.resolve(false);
      }
    },
    [executeAction, betLimits]
  );

  const hit = useCallback(() => executeAction('hit'), [executeAction]);
  const stand = useCallback(() => executeAction('stand'), [executeAction]);

  const double = useCallback((): Promise<boolean> => {
    if (!gameData || !gameData.bet) {
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

  // Initialize - fetch bet limits once
  useEffect(() => {
    fetchBetLimits();
  }, [fetchBetLimits]);

  // Poll game state when connected (with reduced frequency)
  useEffect(() => {
    if (!address) return;

    fetchGameState();
    const interval = setInterval(fetchGameState, GAME_STATE_POLL_INTERVAL);
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
