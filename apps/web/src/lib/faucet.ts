/**
 * Faucet Contract Configuration
 * 
 * CHIPFaucet contract address and configuration.
 */

import type { Address } from 'viem';
import { CHIP_FAUCET_ABI } from './abi/CHIPFaucet';
import { riseTestnet } from './contract';

export { CHIP_FAUCET_ABI };
export { riseTestnet };

// Faucet contract address
export const CHIP_FAUCET_ADDRESS = '0xB659D4113A533971d5bB702062E71814b7D6Bd21' as Address;

// CHIP token address (for reference)
export const CHIP_TOKEN_ADDRESS = '0x18cA3c414bD08C74622C3E3bFE7464903d95602A' as Address;

// Faucet configuration
export const FAUCET_CONFIG = {
    /** Amount given per claim (in CHIP, 18 decimals) */
    defaultAmountPerClaim: 1000n * 10n ** 18n,
    /** Default cooldown between claims (in seconds) */
    defaultCooldown: 3600, // 1 hour
} as const;
