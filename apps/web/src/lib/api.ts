/**
 * API Client
 *
 * Simple fetch wrapper for Rise Casino API.
 * Uses VITE_API_URL from environment.
 */

import type { LogEventRequest, EventType } from '@risejack/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Generic API request handler
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
}

// ==================== EVENTS ====================

export async function logEvent(
    eventType: EventType,
    walletAddress?: string,
    eventData?: Record<string, unknown>
): Promise<{ success: boolean; eventId: string }> {
    return apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify({
            eventType,
            walletAddress,
            eventData,
            deviceType: getDeviceType(),
        } satisfies LogEventRequest),
    });
}

export async function getEventTypes(): Promise<{ eventTypes: EventType[] }> {
    return apiRequest('/api/events/types');
}

// ==================== USERS ====================

export async function registerUser(
    walletAddress: string,
    displayName?: string
): Promise<{ success: boolean; user: unknown }> {
    return apiRequest('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, displayName }),
    });
}

export async function getUserProfile(walletAddress: string) {
    return apiRequest(`/api/users/${walletAddress}`);
}

export async function getUserGames(
    walletAddress: string,
    limit = 20,
    offset = 0
) {
    return apiRequest(
        `/api/users/${walletAddress}/games?limit=${limit}&offset=${offset}`
    );
}

// ==================== REFERRALS ====================

export async function getReferralStats(walletAddress: string) {
    return apiRequest(`/api/referrals/${walletAddress}`);
}

export async function registerReferral(
    walletAddress: string,
    referralCode: string
): Promise<{ success: boolean; userReferralCode?: string; error?: string }> {
    return apiRequest('/api/referrals/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, referralCode }),
    });
}

// ==================== LEADERBOARD ====================

export interface LeaderboardEntry {
    rank: number;
    walletAddress: string;
    displayName?: string | null;
    value: string;  // XP, volume, or other metric value
    vipTier?: string;
}

export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    total: number;
}

export async function getLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all_time') {
    return apiRequest(`/api/leaderboard/${period}`);
}

export async function getLiveLeaderboard(
    metric: 'volume' | 'biggest_win' | 'streak' | 'xp',
    limit = 50
): Promise<LeaderboardResponse> {
    return apiRequest(`/api/leaderboard/live/${metric}?limit=${limit}`);
}

// ==================== UTILS ====================

type DeviceType = 'mobile' | 'desktop' | 'tablet';

function getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet/i.test(ua)) return 'tablet';
    return 'desktop';
}

