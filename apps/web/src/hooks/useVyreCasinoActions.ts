/**
 * useVyreCasinoActions - Game WRITE actions for VyreCasino architecture
 *
 * REFACTORED: Uses simplified Meteoro pattern for session keys
 * - No complex retries
 * - Trusts localStorage
 * - Linear transaction flow: Check -> (Create) -> Prepare -> Sign -> Send
 */

import { useState, useCallback } from 'preact/hooks';
import { encodeFunctionData, parseUnits, formatUnits, maxUint256 } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import {
  signWithSessionKey,
  ensureSessionKey,
  type SessionKeyData,
} from '@/services/sessionKeyManager';
import { ErrorService, TokenService } from '@/services';
import {
  VYRECASINO_ABI,
  VYREJACKCORE_ABI,
  ERC20_ABI,
  VYRECASINO_ADDRESS,
  VYREJACKCORE_ADDRESS,
  CHIP_TOKEN_ADDRESS,
} from '@/lib/contract';
import { logger } from '@/lib/logger';
import { logEvent } from '@/lib/api';

// =============================================================================
// TYPES
// =============================================================================

type GameActionName = 'hit' | 'stand' | 'double';

export interface UseVyreCasinoActionsReturn {
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  // Token write actions
  approveToken: (token: `0x${string}`, amount?: bigint) => Promise<boolean>;
  // Game actions
  placeBet: (betAmount: string, token?: `0x${string}`) => Promise<boolean>;
  hit: () => Promise<boolean>;
  stand: () => Promise<boolean>;
  double: () => Promise<boolean>;
  // Utils
  formatChip: (value: bigint) => string;
}

