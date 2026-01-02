/**
 * useWalletConnection - Wallet connection without wagmi
 * Uses RiseWallet singleton + localStorage (Meteoro pattern)
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getProvider } from '@/lib/riseWallet';
import { logger } from '@/lib/logger';
import { logEvent, registerUser } from '@/lib/api';

// Storage key
const WALLET_STORAGE_KEY = 'risejack.wallet';

export interface WalletData {
  address: `0x${string}`;
}

export interface UseWalletConnectionReturn {
  address: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
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

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedWallet = getSavedWallet();
      if (!savedWallet) return;

      try {
        // Wait a bit for Rise Wallet to initialize
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Use the SAME Rise Wallet singleton as connect() to ensure consistent account derivation
        const provider = getProvider();

        // Check for existing accounts using Rise Wallet's provider
        const accounts = (await provider.request({
          method: 'eth_accounts',
        })) as `0x${string}`[];

        if (accounts?.length > 0) {
          const restoredAddress = accounts[0];
          // Verify it matches our saved address
          if (restoredAddress.toLowerCase() === savedWallet.address.toLowerCase()) {
            logger.log('🔗 Wallet auto-reconnected:', restoredAddress);
            setAddress(restoredAddress);
            setIsConnected(true);
            return;
          } else {
            logger.log('🔗 Different account found, clearing saved wallet');
            removeWallet();
          }
        } else {
          logger.log('🔗 No accounts found, wallet session expired');
          // Don't remove saved wallet - user can manually reconnect
        }
      } catch {
        logger.warn('🔗 Could not verify wallet session');
        removeWallet();
      }
    };

    restoreSession();
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = getProvider();

      logger.log('🔗 Connecting to Rise Wallet...');
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as `0x${string}`[];

      if (!accounts?.length) {
        throw new Error('No accounts returned');
      }

      const walletAddress = accounts[0];
      logger.log('🔗 Connected:', walletAddress);

      setAddress(walletAddress);
      setIsConnected(true);
      saveWallet(walletAddress);

      // Log event & register user (fire-and-forget)
      logEvent('wallet_connect', walletAddress, { provider: 'rise_wallet' }).catch(() => {});
      registerUser(walletAddress).catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
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

  return {
    address,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
