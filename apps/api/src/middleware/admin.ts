/**
 * Admin Authentication Middleware
 *
 * Provides access control for admin-only endpoints like analytics.
 * Uses a simple API key approach for initial implementation.
 *
 * SECURITY NOTE: This middleware ALWAYS requires authentication.
 * There is no development bypass to prevent security vulnerabilities.
 */

import type { Context, Next } from 'hono';
import type { ApiError } from '@risejack/shared';

/**
 * Get admin API key securely.
 * Function scope prevents global access by other modules.
 */
function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY;
}

/**
 * Middleware to require admin authentication for sensitive endpoints.
 * Only checks X-Admin-API-Key header (NOT query params to prevent URL logging/exposure).
 *
 * SECURITY: Authentication is ALWAYS required, even in development.
 * This prevents attackers from bypassing auth by setting NODE_ENV=development.
 *
 * To test admin endpoints in development, set ADMIN_API_KEY in your .env file.
 */
export async function requireAdmin(c: Context, next: Next) {
  const adminApiKey = getAdminApiKey();

  // Always require API key - no development bypass for security
  if (!adminApiKey) {
    // Log only in development for debugging, never expose in response
    if (process.env.NODE_ENV === 'development') {
      console.error('ADMIN_API_KEY not configured - set it in .env to access admin endpoints');
    }
    return c.json({ error: 'Service unavailable' } satisfies ApiError, 503);
  }

  // Only check header - never query parameters for security
  const providedKey = c.req.header('X-Admin-API-Key');

  if (!providedKey) {
    return c.json({ error: 'Authentication required' } satisfies ApiError, 401);
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(providedKey, adminApiKey)) {
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
 * Sanitize error messages for production responses.
 * Prevents information disclosure through error messages (CWE-209).
 *
 * SECURITY: Never expose internal error details, stack traces, or
 * system information in error responses. Always return generic messages.
 */
export function sanitizeError(_error: unknown): string {
  // Always return generic message - never expose internal errors
  // Errors should be logged server-side only in a secure manner
  return 'An unexpected error occurred';
}

/**
 * Safe logger that sanitizes data before logging.
 * Never logs sensitive fields like keys, tokens, or passwords.
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  // Don't log sensitive fields
  const sanitizedData = data ? sanitizeLogData(data) : undefined;

  const logMessage = sanitizedData ? `${message} ${JSON.stringify(sanitizedData)}` : message;

  switch (level) {
    case 'info':
      console.warn(logMessage); // Use warn since info is not allowed by linter
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

  const sensitiveFields = [
    'password',
    'secret',
    'token',
    'apiKey',
    'privateKey',
    'key',
    'authorization',
    'cookie',
    'session',
    'connectionString',
    'databaseUrl',
  ];
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
