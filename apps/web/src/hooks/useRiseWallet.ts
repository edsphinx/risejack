/**
 * useRiseWallet - Compositor hook for Rise Wallet functionality
 * Combines useWalletConnection and useSessionKey
 */

import { useWalletConnection } from './useWalletConnection';
import { useSessionKey } from './useSessionKey';
import type { TimeRemaining } from '@risejack/shared';

export interface UseRiseWalletReturn {
  // Connection
  address: `0x${string}` | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Session Key
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  createSessionKey: () => Promise<boolean>;
  revokeSessionKey: () => Promise<void>;

  // Internal - for useGameActions
  keyPair: { publicKey: string; privateKey: string } | null;
}

export function useRiseWallet(): UseRiseWalletReturn {
  const connection = useWalletConnection();
  const sessionKey = useSessionKey(connection.address);

  // Combine disconnect to also revoke session key
  const disconnect = async () => {
    await sessionKey.revoke();
    connection.disconnect();
  };

  return {
    // Connection
    address: connection.address,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting || sessionKey.isCreating,
    error: connection.error,
    connect: connection.connect,
    disconnect,

    // Session Key
    hasSessionKey: sessionKey.hasSessionKey,
    sessionExpiry: sessionKey.sessionExpiry,
    createSessionKey: sessionKey.create,
    revokeSessionKey: sessionKey.revoke,

    // Internal for useGameActions
    keyPair: sessionKey.keyPair,
  };
}
