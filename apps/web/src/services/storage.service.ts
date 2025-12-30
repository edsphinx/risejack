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

// ==================== Game History Storage ====================

const GAME_HISTORY_KEY = 'risejack.gameHistory';
const MAX_HISTORY_ENTRIES = 50;

export interface GameHistoryEntry {
  id: string;
  timestamp: number;
  playerCards: number[];
  dealerCards: number[];
  playerValue: number;
  dealerValue: number;
  bet: string;
  result: 'win' | 'lose' | 'push' | 'blackjack' | 'surrender';
  payout: string;
}

function getGameHistory(): GameHistoryEntry[] {
  try {
    const data = localStorage.getItem(GAME_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function addGameToHistory(entry: Omit<GameHistoryEntry, 'id' | 'timestamp'>): void {
  const history = getGameHistory();

  const newEntry: GameHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };

  // Add to front, limit to MAX_HISTORY_ENTRIES
  history.unshift(newEntry);
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.pop();
  }

  localStorage.setItem(GAME_HISTORY_KEY, JSON.stringify(history));
}

function clearGameHistory(): void {
  localStorage.removeItem(GAME_HISTORY_KEY);
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

  // Game History
  getGameHistory,
  addGameToHistory,
  clearGameHistory,
} as const;

export type { WalletData, SessionKeyData };
