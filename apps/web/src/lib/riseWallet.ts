/**
 * Rise Wallet Singleton
 * Provides a single instance of RiseWallet for the entire app
 * Based on Meteoro pattern + Porto hydration waiting
 */

import { RiseWallet } from 'rise-wallet';
import { logger } from './logger';

// Module-level singleton
let riseWalletInstance: ReturnType<typeof RiseWallet.create> | null = null;
let hydrationPromise: Promise<boolean> | null = null;

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
 * Wait for Porto's zustand store to hydrate from IndexedDB
 * This is critical for session key persistence across page refresh
 * Based on porto-rise/src/core/internal/store.ts
 */
export async function waitForHydration(): Promise<boolean> {
    const rw = getRiseWallet();
    // Porto's store has persist middleware but TypeScript doesn't know the exact type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = rw._internal.store as { persist: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => void } };

    // Check if already hydrated
    if (store.persist.hasHydrated()) {
        logger.log('🔄 Porto store already hydrated');
        return true;
    }

    // If already waiting, return existing promise
    if (hydrationPromise) {
        return hydrationPromise;
    }

    // Wait for hydration with timeout
    hydrationPromise = new Promise((resolve) => {
        logger.log('🔄 Waiting for Porto store to hydrate from IndexedDB...');
        store.persist.onFinishHydration(() => {
            logger.log('🔄 Porto store hydrated successfully');
            resolve(true);
        });
        // Timeout after 500ms (Porto uses 100ms, we're more generous)
        setTimeout(() => {
            logger.log('🔄 Porto hydration timeout, proceeding anyway');
            resolve(true);
        }, 500);
    });

    return hydrationPromise;
}

/**
 * Get the Rise Wallet provider for direct RPC calls
 * Note: Call waitForHydration() before using this after page load
 */
export function getProvider() {
    return getRiseWallet().provider;
}

/**
 * Provider type for TypeScript
 */
export type RiseWalletProvider = ReturnType<typeof getProvider>;
