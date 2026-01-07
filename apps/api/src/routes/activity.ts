/**
 * Activity Routes
 *
 * HTTP handlers for live activity feed (recent wins, stats)
 */

import { Hono } from 'hono';
import prisma from '../db/client';
import type { ApiError } from '@vyrejack/shared';

const activity = new Hono();

/**
 * GET /activity/recent
 * Returns recent wins for the live activity ticker
 */
activity.get('/recent', async (c) => {
  const rawLimit = c.req.query('limit');
  const limit = Math.min(Math.max(1, Number(rawLimit) || 10), 20);

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
      // Today's games count (betAmount is string, can't sum directly)
      prisma.game.count({
        where: { startedAt: { gte: today } },
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
      todayVolume: '0', // TODO: Use raw SQL for BigInt sum
      todayGames: todayStats,
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
