import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { Porto } from 'porto';
import { riseTestnetConfig } from 'rise-wallet-sdk';
import { encodeFunctionData, type Address } from 'viem';
import { getRiseJackAddress, RISEJACK_ABI } from '../lib/contract';
import type { TimeRemaining } from '@risejack/shared';

// Session expiry duration (1 hour)
const SESSION_EXPIRY_SECONDS = 3600;

// Obfuscation key for localStorage (not a full security solution, but better than plaintext)
// In production, use Web Crypto API with user-derived keys or IndexedDB with origin isolation
const STORAGE_KEY = 'risejack_session_v1';

/**
 * Simple obfuscation for localStorage
 * NOTE: This is NOT encryption. For true security, use Web Crypto API.
 * Session keys are already scoped to specific contract permissions,
 * limiting damage if compromised.
 */
function obfuscate(data: string): string {
  return btoa(
    data
      .split('')
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 256)))
      .join('')
  );
}

function deobfuscate(data: string): string {
  try {
    const decoded = atob(data);
    return decoded
      .split('')
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 256)))
      .join('');
  } catch {
    return '';
  }
}

// Session data structure (no private keys stored - Porto manages that)
interface SessionInfo {
  address: Address;
  expiry: number;
  createdAt: number;
}

export interface UseRiseWalletReturn {
  address: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasSessionKey: boolean;
  sessionExpiry: TimeRemaining | null;
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  createSessionKey: () => Promise<boolean>;
  revokeSessionKey: () => void;
  sendTransaction: (functionName: string, value?: bigint) => Promise<`0x${string}` | null>;
}

export function useRiseWallet(): UseRiseWalletReturn {
  const [address, setAddress] = useState<Address | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = useMemo(() => getRiseJackAddress(), []);

  // Initialize Porto with Rise config
  const porto = useMemo(() => {
    try {
      return Porto.create(riseTestnetConfig);
    } catch (err) {
      console.error('Failed to create Porto instance:', err);
      return null;
    }
  }, []);

  // Load session info from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const deobfuscated = deobfuscate(stored);
        if (deobfuscated) {
          const parsed = JSON.parse(deobfuscated) as SessionInfo;
          // Check if session is still valid
          if (parsed.expiry > Date.now() / 1000) {
            setSessionInfo(parsed);
            setAddress(parsed.address);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Calculate time remaining for session
  const sessionExpiry = useMemo((): TimeRemaining | null => {
    if (!sessionInfo) return null;

    const now = Math.floor(Date.now() / 1000);
    const remaining = sessionInfo.expiry - now;

    if (remaining <= 0) {
      return { seconds: 0, minutes: 0, hours: 0, expired: true };
    }

    return {
      seconds: remaining % 60,
      minutes: Math.floor((remaining % 3600) / 60),
      hours: Math.floor(remaining / 3600),
      expired: false,
    };
  }, [sessionInfo]);

  // Connect wallet via Porto
  const connect = useCallback(async () => {
    if (!porto) {
      setError('Porto not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await porto.provider.request({
        method: 'eth_requestAccounts',
      });

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0] as Address);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [porto]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null);
    setSessionInfo(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Create session key for popup-free transactions
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!porto || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      const expiry = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

      // Request session key creation via Porto
      // Porto manages the private key securely - we only store metadata
      const result = await porto.provider.request({
        method: 'experimental_createSession',
        params: [
          {
            expiry,
            permissions: {
              calls: [
                {
                  to: contractAddress,
                  selector: null, // null = any function on this contract
                },
              ],
              spend: [
                {
                  token: '0x0000000000000000000000000000000000000000', // Native ETH
                  limit: '1000000000000000000', // 1 ETH max per session
                  period: 'hour',
                },
              ],
            },
          },
        ],
      });

      if (result) {
        // Only store session metadata, not private keys
        // Porto manages the actual signing keys internally
        const sessionData: SessionInfo = {
          address,
          expiry,
          createdAt: Math.floor(Date.now() / 1000),
        };

        setSessionInfo(sessionData);

        // Store obfuscated (not encrypted, but not plaintext)
        localStorage.setItem(STORAGE_KEY, obfuscate(JSON.stringify(sessionData)));
        return true;
      }

      return false;
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create session key');
      return false;
    }
  }, [porto, address, contractAddress]);

  // Revoke session key
  const revokeSessionKey = useCallback(() => {
    setSessionInfo(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Encode function call using proper ABI
  const encodeCall = useCallback((functionName: string): `0x${string}` => {
    try {
      // Use viem's encodeFunctionData with proper ABI
      return encodeFunctionData({
        abi: RISEJACK_ABI,
        functionName: functionName as 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
      });
    } catch (err) {
      console.error('Failed to encode function data:', err);
      throw new Error(`Invalid function: ${functionName}`);
    }
  }, []);

  // Send transaction - Porto handles session key signing automatically
  const sendTransaction = useCallback(
    async (functionName: string, value?: bigint): Promise<`0x${string}` | null> => {
      if (!porto || !address) {
        setError('Wallet not connected');
        return null;
      }

      // Validate function name against known functions
      const validFunctions = ['placeBet', 'hit', 'stand', 'double', 'surrender'];
      if (!validFunctions.includes(functionName)) {
        setError(`Invalid function: ${functionName}`);
        return null;
      }

      try {
        // Encode function call using ABI
        const data = encodeCall(functionName);

        // Porto automatically uses session key if available and valid
        // Otherwise it falls back to requiring user approval
        const hash = await porto.provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to: contractAddress,
              data,
              value: value ? `0x${value.toString(16)}` : undefined,
            },
          ],
        });

        return hash as `0x${string}`;
      } catch (err: unknown) {
        setError((err as Error).message || 'Transaction failed');
        return null;
      }
    },
    [porto, address, contractAddress, encodeCall]
  );

  return {
    address,
    isConnected: !!address,
    isConnecting,
    hasSessionKey: !!sessionInfo && sessionInfo.expiry > Date.now() / 1000,
    sessionExpiry,
    error,

    connect,
    disconnect,
    createSessionKey,
    revokeSessionKey,
    sendTransaction,
  };
}
