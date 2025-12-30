/**
 * useGameActions - Game transaction execution without wagmi
 * Uses direct provider.request() (Meteoro pattern)
 * GameEnded events are handled via WebSocket in useGameEvents
 */

import { useState, useCallback, useMemo } from 'preact/hooks';
import { encodeFunctionData, parseEther, formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import { signWithSessionKey, getActiveSessionKey } from '@/services/sessionKeyManager';
import { ErrorService } from '@/services';
import { RISEJACK_ABI, getRiseJackAddress } from '@/lib/contract';
import type { BetLimits, GameResult } from '@risejack/shared';

// Valid game action types
type GameActionName = 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender';

// Card dealt from transaction logs
interface CardDealtFromTx {
  card: number;
  isDealer: boolean;
  faceUp: boolean;
}

export interface GameEndData {
  result: GameResult;
  payout: bigint;
  cardsDealt?: CardDealtFromTx[]; // Cards from this transaction
}

export interface UseGameActionsReturn {
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  placeBet: (betAmount: string) => Promise<boolean>;
  hit: () => Promise<boolean>;
  stand: () => Promise<boolean>;
  double: (currentBet: bigint) => Promise<boolean>;
  surrender: () => Promise<boolean>;
  formatBet: (value: bigint) => string;
}

interface GameActionsConfig {
  address: `0x${string}` | null;
  hasSessionKey: boolean;
  keyPair: { publicKey: string; privateKey: string } | null;
  betLimits: BetLimits;
  onSuccess?: () => void;
  onGameEnd?: (data: GameEndData) => void;
}

export function useGameActions(config: GameActionsConfig): UseGameActionsReturn {
  const { address, hasSessionKey, keyPair, betLimits, onSuccess, onGameEnd } = config;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = useMemo(() => getRiseJackAddress(), []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Send transaction using session key (no popup)
   * Returns txHash and parsed GameEnded event if present
   */
  const sendSessionTransaction = useCallback(
    async (
      to: `0x${string}`,
      value: bigint,
      data: `0x${string}`
    ): Promise<{ txHash: `0x${string}` | null; gameEndData: GameEndData | null }> => {
      const sessionKey = getActiveSessionKey();
      if (!sessionKey || !address) return { txHash: null, gameEndData: null };

      const provider = getProvider();
      const hexValue = value
        ? (`0x${value.toString(16)}` as `0x${string}`)
        : ('0x0' as `0x${string}`);

      const t0 = performance.now();
      console.log(`⚡ [T+0ms] Using session key`);

      // 1. Prepare Calls
      const prepareParams = [
        {
          calls: [{ to, value: hexValue, data }],
          key: {
            type: 'p256',
            publicKey: sessionKey.publicKey,
          },
        },
      ];

      // Cast provider to bypass strict SDK types
      const prepared = (await (
        provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
      ).request({
        method: 'wallet_prepareCalls',
        params: prepareParams,
      })) as { digest: `0x${string}` };

      const t1 = performance.now();
      console.log(`⚡ [T+${Math.round(t1 - t0)}ms] wallet_prepareCalls`);

      const { digest, ...requestParams } = prepared;

      // 2. Sign digest using session key (local, no popup)
      const signature = signWithSessionKey(digest, sessionKey);
      const t2 = performance.now();
      console.log(`⚡ [T+${Math.round(t2 - t0)}ms] P256 sign`);

      // 3. Send prepared calls
      const response = (await (
        provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
      ).request({
        method: 'wallet_sendPreparedCalls',
        params: [{ ...requestParams, signature }],
      })) as Array<{ id: `0x${string}` }>;

      const t3 = performance.now();
      console.log(`⚡ [T+${Math.round(t3 - t0)}ms] wallet_sendPreparedCalls`);

      const callId = response[0]?.id;
      if (!callId) return { txHash: null, gameEndData: null };

      console.log(
        `⚡ [T+${Math.round(performance.now() - t0)}ms] TOTAL - returning callId:`,
        callId
      );

      // Fire-and-forget: Get receipt in background for logging only
      // GameEnded events are handled by WebSocket, no need to wait
      provider
        .request({
          method: 'wallet_getCallsStatus',
          params: [callId],
        })
        .then((callStatus) => {
          const status = callStatus as { receipts?: Array<{ transactionHash: string }> };
          const txHash = status.receipts?.[0]?.transactionHash;
          console.log(`⚡ [async] wallet_getCallsStatus completed, txHash:`, txHash);
        })
        .catch(() => {
          /* ignore */
        });

      return { txHash: callId, gameEndData: null };
    },
    [address]
  );

  /**
   * Send transaction using passkey (popup)
   */
  const sendPasskeyTransaction = useCallback(
    async (
      to: `0x${string}`,
      value: bigint,
      data: `0x${string}`
    ): Promise<`0x${string}` | null> => {
      if (!address) return null;

      const provider = getProvider();
      const hexValue = value
        ? (`0x${value.toString(16)}` as `0x${string}`)
        : ('0x0' as `0x${string}`);

      console.log('🔐 Sending passkey transaction...');

      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, value: hexValue, data }],
      })) as `0x${string}`;

      console.log('🔐 Passkey transaction sent:', txHash);
      return txHash;
    },
    [address]
  );

  // Core execution function
  const executeAction = useCallback(
    async (functionName: GameActionName, value?: bigint): Promise<boolean> => {
      if (!address) {
        setError('Wallet not connected');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = encodeFunctionData({
          abi: RISEJACK_ABI,
          functionName,
        });

        let txHash: `0x${string}` | null = null;
        let gameEndData: GameEndData | null = null;

        if (hasSessionKey && keyPair) {
          console.log('[GameActions] 🔑 Using session key...', {
            hasSessionKey,
            publicKey: keyPair.publicKey?.slice(0, 20) + '...',
          });
          try {
            const result = await sendSessionTransaction(contractAddress, value ?? 0n, data);
            txHash = result.txHash;
            gameEndData = result.gameEndData;
          } catch (sessionErr) {
            // Session key failed - fallback to passkey
            console.warn(
              '[GameActions] ⚠️ Session key FAILED, falling back to passkey:',
              sessionErr
            );
            console.log('[GameActions] 🔐 Falling back to passkey...');
            txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
          }
        } else {
          console.log('[GameActions] 🔐 Using passkey (no session key)...', {
            hasSessionKey,
            hasKeyPair: !!keyPair,
          });
          txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
        }

        if (!txHash) {
          setError('Transaction failed to submit');
          return false;
        }

        console.log('[GameActions] TX Hash:', txHash);

        // If game ended, call the callback with result
        if (gameEndData) {
          console.log('[GameActions] Game ended:', gameEndData);
          onGameEnd?.(gameEndData);
        }

        // Small delay to ensure Rise Chain has processed the tx before refetching
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log('[GameActions] Calling onSuccess to refresh state...');
        onSuccess?.();
        return true;
      } catch (err: unknown) {
        console.error('[GameActions] Error:', err);
        setError(ErrorService.getSafeMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      hasSessionKey,
      keyPair,
      contractAddress,
      sendSessionTransaction,
      sendPasskeyTransaction,
      onSuccess,
      onGameEnd,
    ]
  );

  // Game actions with validation
  const placeBet = useCallback(
    async (betAmount: string): Promise<boolean> => {
      if (!betAmount?.trim()) {
        setError('Please enter a bet amount');
        return false;
      }

      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Bet amount must be a positive number');
        return false;
      }

      let betWei: bigint;
      try {
        betWei = parseEther(betAmount);
      } catch {
        setError('Invalid bet amount format');
        return false;
      }

      if (betLimits.min > 0n && betWei < betLimits.min) {
        setError(`Minimum bet is ${formatEther(betLimits.min)} ETH`);
        return false;
      }
      if (betLimits.max > 0n && betWei > betLimits.max) {
        setError(`Maximum bet is ${formatEther(betLimits.max)} ETH`);
        return false;
      }

      return executeAction('placeBet', betWei);
    },
    [executeAction, betLimits]
  );

  const hit = useCallback(() => executeAction('hit'), [executeAction]);
  const stand = useCallback(() => executeAction('stand'), [executeAction]);
  const double = useCallback(
    (currentBet: bigint) => executeAction('double', currentBet),
    [executeAction]
  );
  const surrender = useCallback(() => executeAction('surrender'), [executeAction]);
  const formatBet = useCallback((value: bigint): string => formatEther(value), []);

  return {
    isLoading,
    error,
    clearError,
    placeBet,
    hit,
    stand,
    double,
    surrender,
    formatBet,
  };
}
