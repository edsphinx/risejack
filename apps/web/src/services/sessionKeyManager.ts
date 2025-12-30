/**
 * Session Key Manager
 * Handles creation, validation, and management of Rise Wallet session keys
 * Based on Meteoro's sessionKeyManager.js
 */

import { P256, PublicKey, Signature } from 'ox';
import { getProvider } from '@/lib/riseWallet';
import { GAME_PERMISSIONS } from '@/lib/gamePermissions';

// Storage prefix
const STORAGE_PREFIX = 'risejack.sessionKey';

// Session key expiry (1 hour)
const SESSION_EXPIRY_SECONDS = 3600;

// Module-level cache
let activeKeyPair: SessionKeyData | null = null;

export interface SessionKeyData {
  privateKey: string;
  publicKey: string;
  expiry: number;
  createdAt: number;
  address?: string;
}

/**
 * Get storage key for a public key
 */
function getStorageKey(publicKey: string): string {
  return `${STORAGE_PREFIX}.${publicKey}`;
}

/**
 * Get all stored session keys from localStorage
 */
export function getStoredSessionKeys(): SessionKeyData[] {
  if (typeof window === 'undefined') return [];

  const keys: SessionKeyData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '');
        if (data?.publicKey) {
          keys.push(data);
        }
      } catch {
        // Ignore invalid entries
      }
    }
  }
  return keys;
}

/**
 * Check if a session key is still valid (not expired)
 */
export function isSessionKeyValid(sessionKey: SessionKeyData | null): boolean {
  if (!sessionKey?.publicKey || !sessionKey?.privateKey || !sessionKey?.expiry) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return sessionKey.expiry > now;
}

/**
 * Get the active session key pair (if any)
 */
export function getActiveSessionKey(): SessionKeyData | null {
  // First check module-level cache
  if (activeKeyPair && isSessionKeyValid(activeKeyPair)) {
    return activeKeyPair;
  }

  // Try to restore from localStorage
  const storedKeys = getStoredSessionKeys();
  const validKey = storedKeys.find((key) => isSessionKeyValid(key));

  if (validKey) {
    activeKeyPair = validKey;
    return validKey;
  }

  return null;
}

/**
 * Check if we have a usable session key
 */
export function hasUsableSessionKey(): boolean {
  return getActiveSessionKey() !== null;
}

/**
 * Create a new session key and request permissions from Rise Wallet
 */
export async function createSessionKey(walletAddress: string): Promise<SessionKeyData> {
  console.log('🔑 Creating new session key...');

  const provider = getProvider();

  // Generate P256 key pair
  const privateKey = P256.randomPrivateKey();
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
    includePrefix: false,
  });

  console.log('🔑 Generated P256 key pair');
  console.log('   Public key:', publicKey.slice(0, 20) + '...');

  // Calculate expiry
  const expiry = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

  // Request permissions from Rise Wallet
  const permissionParams = [
    {
      key: {
        type: 'p256',
        publicKey: publicKey,
      },
      expiry: expiry,
      permissions: GAME_PERMISSIONS,
      feeToken: {
        token: '0x0000000000000000000000000000000000000000',
        limit: '10000000000000000', // 0.01 ETH for gas
      },
    },
  ];

  console.log('🔑 Requesting permissions:', permissionParams);

  // Use type assertion since SDK types are too strict for our params
  await (
    provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
  ).request({
    method: 'wallet_grantPermissions',
    params: permissionParams,
  });

  console.log('🔑 Permissions granted');

  // Store session key data
  const sessionKeyData: SessionKeyData = {
    privateKey,
    publicKey,
    expiry,
    createdAt: Date.now(),
    address: walletAddress,
  };

  // Save to localStorage
  localStorage.setItem(getStorageKey(publicKey), JSON.stringify(sessionKeyData));

  // Update cache
  activeKeyPair = sessionKeyData;

  console.log('🔑 Session key created successfully');
  console.log('   Expires:', new Date(expiry * 1000).toLocaleString());

  return sessionKeyData;
}

/**
 * Revoke a session key
 */
export async function revokeSessionKey(publicKey: string): Promise<void> {
  console.log('🔑 Revoking session key:', publicKey.slice(0, 20) + '...');

  const provider = getProvider();

  try {
    await (
      provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
    ).request({
      method: 'wallet_revokePermissions',
      params: [{ id: publicKey }],
    });
    console.log('🔑 Permissions revoked on wallet');
  } catch {
    console.warn('⚠️ Failed to revoke on wallet (may already be revoked)');
  }

  // Clean up local storage
  localStorage.removeItem(getStorageKey(publicKey));

  // Clear cache if this was the active key
  if (activeKeyPair?.publicKey === publicKey) {
    activeKeyPair = null;
  }

  console.log('🔑 Session key removed');
}

/**
 * Clear all stored session keys
 */
export function clearAllSessionKeys(): void {
  console.log('🔑 Clearing all session keys...');

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  activeKeyPair = null;

  console.log(`🔑 Cleared ${keysToRemove.length} session keys`);
}

/**
 * Sign a digest using session key
 */
export function signWithSessionKey(digest: `0x${string}`, sessionKey: SessionKeyData): string {
  if (!sessionKey?.privateKey) {
    throw new Error('No valid session key for signing');
  }

  const signature = Signature.toHex(
    P256.sign({
      payload: digest,
      privateKey: sessionKey.privateKey as `0x${string}`,
    })
  );

  return signature;
}

/**
 * Get time remaining until session key expires
 */
export function getSessionKeyTimeRemaining(sessionKey: SessionKeyData | null): {
  seconds: number;
  minutes: number;
  hours: number;
  expired: boolean;
} {
  if (!sessionKey?.expiry) {
    return { seconds: 0, minutes: 0, hours: 0, expired: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsRemaining = Math.max(0, sessionKey.expiry - now);

  return {
    seconds: secondsRemaining,
    minutes: Math.floor(secondsRemaining / 60),
    hours: Math.floor(secondsRemaining / 3600),
    expired: secondsRemaining <= 0,
  };
}
