/**
 * useEventLogger - Hook for logging analytics events
 *
 * Provides fire-and-forget event logging to the API.
 * Events are logged asynchronously without blocking UI.
 */

import { useCallback, useRef } from 'preact/hooks';
import { logEvent } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { EventType } from '@vyrejack/shared';

interface UseEventLoggerOptions {
  walletAddress?: string | null;
}

export function useEventLogger(options: UseEventLoggerOptions = {}) {
  const { walletAddress } = options;

  // Track logged events to avoid duplicates in same session
  const loggedEvents = useRef<Set<string>>(new Set());

  /**
   * Log an event to the API (fire-and-forget)
   */
  const log = useCallback(
    async (
      eventType: EventType,
      eventData?: Record<string, unknown>,
      opts?: { dedupe?: boolean; dedupeKey?: string }
    ) => {
      const { dedupe = false, dedupeKey } = opts || {};

      // Dedupe check
      if (dedupe) {
        const key = dedupeKey || `${eventType}-${JSON.stringify(eventData)}`;
        if (loggedEvents.current.has(key)) {
          return;
        }
        loggedEvents.current.add(key);
      }

      try {
        await logEvent(eventType, walletAddress || undefined, eventData);
        logger.log('[EventLogger] Logged:', eventType, eventData);
      } catch (error) {
        // Don't throw - event logging should never break the app
        logger.error('[EventLogger] Failed to log event:', error);
      }
    },
    [walletAddress]
  );

  /**
   * Pre-built event loggers for common events
   */
  const logWalletConnect = useCallback(
    (provider?: string) => {
      log('wallet_connect', { provider }, { dedupe: true, dedupeKey: 'wallet_connect' });
    },
    [log]
  );

  const logWalletDisconnect = useCallback(() => {
    log('wallet_disconnect', {}, { dedupe: true, dedupeKey: 'wallet_disconnect' });
    // Clear dedupe cache on disconnect
    loggedEvents.current.clear();
  }, [log]);

  const logGameStart = useCallback(
    (betAmount: string, currency = 'ETH') => {
      log('game_start', { betAmount, currency });
    },
    [log]
  );

  const logGameAction = useCallback(
    (action: 'hit' | 'stand' | 'double', gameData?: Record<string, unknown>) => {
      log('game_action', { action, ...gameData });
    },
    [log]
  );

  const logPageView = useCallback(
    (page: string) => {
      log('page_view', { page }, { dedupe: true, dedupeKey: `page_view_${page}` });
    },
    [log]
  );

  return {
    log,
    logWalletConnect,
    logWalletDisconnect,
    logGameStart,
    logGameAction,
    logPageView,
  };
}
