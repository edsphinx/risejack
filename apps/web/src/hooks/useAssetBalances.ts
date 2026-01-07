/**
 * useAssetBalances - Hook for fetching multiple asset balances and approval status
 *
 * ⚡ PERFORMANCE: Parallel fetches, uses TokenService caching
 * Returns balances and approval status for CHIP, USDC, ETH
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { TokenService } from '@/services/token.service';
import { CHIP_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '@/lib/contract';
import { logger } from '@/lib/logger';

export interface AssetInfo {
  symbol: string;
  balance: string;
  balanceRaw: bigint;
  decimals: number;
  isApproved: boolean;
  icon: string;
}

export interface UseAssetBalancesReturn {
  assets: AssetInfo[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAssetBalances(account: `0x${string}` | null): UseAssetBalancesReturn {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!account) {
      setAssets([]);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch all balances and approvals in parallel
      const [chipBalance, usdcBalance, chipAllowance, usdcAllowance] = await Promise.all([
        TokenService.getBalance(CHIP_TOKEN_ADDRESS, account),
        TokenService.getBalance(USDC_TOKEN_ADDRESS, account),
        TokenService.getAllowance(CHIP_TOKEN_ADDRESS, account),
        TokenService.getAllowance(USDC_TOKEN_ADDRESS, account),
      ]);

      setAssets([
        {
          symbol: 'CHIP',
          balance: parseFloat(chipBalance.formatted).toFixed(2),
          balanceRaw: chipBalance.raw,
          decimals: chipBalance.decimals,
          isApproved: chipAllowance.isApproved,
          icon: '🟡',
        },
        {
          symbol: 'USDC',
          balance: parseFloat(usdcBalance.formatted).toFixed(2),
          balanceRaw: usdcBalance.raw,
          decimals: usdcBalance.decimals,
          isApproved: usdcAllowance.isApproved,
          icon: '💵',
        },
      ]);
    } catch (error) {
      logger.error('[useAssetBalances] Error fetching:', error);
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return {
    assets,
    isLoading,
    refresh: fetchAssets,
  };
}
