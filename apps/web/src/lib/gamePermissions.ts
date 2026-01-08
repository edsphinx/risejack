/**
 * Game Permissions Configuration
 * Defines session key permissions for VyreCasino architecture
 */

import { keccak256, toHex } from 'viem';
import {
    VYRECASINO_ADDRESS,
    VYREJACKCORE_ADDRESS,
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

/**
 * Allowed contract calls for session key
 * MINIMAL SET - Following Meteoro pattern for Porto compatibility
 * Only the essential game functions are included
 */
export const GAME_CALLS = [
    // VyreCasino - Start games (regular play, not playWithPermit for now)
    {
        to: CASINO_ADDRESS,
        signature: getFunctionSelector('play(address,address,uint256,bytes)'),
    },
    // VyreJackCore - Game actions
    { to: GAME_ADDRESS, signature: getFunctionSelector('hit()') },
    { to: GAME_ADDRESS, signature: getFunctionSelector('stand()') },
    { to: GAME_ADDRESS, signature: getFunctionSelector('double()') },
];

/**
 * Spending limits for session key
 * VyreJack with CHIP/USDC does NOT need ETH spend limits:
 * - Gas is paid by Rise Wallet (gasless)
 * - Only ERC20 tokens (CHIP/USDC) are spent, not native ETH
 * Empty array = no native token spending allowed (correct!)
 */
export const SPEND_LIMITS: Array<{
    limit: string;
    period: 'day' | 'hour' | 'minute';
    token: `0x${string}`;
}> = [];

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
