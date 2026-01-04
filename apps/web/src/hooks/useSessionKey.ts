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
import type { TimeRemaining } from '@vyrejack/shared';

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

  // Load and VALIDATE existing session key on mount or address change
  useEffect(() => {
    if (!address) {
      setSessionData(null);
      return;
    }

    const restoreAndValidate = async () => {
      const existingKey = getActiveSessionKey();
      logger.log('🔑 [DEBUG] restoreAndValidate:', {
        hasKey: !!existingKey,
        publicKey: existingKey?.publicKey?.slice(0, 20),
        expiry: existingKey?.expiry,
        isValid: existingKey ? isSessionKeyValid(existingKey) : false,
      });

      if (existingKey && isSessionKeyValid(existingKey)) {
        // Simple validation - just check if key exists and is not expired
        // No need for RPC validation or warmup - sendSessionTransaction handles failures
        // with auto-recreate pattern
        logger.log('🔑 Found valid session key in localStorage');
        setSessionData(existingKey);
      }
    };

    restoreAndValidate();
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
