/**
 * Contract Service - All contract read operations
 * Handles reading state from the VyreJack smart contract.
 */

import { createPublicClient, http } from 'viem';
import { VYREJACK_ABI, getVyreJackAddress, riseTestnet } from '@/lib/contract';
import type { GameData, HandValue, BetLimits, GameState } from '@vyrejack/shared';

// Shared public client - created once
const publicClient = createPublicClient({
  chain: riseTestnet,
  transport: http(),
});

const contractAddress = getVyreJackAddress();

/**
 * Get the current game state for a player
 */
async function getGameState(playerAddress: `0x${string}`): Promise<GameData> {
  const game = await publicClient.readContract({
    address: contractAddress,
    abi: VYREJACK_ABI,
    functionName: 'getGameState',
    args: [playerAddress],
  });

  return {
    player: game.player,
    bet: game.bet,
    playerCards: game.playerCards,
    dealerCards: game.dealerCards,
    state: game.state as GameState,
    timestamp: game.timestamp,
    isDoubled: game.isDoubled,
  };
}

/**
 * Get the player's hand value
 */
async function getPlayerHandValue(playerAddress: `0x${string}`): Promise<HandValue> {
  const [value, isSoft] = await publicClient.readContract({
    address: contractAddress,
    abi: VYREJACK_ABI,
    functionName: 'getPlayerHandValue',
    args: [playerAddress],
  });

  return { value, isSoft };
}

/**
 * Get the dealer's visible card value
 */
async function getDealerVisibleValue(playerAddress: `0x${string}`): Promise<number> {
  return publicClient.readContract({
    address: contractAddress,
    abi: VYREJACK_ABI,
    functionName: 'getDealerVisibleValue',
    args: [playerAddress],
  });
}

/**
 * Get bet limits from the contract
 */
async function getBetLimits(): Promise<BetLimits> {
  const [min, max] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: VYREJACK_ABI,
      functionName: 'minBet',
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: VYREJACK_ABI,
      functionName: 'maxBet',
    }),
  ]);

  return { min, max };
}

/**
 * Fetch all game data at once (optimized batch call)
 */
async function getFullGameData(
  playerAddress: `0x${string}`
): Promise<{ gameData: GameData; playerValue: HandValue; dealerValue: number }> {
  const [gameData, playerValue, dealerValue] = await Promise.all([
    getGameState(playerAddress),
    getPlayerHandValue(playerAddress),
    getDealerVisibleValue(playerAddress),
  ]);

  return { gameData, playerValue, dealerValue };
}

/**
 * Wait for a transaction to be confirmed
 */
async function waitForTransaction(hash: `0x${string}`): Promise<boolean> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.status === 'success';
  } catch {
    return false;
  }
}

/**
 * Get transaction receipt (with retries)
 */
async function getTransactionReceipt(
  hash: `0x${string}`,
  maxRetries = 10,
  delayMs = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) {
        return receipt.status === 'success';
      }
    } catch {
      // Not yet mined, continue
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Get remaining cooldown time for a player
 * Returns seconds remaining (0 if no cooldown active)
 */
async function getCooldownRemaining(playerAddress: `0x${string}`): Promise<number> {
  try {
    const [lastTimestamp, cooldownDuration] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: VYREJACK_ABI,
        functionName: 'lastGameTimestamp',
        args: [playerAddress],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: VYREJACK_ABI,
        functionName: 'gameCooldown',
      }),
    ]);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const cooldownEnds = lastTimestamp + (cooldownDuration as bigint);

    if (now >= cooldownEnds) {
      return 0;
    }

    return Number(cooldownEnds - now);
  } catch {
    return 0;
  }
}

export const ContractService = {
  // State reading
  getGameState,
  getPlayerHandValue,
  getDealerVisibleValue,
  getBetLimits,
  getFullGameData,
  getCooldownRemaining,

  // Transaction utilities
  waitForTransaction,
  getTransactionReceipt,

  // Expose for advanced use cases
  publicClient,
  contractAddress,
} as const;
