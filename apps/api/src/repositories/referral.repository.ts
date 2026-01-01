/**
 * Referral Repository
 *
 * Data access layer for referral-related database operations.
 */

import prisma from '../db/client';
import { Prisma } from '@prisma/client';

// Maximum limit for pagination to prevent DoS
const MAX_LIMIT = 100;

/**
 * Sanitize and bound a limit parameter
 */
function sanitizeLimit(limit: number, defaultLimit: number = 50): number {
  const parsed = Math.floor(Number(limit) || defaultLimit);
  return Math.min(Math.max(1, parsed), MAX_LIMIT);
}

// ==================== READ OPERATIONS ====================

export async function getReferralEarnings(
  referrerId: string,
  options: { limit?: number; offset?: number; unclaimedOnly?: boolean } = {}
) {
  const limit = sanitizeLimit(options.limit || 50);
  const offset = Math.max(0, Math.floor(options.offset || 0));
  const unclaimedOnly = options.unclaimedOnly || false;

  return prisma.referralEarning.findMany({
    where: {
      referrerId,
      ...(unclaimedOnly && { claimed: false }),
    },
    include: {
      referee: {
        select: {
          displayName: true,
          walletAddress: true,
        },
      },
      game: {
        select: {
          gameType: true,
          txHash: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getEarningsSummary(referrerId: string) {
  // Since 'earned' is a string field, we need to use raw SQL for aggregation
  // Using Prisma.sql for explicit parameterized query
  const result = await prisma.$queryRaw<
    Array<{
      total_earnings: string | null;
      total_transactions: bigint;
      unclaimed_earnings: string | null;
    }>
  >(Prisma.sql`
    SELECT 
      COALESCE(SUM(CAST(earned AS NUMERIC)), 0)::text as total_earnings,
      COUNT(*)::bigint as total_transactions,
      COALESCE(SUM(CASE WHEN claimed = false THEN CAST(earned AS NUMERIC) ELSE 0 END), 0)::text as unclaimed_earnings
    FROM referral_earnings
    WHERE referrer_id = ${referrerId}
  `);

  const stats = result[0];

  return {
    totalEarnings: stats?.total_earnings || '0',
    totalTransactions: Number(stats?.total_transactions || 0),
    unclaimedEarnings: stats?.unclaimed_earnings || '0',
  };
}

// ==================== WRITE OPERATIONS ====================

export async function createReferralEarning(data: {
  referrerId: string;
  refereeId: string;
  gameId: string;
  tier: 1 | 2;
  houseEdge: string;
  earned: string;
  currency: string;
}) {
  return prisma.referralEarning.create({
    data: {
      referrerId: data.referrerId,
      refereeId: data.refereeId,
      gameId: data.gameId,
      tier: data.tier,
      houseEdge: data.houseEdge,
      earned: data.earned,
      currency: data.currency,
    },
  });
}

export async function markEarningsClaimed(earningIds: string[], claimTxHash: string) {
  return prisma.referralEarning.updateMany({
    where: { id: { in: earningIds } },
    data: {
      claimed: true,
      claimedAt: new Date(),
      claimTxHash,
    },
  });
}
