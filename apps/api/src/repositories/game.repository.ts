/**
 * Game Repository
 *
 * Data access layer for game-related database operations.
 */

import prisma from '../db/client';
import type { GameType, GameOutcome } from '@risejack/shared';

// ==================== READ OPERATIONS ====================

export async function getGamesByUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;

  return prisma.game.findMany({
    where: { userId },
    orderBy: { endedAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function countGamesByUser(userId: string): Promise<number> {
  return prisma.game.count({
    where: { userId },
  });
}

export async function getGameStats(userId: string) {
  const [aggregate, winCount] = await Promise.all([
    prisma.game.aggregate({
      where: { userId },
      _sum: {
        betAmount: true,
        pnl: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.game.count({
      where: {
        userId,
        outcome: { in: ['win', 'blackjack'] },
      },
    }),
  ]);

  return {
    totalGames: aggregate._count._all,
    totalWagered: aggregate._sum.betAmount || '0',
    totalPnL: aggregate._sum.pnl || '0',
    wins: winCount,
    losses: aggregate._count._all - winCount,
  };
}

export async function getGameByTxHash(txHash: string) {
  return prisma.game.findUnique({
    where: { txHash },
  });
}

// ==================== WRITE OPERATIONS ====================

export async function createGame(data: {
  userId: string;
  gameType: GameType;
  txHash: string;
  blockNumber: bigint;
  betAmount: string;
  currency: string;
  payout: string;
  pnl: string;
  outcome: GameOutcome;
  gameData?: Record<string, unknown>;
  startedAt: Date;
}) {
  return prisma.game.create({
    data: {
      userId: data.userId,
      gameType: data.gameType,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      betAmount: data.betAmount,
      currency: data.currency,
      payout: data.payout,
      pnl: data.pnl,
      outcome: data.outcome,
      gameData: data.gameData,
      startedAt: data.startedAt,
    },
  });
}

// ==================== AGGREGATIONS ====================

export async function getVolumeLeaderboard(limit: number = 50) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      displayName: string | null;
      walletAddress: string;
      vipTier: string;
      value: string;
    }>
  >`
    SELECT 
      u.id,
      u.display_name as "displayName",
      u.wallet_address as "walletAddress",
      u.vip_tier as "vipTier",
      COALESCE(SUM(CAST(g.bet_amount AS NUMERIC)), 0)::text as value
    FROM users u
    LEFT JOIN games g ON g.user_id = u.id
    GROUP BY u.id
    ORDER BY COALESCE(SUM(CAST(g.bet_amount AS NUMERIC)), 0) DESC
    LIMIT ${limit}
  `;
}

export async function getWinsLeaderboard(limit: number = 50) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      displayName: string | null;
      walletAddress: string;
      vipTier: string;
      value: string;
    }>
  >`
    SELECT 
      u.id,
      u.display_name as "displayName",
      u.wallet_address as "walletAddress",
      u.vip_tier as "vipTier",
      COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END)::text as value
    FROM users u
    LEFT JOIN games g ON g.user_id = u.id
    GROUP BY u.id
    ORDER BY COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END) DESC
    LIMIT ${limit}
  `;
}

export async function getXpLeaderboard(limit: number = 50) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      walletAddress: true,
      vipTier: true,
      xp: true,
      level: true,
    },
    orderBy: { xp: 'desc' },
    take: limit,
  });

  return users.map((u) => ({
    ...u,
    value: u.xp.toString(),
  }));
}
