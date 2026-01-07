/**
 * Contract Configuration
 *
 * VyreCasino architecture contract addresses and ABIs.
 * Includes: VyreCasino (orchestrator), VyreJackCore (game), VyreTreasury, CHIP token
 */

import type { Address } from 'viem';
// Import ABIs
import { VYREJACK_ABI } from './abi/VyreJack'; // Legacy standalone (ETH)
import { VYRECASINO_ABI } from './abi/VyreCasino';
import { VYREJACKCORE_ABI } from './abi/VyreJackCore';
import { ERC20_ABI } from './abi/ERC20';

// Re-export ABIs
export { VYREJACK_ABI, VYRECASINO_ABI, VYREJACKCORE_ABI, ERC20_ABI };

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

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

// =============================================================================
// CONTRACT ADDRESSES (Rise Testnet - VyreCasino Architecture v2)
// =============================================================================

/** VyreCasino - Central orchestrator for all games */
export const VYRECASINO_ADDRESS =
    '0xB841E36b03801B658aaB347F696232f99b844d83' as Address;

/** VyreJackCore - Blackjack game logic (called via VyreCasino) */
export const VYREJACKCORE_ADDRESS =
    '0x4a9b126eD3B0a686c803ace5dfA5d220b7b7496B' as Address;

/** VyreTreasury - Secure vault for casino funds */
export const VYRETREASURY_ADDRESS =
    '0x53052Fc42f81bf211a81C5b99Ec1fAAc42522644' as Address;

/** CHIP Token - Primary betting token */
export const CHIP_TOKEN_ADDRESS =
    '0x18cA3c414bD08C74622C3E3bFE7464903d95602A' as Address;

/** USDC Token - Alternative betting token */
export const USDC_TOKEN_ADDRESS =
    '0x8A93d247134d91e0de6f96547cB0204e5BE8e5D8' as Address;

/** CHIP Faucet - Get test CHIP tokens */
export const CHIP_FAUCET_ADDRESS =
    '0xB659D4113A533971d5bB702062E71814b7D6Bd21' as Address;

// =============================================================================
// LEGACY STANDALONE CONTRACT (VyreJackETH - uses native ETH)
// =============================================================================

/** Legacy VyreJack standalone contract (ETH betting, deprecated) */
export const VYREJACK_LEGACY_ADDRESS =
    '0xe17C645aE8dC321B41BA00bbc8B9E392342A0cA2' as Address;

/**
 * @deprecated Use VYREJACKCORE_ADDRESS for new architecture
 * Legacy function for backwards compatibility
 */
export function getVyreJackAddress(): Address {
    const envAddress =
        typeof import.meta !== 'undefined'
            ? (import.meta as { env?: Record<string, string> }).env?.VITE_VYREJACK_ADDRESS
            : undefined;

    if (envAddress && /^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
        return envAddress as Address;
    }

    return VYREJACK_LEGACY_ADDRESS;
}

/** @deprecated Use VYREJACKCORE_ADDRESS */
export const VYREJACK_ADDRESS = getVyreJackAddress();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get default betting token (CHIP) */
export function getDefaultBettingToken(): Address {
    return CHIP_TOKEN_ADDRESS;
}

/** Get all whitelisted betting tokens */
export function getWhitelistedTokens(): Address[] {
    return [CHIP_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS];
}
