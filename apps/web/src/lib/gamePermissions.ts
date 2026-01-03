/**
 * Game Permissions Configuration
 * Defines session key permissions for RiseJack game
 * Based on Meteoro's gamePermissions.js
 */

import { keccak256, toHex } from 'viem';
import { getRiseJackAddress } from './contract';

/**
 * Compute function selector from signature
 */
export function getFunctionSelector(signature: string): `0x${string}` {
    return keccak256(toHex(signature)).slice(0, 10) as `0x${string}`;
}

// Contract address - converted to lowercase for Porto compatibility
// Porto stores and compares addresses as lowercase strings
const CONTRACT_ADDRESS = getRiseJackAddress().toLowerCase() as `0x${string}`;

/**
 * Allowed contract calls for session key
 * These functions can be called without user popup confirmation
 */
export const GAME_CALLS = [
    { to: CONTRACT_ADDRESS, signature: getFunctionSelector('placeBet()') },
    { to: CONTRACT_ADDRESS, signature: getFunctionSelector('hit()') },
    { to: CONTRACT_ADDRESS, signature: getFunctionSelector('stand()') },
    { to: CONTRACT_ADDRESS, signature: getFunctionSelector('double()') },
    { to: CONTRACT_ADDRESS, signature: getFunctionSelector('surrender()') },
];

/**
 * Spending limits for session key
 * Controls how much native token can be spent per period
 * Note: limit is hex string for Rise Wallet SDK
 */
export const SPEND_LIMITS = [
    {
        limit: '0x8AC7230489E80000', // 10 ETH in wei as hex
        period: 'day' as const,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    },
];

/**
 * Combined permissions object for grantPermissions call
 */
export const GAME_PERMISSIONS = {
    calls: GAME_CALLS,
    spend: SPEND_LIMITS,
};

/**
 * Check if a contract call is permitted by session key
 */
export function isCallPermitted(to: string, data: string): boolean {
    if (!to || !data) return false;

    const functionSelector = data.slice(0, 10).toLowerCase();
    const targetAddress = to.toLowerCase();

    return GAME_CALLS.some((call) => {
        const permittedAddress = call.to?.toLowerCase();
        const permittedSelector = call.signature?.toLowerCase();

        const addressMatch = !permittedAddress || permittedAddress === targetAddress;
        const selectorMatch = !permittedSelector || permittedSelector === functionSelector;

        return addressMatch && selectorMatch;
    });
}
