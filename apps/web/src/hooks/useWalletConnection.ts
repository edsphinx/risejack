/**
 * useWalletConnection - Wallet connection without wagmi
 * Uses RiseWallet singleton + localStorage (Meteoro pattern)
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getProvider } from '@/lib/riseWallet';
import { logger } from '@/lib/logger';
import { logEvent, registerUser } from '@/lib/api';
import {
  recordConnectionFailure,
  clearConnectionFailures,
  isCorruptedStateError,
} from '@/lib/walletRecovery';

// Storage key
const WALLET_STORAGE_KEY = 'vyrejack.wallet';

// Number of failures before showing recovery modal
const FAILURE_THRESHOLD = 2;

export interface WalletData {
  address: `0x${string}`;
}

export interface UseWalletConnectionReturn {
  address: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  showRecoveryModal: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  openRecoveryModal: () => void;
  closeRecoveryModal: () => void;
  handleRecoveryComplete: () => void;
}

/**
 * Get saved wallet from localStorage
 */
function getSavedWallet(): WalletData | null {
  try {
    const data = localStorage.getItem(WALLET_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Save wallet to localStorage
 */
function saveWallet(address: `0x${string}`): void {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address }));
}

/**
 * Remove wallet from localStorage
 */
function removeWallet(): void {
  localStorage.removeItem(WALLET_STORAGE_KEY);
}

export function useWalletConnection(): UseWalletConnectionReturn {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedWallet = getSavedWallet();
      if (!savedWallet) return;

      try {
        // Import and wait for Porto's zustand store to hydrate from IndexedDB
        // This is critical for session key persistence - without this, Porto hasn't
        // loaded the account state and will return "provider disconnected" errors
        const { getRiseWallet, waitForHydration } = await import('@/lib/riseWallet');
        await waitForHydration();

        const rw = getRiseWallet();

        // Access Porto's hydrated zustand state DIRECTLY instead of calling wallet_connect
        // wallet_connect is interactive (prompts for PIN), but after hydration,
        // the accounts are already in zustand state from IndexedDB
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (rw._internal.store as any).getState();
        const hydratedAccounts = state?.accounts as Array<{ address: `0x${string}` }> | undefined;

        if (hydratedAccounts && hydratedAccounts.length > 0) {
          const restoredAddress = hydratedAccounts[0].address;
          // Verify it matches our saved address
          if (restoredAddress.toLowerCase() === savedWallet.address.toLowerCase()) {
            logger.log('🔗 Wallet silently restored from Porto state:', restoredAddress);
            setAddress(restoredAddress);
            setIsConnected(true);
            clearConnectionFailures();
            return;
          } else {
            logger.log('🔗 Different account in Porto state, clearing saved wallet');
            removeWallet();
          }
        } else {
          logger.log('🔗 No accounts in Porto hydrated state, session expired');
          // Don't remove saved wallet - user can manually reconnect
        }
      } catch (err) {
        logger.warn('🔗 Could not restore wallet session:', err);
        // Don't remove saved wallet - user can manually reconnect
      }
    };

    restoreSession();
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = getProvider();

      logger.log('🔗 Connecting to Rise Wallet via wallet_connect...');

      // Use wallet_connect instead of eth_requestAccounts for proper persistence
      // wallet_connect persists the account to Rise Wallet's IndexedDB, enabling
      // session keys to survive page refresh
      const response = await (
        provider as {
          request: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<{ accounts: Array<{ address: `0x${string}` }> }>;
        }
      ).request({
        method: 'wallet_connect',
        params: [{}], // Empty capabilities for basic connection
      });

      const accounts = response.accounts;
      if (!accounts?.length) {
        throw new Error('No accounts returned');
      }

      const walletAddress = accounts[0].address;
      logger.log('🔗 Connected via wallet_connect:', walletAddress);

      setAddress(walletAddress);
      setIsConnected(true);
      saveWallet(walletAddress);
      clearConnectionFailures(); // Clear failures on success

      // Log event & register user (fire-and-forget)
      logEvent('wallet_connect', walletAddress, { provider: 'rise_wallet' }).catch(() => {});
      registerUser(walletAddress).catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect';

      // Track failures for potential corrupted state
      if (isCorruptedStateError(err)) {
        const failureCount = recordConnectionFailure();
        logger.warn(`🔗 Connection failure #${failureCount}:`, message);

        if (failureCount >= FAILURE_THRESHOLD) {
          // Show recovery modal
          setShowRecoveryModal(true);
          setError(null); // Don't show error if we're showing the modal
          return;
        }
      }

      if (message.includes('rejected') || message.includes('cancelled')) {
        setError('Connection was cancelled');
      } else {
        setError(message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    const prevAddress = address;
    setAddress(null);
    setIsConnected(false);
    setError(null);
    removeWallet();
    logger.log('🔗 Disconnected');

    // Log disconnect event (fire-and-forget)
    if (prevAddress) {
      logEvent('wallet_disconnect', prevAddress).catch(() => {});
    }
  }, [address]);

  const openRecoveryModal = useCallback(() => {
    setShowRecoveryModal(true);
  }, []);

  const closeRecoveryModal = useCallback(() => {
    setShowRecoveryModal(false);
  }, []);

  const handleRecoveryComplete = useCallback(() => {
    setShowRecoveryModal(false);
    setError(null);
    clearConnectionFailures();
    // Trigger reconnect after a small delay
    setTimeout(() => {
      connect();
    }, 500);
  }, [connect]);

  return {
    address,
    isConnected,
    isConnecting,
    error,
    showRecoveryModal,
    connect,
    disconnect,
    openRecoveryModal,
    closeRecoveryModal,
    handleRecoveryComplete,
  };
}
