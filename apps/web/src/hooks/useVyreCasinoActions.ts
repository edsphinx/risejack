/**
 * useVyreCasinoActions - Game actions for VyreCasino architecture
 *
 * Handles:
 * - Token approval (CHIP/USDC → VyreCasino)
 * - Casino.play() for starting games
 * - Direct calls to VyreJackCore for hit/stand/double
 *
 * Flow:
 * 1. Check token allowance
 * 2. Approve if needed
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
import { ErrorService } from '@/services';
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
  // Token management
  approveToken: (token: `0x${string}`, amount?: bigint) => Promise<boolean>;
  checkAllowance: (token: `0x${string}`) => Promise<bigint>;
  getTokenBalance: (token: `0x${string}`) => Promise<bigint>;
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
  const { address, hasSessionKey, keyPair, onSuccess } = config;

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
        if (msg.includes('not been authorized') || msg.includes('unauthorized')) {
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
      if (hasSessionKey && keyPair) {
        try {
          return await sendSessionTransaction(to, value, data);
        } catch {
          return await sendPasskeyTransaction(to, value, data);
        }
      }
      return await sendPasskeyTransaction(to, value, data);
    },
    [hasSessionKey, keyPair, sendSessionTransaction, sendPasskeyTransaction]
  );

  // ---------------------------------------------------------------------------
  // TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  const checkAllowance = useCallback(
    async (token: `0x${string}`): Promise<bigint> => {
      if (!address) return 0n;
      const provider = getProvider();

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, VYRECASINO_ADDRESS],
      });

      const result = (await provider.request({
        method: 'eth_call',
        params: [{ to: token, data }],
      })) as `0x${string}`;

      return BigInt(result);
    },
    [address]
  );

  const getTokenBalance = useCallback(
    async (token: `0x${string}`): Promise<bigint> => {
      if (!address) return 0n;
      const provider = getProvider();

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });

      const result = (await provider.request({
        method: 'eth_call',
        params: [{ to: token, data }],
      })) as `0x${string}`;

      return BigInt(result);
    },
    [address]
  );

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
        // Step 1: Check allowance
        const allowance = await checkAllowance(token);
        logger.log('[VyreCasino] Current allowance:', formatUnits(allowance, 18));

        // Step 2: Approve if needed
        if (allowance < betWei) {
          logger.log('[VyreCasino] Approving CHIP...');
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
    [address, checkAllowance, approveToken, sendTransaction, onSuccess]
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
    checkAllowance,
    getTokenBalance,
    placeBet,
    hit,
    stand,
    double,
    formatChip,
  };
}
