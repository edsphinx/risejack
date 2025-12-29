import type { Address } from 'viem';

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
const DEFAULT_RISEJACK_ADDRESS = '0x8a0AaDE6ebDaEF9993084a29a46BD1C93eC6001a' as Address;

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

export const RISEJACK_ABI = [
    { type: 'function', name: 'getGameState', inputs: [{ name: 'player', type: 'address' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'player', type: 'address' }, { name: 'bet', type: 'uint256' }, { name: 'playerCards', type: 'uint8[]' }, { name: 'dealerCards', type: 'uint8[]' }, { name: 'state', type: 'uint8' }, { name: 'timestamp', type: 'uint256' }, { name: 'isDoubled', type: 'bool' }] }], stateMutability: 'view' },
    { type: 'function', name: 'getPlayerHandValue', inputs: [{ name: 'player', type: 'address' }], outputs: [{ name: 'value', type: 'uint8' }, { name: 'isSoft', type: 'bool' }], stateMutability: 'view' },
    { type: 'function', name: 'getDealerVisibleValue', inputs: [{ name: 'player', type: 'address' }], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' },
    { type: 'function', name: 'getCardInfo', inputs: [{ name: 'card', type: 'uint8' }], outputs: [{ name: 'rank', type: 'uint8' }, { name: 'suit', type: 'uint8' }], stateMutability: 'pure' },
    { type: 'function', name: 'minBet', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'maxBet', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'placeBet', inputs: [], outputs: [], stateMutability: 'payable' },
    { type: 'function', name: 'hit', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'stand', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'double', inputs: [], outputs: [], stateMutability: 'payable' },
    { type: 'function', name: 'surrender', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;
