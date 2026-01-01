/**
 * Game Repository
 *
 * Data access layer for game-related database operations.
 */

import prisma from '../db/client';
import type { GameType, GameOutcome } from '@risejack/shared';
import { Prisma } from '@prisma/client';

const DEFAULT_CHAIN_ID = 713715; // Rise Testnet

// Maximum limit for pagination to prevent DoS
const MAX_LIMIT = 100;

/**
 * Sanitize and bound a limit parameter
 */
function sanitizeLimit(limit: number, defaultLimit: number = 20): number {
  const parsed = Math.floor(Number(limit) || defaultLimit);
  return Math.min(Math.max(1, parsed), MAX_LIMIT);
}

// ==================== READ OPERATIONS ====================

export async function getGamesByUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const limit = sanitizeLimit(options.limit || 20);
  const offset = Math.max(0, Math.floor(options.offset || 0));

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
  // Since betAmount and pnl are strings (for BigInt compatibility), we use raw SQL
  // Prisma's $queryRaw with template literals automatically uses parameterized queries
  const result = await prisma.$queryRaw<
    Array<{
      total_games: bigint;
      total_wagered: string | null;
      total_pnl: string | null;
      wins: bigint;
    }>
  >(Prisma.sql`
    SELECT 
      COUNT(*)::bigint as total_games,
      COALESCE(SUM(CAST(bet_amount AS NUMERIC)), 0)::text as total_wagered,
      COALESCE(SUM(CAST(pnl AS NUMERIC)), 0)::text as total_pnl,
      COUNT(CASE WHEN outcome IN ('win', 'blackjack') THEN 1 END)::bigint as wins
    FROM games
    WHERE user_id = ${userId}
  `);

  const stats = result[0];
  const totalGames = Number(stats?.total_games || 0);
  const wins = Number(stats?.wins || 0);

  return {
    totalGames,
    totalWagered: stats?.total_wagered || '0',
    totalPnL: stats?.total_pnl || '0',
    wins,
    losses: totalGames - wins,
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
  gameData?: Prisma.InputJsonValue;
  startedAt: Date;
  chainId?: number;
}) {
  return prisma.game.create({
    data: {
      user: { connect: { id: data.userId } },
      chain: { connect: { id: data.chainId || DEFAULT_CHAIN_ID } },
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
  const safeLimit = sanitizeLimit(limit, 50);

  return prisma.$queryRaw<
    Array<{
      id: string;
      displayName: string | null;
      walletAddress: string;
      vipTier: string;
      value: string;
    }>
  >(Prisma.sql`
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
    LIMIT ${safeLimit}
  `);
}

export async function getBiggestWinLeaderboard(limit: number = 50) {
  const safeLimit = sanitizeLimit(limit, 50);

  return prisma.$queryRaw<
    Array<{
      id: string;
      displayName: string | null;
      walletAddress: string;
      vipTier: string;
      value: string;
    }>
  >(Prisma.sql`
    SELECT 
      u.id,
      u.display_name as "displayName",
      u.wallet_address as "walletAddress",
      u.vip_tier as "vipTier",
      COALESCE(MAX(CAST(g.payout AS NUMERIC)), 0)::text as value
    FROM users u
    LEFT JOIN games g ON g.user_id = u.id AND g.outcome IN ('win', 'blackjack')
    GROUP BY u.id
    HAVING MAX(CAST(g.payout AS NUMERIC)) > 0
    ORDER BY MAX(CAST(g.payout AS NUMERIC)) DESC
    LIMIT ${safeLimit}
  `);
}

export async function getWinStreakLeaderboard(limit: number = 50) {
  const safeLimit = sanitizeLimit(limit, 50);

  // Calculate best win streak using SQL - counts consecutive wins
  // This is a simplified version that counts total wins as a proxy for "streak potential"
  // For true streak tracking, we'd need to add a winStreak field to the user table
  return prisma.$queryRaw<
    Array<{
      id: string;
      displayName: string | null;
      walletAddress: string;
      vipTier: string;
      value: string;
    }>
  >(Prisma.sql`
    SELECT 
      u.id,
      u.display_name as "displayName",
      u.wallet_address as "walletAddress",
      u.vip_tier as "vipTier",
      COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END)::text as value
    FROM users u
    LEFT JOIN games g ON g.user_id = u.id
    GROUP BY u.id
    HAVING COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END) > 0
    ORDER BY COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END) DESC
    LIMIT ${safeLimit}
  `);
}

export async function getXpLeaderboard(limit: number = 50) {
  const safeLimit = sanitizeLimit(limit, 50);

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
    take: safeLimit,
  });

  return users.map((u) => ({
    ...u,
    value: u.xp.toString(),
  }));
}
