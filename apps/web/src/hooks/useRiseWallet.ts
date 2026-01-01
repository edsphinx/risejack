/**
 * useRiseWallet - Compositor hook for Rise Wallet functionality
 * Combines useWalletConnection, useSessionKey, and auto-session logic
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { formatEther } from 'viem';
import { useWalletConnection } from './useWalletConnection';
import { useSessionKey } from './useSessionKey';
import { getProvider } from '@/lib/riseWallet';
import { logger } from '@/lib/logger';
import type { UseRiseWalletReturn } from '@risejack/shared';

// LocalStorage keys
const ONBOARDING_SEEN_KEY = 'risejack_fastmode_onboarding_seen';
const SKIP_FASTMODE_KEY = 'risejack_skip_fastmode';

export function useRiseWallet(): UseRiseWalletReturn {
  const connection = useWalletConnection();
  const sessionKey = useSessionKey(connection.address);
  const [balance, setBalance] = useState<bigint | null>(null);

  // Auto session flow states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
  });
  const [skipFastMode, setSkipFastMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SKIP_FASTMODE_KEY) === 'true';
  });
  const [wasConnected, setWasConnected] = useState(false);

  // Fetch balance
  useEffect(() => {
    if (!connection.address) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const provider = getProvider();
        const result = await provider.request({
          method: 'eth_getBalance',
          params: [connection.address!, 'latest'],
        });
        // Validate result before BigInt conversion
        if (typeof result === 'string' && result.startsWith('0x')) {
          setBalance(BigInt(result));
        } else {
          setBalance(null);
        }
      } catch {
        setBalance(null);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [connection.address]);

  // Auto-create session on connection (for returning users)
  useEffect(() => {
    // Detect fresh connection (was disconnected, now connected)
    if (connection.isConnected && !wasConnected) {
      setWasConnected(true);

      // If user hasn't seen onboarding, show it
      if (!hasSeenOnboarding && !skipFastMode) {
        setShowOnboarding(true);
        return;
      }

      // If returning user and doesn't have session key, auto-create
      // Check isCreating to prevent race condition / duplicate attempts
      if (
        hasSeenOnboarding &&
        !sessionKey.hasSessionKey &&
        !skipFastMode &&
        !sessionKey.isCreating
      ) {
        sessionKey.create();
      }
    }

    // Reset when disconnected
    if (!connection.isConnected && wasConnected) {
      setWasConnected(false);
      setShowOnboarding(false);
      setShowExpiryModal(false);
    }
  }, [
    connection.isConnected,
    wasConnected,
    hasSeenOnboarding,
    skipFastMode,
    sessionKey.hasSessionKey,
    sessionKey.isCreating,
    sessionKey.create,
  ]);

  // Track previous session state to detect expiry
  const [hadSessionKey, setHadSessionKey] = useState(false);

  // Update hadSessionKey when session state changes
  // Reset after expiry modal is dismissed to allow multiple session expirations
  useEffect(() => {
    if (sessionKey.hasSessionKey) {
      setHadSessionKey(true);
    }
  }, [sessionKey.hasSessionKey]);

  // Detect session expiry - when we HAD a key but now we don't
  useEffect(() => {
    if (!connection.isConnected || skipFastMode) return;

    // If we HAD a session but now we don't (it expired), show modal
    if (hadSessionKey && !sessionKey.hasSessionKey && !showOnboarding && !showExpiryModal) {
      logger.log('🔑 Session expired - showing modal');
      setShowExpiryModal(true);
    }
  }, [
    sessionKey.hasSessionKey,
    hadSessionKey,
    connection.isConnected,
    skipFastMode,
    showOnboarding,
    showExpiryModal,
  ]);

  // Calculate warning (5 min before expiry)
  const expiryWarningMinutes = (() => {
    if (!sessionKey.sessionExpiry || sessionKey.sessionExpiry.expired) return null;
    const totalMinutes = sessionKey.sessionExpiry.hours * 60 + sessionKey.sessionExpiry.minutes;
    if (totalMinutes <= 5 && totalMinutes > 0) return totalMinutes;
    return null;
  })();

  // Combine disconnect to also revoke session key
  const disconnect = async () => {
    await sessionKey.revoke();
    connection.disconnect();
  };

  const formatBalance = () => {
    if (balance === null) return '0';
    return formatEther(balance);
  };

  // Handle onboarding dismissal
  const dismissOnboarding = useCallback(
    async (enableFastMode: boolean) => {
      setShowOnboarding(false);
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      setHasSeenOnboarding(true);

      if (enableFastMode) {
        await sessionKey.create();
      } else {
        localStorage.setItem(SKIP_FASTMODE_KEY, 'true');
        setSkipFastMode(true);
      }
    },
    [sessionKey.create]
  );

  // Handle expiry modal dismissal
  const dismissExpiryModal = useCallback(
    async (extend: boolean) => {
      setShowExpiryModal(false);
      setHadSessionKey(false); // Reset so we can detect next expiry

      if (extend) {
        await sessionKey.create();
      } else {
        // User chose to continue without - set skip flag for this session only
        // (not persisted, so next visit will show onboarding again)
      }
    },
    [sessionKey.create]
  );

  return {
    // Connection
    address: connection.address,
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting || sessionKey.isCreating,
    error: connection.error,
    connect: connection.connect,
    disconnect,

    // Balance
    balance,
    formatBalance,

    // Session Key
    hasSessionKey: sessionKey.hasSessionKey,
    sessionExpiry: sessionKey.sessionExpiry,
    createSessionKey: sessionKey.create,
    revokeSessionKey: sessionKey.revoke,
    isCreatingSession: sessionKey.isCreating,

    // Auto Session Flow
    showOnboarding,
    showExpiryModal,
    expiryWarningMinutes,
    dismissOnboarding,
    dismissExpiryModal,

    // Internal for useGameActions
    keyPair: sessionKey.keyPair,
  };
}
