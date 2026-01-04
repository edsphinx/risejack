/**
 * useGameActions - Game transaction execution without wagmi
 * Uses direct provider.request() (Meteoro pattern)
 * GameEnded events are handled via WebSocket in useGameEvents
 */

import { useState, useCallback, useMemo } from 'preact/hooks';
import { encodeFunctionData, parseEther, formatEther } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import {
  signWithSessionKey,
  getActiveSessionKey,
  clearAllSessionKeys,
  createSessionKey,
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

  const contractAddress = useMemo(() => getVyreJackAddress(), []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Send transaction using session key (no popup)
   * If session key fails with authorization error, auto-recreate it (one PIN prompt)
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
      logger.log(`⚡ [T+0ms] Using session key`);

      // Helper: Execute transaction with given session key
      const executeWithKey = async (key: typeof sessionKey) => {
        const prepareParams = [
          {
            calls: [{ to: to.toLowerCase() as `0x${string}`, value: hexValue, data }],
            key: {
              type: 'p256',
              publicKey: key!.publicKey,
            },
          },
        ];

        const prepared = (await (
          provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
        ).request({
          method: 'wallet_prepareCalls',
          params: prepareParams,
        })) as { digest: `0x${string}` };

        const { digest, ...requestParams } = prepared;
        const signature = signWithSessionKey(digest, key!);

        const response = (await (
          provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
        ).request({
          method: 'wallet_sendPreparedCalls',
          params: [{ ...requestParams, signature }],
        })) as Array<{ id: `0x${string}` }>;

        return response[0]?.id || null;
      };

      // Helper: Check if error is authorization-related
      const isAuthError = (err: unknown) => {
        const msg = String(err);
        return (
          msg.includes('not been authorized') ||
          msg.includes('unauthorized') ||
          msg.includes('REVOKED')
        );
      };

      // Try with existing session key first
      try {
        const callId = await executeWithKey(sessionKey);
        if (!callId) return { txHash: null, gameEndData: null };

        const t1 = performance.now();
        logger.log(`⚡ [T+${Math.round(t1 - t0)}ms] Session key transaction sent`);

        // Fire-and-forget: Get receipt for logging
        provider
          .request({ method: 'wallet_getCallsStatus', params: [callId] })
          .then((status) => {
            const s = status as { receipts?: Array<{ transactionHash: string }> };
            logger.log(`⚡ [async] txHash:`, s.receipts?.[0]?.transactionHash);
          })
          .catch(() => {});

        return { txHash: callId, gameEndData: null };
      } catch (firstError) {
        if (!isAuthError(firstError)) {
          throw firstError; // Non-auth error, don't retry
        }

        // Authorization failed - try to reactivate with wallet_connect first (PIN only)
        logger.log('⚡ Session key authorization failed, trying to reactivate...');

        try {
          // First, try wallet_connect to reactivate the session (prompts PIN once)
          await (
            provider as {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            }
          ).request({
            method: 'wallet_connect',
            params: [{}],
          });
          logger.log(
            `⚡ [T+${Math.round(performance.now() - t0)}ms] Provider reactivated, retrying with same key...`
          );

          // Retry with the SAME session key (no need to create new one)
          const callId = await executeWithKey(sessionKey);
          if (!callId) return { txHash: null, gameEndData: null };

          logger.log(
            `⚡ [T+${Math.round(performance.now() - t0)}ms] Retry with same key succeeded`
          );

          // Fire-and-forget: Get receipt for logging
          provider
            .request({ method: 'wallet_getCallsStatus', params: [callId] })
            .then((status) => {
              const s = status as { receipts?: Array<{ transactionHash: string }> };
              logger.log(`⚡ [async] txHash:`, s.receipts?.[0]?.transactionHash);
            })
            .catch(() => {});

          return { txHash: callId, gameEndData: null };
        } catch {
          // Reactivation failed - as last resort, try creating a new session key
          logger.log('⚡ Reactivation failed, creating new session key as last resort...');

          try {
            const { createSessionKey, clearAllSessionKeys } =
              await import('@/services/sessionKeyManager');
            clearAllSessionKeys(); // Clean up stale keys

            const newKey = await createSessionKey(address);
            logger.log(`⚡ [T+${Math.round(performance.now() - t0)}ms] Session key recreated`);

            // Retry with new session key
            const callId = await executeWithKey(newKey);
            if (!callId) return { txHash: null, gameEndData: null };

            logger.log(
              `⚡ [T+${Math.round(performance.now() - t0)}ms] Retry with new key succeeded`
            );

            provider
              .request({ method: 'wallet_getCallsStatus', params: [callId] })
              .then((status) => {
                const s = status as { receipts?: Array<{ transactionHash: string }> };
                logger.log(`⚡ [async] txHash:`, s.receipts?.[0]?.transactionHash);
              })
              .catch(() => {});

            return { txHash: callId, gameEndData: null };
          } catch (recreateErr) {
            logger.warn('⚡ Session key recreation failed:', recreateErr);
            throw recreateErr; // Let caller handle fallback to passkey
          }
        }
      }
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

      logger.log('🔐 Sending passkey transaction...');

      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, value: hexValue, data }],
      })) as `0x${string}`;

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

        let txHash: `0x${string}` | null = null;
        let gameEndData: GameEndData | null = null;

        if (hasSessionKey && keyPair) {
          logger.log('[GameActions] 🔑 Using session key...', {
            hasSessionKey,
            publicKey: keyPair.publicKey?.slice(0, 20) + '...',
          });
          try {
            const result = await sendSessionTransaction(contractAddress, value ?? 0n, data);
            txHash = result.txHash;
            gameEndData = result.gameEndData;
          } catch (sessionErr) {
            // Session key failed - check if it's a permission issue
            const errorStr = String(sessionErr);
            if (errorStr.includes('UserRejectedRequestError') || errorStr.includes('rejected')) {
              // Permission was revoked by Rise Wallet - clear invalid session key
              logger.warn('[GameActions] ⚠️ Session key REVOKED by wallet, clearing...');
              clearAllSessionKeys();

              // Try to auto-recreate session key (like Meteoro does)
              logger.log('[GameActions] 🔑 Attempting to auto-recreate session key...');
              try {
                await createSessionKey(address);
                logger.log('[GameActions] 🔑 Session key recreated successfully!');

                // Retry with new session key
                const retryResult = await sendSessionTransaction(
                  contractAddress,
                  value ?? 0n,
                  data
                );
                txHash = retryResult.txHash;
                gameEndData = retryResult.gameEndData;
              } catch (recreateErr) {
                logger.warn('[GameActions] ⚠️ Failed to recreate session key:', recreateErr);
                // Fallback to passkey
                logger.log('[GameActions] 🔐 Falling back to passkey...');
                txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
              }
            } else {
              logger.warn('[GameActions] ⚠️ Session key failed:', sessionErr);
              // Fallback to passkey
              logger.log('[GameActions] 🔐 Falling back to passkey...');
              txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
            }
          }
        } else {
          logger.log('[GameActions] 🔐 Using passkey (no session key)...', {
            hasSessionKey,
            hasKeyPair: !!keyPair,
          });
          txHash = await sendPasskeyTransaction(contractAddress, value ?? 0n, data);
        }

        if (!txHash) {
          setError('Transaction failed to submit');
          return false;
        }

        logger.log('[GameActions] TX Hash:', txHash);

        // If game ended, call the callback with result
        if (gameEndData) {
          logger.log('[GameActions] Game ended:', gameEndData);
          onGameEnd?.(gameEndData);
        }

        // Small delay to ensure Rise Chain has processed the tx before refetching
        await new Promise((resolve) => setTimeout(resolve, 100));

        logger.log('[GameActions] Calling onSuccess to refresh state...');
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

      // Log game_start event
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

  // Cancel a timed out game using session key + passkey fallback for consistency
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

      let txHash: `0x${string}` | null = null;

      // Use session key if available (consistent with other actions)
      if (hasSessionKey && keyPair) {
        logger.log('[GameActions] 🚪 Cancelling with session key...');
        try {
          const result = await sendSessionTransaction(contractAddress, 0n, data);
          txHash = result.txHash;
        } catch (sessionErr) {
          logger.warn(
            '[GameActions] Session key failed for cancel, falling back to passkey:',
            sessionErr
          );
          txHash = await sendPasskeyTransaction(contractAddress, 0n, data);
        }
      } else {
        logger.log('[GameActions] 🚪 Cancelling with passkey...');
        txHash = await sendPasskeyTransaction(contractAddress, 0n, data);
      }

      if (!txHash) {
        setError('Cancel transaction failed');
        return false;
      }

      logger.log('[GameActions] 🚪 Cancel TX:', txHash);

      // Wait a bit then refresh
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
  }, [
    address,
    hasSessionKey,
    keyPair,
    contractAddress,
    sendSessionTransaction,
    sendPasskeyTransaction,
    onSuccess,
  ]);

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
