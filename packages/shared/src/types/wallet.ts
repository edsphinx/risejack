import type { Address } from 'viem';

/**
 * Session metadata for Rise Wallet
 * Note: Porto manages private keys securely - we only store metadata
 */
export interface SessionKeyData {
  expiry: number;
  createdAt: number;
  address: Address;
}

/**
 * Time remaining for session key
 */
export interface TimeRemaining {
  seconds: number;
  minutes: number;
  hours: number;
  expired: boolean;
}

/**
 * Transaction status
 */
export type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';
