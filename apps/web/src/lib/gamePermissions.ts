/**
 * Game Permissions Configuration
 * Defines session key permissions for VyreCasino architecture
 * 
 * Token-specific spend limits:
 * - CHIP: 100 per day
 * - USDC: 100 per day  
 * - ETH: 10 per day (for gas)
 */

import { keccak256, toHex, parseEther, parseUnits } from 'viem';
import {
    VYRECASINO_ADDRESS,
    VYREJACKCORE_ADDRESS,
    CHIP_TOKEN_ADDRESS,
    USDC_TOKEN_ADDRESS,
} from './contract';

// Token context type
export type TokenContext = 'chip' | 'usdc' | 'both';

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
const USDC_ADDRESS = USDC_TOKEN_ADDRESS.toLowerCase() as `0x${string}`;
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Allowed contract calls for session key
 * Following Meteoro pattern for Porto compatibility
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
    // Token approvals (needed for play to work)
    { to: CHIP_ADDRESS, signature: getFunctionSelector('approve(address,uint256)') },
    { to: USDC_ADDRESS, signature: getFunctionSelector('approve(address,uint256)') },
];

/**
 * Base spending limit - ETH for gas (always included)
 */
const ETH_SPEND_LIMIT = {
    limit: `0x${parseEther('10').toString(16)}`, // 10 ETH
    period: 'day' as const,
    token: ETH_ADDRESS,
};

/**
 * CHIP token spending limit - 100 CHIP per day
 */
const CHIP_SPEND_LIMIT = {
    limit: `0x${parseEther('100').toString(16)}`, // 100 CHIP (18 decimals)
    period: 'day' as const,
    token: CHIP_ADDRESS,
};

/**
 * USDC token spending limit - 100 USDC per day
 */
const USDC_SPEND_LIMIT = {
    limit: `0x${parseUnits('100', 6).toString(16)}`, // 100 USDC (6 decimals)
    period: 'day' as const,
    token: USDC_ADDRESS,
};

/**
 * Get game permissions for a specific token context
 * NOTE: No ETH spend limit needed - VyreJack uses ERC20 tokens only.
 * Gas is handled separately via feeToken in wallet_grantPermissions.
 * @param tokenContext - 'chip', 'usdc', or 'both' (default)
 */
export function getGamePermissions(tokenContext: TokenContext = 'both') {
    const spend: typeof CHIP_SPEND_LIMIT[] = [];

    if (tokenContext === 'chip') {
        spend.push(CHIP_SPEND_LIMIT);
    } else if (tokenContext === 'usdc') {
        spend.push(USDC_SPEND_LIMIT);
    } else {
        // 'both' - include both tokens
        spend.push(CHIP_SPEND_LIMIT, USDC_SPEND_LIMIT);
    }

    return { calls: GAME_CALLS, spend };
}

/**
 * Default permissions (both tokens) - for backwards compatibility
 */
export const GAME_PERMISSIONS = getGamePermissions('both');

/**
 * Legacy spend limits export - for backwards compatibility
 */
export const SPEND_LIMITS = [ETH_SPEND_LIMIT, CHIP_SPEND_LIMIT, USDC_SPEND_LIMIT];

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
