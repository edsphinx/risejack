import type { Address } from 'viem';

/**
 * Session key data for Rise Wallet
 */
export interface SessionKeyData {
    privateKey: Address;
    publicKey: Address;
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
