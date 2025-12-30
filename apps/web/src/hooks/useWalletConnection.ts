/**
 * useWalletConnection - Wallet connection without wagmi
 * Uses RiseWallet singleton + localStorage (Meteoro pattern)
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { getProvider } from '@/lib/riseWallet';

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
        const provider = getProvider();
        const accounts = (await provider.request({
          method: 'eth_accounts',
        })) as `0x${string}`[];

        if (
          accounts?.length > 0 &&
          accounts[0].toLowerCase() === savedWallet.address.toLowerCase()
        ) {
          console.log('🔗 Wallet session restored:', accounts[0]);
          setAddress(accounts[0]);
          setIsConnected(true);
        } else {
          console.log('🔗 Wallet session expired');
          removeWallet();
        }
      } catch {
        console.warn('🔗 Could not verify wallet session');
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

      console.log('🔗 Connecting to Rise Wallet...');
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as `0x${string}`[];

      if (!accounts?.length) {
        throw new Error('No accounts returned');
      }

      const walletAddress = accounts[0];
      console.log('🔗 Connected:', walletAddress);

      setAddress(walletAddress);
      setIsConnected(true);
      saveWallet(walletAddress);
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
    setAddress(null);
    setIsConnected(false);
    setError(null);
    removeWallet();
    console.log('🔗 Disconnected');
  }, []);

  return {
    address,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