interface VyreCasinoActionsConfig {
  address: `0x${string}` | null;
  tokenContext?: 'ETH' | 'CHIP' | 'USDC';
  onSuccess?: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useVyreCasinoActions(config: VyreCasinoActionsConfig): UseVyreCasinoActionsReturn {
  const { address, tokenContext, onSuccess } = config;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Wait for transaction status with polling
   * Matches Meteoro's waitForTransactionStatus
   */
  const waitForTransactionStatus = async (provider: any, callId: string, maxAttempts = 30) => {
    logger.log(`[VyreCasino] Polling transaction status for: ${callId}`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await provider.request({
          method: 'wallet_getCallsStatus',
          params: [callId],
        });

        // Log every status update for debugging
        if (i % 5 === 0 || i < 3) {
          logger.log(
            `[VyreCasino] Poll ${i + 1}/${maxAttempts} - Status:`,
            JSON.stringify(status, null, 2)
          );
        }

        if (status) {
          if (status.status === 'CONFIRMED' || status.status === 'confirmed') {
            logger.log('[VyreCasino] ✅ Transaction CONFIRMED!', {
              txHash: status.receipts?.[0]?.transactionHash,
              receipts: status.receipts,
            });
            if (status.receipts?.[0]?.transactionHash) {
              return status.receipts[0].transactionHash;
            }
            return callId; // Fallback
          }

          if (status.status === 'FAILED' || status.status === 'failed') {
            logger.error('[VyreCasino] ❌ Transaction FAILED!', {
              error: status.error,
              status: status.status,
              full: JSON.stringify(status, null, 2),
            });
            throw new Error(`Transaction failed: ${status.error || JSON.stringify(status)}`);
          }

          // Log other statuses (PENDING, etc)
          if (status.status && status.status !== 'PENDING' && status.status !== 'pending') {
            logger.log(`[VyreCasino] Unexpected status: ${status.status}`, status);
          }
        }
      } catch (err) {
        // Log polling errors
        logger.warn(`[VyreCasino] Poll error at attempt ${i + 1}:`, err);
        // Ignore polling errors unless it's a definitive failure
        if (String(err).includes('Transaction failed')) throw err;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    logger.warn(
      '[VyreCasino] ⚠️ Transaction status polling timed out after',
      maxAttempts,
      'attempts'
    );
    return callId;
  };

  /**
   * Send transaction using session key pattern (Prepare -> Sign -> Send)
   */
  const sendSessionTransaction = useCallback(
    async (to: `0x${string}`, value: bigint, data: `0x${string}`): Promise<string | null> => {
      if (!address) return null;

      const provider = getProvider();

      // 1. Get or Create Session Key
      // This will use existing from localStorage OR create new one via popup
      // No extra validation steps here
      let sessionKey: SessionKeyData;
      try {
        sessionKey = await ensureSessionKey(address, tokenContext);
      } catch (err) {
        logger.error('Failed to ensure session key:', err);
        throw new Error('Failed to get permissions for game');
      }

      const hexValue = value ? `0x${value.toString(16)}` : '0x0';

      // 2. Prepare Call
      // Added detailed params to match wallet-demo exactly
      const prepareParams = [
        {
          calls: [
            {
              to: to.toLowerCase(),
              value: hexValue,
              data,
            },
          ],
          chainId: '0xaa39db', // Rise Testnet
          from: address,
          atomicRequired: true,
          key: {
            type: 'p256',
            publicKey: sessionKey.publicKey,
          },
        },
      ];

      logger.log('[VyreCasino] Preparing calls with params:', prepareParams);

      const prepared = await (provider as any).request({
        method: 'wallet_prepareCalls',
        params: prepareParams,
      });

      logger.log('[VyreCasino] Prepared object:', prepared);

      // 3. Sign Call
      // Extract only what we need from prepared response
      const { digest, capabilities, context, key, chainId } = prepared;
      const signature = signWithSessionKey(digest, sessionKey);

      logger.log('[VyreCasino] Generated signature:', signature);

      // 4. Send Call
      // Required: chainId, context, key, signature
      // Optional: capabilities.feeSignature
      const sendParams = {
        chainId,
        context,
        key,
        ...(capabilities?.feeSignature
          ? { capabilities: { feeSignature: capabilities.feeSignature } }
          : {}),
        signature,
      };

      logger.log(
        '[VyreCasino] Sending prepared calls with params:',
        JSON.stringify(sendParams, null, 2)
      );

      const response = await (provider as any).request({
        method: 'wallet_sendPreparedCalls',
        params: [sendParams],
      });

      // 5. Handle Response & Poll
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

      logger.log(`[VyreCasino] Transaction sent, ID: ${callId}`);

      return waitForTransactionStatus(provider, callId);
    },
    [address, tokenContext]
  );

  const sendPasskeyTransaction = useCallback(
    async (to: `0x${string}`, value: bigint, data: `0x${string}`): Promise<string | null> => {
      if (!address) return null;
      const provider = getProvider();
      const hexValue = value
        ? (`0x${value.toString(16)}` as `0x${string}`)
        : ('0x0' as `0x${string}`);

      return (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, value: hexValue, data }],
      })) as string;
    },
    [address]
  );

  const sendTransaction = useCallback(
    async (to: `0x${string}`, value: bigint, data: `0x${string}`): Promise<string | null> => {
      // Always try session key flow first
      // Our ensureSessionKey logic handles checking if we need a new one
      try {
        return await sendSessionTransaction(to, value, data);
      } catch (err) {
        // Only fallback to passkey if it's a non-recoverable session error
        // Or if user rejected permissions
        logger.warn('[VyreCasino] Session transaction failed:', err);

        // Use a simple heuristic: if it's "User rejected" don't retry with passkey immediately
        // But for safety/robustness we can try passkey as fallback
        return await sendPasskeyTransaction(to, value, data);
      }
    },
    [sendSessionTransaction, sendPasskeyTransaction]
  );

  // ---------------------------------------------------------------------------
  // TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  const approveToken = useCallback(
    async (token: `0x${string}`, amount: bigint = maxUint256): Promise<boolean> => {
      if (!address) {
        setError('Wallet not connected');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = encodeFunctionData({
          abi: ERC20_ABI as any,
          functionName: 'approve',
          args: [VYRECASINO_ADDRESS, amount],
        });

        const txHash = await sendTransaction(token, 0n, data);
        if (!txHash) {
          setError('Approval failed');
          return false;
        }

        logger.log('[VyreCasino] Token approved:', txHash);
        await new Promise((r) => setTimeout(r, 500)); // Wait for tx to be mined
        return true;
      } catch (err) {
        setError(ErrorService.getSafeMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [address, sendTransaction]
  );

  // ---------------------------------------------------------------------------
  // GAME ACTIONS
  // ---------------------------------------------------------------------------

  const placeBet = useCallback(
    async (betAmount: string, token: `0x${string}` = CHIP_TOKEN_ADDRESS): Promise<boolean> => {
      if (!address) {
        setError('Wallet not connected');
        return false;
      }

      if (!betAmount?.trim()) {
        setError('Please enter a bet amount');
        return false;
      }

      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Bet amount must be positive');
        return false;
      }

      // Determine decimals based on token
      // USDC uses 6 decimals, CHIP uses 18
      // We should really get this from token metadata, but for now we hardcode known tokens
      const isUSDC = token.toLowerCase() === '0x062fcbbe1ca8fc6d79d9a650d8022412d53b08f6'; // Replace with constant check ideally
      // Actually we have tokenContext passed in, maybe use that?
      // But safer to check address or assumes 18 unless specified.
      // VyreJackUsdc passes token context USDC.

      const decimals = isUSDC || token.toLowerCase().includes('cbe1c') ? 6 : 18;
      const betWei = parseUnits(betAmount, decimals);

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Check allowance via TokenService (cached)
        const allowanceState = await TokenService.getAllowance(token, address);

        // Step 2: Approve if needed
        if (allowanceState.amount < betWei) {
          logger.log('[VyreCasino] Approving token...');
          // Approval uses session key too!
          const approved = await approveToken(token, maxUint256);
          if (!approved) return false;
        }

        // Step 3: Call VyreCasino.play()
        const data = encodeFunctionData({
          abi: VYRECASINO_ABI as any,
          functionName: 'play',
          args: [
            VYREJACKCORE_ADDRESS, // game address
            token, // token address
            betWei, // amount
            '0x' as `0x${string}`, // empty gameData for blackjack
          ],
        });

        const txHash = await sendTransaction(VYRECASINO_ADDRESS, 0n, data);
        if (!txHash) {
          setError('Transaction failed');
          return false;
        }

        logger.log('[VyreCasino] Play TX:', txHash);
        logEvent('game_start', address, { betAmount, token, game: 'VyreJack' }).catch(() => {});

        await new Promise((r) => setTimeout(r, 100));
        onSuccess?.();
        return true;
      } catch (err) {
        logger.error('[VyreCasino] placeBet error:', err);
        setError(ErrorService.getSafeMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [address, approveToken, sendTransaction, onSuccess]
  );

  const executeGameAction = useCallback(
    async (action: GameActionName): Promise<boolean> => {
      if (!address) {
        setError('Wallet not connected');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = encodeFunctionData({
          abi: VYREJACKCORE_ABI as any,
          functionName: action,
        });

        const txHash = await sendTransaction(VYREJACKCORE_ADDRESS, 0n, data);
        if (!txHash) {
          setError('Action failed');
          return false;
        }

        logger.log(`[VyreCasino] ${action} TX:`, txHash);
        logEvent('game_action', address, { action }).catch(() => {});

        await new Promise((r) => setTimeout(r, 100));
        onSuccess?.();
        return true;
      } catch (err) {
        logger.error(`[VyreCasino] ${action} error:`, err);
        setError(ErrorService.getSafeMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [address, sendTransaction, onSuccess]
  );

  const hit = useCallback(() => executeGameAction('hit'), [executeGameAction]);
  const stand = useCallback(() => executeGameAction('stand'), [executeGameAction]);
  const double = useCallback(() => executeGameAction('double'), [executeGameAction]);

  const formatChip = useCallback((value: bigint): string => formatUnits(value, 18), []);

  return {
    isLoading,
    error,
    clearError,
    approveToken,
    placeBet,
    hit,
    stand,
    double,
    formatChip,
  };
}
