/**
 * Event Routes
 *
 * HTTP handlers for event logging endpoints.
 * All business logic is delegated to EventService.
 */

import { Hono } from 'hono';
import { EventService } from '../services';
import { requireAdmin, sanitizeError } from '../middleware/admin';
import { isValidWalletAddress, isValidUUID, sanitizeString } from '../middleware';
import type { LogEventRequest, ApiError } from '@risejack/shared';
import type { Prisma } from '@prisma/client';

const events = new Hono();

// Valid device types for input validation
const VALID_DEVICE_TYPES = ['mobile', 'desktop', 'tablet'] as const;

/**
 * POST /events
 * Log a user event
 */
events.post('/', async (c) => {
  // Validate request size before parsing to prevent DoS
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength) > 50000) {
    // 50KB limit
    return c.json({ error: 'Request too large' } satisfies ApiError, 413);
  }

  let body: LogEventRequest;
  try {
    body = await c.req.json<LogEventRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON payload' } satisfies ApiError, 400);
  }
  const { walletAddress, eventType, eventData, sessionId, deviceType } = body;

  // INPUT VALIDATION: Validate wallet address if provided
  if (walletAddress && !isValidWalletAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' } satisfies ApiError, 400);
  }

  // INPUT VALIDATION: Validate and sanitize event type
  if (!eventType || !EventService.isValidEventType(eventType)) {
    const validTypes = EventService.getValidEventTypes();
    return c.json(
      { error: `Invalid eventType. Valid types: ${validTypes.join(', ')}` } satisfies ApiError,
      400
    );
  }

  // INPUT VALIDATION: Validate session ID format if provided
  if (sessionId && !isValidUUID(sessionId)) {
    return c.json({ error: 'Invalid sessionId format' } satisfies ApiError, 400);
  }

  // INPUT VALIDATION: Validate device type if provided
  if (
    deviceType &&
    !VALID_DEVICE_TYPES.includes(deviceType as (typeof VALID_DEVICE_TYPES)[number])
  ) {
    return c.json(
      {
        error: `Invalid deviceType. Valid types: ${VALID_DEVICE_TYPES.join(', ')}`,
      } satisfies ApiError,
      400
    );
  }

  // INPUT VALIDATION: Validate eventData size and depth to prevent DoS attacks
  if (eventData) {
    try {
      // Check depth to prevent deeply nested objects (JSON bomb)
      const maxDepth = 10;
      const checkDepth = (obj: unknown, depth = 0): boolean => {
        if (depth > maxDepth) return false;
        if (obj && typeof obj === 'object') {
          for (const key in obj as Record<string, unknown>) {
            if (!checkDepth((obj as Record<string, unknown>)[key], depth + 1)) return false;
          }
        }
        return true;
      };

      if (!checkDepth(eventData)) {
        return c.json({ error: 'Event data too complex' } satisfies ApiError, 400);
      }

      const eventDataStr = JSON.stringify(eventData);
      if (eventDataStr.length > 10000) {
        // 10KB limit
        return c.json({ error: 'Event data too large' } satisfies ApiError, 400);
      }
    } catch {
      return c.json({ error: 'Invalid event data format' } satisfies ApiError, 400);
    }
  }

  try {
    // Get geo from Cloudflare header (if deployed on Cloudflare/Vercel)
    const ipGeoCountry = c.req.header('cf-ipcountry') || undefined;

    const eventId = await EventService.logEvent({
      walletAddress: walletAddress ? sanitizeString(walletAddress, 42) : undefined,
      eventType,
      eventData: eventData as Prisma.InputJsonValue | undefined,
      sessionId,
      deviceType,
      ipGeoCountry: ipGeoCountry ? sanitizeString(ipGeoCountry, 2) : undefined,
    });

    return c.json({
      success: true,
      eventId,
    });
  } catch (error) {
    // Log error server-side without exposing details
    console.error('Event log error:', process.env.NODE_ENV === 'development' ? error : 'Internal');
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

/**
 * GET /events/types
 * Returns valid event types
 */
events.get('/types', (c) => {
  return c.json({
    eventTypes: EventService.getValidEventTypes(),
  });
});

/**
 * GET /events/funnel
 * Returns funnel analytics (admin only)
 * Requires X-Admin-API-Key header or admin_key query parameter
 */
events.get('/funnel', requireAdmin, async (c) => {
  // Validate days parameter (bounded input)
  const rawDays = c.req.query('days');
  const days = Math.min(Math.max(1, Number(rawDays) || 7), 90); // Bounded between 1-90 days

  try {
    const result = await EventService.getFunnelAnalytics(days);
    return c.json(result);
  } catch (error) {
    console.error(
      'Funnel analytics error:',
      process.env.NODE_ENV === 'development' ? error : 'Internal'
    );
    return c.json({ error: sanitizeError(error) } satisfies ApiError, 500);
  }
});

export default events;
