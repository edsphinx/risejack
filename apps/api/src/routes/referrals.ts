/**
 * Referral Routes
 *
 * HTTP handlers for referral-related endpoints.
 * All business logic is delegated to ReferralService and UserService.
 */

import { Hono } from 'hono';
import { ReferralService, UserService } from '../services';
import type { ApiError } from '@risejack/shared';

const referrals = new Hono();

/**
 * GET /referrals/:walletAddress
 * Returns referral stats for a user
 */
referrals.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  try {
    const stats = await ReferralService.getReferralStats(walletAddress);

    if (!stats) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json(stats);
  } catch (error) {
    console.error('Referral stats error:', error);
    return c.json({ error: 'Failed to fetch referral stats' } satisfies ApiError, 500);
  }
});

/**
 * GET /referrals/:walletAddress/history
 * Returns detailed earning history
 */
referrals.get('/:walletAddress/history', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const limit = Number(c.req.query('limit')) || 50;
  const offset = Number(c.req.query('offset')) || 0;

  try {
    const history = await ReferralService.getReferralHistory(walletAddress, { limit, offset });

    if (!history) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json({
      history,
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Referral history error:', error);
    return c.json({ error: 'Failed to fetch referral history' } satisfies ApiError, 500);
  }
});

/**
 * POST /referrals/register
 * Register a referral link (called when user first connects with ?ref=CODE)
 */
referrals.post('/register', async (c) => {
  const body = await c.req.json<{ walletAddress?: string; referralCode?: string }>();
  const { walletAddress, referralCode } = body;

  if (!walletAddress || !referralCode) {
    return c.json({ error: 'walletAddress and referralCode required' } satisfies ApiError, 400);
  }

  try {
    const result = await UserService.registerReferral(walletAddress, referralCode);

    if (!result.success) {
      return c.json({ error: result.error } satisfies ApiError, 400);
    }

    return c.json({
      success: true,
      message: 'Referral registered successfully',
      userReferralCode: result.userReferralCode,
    });
  } catch (error) {
    console.error('Referral register error:', error);
    return c.json({ error: 'Failed to register referral' } satisfies ApiError, 500);
  }
});

export default referrals;
