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
import type { ApiError } from '@vyrejack/shared';
import { timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

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
    // Never log configuration details, even in development
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
 * Constant-time string comparison to prevent timing attacks (CWE-208)
 * Uses crypto.timingSafeEqual directly which handles length differences securely
 */
function timingSafeEqual(a: string, b: string): boolean {
  try {
    // Convert strings to buffers for crypto.timingSafeEqual
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    // crypto.timingSafeEqual throws if lengths differ, so we catch that
    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return cryptoTimingSafeEqual(bufferA, bufferB);
  } catch {
    // Return false if buffer conversion fails
    return false;
  }
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

  const logMessage = sanitizedData
    ? (() => {
        try {
          const jsonStr = JSON.stringify(sanitizedData);
          if (jsonStr.length > 10000) {
            // 10KB limit
            return `${message} [LOG_DATA_TOO_LARGE]`;
          }
          return `${message} ${jsonStr}`;
        } catch {
          return `${message} [LOG_DATA_STRINGIFY_ERROR]`;
        }
      })()
    : message;

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

// Maximum depth for recursive sanitization to prevent stack overflow
const MAX_SANITIZATION_DEPTH = 10;

/**
 * Remove sensitive fields from log data.
 *
 * SECURITY: Prevents stack overflow by:
 * 1. Limiting recursion depth to MAX_SANITIZATION_DEPTH
 * 2. Tracking visited objects to handle circular references (per-call WeakSet)
 */
function sanitizeLogData(
  data: unknown,
  depth: number = 0,
  visitedObjects: WeakSet<object> = new WeakSet()
): unknown {
  // Prevent stack overflow from deep nesting
  if (depth >= MAX_SANITIZATION_DEPTH) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // Handle circular references
  if (visitedObjects.has(data)) {
    return '[CIRCULAR_REFERENCE]';
  }

  visitedObjects.add(data);

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1, visitedObjects));
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
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, depth + 1, visitedObjects);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
