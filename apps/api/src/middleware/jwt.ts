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
};

/**
 * Optional JWT middleware - validates token if present but doesn't require it
 * Use for routes that work with or without authentication
 */
export const optionalJwtAuth = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = await AuthService.verifyToken(token);

        if (payload) {
            c.set('user', {
                wallet: payload.wallet,
                userId: payload.userId,
            } as AuthUser);
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
