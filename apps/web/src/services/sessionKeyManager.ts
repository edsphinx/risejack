/**
 * Session Key Manager
 * Handles creation, validation, and management of Rise Wallet session keys
 * Based on Meteoro's sessionKeyManager.js
 */

import { P256, PublicKey, Signature } from 'ox';
import { getProvider } from '@/lib/riseWallet';
import { GAME_PERMISSIONS } from '@/lib/gamePermissions';
import { logger } from '@/lib/logger';

// Storage prefix
const STORAGE_PREFIX = 'vyrejack.sessionKey';

// Session key expiry - 30 days for "keyless" experience
// Users can always recover via social login if needed
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days = 2,592,000 seconds

// Flag to indicate long-duration mode (affects UI behavior)
export const SESSION_KEY_LONG_DURATION = true;

// Threshold for showing expiry warnings (24 hours before expiry)
export const EXPIRY_WARNING_THRESHOLD_HOURS = 24;

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
 * Validate that a session key exists in Rise Wallet (not just localStorage)
 * Uses Porto's hydrated zustand state instead of RPC calls to avoid "provider disconnected" errors
 */
export async function validateSessionKeyWithWallet(): Promise<boolean> {
  const sessionKey = getActiveSessionKey();
  if (!sessionKey) return false;

  try {
    // Import and wait for Porto's zustand store to hydrate from IndexedDB
    const { getRiseWallet, waitForHydration } = await import('@/lib/riseWallet');
    await waitForHydration();

    const rw = getRiseWallet();

    // Access Porto's hydrated zustand state DIRECTLY instead of using RPC
    // This avoids "provider disconnected" errors after page refresh
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (rw._internal.store as any).getState();
    const accounts = state?.accounts as
      | Array<{ address: string; keys?: Array<{ publicKey?: string; expiry?: number }> }>
      | undefined;

    if (!accounts || accounts.length === 0) {
      logger.warn('🔑 No accounts in Porto state, cannot validate session key');
      return false;
    }

    // Get keys from first account (session keys are stored with account)
    const accountKeys = accounts[0].keys;

    if (!accountKeys || !Array.isArray(accountKeys)) {
      logger.warn('🔑 No keys found in Porto account state');
      // Clear stale local session key since Rise Wallet doesn't have keys
      clearAllSessionKeys();
      return false;
    }

    // Debug: Log all session keys in Porto state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionKeysInPorto = (accountKeys as any[]).filter((k) => k.role === 'session');
    logger.log(`🔑 [DEBUG] Porto has ${sessionKeysInPorto.length} session keys:`);
    sessionKeysInPorto.forEach((k: { publicKey?: string; expiry?: number }, i: number) => {
      logger.log(`   [${i}] ${k.publicKey?.slice(0, 30)}... (expires: ${k.expiry})`);
    });
    logger.log(`🔑 [DEBUG] Our localStorage key: ${sessionKey.publicKey?.slice(0, 30)}...`);

    // Check if our session key's publicKey exists in the account's keys
    const now = Math.floor(Date.now() / 1000);
    const matchingKey = accountKeys.find(
      (k: { publicKey?: string; expiry?: number }) =>
        k.publicKey === sessionKey.publicKey && (k.expiry ?? 0) > now
    );

    if (matchingKey) {
      logger.log('🔑 Session key validated with Porto state ✓');
      return true;
    } else {
      logger.warn('🔑 Session key NOT found in Porto account keys - clearing stale key');
      // Clear the stale session key from localStorage
      clearAllSessionKeys();
      return false;
    }
  } catch (error) {
    logger.warn('🔑 Failed to validate session key with Porto state:', error);
    return false;
  }
}

/**
 * Create a new session key and request permissions from Rise Wallet
 */
export async function createSessionKey(walletAddress: string): Promise<SessionKeyData> {
  logger.log('🔑 Creating new session key...');

  const provider = getProvider();

  // Generate P256 key pair
  const privateKey = P256.randomPrivateKey();
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
    includePrefix: false,
  });

  logger.log('🔑 Generated P256 key pair');
  logger.log('   Public key:', publicKey.slice(0, 20) + '...');

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

  logger.log('🔑 Requesting permissions:', permissionParams);

  // Ensure provider is connected (needed after page refresh)
  // This may prompt for PIN but is required for grantPermissions to work
  try {
    await (
      provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    ).request({
      method: 'wallet_connect',
      params: [{}],
    });
  } catch {
    // Ignore errors - wallet_connect might fail if already connected
  }

  // Use type assertion since SDK types are too strict for our params
  await (
    provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
  ).request({
    method: 'wallet_grantPermissions',
    params: permissionParams,
  });

  logger.log('🔑 Permissions granted');

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

  logger.log('🔑 Session key created successfully');
  logger.log('   Expires:', new Date(expiry * 1000).toLocaleString());

  return sessionKeyData;
}

/**
 * Revoke a session key
 */
export async function revokeSessionKey(publicKey: string): Promise<void> {
  logger.log('🔑 Revoking session key:', publicKey.slice(0, 20) + '...');

  const provider = getProvider();

  try {
    await (
      provider as { request: (args: { method: string; params: unknown }) => Promise<unknown> }
    ).request({
      method: 'wallet_revokePermissions',
      params: [{ id: publicKey }],
    });
    logger.log('🔑 Permissions revoked on wallet');
  } catch {
    logger.warn('⚠️ Failed to revoke on wallet (may already be revoked)');
  }

  // Clean up local storage
  localStorage.removeItem(getStorageKey(publicKey));

  // Clear cache if this was the active key
  if (activeKeyPair?.publicKey === publicKey) {
    activeKeyPair = null;
  }

  logger.log('🔑 Session key removed');
}

/**
 * Clear all stored session keys
 */
export function clearAllSessionKeys(): void {
  logger.log('🔑 Clearing all session keys...');

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  activeKeyPair = null;

  logger.log(`🔑 Cleared ${keysToRemove.length} session keys`);
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
