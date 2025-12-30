/**
 * Storage Service - Centralized localStorage handling
 * All localStorage operations go through this service for consistency and type safety.
 */

const STORAGE_KEYS = {
  WALLET: 'risejack.wallet',
  SESSION_KEY_PREFIX: 'risejack.sessionKey',
} as const;

// Types
interface WalletData {
  address: `0x${string}`;
}

interface SessionKeyData {
  publicKey: `0x${string}`;
  privateKey: `0x${string}`;
  expiry: number; // Unix timestamp
  createdAt: number;
}

// ==================== Wallet Storage ====================

function getWallet(): WalletData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WALLET);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setWallet(address: `0x${string}`): void {
  localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify({ address }));
}

function removeWallet(): void {
  localStorage.removeItem(STORAGE_KEYS.WALLET);
}

// ==================== Session Key Storage ====================

function getSessionKeyStorageKey(publicKey: string): string {
  return `${STORAGE_KEYS.SESSION_KEY_PREFIX}.${publicKey}`;
}

function getSessionKey(publicKey: string): SessionKeyData | null {
  try {
    const data = localStorage.getItem(getSessionKeyStorageKey(publicKey));
    if (!data) return null;

    const parsed = JSON.parse(data) as SessionKeyData;
    // Validate expiry
    if (parsed.expiry <= Math.floor(Date.now() / 1000)) {
      removeSessionKey(publicKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setSessionKey(data: SessionKeyData): void {
  localStorage.setItem(getSessionKeyStorageKey(data.publicKey), JSON.stringify(data));
}

function removeSessionKey(publicKey: string): void {
  localStorage.removeItem(getSessionKeyStorageKey(publicKey));
}

function findValidSessionKey(): SessionKeyData | null {
  const now = Math.floor(Date.now() / 1000);
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(`${STORAGE_KEYS.SESSION_KEY_PREFIX}.`)
  );

  for (const key of keys) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data) as SessionKeyData;
        if (parsed.expiry > now) {
          return parsed;
        }
        // Clean up expired key
        localStorage.removeItem(key);
      }
    } catch {
      continue;
    }
  }
  return null;
}

function clearAllSessionKeys(): void {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(`${STORAGE_KEYS.SESSION_KEY_PREFIX}.`)
  );
  keys.forEach((k) => localStorage.removeItem(k));
}

// ==================== Export ====================

export const StorageService = {
  // Wallet
  getWallet,
  setWallet,
  removeWallet,

  // Session Keys
  getSessionKey,
  setSessionKey,
  removeSessionKey,
  findValidSessionKey,
  clearAllSessionKeys,
} as const;

export type { WalletData, SessionKeyData };
