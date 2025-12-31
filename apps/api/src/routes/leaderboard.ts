/**
 * Leaderboard Routes
 *
 * HTTP handlers for leaderboard-related endpoints.
 * All business logic is delegated to LeaderboardService.
 */

import { Hono } from 'hono';
import { LeaderboardService } from '../services';
import type { LeaderboardPeriod, LeaderboardMetric, ApiError } from '@risejack/shared';

const leaderboard = new Hono();

const VALID_PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all_time'];
const VALID_METRICS: LeaderboardMetric[] = ['volume', 'wins', 'pnl', 'xp'];

/**
 * GET /leaderboard/:period
 * Returns the cached leaderboard for a given period
 */
leaderboard.get('/:period', async (c) => {
  const period = c.req.param('period') as LeaderboardPeriod;

  if (!VALID_PERIODS.includes(period)) {
    return c.json(
      { error: `Invalid period. Use: ${VALID_PERIODS.join(', ')}` } satisfies ApiError,
      400
    );
  }

  try {
    const result = await LeaderboardService.getCachedLeaderboard(period);

    if (!result) {
      return c.json({
        period,
        entries: [],
        generatedAt: null,
        message: 'No leaderboard data available yet',
      });
    }

    return c.json(result);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return c.json({ error: 'Failed to fetch leaderboard' } satisfies ApiError, 500);
  }
});

/**
 * GET /leaderboard/live/:metric
 * Returns a real-time calculated leaderboard (slower, not cached)
 */
leaderboard.get('/live/:metric', async (c) => {
  const metric = c.req.param('metric') as LeaderboardMetric;
  const limit = Number(c.req.query('limit')) || 50;

  if (!VALID_METRICS.includes(metric)) {
    return c.json(
      { error: `Invalid metric. Use: ${VALID_METRICS.join(', ')}` } satisfies ApiError,
      400
    );
  }

  try {
    const result = await LeaderboardService.getLiveLeaderboard(metric, limit);
    return c.json(result);
  } catch (error) {
    console.error('Live leaderboard error:', error);
    return c.json({ error: 'Failed to calculate leaderboard' } satisfies ApiError, 500);
  }
});

export default leaderboard;
