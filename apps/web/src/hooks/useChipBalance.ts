/**
 * useChipBalance - Hook to read CHIP token balance
 *
 * Uses the ERC20 balanceOf function to get the user's CHIP balance.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { createPublicClient, http, formatEther } from 'viem';
import { useWallet } from '@/context/WalletContext';
import { CHIP_TOKEN_ADDRESS, riseTestnet } from '@/lib/faucet';

// Minimal ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Create public client for reading
const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(),
});

export interface UseChipBalanceReturn {
  /** CHIP balance in wei */
  balance: bigint | null;
  /** CHIP balance formatted as string with decimals */
  formattedBalance: string;
  /** CHIP balance as a number (for display) */
  displayBalance: string;
  /** Is currently loading */
  isLoading: boolean;
  /** Refresh the balance */
  refresh: () => Promise<void>;
}

export function useChipBalance(): UseChipBalanceReturn {
  const { address, isConnected } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!address || !isConnected) {
      setBalance(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await publicClient.readContract({
        address: CHIP_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setBalance(result);
    } catch (err) {
      console.error('[useChipBalance] Error:', err);
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  // Initial load and refresh on address change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Format balance for display
  const formattedBalance = balance !== null ? formatEther(balance) : '0';

  // Display balance with reasonable decimals
  const displayBalance =
    balance !== null
      ? Number(formatEther(balance)).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : '0';

  return {
    balance,
    formattedBalance,
    displayBalance,
    isLoading,
    refresh,
  };
}
