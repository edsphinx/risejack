/**
 * Game Permissions Configuration
 * Defines session key permissions for VyreCasino architecture
 * 
 * Based on Porto schema analysis (porto-rise/src/core/internal/schema/key.ts):
 * - limit: hex string or bigint (e.g., "0x3e8" or 1000n)
 * - period: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
 * - token: optional - if omitted = native ETH, if provided = ERC20 address
 */

import { keccak256, toHex, parseUnits } from 'viem';
import {
    VYRECASINO_ADDRESS,
    VYREJACKCORE_ADDRESS,
    CHIP_TOKEN_ADDRESS,
    USDC_TOKEN_ADDRESS,
} from './contract';

// Token context type for game versions
export type TokenContext = 'ETH' | 'CHIP' | 'USDC';

/**
 * Compute function selector from signature
 */
export function getFunctionSelector(signature: string): `0x${string}` {
    return keccak256(toHex(signature)).slice(0, 10) as `0x${string}`;
}

// Contract addresses - lowercase for Porto compatibility
const CASINO_ADDRESS = VYRECASINO_ADDRESS.toLowerCase() as `0x${string}`;
const GAME_ADDRESS = VYREJACKCORE_ADDRESS.toLowerCase() as `0x${string}`;

/**
 * Allowed contract calls for session key
 * MINIMAL SET - Following Meteoro pattern for Porto compatibility
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
];

// Spend permission type matching Porto schema
type SpendPermission = {
    limit: string;
    period: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
    token?: `0x${string}`;
};

/**
 * Get spend limits based on token context
 * Returns correct format for Porto grantPermissions:
 * - ETH: no token field (native)
 * - CHIP/USDC: with token address (ERC20)
 */
export function getSpendLimits(tokenContext?: TokenContext): SpendPermission[] {
    // Daily limits as hex strings (Porto format)
    // 100 tokens with 18 decimals = 100e18 = 0x56BC75E2D63100000
    const LIMIT_100_18_DECIMALS = `0x${parseUnits('100', 18).toString(16)}`;
    // 100 USDC with 6 decimals = 100e6 = 0x5F5E100
    const LIMIT_100_6_DECIMALS = `0x${parseUnits('100', 6).toString(16)}`;

    switch (tokenContext) {
        case 'ETH':
            // Native ETH spend limit (no token field)
            return [{
                limit: LIMIT_100_18_DECIMALS,
                period: 'day',
            }];

        case 'CHIP':
            // CHIP token spend limit
            return [{
                limit: LIMIT_100_18_DECIMALS,
                period: 'day',
                token: CHIP_TOKEN_ADDRESS.toLowerCase() as `0x${string}`,
            }];

        case 'USDC':
            // USDC token spend limit (6 decimals)
            return [{
                limit: LIMIT_100_6_DECIMALS,
                period: 'day',
                token: USDC_TOKEN_ADDRESS.toLowerCase() as `0x${string}`,
            }];

        default:
            // No spend limit (gasless, ERC20 handled by contract)
            return [];
    }
}

/**
 * Get game permissions based on token context
 */
export function getGamePermissions(tokenContext?: TokenContext) {
    return {
        calls: GAME_CALLS,
        spend: getSpendLimits(tokenContext),
    };
}

// Legacy export for backward compatibility (empty spend limits)
export const SPEND_LIMITS: SpendPermission[] = [];
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

