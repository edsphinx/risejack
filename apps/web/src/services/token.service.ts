/**
 * Token Service - ERC20 Token Operations
 *
 * Pure functions for reading token state.
 * No React dependencies - usable by frontend and backend.
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { ERC20_ABI } from '@vyrejack/shared';
import type { TokenBalance, AllowanceState } from '@vyrejack/shared';
import { riseTestnet, VYRECASINO_ADDRESS } from '@/lib/contract';

// Shared public client
const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(),
});

// Token decimals cache
const decimalsCache = new Map<string, number>();

/**
 * Get token decimals (cached)
 */
async function getDecimals(token: `0x${string}`): Promise<number> {
  const key = token.toLowerCase();
  if (decimalsCache.has(key)) {
    return decimalsCache.get(key)!;
  }

  const decimals = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  decimalsCache.set(key, decimals);
  return decimals;
}

/**
 * Get token balance for account
 */
async function getBalance(token: `0x${string}`, account: `0x${string}`): Promise<TokenBalance> {
  const [raw, decimals] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    }),
    getDecimals(token),
  ]);

  return {
    raw,
    formatted: formatUnits(raw, decimals),
    decimals,
  };
}

/**
 * Get allowance for spender (defaults to VyreCasino)
 */
async function getAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}` = VYRECASINO_ADDRESS
): Promise<AllowanceState> {
  const amount = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, spender],
  });

  // Consider "unlimited" if allowance is greater than 1e30
  const isUnlimited = amount > 10n ** 30n;

  return {
    amount,
    isUnlimited,
    isApproved: amount > 0n,
  };
}

/**
 * Get token symbol
 */
async function getSymbol(token: `0x${string}`): Promise<string> {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'symbol',
  });
}

/**
 * Get token name
 */
async function getName(token: `0x${string}`): Promise<string> {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'name',
  });
}

/**
 * Get full token info
 */
async function getTokenInfo(token: `0x${string}`) {
  const [name, symbol, decimals] = await Promise.all([
    getName(token),
    getSymbol(token),
    getDecimals(token),
  ]);

  return { address: token, name, symbol, decimals };
}

export const TokenService = {
  getBalance,
  getAllowance,
  getDecimals,
  getSymbol,
  getName,
  getTokenInfo,
  publicClient,
} as const;
