/**
 * Event Repository
 *
 * Data access layer for event logging operations.
 */

import prisma from '../db/client';
import type { EventType } from '@risejack/shared';
import type { Prisma } from '@prisma/client';

// ==================== WRITE OPERATIONS ====================

export async function createEvent(data: {
  userId?: string;
  walletAddress?: string;
  eventType: EventType;
  eventData?: Prisma.InputJsonValue;
  sessionId?: string;
  deviceType?: string;
  ipGeoCountry?: string;
  chainId?: number;
}) {
  return prisma.eventLog.create({
    data: {
      ...(data.userId && { user: { connect: { id: data.userId } } }),
      walletAddress: data.walletAddress?.toLowerCase(),
      eventType: data.eventType,
      eventData: data.eventData,
      sessionId: data.sessionId,
      deviceType: data.deviceType,
      ipGeoCountry: data.ipGeoCountry,
      ...(data.chainId && { chain: { connect: { id: data.chainId } } }),
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
