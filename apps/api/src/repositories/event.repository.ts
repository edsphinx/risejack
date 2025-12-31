/**
 * Event Repository
 *
 * Data access layer for event logging operations.
 */

import prisma from '../db/client';
import type { EventType } from '@risejack/shared';

// ==================== WRITE OPERATIONS ====================

export async function createEvent(data: {
  userId?: string;
  walletAddress?: string;
  eventType: EventType;
  eventData?: Record<string, unknown>;
  sessionId?: string;
  deviceType?: string;
  ipGeoCountry?: string;
}) {
  return prisma.eventLog.create({
    data: {
      userId: data.userId,
      walletAddress: data.walletAddress?.toLowerCase(),
      eventType: data.eventType,
      eventData: data.eventData || {},
      sessionId: data.sessionId,
      deviceType: data.deviceType,
      ipGeoCountry: data.ipGeoCountry,
    },
  });
}

// ==================== READ OPERATIONS ====================

export async function getEventCountsByType(since: Date) {
  return prisma.eventLog.groupBy({
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
}

export async function getUniqueUsersByEventType(since: Date) {
  return prisma.$queryRaw<Array<{ event_type: string; unique_users: bigint }>>`
    SELECT event_type, COUNT(DISTINCT COALESCE(user_id, wallet_address)) as unique_users
    FROM event_log
    WHERE created_at >= ${since}
    GROUP BY event_type
  `;
}
