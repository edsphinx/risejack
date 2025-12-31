/**
 * Referral Repository
 *
 * Data access layer for referral-related database operations.
 */

import prisma from '../db/client';

// ==================== READ OPERATIONS ====================

export async function getReferralEarnings(
  referrerId: string,
  options: { limit?: number; offset?: number; unclaimedOnly?: boolean } = {}
) {
  const { limit = 50, offset = 0, unclaimedOnly = false } = options;

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
  const [total, unclaimed] = await Promise.all([
    prisma.referralEarning.aggregate({
      where: { referrerId },
      _sum: { earned: true },
      _count: true,
    }),
    prisma.referralEarning.aggregate({
      where: { referrerId, claimed: false },
      _sum: { earned: true },
    }),
  ]);

  return {
    totalEarnings: total._sum.earned || '0',
    totalTransactions: total._count,
    unclaimedEarnings: unclaimed._sum.earned || '0',
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
