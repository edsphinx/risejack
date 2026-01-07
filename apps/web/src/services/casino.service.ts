/**
 * Casino Service - VyreCasino Contract Operations
 *
 * Pure functions for reading VyreCasino state.
 * Handles house edge, referrals, whitelisted tokens, etc.
 */

import { createPublicClient, http } from 'viem';
import { VYRECASINO_ABI } from '@vyrejack/shared';
import type { CasinoConfig } from '@vyrejack/shared';
import { riseTestnet, VYRECASINO_ADDRESS } from '@/lib/contract';

// Shared public client
const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(),
});

/**
 * Get casino configuration
 */
async function getConfig(): Promise<CasinoConfig> {
  const [houseEdgeBps, referralShareBps, treasuryShareBps, buybackShareBps, paused] =
    await Promise.all([
      publicClient.readContract({
        address: VYRECASINO_ADDRESS,
        abi: VYRECASINO_ABI,
        functionName: 'houseEdgeBps',
      }),
      publicClient.readContract({
        address: VYRECASINO_ADDRESS,
        abi: VYRECASINO_ABI,
        functionName: 'referralShareBps',
      }),
      publicClient.readContract({
        address: VYRECASINO_ADDRESS,
        abi: VYRECASINO_ABI,
        functionName: 'treasuryShareBps',
      }),
      publicClient.readContract({
        address: VYRECASINO_ADDRESS,
        abi: VYRECASINO_ABI,
        functionName: 'buybackShareBps',
      }),
      publicClient.readContract({
        address: VYRECASINO_ADDRESS,
        abi: VYRECASINO_ABI,
        functionName: 'paused',
      }),
    ]);

  return {
    houseEdgeBps: Number(houseEdgeBps),
    referralShareBps: Number(referralShareBps),
    treasuryShareBps: Number(treasuryShareBps),
    buybackShareBps: Number(buybackShareBps),
    paused,
  };
}

/**
 * Check if a token is whitelisted
 */
async function isTokenWhitelisted(token: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: VYRECASINO_ADDRESS,
    abi: VYRECASINO_ABI,
    functionName: 'whitelistedTokens',
    args: [token],
  });
}

/**
 * Check if a game is registered
 */
async function isGameRegistered(game: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: VYRECASINO_ADDRESS,
    abi: VYRECASINO_ABI,
    functionName: 'registeredGames',
    args: [game],
  });
}

/**
 * Get referral earnings for a user and token
 */
async function getReferralEarnings(referrer: `0x${string}`, token: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: VYRECASINO_ADDRESS,
    abi: VYRECASINO_ABI,
    functionName: 'referralEarnings',
    args: [referrer, token],
  });
}

/**
 * Get a player's referrer
 */
async function getReferrer(player: `0x${string}`): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: VYRECASINO_ADDRESS,
    abi: VYRECASINO_ABI,
    functionName: 'referrers',
    args: [player],
  });
}

/**
 * Get available chip tiers for a player
 */
async function getAvailableChipTiers(
  player: `0x${string}`,
  token: `0x${string}`
): Promise<boolean[]> {
  const result = await publicClient.readContract({
    address: VYRECASINO_ADDRESS,
    abi: VYRECASINO_ABI,
    functionName: 'getAvailableChipTiers',
    args: [player, token],
  });
  return [...result];
}

export const CasinoService = {
  getConfig,
  isTokenWhitelisted,
  isGameRegistered,
  getReferralEarnings,
  getReferrer,
  getAvailableChipTiers,
  publicClient,
  address: VYRECASINO_ADDRESS,
} as const;
