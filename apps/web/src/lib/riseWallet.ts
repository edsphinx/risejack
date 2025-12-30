/**
 * Rise Wallet Singleton
 * Provides a single instance of RiseWallet for the entire app
 * Based on Meteoro pattern
 */

import { RiseWallet } from 'rise-wallet';

// Module-level singleton
let riseWalletInstance: ReturnType<typeof RiseWallet.create> | null = null;

/**
 * Get the RiseWallet instance (creates if not exists)
 */
export function getRiseWallet() {
    if (!riseWalletInstance) {
        riseWalletInstance = RiseWallet.create();
    }
    return riseWalletInstance;
}

/**
 * Get the Rise Wallet provider for direct RPC calls
 */
export function getProvider() {
    return getRiseWallet().provider;
}

/**
 * Provider type for TypeScript
 */
export type RiseWalletProvider = ReturnType<typeof getProvider>;
