/**
 * useLeaderboardSubscription - Real-time leaderboard updates via Shreds
 *
 * Subscribes to GameEnded events to detect when rankings might change,
 * then triggers a refetch of the leaderboard data.
 */

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { LiveActivityService, type LiveWinEvent } from '@/services/live-activity.service';
import { logger } from '@/lib/logger';

interface UseLeaderboardSubscriptionOptions {
    onUpdate?: () => void;
    debounceMs?: number;
    enabled?: boolean;
}

/**
 * Subscribe to real-time leaderboard updates
 */
export function useLeaderboardSubscription(options: UseLeaderboardSubscriptionOptions = {}) {
    const { onUpdate, debounceMs = 2000, enabled = true } = options;
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingUpdateRef = useRef(false);

    const handleWinEvent = useCallback(
        (_win: LiveWinEvent) => {
            // A win happened - leaderboard might need refresh
            pendingUpdateRef.current = true;

            // Debounce updates to avoid hammering the API
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
                if (pendingUpdateRef.current && onUpdate) {
                    logger.log('[LeaderboardSub] Triggering leaderboard refresh after win event');
                    onUpdate();
                    pendingUpdateRef.current = false;
                }
                debounceTimerRef.current = null;
            }, debounceMs);
        },
        [onUpdate, debounceMs]
    );

    useEffect(() => {
        if (!enabled || !onUpdate) return;

        const unsubscribe = LiveActivityService.subscribe(handleWinEvent);
        logger.log('[LeaderboardSub] Subscribed to live activity for leaderboard updates');

        return () => {
            unsubscribe();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            logger.log('[LeaderboardSub] Unsubscribed');
        };
    }, [enabled, handleWinEvent, onUpdate]);
}
