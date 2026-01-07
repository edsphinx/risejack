/**
 * JWT Authentication Middleware
 *
 * Validates JWT tokens from Authorization header and sets user context.
 */

import type { Context, Next } from 'hono';
import * as AuthService from '../services/auth';

export interface AuthUser {
  wallet: string;
  userId?: string;
}

/**
 * JWT middleware - validates token and sets user on context
 * Use for protected routes that REQUIRE authentication
 */
export const jwtAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  const token = authHeader.slice(7);

  // Validate token length to prevent DoS attacks
  if (token.length > 2048) {
    return c.json({ error: 'Token too long' }, 400);
  }

  try {
    const payload = await AuthService.verifyToken(token);

    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Set user on context for use in handlers
    c.set('user', {
      wallet: payload.wallet,
      userId: payload.userId,
    } as AuthUser);

    await next();
  } catch (error) {
    // Log error for debugging but don't expose details
    console.error('JWT verification error:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

/**
 * Optional JWT middleware - validates token if present but doesn't require it
 * Use for routes that work with or without authentication
 */
export const optionalJwtAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Validate token length to prevent DoS attacks
    if (token.length > 2048) {
      return c.json({ error: 'Token too long' }, 400);
    }

    try {
      const payload = await AuthService.verifyToken(token);

      if (payload) {
        c.set('user', {
          wallet: payload.wallet,
          userId: payload.userId,
        } as AuthUser);
      }
    } catch (error) {
      // Log error for debugging but don't expose details
      console.error('Optional JWT verification error:', error);
      // Continue without setting user context for optional auth
    }
  }

  await next();
};

/**
 * Helper to get authenticated user from context
 */
export const getAuthUser = (c: Context): AuthUser | undefined => {
  return c.get('user') as AuthUser | undefined;
};
