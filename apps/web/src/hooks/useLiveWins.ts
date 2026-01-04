/**
 * useLiveWins - Hook for real-time wins via Shreds
 *
 * Subscribes to live GameEnded events and maintains a list of recent wins.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { LiveActivityService, type LiveWinEvent } from '@/services/live-activity.service';

interface UseLiveWinsOptions {
    maxWins?: number;
    enabled?: boolean;
}

interface UseLiveWinsResult {
    wins: LiveWinEvent[];
    isConnected: boolean;
    latestWin: LiveWinEvent | null;
}

export function useLiveWins(options: UseLiveWinsOptions = {}): UseLiveWinsResult {
    const { maxWins = 10, enabled = true } = options;

    const [wins, setWins] = useState<LiveWinEvent[]>([]);
    const [latestWin, setLatestWin] = useState<LiveWinEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const handleNewWin = useCallback(
        (win: LiveWinEvent) => {
            setLatestWin(win);
            setWins((prev) => {
                const updated = [win, ...prev];
                return updated.slice(0, maxWins);
            });
        },
        [maxWins]
    );

    useEffect(() => {
        if (!enabled) return;

        // Get initial wins
        const recent = LiveActivityService.getRecent();
        if (recent.length > 0) {
            setWins(recent.slice(0, maxWins));
        }

        // Subscribe to live updates
        const unsubscribe = LiveActivityService.subscribe(handleNewWin);
        setIsConnected(true);

        return () => {
            unsubscribe();
            setIsConnected(false);
        };
    }, [enabled, maxWins, handleNewWin]);

    return { wins, isConnected, latestWin };
}
