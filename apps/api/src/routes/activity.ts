/**
 * Activity Routes
 *
 * HTTP handlers for live activity feed (recent wins, stats)
 */

import { Hono } from 'hono';
import prisma from '../db/client';
import type { ApiError } from '@risejack/shared';

const activity = new Hono();

/**
 * GET /activity/recent
 * Returns recent wins for the live activity ticker
 */
activity.get('/recent', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 10, 20);

  try {
    // Get recent wins (blackjack and win outcomes)
    const recentWins = await prisma.game.findMany({
      where: {
        outcome: { in: ['win', 'blackjack'] },
      },
      select: {
        id: true,
        payout: true,
        outcome: true,
        endedAt: true,
        user: {
          select: {
            walletAddress: true,
            displayName: true,
          },
        },
      },
      orderBy: { endedAt: 'desc' },
      take: limit,
    });

    const entries = recentWins.map((game) => ({
      id: game.id,
      walletAddress: game.user.walletAddress,
      displayName: game.user.displayName,
      payout: game.payout,
      outcome: game.outcome,
      timestamp: game.endedAt?.toISOString() || new Date().toISOString(),
    }));

    return c.json({
      entries,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    return c.json({ error: 'Failed to fetch activity' } satisfies ApiError, 500);
  }
});

/**
 * GET /activity/stats
 * Returns summary stats for the ticker (today's volume, top win, etc)
 */
activity.get('/stats', async (c) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, biggestWin, topPlayer] = await Promise.all([
      // Today's volume
      prisma.game.aggregate({
        where: { startedAt: { gte: today } },
        _sum: { betAmount: true },
        _count: { _all: true },
      }),
      // Biggest win today
      prisma.game.findFirst({
        where: {
          startedAt: { gte: today },
          outcome: { in: ['win', 'blackjack'] },
        },
        select: {
          payout: true,
          user: { select: { walletAddress: true, displayName: true } },
        },
        orderBy: { payout: 'desc' },
      }),
      // Top XP player
      prisma.user.findFirst({
        select: { walletAddress: true, displayName: true, xp: true },
        orderBy: { xp: 'desc' },
      }),
    ]);

    return c.json({
      todayVolume: todayStats._sum.betAmount || '0',
      todayGames: todayStats._count._all,
      biggestWinToday: biggestWin
        ? {
            payout: biggestWin.payout,
            walletAddress: biggestWin.user.walletAddress,
            displayName: biggestWin.user.displayName,
          }
        : null,
      topXpPlayer: topPlayer
        ? {
            walletAddress: topPlayer.walletAddress,
            displayName: topPlayer.displayName,
            xp: topPlayer.xp.toString(),
          }
        : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Activity stats error:', error);
    return c.json({ error: 'Failed to fetch stats' } satisfies ApiError, 500);
  }
});

export default activity;
