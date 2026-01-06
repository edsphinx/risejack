/**
 * Event Service
 *
 * Business logic layer for event logging operations.
 */

import { UserRepository, EventRepository } from '../repositories';
import type { EventType, FunnelEntry, FunnelResponse } from '@vyrejack/shared';
import type { Prisma } from '@prisma/client';

const VALID_EVENT_TYPES: EventType[] = [
  'wallet_connect',
  'wallet_disconnect',
  'game_start',
  'game_action',
  'referral_click',
  'vip_upgrade',
  'email_subscribe',
  'page_view',
];

export function isValidEventType(type: string): type is EventType {
  return VALID_EVENT_TYPES.includes(type as EventType);
}

export function getValidEventTypes(): EventType[] {
  return [...VALID_EVENT_TYPES];
}

export async function logEvent(data: {
  walletAddress?: string;
  eventType: EventType;
  eventData?: Prisma.InputJsonValue;
  sessionId?: string;
  deviceType?: string;
  ipGeoCountry?: string;
}): Promise<string> {
  // Find user if wallet provided
  let userId: string | undefined;

  if (data.walletAddress) {
    const user = await UserRepository.findUserByWallet(data.walletAddress);
    userId = user?.id;
  }

  const event = await EventRepository.createEvent({
    userId,
    walletAddress: data.walletAddress,
    eventType: data.eventType,
    eventData: data.eventData,
    sessionId: data.sessionId,
    deviceType: data.deviceType,
    ipGeoCountry: data.ipGeoCountry,
  });

  return event.id;
}

export async function getFunnelAnalytics(days: number = 7): Promise<FunnelResponse> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [eventCounts, uniqueUsers] = await Promise.all([
    EventRepository.getEventCountsByType(since),
    EventRepository.getUniqueUsersByEventType(since),
  ]);

  const countsMap = new Map(eventCounts.map((e) => [e.eventType, e._count]));
  const usersMap = new Map(uniqueUsers.map((u) => [u.event_type, Number(u.unique_users)]));

  const funnel: FunnelEntry[] = VALID_EVENT_TYPES.map((type) => ({
    eventType: type,
    totalEvents: countsMap.get(type) || 0,
    uniqueUsers: usersMap.get(type) || 0,
  }));

  return {
    period: {
      days,
      since: since.toISOString(),
    },
    funnel,
  };
}
