/**
 * useGameActions - Game transaction execution without wagmi
 *
 * REFACTORED: Uses simplified Meteoro pattern for session keys
 * - No complex retries
 * - Trusts localStorage
 * - Linear transaction flow: Check -> (Create) -> Prepare -> Sign -> Send
 */

import { useState, useCallback, useMemo } from 'preact/hooks';
import { encodeFunctionData, parseEther, formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import {
  signWithSessionKey,
  ensureSessionKey,
  type SessionKeyData,
} from '@/services/sessionKeyManager';
import { ErrorService } from '@/services';
import { VYREJACK_ABI, getVyreJackAddress } from '@/lib/contract';
import { logger } from '@/lib/logger';
import { logEvent } from '@/lib/api';
import type { BetLimits, GameResult } from '@vyrejack/shared';

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
  cancelTimedOutGame: () => Promise<boolean>;
  formatBet: (value: bigint) => string;
}

interface GameActionsConfig {
  address: `0x${string}` | null;
  // Legacy props kept for compatibility, but ignored in favor of direct manager calls
  hasSessionKey: boolean;
  keyPair: { publicKey: string; privateKey: string } | null;
  betLimits: BetLimits;
  onSuccess?: () => void;
  onGameEnd?: (data: GameEndData) => void;
}

export function useGameActions(config: GameActionsConfig): UseGameActionsReturn {
  const { address, betLimits, onSuccess, onGameEnd } = config;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = useMemo(() => getVyreJackAddress(), []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Wait for transaction status with polling
   */
  const waitForTransactionStatus = async (provider: any, callId: string, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await provider.request({
          method: 'wallet_getCallsStatus',
          params: [callId],
        });

        if (status) {
          if (status.status === 'CONFIRMED' || status.status === 'confirmed') {
            if (status.receipts?.[0]?.transactionHash) {
              return status.receipts[0].transactionHash;
            }
            return callId; // Fallback
          }

          if (status.status === 'FAILED' || status.status === 'failed') {
            throw new Error(`Transaction failed: ${status.error || 'Unknown error'}`);
          }
        }
      } catch (err) {
        // Ignore polling errors unless it's a definitive failure
        if (String(err).includes('Transaction failed')) throw err;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return callId;
  };

  /**
   * Send transaction using session key pattern (Prepare -> Sign -> Send)
   */
  const sendSessionTransaction = useCallback(
    async (
      to: `0x${string}`,
      value: bigint,
      data: `0x${string}`
    ): Promise<{ txHash: string | null; gameEndData: GameEndData | null }> => {
      if (!address) return { txHash: null, gameEndData: null };

      const provider = getProvider();

      // 1. Get or Create Session Key (Meteoro pattern)
      let sessionKey: SessionKeyData;
      try {
        // This handles creating if missing, or reusing if exists in localStorage
        sessionKey = await ensureSessionKey(address);
      } catch (err) {
        logger.error('Failed to ensure session key:', err);
        throw new Error('Failed to obtain permissions');
      }

      const hexValue = value ? `0x${value.toString(16)}` : '0x0';

      // 2. Prepare Call
      const prepared = await (provider as any).request({
        method: 'wallet_prepareCalls',
        params: [
          {
            calls: [
              {
                to: to.toLowerCase(),
                value: hexValue,
                data,
              },
            ],
            key: {
              type: 'p256',
              publicKey: sessionKey.publicKey,
            },
          },
        ],
      });

      // 3. Sign
      const { digest, ...requestParams } = prepared;
      const signature = signWithSessionKey(digest, sessionKey);

      // 4. Send
      const response = await (provider as any).request({
        method: 'wallet_sendPreparedCalls',
        params: [
          {
            ...requestParams,
            signature,
          },
        ],
      });

      // 5. Handle Response
      let callId: string;
      if (Array.isArray(response) && response.length > 0) {
        callId = response[0].id;
      } else if (typeof response === 'string') {
        callId = response;
      } else if (response && typeof response === 'object' && 'id' in response) {
        callId = (response as any).id;
      } else {
        throw new Error('Invalid response from wallet_sendPreparedCalls');
      }

      logger.log(`[GameActions] Transaction sent, ID: ${callId}`);

      // Wait for confirmation
      const finalTxHash = await waitForTransactionStatus(provider, callId);

      // TODO: In the future, we could parse logs from the receipt here to populate gameEndData
      // For now, we return null gameEndData and rely on WebSocket events or polling
      return { txHash: finalTxHash, gameEndData: null };
    },
    [address]
  );

  /**
   * Send transaction using passkey (popup)
   */
  const sendPasskeyTransaction = useCallback(
    async (to: `0x${string}`, value: bigint, data: `0x${string}`): Promise<string | null> => {
      if (!address) return null;

      const provider = getProvider();
      const hexValue = value
        ? (`0x${value.toString(16)}` as `0x${string}`)
        : ('0x0' as `0x${string}`);

      logger.log('🔐 Sending passkey transaction...');

      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, value: hexValue, data }],
      })) as string;

      logger.log('🔐 Passkey transaction sent:', txHash);
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
          abi: VYREJACK_ABI,
          functionName,
        });

        let txHash: string | null = null;
        let gameEndData: GameEndData | null = null;

        // Try session key first
        try {
          logger.log('[GameActions] 🔑 Attempting session transaction...');
          const result = await sendSessionTransaction(contractAddress, value ?? 0n, data);
          txHash = result.txHash;
          gameEndData = result.gameEndData;
        } catch (sessionErr) {
          logger.warn('[GameActions] ⚠️ Session transaction failed:', sessionErr);
          // Fallback to passkey only on failure
          logger.log('[GameActions] 🔐 Falling back to passkey...');
          txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
        }

        if (!txHash) {
          setError('Transaction failed to submit');
          return false;
        }

        logger.log('[GameActions] TX Hash:', txHash);

        // If game ended (parsed from logs), callback
        if (gameEndData) {
          onGameEnd?.(gameEndData);
        }

        // Small delay to ensure state propagation
        await new Promise((resolve) => setTimeout(resolve, 100));
        onSuccess?.();
        return true;
      } catch (err: unknown) {
        logger.error('[GameActions] Error:', err);
        setError(ErrorService.getSafeMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [address, contractAddress, sendSessionTransaction, sendPasskeyTransaction, onSuccess, onGameEnd]
  );

  // Game actions wrappers
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

      logEvent('game_start', address || undefined, {
        betAmount: betAmount,
        currency: 'ETH',
      }).catch(() => {});

      return executeAction('placeBet', betWei);
    },
    [executeAction, betLimits, address]
  );

  const hit = useCallback(() => {
    logEvent('game_action', address || undefined, { action: 'hit' }).catch(() => {});
    return executeAction('hit');
  }, [executeAction, address]);

  const stand = useCallback(() => {
    logEvent('game_action', address || undefined, { action: 'stand' }).catch(() => {});
    return executeAction('stand');
  }, [executeAction, address]);

  const double = useCallback(
    (currentBet: bigint) => {
      logEvent('game_action', address || undefined, { action: 'double' }).catch(() => {});
      return executeAction('double', currentBet);
    },
    [executeAction, address]
  );

  const surrender = useCallback(() => {
    logEvent('game_action', address || undefined, { action: 'surrender' }).catch(() => {});
    return executeAction('surrender');
  }, [executeAction, address]);

  const formatBet = useCallback((value: bigint): string => formatEther(value), []);

  // Cancel action
  const cancelTimedOutGame = useCallback(async (): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = encodeFunctionData({
        abi: VYREJACK_ABI,
        functionName: 'cancelTimedOutGame',
        args: [address],
      });

      let txHash: string | null = null;

      try {
        const result = await sendSessionTransaction(contractAddress, 0n, data);
        txHash = result.txHash;
      } catch (sessionErr) {
        logger.warn('[GameActions] Session cancel failed, trying passkey:', sessionErr);
        txHash = await sendPasskeyTransaction(contractAddress, 0n, data);
      }

      if (!txHash) {
        setError('Cancel transaction failed');
        return false;
      }

      logger.log('[GameActions] 🚪 Cancel TX:', txHash);
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSuccess?.();
      return true;
    } catch (err: unknown) {
      logger.error('[GameActions] Cancel failed:', err);
      setError(ErrorService.getSafeMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, sendSessionTransaction, sendPasskeyTransaction, onSuccess]);

  return {
    isLoading,
    error,
    clearError,
    placeBet,
    hit,
    stand,
    double,
    surrender,
    cancelTimedOutGame,
    formatBet,
  };
}
