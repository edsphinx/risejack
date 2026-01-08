/**
 * useVyreCasinoActions - Game WRITE actions for VyreCasino architecture
 *
 * ⚡ PERFORMANCE: Uses TokenService for reads (no duplicate RPC calls)
 * 🔧 MAINTAINABILITY: ONLY handles writes, reads done via hooks/services
 *
 * Handles:
 * - Token approval (CHIP/USDC → VyreCasino)
 * - Casino.play() for starting games
 * - Direct calls to VyreJackCore for hit/stand/double
 *
 * Flow:
 * 1. Check token allowance (via TokenService)
 * 2. Approve if needed (write)
 * 3. Call VyreCasino.play(game, token, amount, data)
 * 4. For actions: call VyreJackCore.hit(), stand(), etc.
 */

import { useState, useCallback } from 'preact/hooks';
import { encodeFunctionData, parseUnits, formatUnits, maxUint256 } from 'viem';
import { getProvider } from '@/lib/riseWallet';
import {
  signWithSessionKey,
  getActiveSessionKey,
  clearAllSessionKeys,
  createSessionKey,
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

type GameActionName = 'hit' | 'stand';

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
  hasSessionKey: boolean;
  keyPair: { publicKey: string; privateKey: string } | null;
  onSuccess?: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useVyreCasinoActions(config: VyreCasinoActionsConfig): UseVyreCasinoActionsReturn {
  const { address, onSuccess } = config;
  // Note: hasSessionKey and keyPair from config are no longer used
  // We now check getActiveSessionKey() directly in sendTransaction for freshest state

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // TRANSACTION HELPERS
  // ---------------------------------------------------------------------------

  const sendSessionTransaction = useCallback(
    async (
      to: `0x${string}`,
      value: bigint,
      data: `0x${string}`
    ): Promise<`0x${string}` | null> => {
      const sessionKey = getActiveSessionKey();
      if (!sessionKey || !address) return null;

      const provider = getProvider();
      const hexValue = value
        ? (`0x${value.toString(16)}` as `0x${string}`)
        : ('0x0' as `0x${string}`);

      const executeWithKey = async (key: typeof sessionKey) => {
        // Log the exact call we're attempting
        const selector = data.slice(0, 10);
        logger.log('[VyreCasinoActions] Attempting call:', {
          to: to.toLowerCase(),
          selector,
          publicKey: key!.publicKey.slice(0, 30) + '...',
        });

        const prepareParams = [
          {
            calls: [{ to: to.toLowerCase() as `0x${string}`, value: hexValue, data }],
            key: { type: 'p256', publicKey: key!.publicKey },
          },
        ];

        const prepared = (await (provider as any).request({
          method: 'wallet_prepareCalls',
          params: prepareParams,
        })) as { digest: `0x${string}` };

        const { digest, ...requestParams } = prepared;
        const signature = signWithSessionKey(digest, key!);

        const response = (await (provider as any).request({
          method: 'wallet_sendPreparedCalls',
          params: [{ ...requestParams, signature }],
        })) as Array<{ id: `0x${string}` }>;

        return response[0]?.id || null;
      };

      try {
        return await executeWithKey(sessionKey);
      } catch (firstError) {
        const msg = String(firstError);
        logger.log('[VyreCasinoActions] Session key TX failed:', msg);

        if (msg.includes('not been authorized') || msg.includes('unauthorized')) {
          logger.log('[VyreCasinoActions] Detected auth error, recreating session key...');
          // Try to recreate session key
          clearAllSessionKeys();
          const newKey = await createSessionKey(address);
          return await executeWithKey(newKey);
        }
        throw firstError;
      }
    },
    [address]
  );

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

      return (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to, value: hexValue, data }],
      })) as `0x${string}`;
    },
    [address]
  );

  const sendTransaction = useCallback(
    async (
      to: `0x${string}`,
      value: bigint,
      data: `0x${string}`
    ): Promise<`0x${string}` | null> => {
      // Check for valid session key directly (not from props which may be stale)
      const currentSessionKey = getActiveSessionKey();

      if (currentSessionKey) {
        logger.log('[VyreCasinoActions] Using session key for transaction');
        try {
          return await sendSessionTransaction(to, value, data);
        } catch (err) {
          logger.log('[VyreCasinoActions] Session key failed, falling back to passkey:', err);
          return await sendPasskeyTransaction(to, value, data);
        }
      }

      logger.log('[VyreCasinoActions] No session key, using passkey');
      return await sendPasskeyTransaction(to, value, data);
    },
    [sendSessionTransaction, sendPasskeyTransaction] // Removed hasSessionKey, keyPair from deps
  );

  // ---------------------------------------------------------------------------
  // TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  // ⚡ READS now use TokenService (cached, optimized)
  // checkAllowance and getTokenBalance removed - use TokenService directly or useTokenBalance hook

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
          abi: ERC20_ABI,
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

      // CHIP has 18 decimals
      const betWei = parseUnits(betAmount, 18);

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Check allowance via TokenService (cached)
        const allowanceState = await TokenService.getAllowance(token, address);
        logger.log(
          '[VyreCasino] Current allowance:',
          allowanceState.isApproved ? 'approved' : 'need approval'
        );

        // Step 2: Approve if needed (check against bet amount)
        if (allowanceState.amount < betWei) {
          logger.log('[VyreCasino] Approving token...');
          const approved = await approveToken(token, maxUint256);
          if (!approved) return false;
        }

        // Step 3: Call VyreCasino.play()
        const data = encodeFunctionData({
          abi: VYRECASINO_ABI,
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

  // Player actions go directly to VyreJackCore
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
          abi: VYREJACKCORE_ABI,
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
  // TODO: double not yet in VyreJackCore ABI - implement when available
  const double = useCallback(() => {
    setError('Double not yet available');
    return Promise.resolve(false);
  }, []);

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
