/**
 * Events API Routes
 *
 * Logs high-value user events for analytics and funnel tracking
 */

import { Hono } from 'hono';
import prisma from '../db/client';

const events = new Hono();

// Valid event types
const VALID_EVENT_TYPES = [
  'wallet_connect',
  'wallet_disconnect',
  'game_start',
  'game_action', // hit, stand, double, etc.
  'referral_click',
  'vip_upgrade',
  'email_subscribe',
  'page_view',
] as const;

/**
 * POST /events
 * Log a user event
 */
events.post('/', async (c) => {
  const body = await c.req.json();
  const { walletAddress, eventType, eventData, sessionId, deviceType } = body;

  // Validate event type
  if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
    return c.json(
      {
        error: `Invalid eventType. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
      },
      400
    );
  }

  try {
    // Find user if wallet provided
    let userId: string | undefined;
    if (walletAddress) {
      const user = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
        select: { id: true },
      });
      userId = user?.id;
    }

    // Get geo from request (simplified - in production use a geo service)
    const ipGeoCountry = c.req.header('cf-ipcountry') || null;

    // Create event
    const event = await prisma.eventLog.create({
      data: {
        userId,
        walletAddress: walletAddress?.toLowerCase(),
        eventType,
        eventData: eventData || {},
        sessionId,
        deviceType,
        ipGeoCountry,
      },
    });

    return c.json({
      success: true,
      eventId: event.id,
    });
  } catch (error) {
    console.error('Event log error:', error);
    return c.json({ error: 'Failed to log event' }, 500);
  }
});

/**
 * GET /events/types
 * Returns valid event types
 */
events.get('/types', (c) => {
  return c.json({
    eventTypes: VALID_EVENT_TYPES,
  });
});

/**
 * GET /events/funnel
 * Returns funnel analytics (admin only in production)
 */
events.get('/funnel', async (c) => {
  const days = Number(c.req.query('days')) || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Count events by type
    const funnel = await prisma.eventLog.groupBy({
      by: ['eventType'],
      where: {
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: {
        _count: {
          eventType: 'desc',
        },
      },
    });

    // Count unique users per event type
    const uniqueUsers = await prisma.$queryRaw<Array<{ event_type: string; unique_users: bigint }>>`
      SELECT event_type, COUNT(DISTINCT COALESCE(user_id, wallet_address)) as unique_users
      FROM event_log
      WHERE created_at >= ${since}
      GROUP BY event_type
    `;

    const funnelMap = new Map(funnel.map((f) => [f.eventType, f._count]));
    const usersMap = new Map(uniqueUsers.map((u) => [u.event_type, Number(u.unique_users)]));

    return c.json({
      period: { days, since },
      funnel: VALID_EVENT_TYPES.map((type) => ({
        eventType: type,
        totalEvents: funnelMap.get(type) || 0,
        uniqueUsers: usersMap.get(type) || 0,
      })),
    });
  } catch (error) {
    console.error('Funnel analytics error:', error);
    return c.json({ error: 'Failed to get funnel data' }, 500);
  }
});

export default events;
