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
 * Uses fixed-length padding to prevent length leakage, then crypto.timingSafeEqual
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Use fixed maximum length to prevent length leakage
  const FIXED_LENGTH = 256;

  // Verify actual lengths match first (in constant time)
  const lengthMatch = a.length === b.length;

  // Convert strings to buffers and pad to fixed length
  const bufferA = Buffer.alloc(FIXED_LENGTH, 0);
  const bufferB = Buffer.alloc(FIXED_LENGTH, 0);

  Buffer.from(a, 'utf8').copy(bufferA);
  Buffer.from(b, 'utf8').copy(bufferB);

  // Use crypto.timingSafeEqual on fixed-length buffers
  const match = cryptoTimingSafeEqual(bufferA, bufferB);

  return match && lengthMatch;
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
