/**
 * Referral Routes
 *
 * HTTP handlers for referral-related endpoints.
 * All business logic is delegated to ReferralService and UserService.
 */

import { Hono } from 'hono';
import { ReferralService, UserService } from '../services';
import { isValidWalletAddress, isValidReferralCode, sanitizeError } from '../middleware';
import type { ApiError } from '@risejack/shared';

const referrals = new Hono();

/**
 * GET /referrals/:walletAddress
 * Returns referral stats for a user
 */
referrals.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' } satisfies ApiError, 400);
  }

  try {
    const stats = await ReferralService.getReferralStats(walletAddress);

    if (!stats) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json(stats);
  } catch (error) {
    console.error('Referral stats error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * GET /referrals/:walletAddress/history
 * Returns detailed earning history
 */
referrals.get('/:walletAddress/history', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' } satisfies ApiError, 400);
  }

  const limit = Math.min(Math.max(1, Number(c.req.query('limit')) || 50), 100);
  const offset = Math.max(0, Number(c.req.query('offset')) || 0);

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
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * POST /referrals/register
 * Register a referral link (called when user first connects with ?ref=CODE)
 */
referrals.post('/register', async (c) => {
  const body = await c.req.json<{ walletAddress?: string; referralCode?: string }>();
  const { walletAddress, referralCode } = body;

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Valid walletAddress required' } satisfies ApiError, 400);
  }

  // Validate referral code format (8 alphanumeric chars)
  if (!isValidReferralCode(referralCode)) {
    return c.json({ error: 'Invalid referral code format' } satisfies ApiError, 400);
  }

  try {
    const result = await UserService.registerReferral(walletAddress!, referralCode!);

    if (!result.success) {
      return c.json({ error: result.error || 'Registration failed' } satisfies ApiError, 400);
    }

    return c.json({
      success: true,
      message: 'Referral registered successfully',
      userReferralCode: result.userReferralCode,
    });
  } catch (error) {
    console.error('Referral register error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

export default referrals;
