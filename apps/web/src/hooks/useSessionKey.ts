/**
 * useSessionKey - Session key hook without wagmi
 * Uses sessionKeyManager service (Meteoro pattern)
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  getActiveSessionKey,
  createSessionKey,
  revokeSessionKey,
  getSessionKeyTimeRemaining,
  isSessionKeyValid,
  type SessionKeyData,
} from '@/services/sessionKeyManager';
import { logger } from '@/lib/logger';
import type { TimeRemaining } from '@risejack/shared';

export interface UseSessionKeyReturn {
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  keyPair: { publicKey: string; privateKey: string } | null;
  isCreating: boolean;
  create: () => Promise<boolean>;
  revoke: () => Promise<void>;
}

export function useSessionKey(address: `0x${string}` | null): UseSessionKeyReturn {
  const [sessionData, setSessionData] = useState<SessionKeyData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load existing session key on mount or address change
  useEffect(() => {
    if (!address) {
      setSessionData(null);
      return;
    }

    const existingKey = getActiveSessionKey();
    if (existingKey && isSessionKeyValid(existingKey)) {
      logger.log('🔑 Restored session key from localStorage');
      setSessionData(existingKey);
    }
  }, [address]);

  // Update timer periodically
  useEffect(() => {
    if (!sessionData) return;

    const interval = setInterval(() => {
      if (!isSessionKeyValid(sessionData)) {
        logger.log('🔑 Session key expired');
        setSessionData(null);
      } else {
        // Force re-render to update time remaining
        setSessionData({ ...sessionData });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionData?.publicKey]);

  const hasSessionKey = Boolean(sessionData && isSessionKeyValid(sessionData));

  const timeRemaining: TimeRemaining | null = useMemo(() => {
    if (!sessionData) return null;

    const remaining = getSessionKeyTimeRemaining(sessionData);
    return {
      hours: remaining.hours,
      minutes: remaining.minutes % 60,
      seconds: remaining.seconds % 60,
      expired: remaining.expired,
    };
  }, [sessionData]);

  const keyPair = useMemo(() => {
    if (!sessionData) return null;
    return {
      publicKey: sessionData.publicKey,
      privateKey: sessionData.privateKey,
    };
  }, [sessionData]);

  const create = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    try {
      setIsCreating(true);
      const newKey = await createSessionKey(address);
      setSessionData(newKey);
      return true;
    } catch (err) {
      logger.error('🔑 Failed to create session key:', err);
      return false;
    } finally {
      setIsCreating(false);
    }
  }, [address]);

  const revoke = useCallback(async (): Promise<void> => {
    if (!sessionData?.publicKey) return;

    try {
      await revokeSessionKey(sessionData.publicKey);
      setSessionData(null);
    } catch (err) {
      logger.error('🔑 Failed to revoke session key:', err);
    }
  }, [sessionData]);

  return {
    hasSessionKey,
    sessionExpiry: timeRemaining,
    keyPair,
    isCreating,
    create,
    revoke,
  };
}
