/**
 * Leaderboard API Routes
 */

import { Hono } from 'hono';
import prisma from '../db/client';

const leaderboard = new Hono();

/**
 * GET /leaderboard/:period
 * Returns the leaderboard for a given period (daily, weekly, monthly, all_time)
 */
leaderboard.get('/:period', async (c) => {
  const period = c.req.param('period');
  const validPeriods = ['daily', 'weekly', 'monthly', 'all_time'];

  if (!validPeriods.includes(period)) {
    return c.json({ error: 'Invalid period. Use: daily, weekly, monthly, all_time' }, 400);
  }

  try {
    // Get the latest snapshot for this period
    const snapshot = await prisma.leaderboardSnapshot.findFirst({
      where: { period },
      orderBy: { periodStart: 'desc' },
    });

    if (!snapshot) {
      return c.json({
        period,
        entries: [],
        generatedAt: null,
        message: 'No leaderboard data available yet',
      });
    }

    return c.json({
      period: snapshot.period,
      periodStart: snapshot.periodStart,
      metric: snapshot.metric,
      entries: snapshot.entries,
      generatedAt: snapshot.generatedAt,
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return c.json({ error: 'Failed to fetch leaderboard' }, 500);
  }
});

/**
 * GET /leaderboard/live/:metric
 * Returns a real-time calculated leaderboard (slower, not cached)
 */
leaderboard.get('/live/:metric', async (c) => {
  const metric = c.req.param('metric');
  const limit = Number(c.req.query('limit')) || 50;

  try {
    let entries;

    switch (metric) {
      case 'volume':
        // Top players by total wagered
        entries = await prisma.$queryRaw`
          SELECT 
            u.id,
            u.display_name as "displayName",
            u.wallet_address as "walletAddress",
            u.vip_tier as "vipTier",
            COALESCE(SUM(CAST(g.bet_amount AS NUMERIC)), 0) as value
          FROM users u
          LEFT JOIN games g ON g.user_id = u.id
          GROUP BY u.id
          ORDER BY value DESC
          LIMIT ${limit}
        `;
        break;

      case 'wins':
        // Top players by win count
        entries = await prisma.$queryRaw`
          SELECT 
            u.id,
            u.display_name as "displayName",
            u.wallet_address as "walletAddress",
            u.vip_tier as "vipTier",
            COUNT(CASE WHEN g.outcome IN ('win', 'blackjack') THEN 1 END) as value
          FROM users u
          LEFT JOIN games g ON g.user_id = u.id
          GROUP BY u.id
          ORDER BY value DESC
          LIMIT ${limit}
        `;
        break;

      case 'xp':
        // Top players by XP
        entries = await prisma.user.findMany({
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
        entries = entries.map((u, i) => ({ ...u, value: u.xp, rank: i + 1 }));
        break;

      default:
        return c.json({ error: 'Invalid metric. Use: volume, wins, xp' }, 400);
    }

    return c.json({
      metric,
      entries,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Live leaderboard error:', error);
    return c.json({ error: 'Failed to calculate leaderboard' }, 500);
  }
});

export default leaderboard;
