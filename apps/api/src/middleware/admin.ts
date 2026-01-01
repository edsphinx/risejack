/**
 * Admin Authentication Middleware
 *
 * Provides access control for admin-only endpoints like analytics.
 * Uses a simple API key approach for initial implementation.
 */

import type { Context, Next } from 'hono';
import type { ApiError } from '@risejack/shared';

// Admin API key from environment variable
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Middleware to require admin authentication for sensitive endpoints.
 * Checks for X-Admin-API-Key header or admin_key query parameter.
 */
export async function requireAdmin(c: Context, next: Next) {
  // Skip auth in development if no key is configured
  if (process.env.NODE_ENV === 'development' && !ADMIN_API_KEY) {
    return next();
  }

  // Require API key in production
  if (!ADMIN_API_KEY) {
    console.error('ADMIN_API_KEY not configured - analytics endpoints disabled');
    return c.json({ error: 'Service unavailable' } satisfies ApiError, 503);
  }

  // Check header first, then query parameter
  const providedKey = c.req.header('X-Admin-API-Key') || c.req.query('admin_key');

  if (!providedKey) {
    return c.json({ error: 'Authentication required' } satisfies ApiError, 401);
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(providedKey, ADMIN_API_KEY)) {
    return c.json({ error: 'Invalid credentials' } satisfies ApiError, 403);
  }

  return next();
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Sanitize error messages for production responses
 * Prevents information disclosure through error messages
 */
export function sanitizeError(error: unknown): string {
  // In development, return full error for debugging
  if (process.env.NODE_ENV === 'development') {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, return generic message
  // Log the actual error server-side
  if (error instanceof Error) {
    // Only log in production, not the full stack to avoid sensitive data
    console.error(`Error: ${error.name}`);
  }

  return 'An unexpected error occurred';
}

/**
 * Safe logger that sanitizes data before logging
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  // Don't log sensitive fields
  const sanitizedData = data ? sanitizeLogData(data) : undefined;

  const logMessage = sanitizedData ? `${message} ${JSON.stringify(sanitizedData)}` : message;

  switch (level) {
    case 'info':
      console.info(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
  }
}

/**
 * Remove sensitive fields from log data
 */
function sanitizeLogData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'privateKey', 'key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
