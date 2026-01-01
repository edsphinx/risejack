/**
 * Event Routes
 *
 * HTTP handlers for event logging endpoints.
 * All business logic is delegated to EventService.
 */

import { Hono } from 'hono';
import { EventService } from '../services';
import { requireAdmin, sanitizeError } from '../middleware/admin';
import type { LogEventRequest, ApiError } from '@risejack/shared';
import type { Prisma } from '@prisma/client';

const events = new Hono();

/**
 * POST /events
 * Log a user event
 */
events.post('/', async (c) => {
  const body = await c.req.json<LogEventRequest>();
  const { walletAddress, eventType, eventData, sessionId, deviceType } = body;

  // Validate event type
  if (!eventType || !EventService.isValidEventType(eventType)) {
    const validTypes = EventService.getValidEventTypes();
    return c.json(
      { error: `Invalid eventType. Valid types: ${validTypes.join(', ')}` } satisfies ApiError,
      400
    );
  }

  try {
    // Get geo from Cloudflare header (if deployed on Cloudflare/Vercel)
    const ipGeoCountry = c.req.header('cf-ipcountry') || undefined;

    const eventId = await EventService.logEvent({
      walletAddress,
      eventType,
      eventData: eventData as Prisma.InputJsonValue | undefined,
      sessionId,
      deviceType,
      ipGeoCountry,
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
