/**
 * Contract Configuration
 * 
 * RiseJack contract address and ABI configuration.
 * The ABI is auto-synced from the contracts package - see packages/contracts/scripts/sync-abi.js
 */

import type { Address } from 'viem';
// Import the auto-generated ABI from sync script
import { RISEJACK_ABI } from './abi/RiseJack';

export { RISEJACK_ABI };

export const riseTestnet = {
    id: 11155931,
    name: 'Rise Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet.riselabs.xyz'] },
    },
    blockExplorers: {
        default: { name: 'Rise Explorer', url: 'https://explorer.testnet.riselabs.xyz' },
    },
} as const;

// Default contract address (can be overridden by env variable)
const DEFAULT_RISEJACK_ADDRESS = '0xe17C645aE8dC321B41BA00bbc8B9E392342A0cA2' as Address;

/**
 * Get RiseJack contract address from environment or use default
 */
export function getRiseJackAddress(): Address {
    // Check for environment variable (Vite format)
    const envAddress = typeof import.meta !== 'undefined'
        ? (import.meta as { env?: Record<string, string> }).env?.VITE_RISEJACK_ADDRESS
        : undefined;

    if (envAddress && /^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
        return envAddress as Address;
    }

    return DEFAULT_RISEJACK_ADDRESS;
}

// Export for convenience (uses env or default)
export const RISEJACK_ADDRESS = getRiseJackAddress();
