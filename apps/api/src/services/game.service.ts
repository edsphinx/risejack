/**
 * Game Service
 *
 * Business logic layer for game operations.
 */

import { UserRepository, GameRepository } from '../repositories';
import type { GameRecord, GameHistoryResponse, GameType } from '@vyrejack/shared';

export async function getGameHistory(
  walletAddress: string,
  options: { limit?: number; offset?: number } = {}
): Promise<GameHistoryResponse | null> {
  const user = await UserRepository.findUserByWallet(walletAddress);

  if (!user) return null;

  const { limit = 20, offset = 0 } = options;

  const [games, total] = await Promise.all([
    GameRepository.getGamesByUser(user.id, { limit, offset }),
    GameRepository.countGamesByUser(user.id),
  ]);

  const gameRecords: GameRecord[] = games.map((g) => ({
    id: g.id,
    gameType: g.gameType as GameType,
    betAmount: g.betAmount,
    currency: g.currency,
    payout: g.payout,
    pnl: g.pnl,
    outcome: g.outcome as GameRecord['outcome'],
    txHash: g.txHash,
    playedAt: g.endedAt?.toISOString() || g.startedAt.toISOString(),
  }));

  return {
    games: gameRecords,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}
