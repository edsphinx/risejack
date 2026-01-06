/**
 * Auth Routes
 *
 * Endpoints for wallet-based JWT authentication.
 */

import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import * as AuthService from '../services/auth';
import { UserService } from '../services';
import { isValidWalletAddress, sanitizeError } from '../middleware';
import type { ApiError } from '@vyrejack/shared';

const auth = new Hono();

// Rate limiting for auth endpoints - 10 requests per 15 minutes per IP
const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
});

/**
 * GET /auth/nonce
 * Generate a nonce for wallet signature
 */
auth.get('/nonce', authRateLimit, async (c) => {
  const wallet = c.req.query('wallet');

  if (!isValidWalletAddress(wallet)) {
    return c.json({ error: 'Valid wallet address required' } satisfies ApiError, 400);
  }

  const nonce = await AuthService.generateNonce(wallet!);
  const message = AuthService.getSignMessage(wallet!, nonce);

  return c.json({
    nonce,
    message,
  });
});

/**
 * POST /auth/verify
 * Verify wallet signature and issue JWT
 */
auth.post('/verify', authRateLimit, async (c) => {
  const body = await c.req.json<{
    wallet?: string;
    signature?: string;
    message?: string;
  }>();

  const { wallet, signature, message } = body;

  if (!isValidWalletAddress(wallet)) {
    return c.json({ error: 'Valid wallet address required' } satisfies ApiError, 400);
  }

  if (!signature || !message) {
    return c.json({ error: 'Signature and message required' } satisfies ApiError, 400);
  }

  try {
    const isValid = await AuthService.verifySignature(wallet!, signature, message);

    if (!isValid) {
      return c.json({ error: 'Invalid signature or expired nonce' } satisfies ApiError, 401);
    }

    // Get or create user
    const user = await UserService.registerUser(wallet!);

    // Create JWT token
    const token = await AuthService.createToken(wallet!, user.id);

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        wallet: user.walletAddress,
        displayName: user.displayName,
        xp: user.xp,
        level: user.level,
      },
    });
  } catch (error) {
    console.error('Auth verify error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * GET /auth/me
 * Get current authenticated user from JWT
 */
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' } satisfies ApiError, 401);
  }

  const token = authHeader.slice(7);
  const payload = await AuthService.verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' } satisfies ApiError, 401);
  }

  try {
    const user = await UserService.getUserProfile(payload.wallet);

    if (!user) {
      return c.json({ error: 'User not found' } satisfies ApiError, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

export default auth;
