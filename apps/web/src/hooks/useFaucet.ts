/**
 * useFaucet Hook
 *
 * Manages faucet state and provides claim functionality.
 * Follows the pattern of useContractState and useGameState.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { FaucetService, type FaucetStatus } from '@/services/faucet.service';
import { emitBalanceChange } from '@/lib/balanceEvents';

export interface UseFaucetReturn {
  // Status
  status: FaucetStatus | null;
  isLoading: boolean;
  error: string | null;

  // User balance
  userBalance: bigint;
  hasEnoughChips: boolean;

  // Claim
  isClaiming: boolean;
  txHash: string | null;
  claim: () => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;

  // Computed
  canClaim: boolean;
  timeUntilClaim: number;
}

// Minimum CHIP balance below which user can claim from faucet (100 CHIP)
const CLAIM_THRESHOLD = 100n * 10n ** 18n;

export function useFaucet(): UseFaucetReturn {
  const { address, isConnected } = useWallet();

  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<bigint>(0n);

  // Countdown state (decrements every second)
  const [timeUntilClaim, setTimeUntilClaim] = useState(0);

  // Fetch faucet status and user balance
  const refresh = useCallback(async () => {
    if (!address || !isConnected) {
      setStatus(null);
      setUserBalance(0n);
      setIsLoading(false);
      return;
    }

    try {
      const [faucetStatus, balance] = await Promise.all([
        FaucetService.getFaucetStatus(address),
        FaucetService.getUserChipBalance(address),
      ]);
      setStatus(faucetStatus);
      setUserBalance(balance);
      setTimeUntilClaim(faucetStatus.timeUntilClaim);
      setError(null);
    } catch (err) {
      console.error('[useFaucet] Failed to fetch status:', err);
      setError('Failed to load faucet status');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  // Countdown timer
  useEffect(() => {
    if (timeUntilClaim <= 0) return;

    const interval = setInterval(() => {
      setTimeUntilClaim((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeUntilClaim]);

  // Fetch on mount and when address changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Claim function - optimistic UI, don't block on confirmation
  const claim = useCallback(async () => {
    if (!address || !isConnected) return;

    setIsClaiming(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await FaucetService.sendClaimTransaction(address);

      if (!hash) {
        throw new Error('Transaction failed');
      }

      // Show success immediately with tx hash
      setTxHash(hash);
      setIsClaiming(false);

      // Update header balance immediately
      emitBalanceChange();

      // Update UI immediately - assume success
      // Set cooldown to ~1 hour (3600 seconds)
      setTimeUntilClaim(3600);

      // Refresh in background after a short delay (fire-and-forget)
      setTimeout(() => {
        refresh().catch(console.error);
      }, 3000);
    } catch (err: any) {
      console.error('[useFaucet] Claim failed:', err);
      setError(err.message || 'Claim failed');
      setIsClaiming(false);
    }
  }, [address, isConnected, refresh]);

  // User has enough CHIP if balance >= threshold
  const hasEnoughChips = userBalance >= CLAIM_THRESHOLD;

  return {
    status,
    isLoading,
    error,
    userBalance,
    hasEnoughChips,
    isClaiming,
    txHash,
    claim,
    refresh,
    // Can only claim if: cooldown expired AND contract allows AND user has low balance
    canClaim: timeUntilClaim <= 0 && (status?.canClaim ?? false) && !hasEnoughChips,
    timeUntilClaim,
  };
}

/**
 * Hook to check if user can claim (for auto-opening modal)
 * Only returns true if:
 * 1. Contract cooldown allows claim
 * 2. User has 0 CHIP balance (not just low balance)
 *
 * This prevents the popup from auto-opening for users who already have CHIP.
 * Manual click on "Get CHIP" button will still work.
 */
export function useFaucetCanClaim(): boolean {
  const { address, isConnected } = useWallet();
  const [shouldAutoOpen, setShouldAutoOpen] = useState(false);

  useEffect(() => {
    if (!address || !isConnected) {
      setShouldAutoOpen(false);
      return;
    }

    // Check both: can claim from contract AND user has 0 balance
    Promise.all([FaucetService.canUserClaim(address), FaucetService.getUserChipBalance(address)])
      .then(([canClaim, userBalance]) => {
        // Only auto-open if user can claim AND has zero CHIP
        const hasZeroBalance = userBalance === 0n;
        setShouldAutoOpen(canClaim && hasZeroBalance);
      })
      .catch(() => setShouldAutoOpen(false));
  }, [address, isConnected]);

  return shouldAutoOpen;
}
