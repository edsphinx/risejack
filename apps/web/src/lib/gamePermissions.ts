/**
 * Game Permissions Configuration
 * Defines session key permissions for VyreCasino architecture
 */

import { keccak256, toHex } from 'viem';
import {
    VYRECASINO_ADDRESS,
    VYREJACKCORE_ADDRESS,
    CHIP_TOKEN_ADDRESS,
    CHIP_FAUCET_ADDRESS,
} from './contract';

/**
 * Compute function selector from signature
 */
export function getFunctionSelector(signature: string): `0x${string}` {
    return keccak256(toHex(signature)).slice(0, 10) as `0x${string}`;
}

// Contract addresses - lowercase for Porto compatibility
const CASINO_ADDRESS = VYRECASINO_ADDRESS.toLowerCase() as `0x${string}`;
const GAME_ADDRESS = VYREJACKCORE_ADDRESS.toLowerCase() as `0x${string}`;
const CHIP_ADDRESS = CHIP_TOKEN_ADDRESS.toLowerCase() as `0x${string}`;
const FAUCET_ADDRESS = CHIP_FAUCET_ADDRESS.toLowerCase() as `0x${string}`;

/**
 * Allowed contract calls for session key
 * These functions can be called without user popup confirmation
 */
export const GAME_CALLS = [
    // VyreCasino - Start games
    {
        to: CASINO_ADDRESS,
        signature: getFunctionSelector('play(address,address,uint256,bytes)'),
    },
    // VyreJackCore - Game actions
    { to: GAME_ADDRESS, signature: getFunctionSelector('hit()') },
    { to: GAME_ADDRESS, signature: getFunctionSelector('stand()') },
    { to: GAME_ADDRESS, signature: getFunctionSelector('double()') },
    // CHIP Token - Approve for betting
    {
        to: CHIP_ADDRESS,
        signature: getFunctionSelector('approve(address,uint256)'),
    },
    // Faucet claim
    { to: FAUCET_ADDRESS, signature: getFunctionSelector('claim()') },
];

/**
 * Spending limits for session key
 * Note: CHIP tokens, not ETH
 */
export const SPEND_LIMITS = [
    {
        limit: '0x56BC75E2D63100000', // 100 CHIP in wei as hex
        period: 'day' as const,
        token: CHIP_ADDRESS,
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
