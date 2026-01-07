/**
 * Leaderboard Service
 *
 * Business logic layer for leaderboard operations.
 */

import prisma from '../db/client';
import { GameRepository } from '../repositories';
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardPeriod,
  LeaderboardMetric,
  VipTier,
} from '@vyrejack/shared';
import type { Prisma } from '@prisma/client';

export async function getCachedLeaderboard(
  period: LeaderboardPeriod
): Promise<LeaderboardResponse | null> {
  const snapshot = await prisma.leaderboardSnapshot.findFirst({
    where: { period },
    orderBy: { periodStart: 'desc' },
  });

  if (!snapshot) return null;

  return {
    period: snapshot.period as LeaderboardPeriod,
    periodStart: snapshot.periodStart.toISOString(),
    metric: snapshot.metric as LeaderboardMetric,
    entries: snapshot.entries as unknown as LeaderboardEntry[],
    generatedAt: snapshot.generatedAt.toISOString(),
    cached: true,
  };
}

export async function getLiveLeaderboard(
  metric: LeaderboardMetric,
  limit: number = 50
): Promise<LeaderboardResponse> {
  let rawEntries: Array<{
    id: string;
    displayName: string | null;
    walletAddress: string;
    vipTier: string;
    value: string;
  }>;

  switch (metric) {
    case 'volume':
      rawEntries = await GameRepository.getVolumeLeaderboard(limit);
      break;
    case 'biggest_win':
      rawEntries = await GameRepository.getBiggestWinLeaderboard(limit);
      break;
    case 'streak':
      rawEntries = await GameRepository.getWinStreakLeaderboard(limit);
      break;
    case 'xp':
      rawEntries = await GameRepository.getXpLeaderboard(limit);
      break;
    default:
      rawEntries = [];
  }

  const entries: LeaderboardEntry[] = rawEntries.map((e, index) => ({
    rank: index + 1,
    userId: e.id,
    displayName: e.displayName || `${e.walletAddress.slice(0, 6)}...${e.walletAddress.slice(-4)}`,
    walletAddress: e.walletAddress,
    vipTier: e.vipTier as VipTier,
    value: e.value,
  }));

  return {
    period: 'all_time',
    metric,
    entries,
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}

export async function saveLeaderboardSnapshot(
  period: LeaderboardPeriod,
  metric: LeaderboardMetric,
  entries: LeaderboardEntry[],
  periodStart: Date
): Promise<void> {
  await prisma.leaderboardSnapshot.create({
    data: {
      period,
      metric,
      entries: entries as unknown as Prisma.InputJsonValue,
      periodStart,
    },
  });
}
