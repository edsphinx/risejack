/**
 * User Routes
 *
 * HTTP handlers for user-related endpoints.
 * All business logic is delegated to UserService.
 */

import { Hono } from 'hono';
import { UserService, GameService } from '../services';
import { isValidWalletAddress, sanitizeError } from '../middleware';
import type { ApiError } from '@risejack/shared';

const users = new Hono();

/**
 * GET /users/:walletAddress
 * Returns user profile and stats
 */
users.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' } satisfies ApiError, 400);
  }

  try {
    const result = await UserService.getUserProfile(walletAddress);

    if (!result) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('User fetch error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * POST /users/register
 * Register or update a user (called on wallet connect)
 */
users.post('/register', async (c) => {
  const body = await c.req.json<{ walletAddress?: string; displayName?: string }>();
  const { walletAddress, displayName } = body;

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Valid walletAddress required' } satisfies ApiError, 400);
  }

  try {
    const user = await UserService.registerUser(walletAddress!, displayName);

    return c.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('User register error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * GET /users/:walletAddress/games
 * Returns user's game history
 */
users.get('/:walletAddress/games', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  // Validate wallet address format
  if (!isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' } satisfies ApiError, 400);
  }

  const limit = Math.min(Math.max(1, Number(c.req.query('limit')) || 20), 100);
  const offset = Math.max(0, Number(c.req.query('offset')) || 0);

  try {
    const result = await GameService.getGameHistory(walletAddress, { limit, offset });

    if (!result) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('User games error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

export default users;
