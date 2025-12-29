import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { P256, PublicKey, Signature } from 'ox';
import { Hooks, Actions } from 'rise-wallet/wagmi';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { riseWalletConnector, wagmiConfig } from '../config/wagmi';
import { getRiseJackAddress, RISEJACK_ABI } from '../lib/contract';
import { keccak256, toHex, encodeFunctionData as viemEncodeFunctionData } from 'viem';
import type { TimeRemaining } from '@risejack/shared';

// Session key expiry (1 hour)
const SESSION_EXPIRY_SECONDS = 3600;
const SESSION_KEY_STORAGE_PREFIX = 'risejack.sessionKey';

// Generate function selector
const getFunctionSelector = (signature: string): `0x${string}` =>
  keccak256(toHex(signature)).slice(0, 10) as `0x${string}`;

// Game permissions for session key
const GAME_PERMISSIONS = {
  calls: [
    { to: getRiseJackAddress(), signature: getFunctionSelector('placeBet()') },
    { to: getRiseJackAddress(), signature: getFunctionSelector('hit()') },
    { to: getRiseJackAddress(), signature: getFunctionSelector('stand()') },
    { to: getRiseJackAddress(), signature: getFunctionSelector('double()') },
    { to: getRiseJackAddress(), signature: getFunctionSelector('surrender()') },
  ],
  spend: [
    {
      limit: 10000000000000000000n, // 10 ETH in wei
      period: 'day' as const,
      token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    },
  ],
};

// Module-level key pair storage (like wallet-demo)
let keyPair: { privateKey: string; publicKey: string } | null = null;

// Generate P256 key pair
function generateKeyPair() {
  const privateKey = P256.randomPrivateKey();
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }), {
    includePrefix: false,
  });
  return { privateKey, publicKey };
}

// Sign with session key
function signWithSessionKey(digest: `0x${string}`, privateKey: string): string {
  return Signature.toHex(
    P256.sign({
      payload: digest,
      privateKey: privateKey as `0x${string}`,
    })
  );
}

export interface UseRiseWalletReturn {
  address: `0x${string}` | null;
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
  const { address, isConnected, connector } = useAccount();
  const { connect: wagmiConnect, isPending: isConnecting } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [error, setError] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);

  const contractAddress = useMemo(() => getRiseJackAddress(), []);

  // Use Porto's built-in hooks for permissions
  const { data: permissions, isLoading: permissionsLoading } = Hooks.usePermissions();
  const grantPermissions = Hooks.useGrantPermissions();

  // Check if we have a usable session key
  const hasSessionKey = useMemo(() => {
    if (!keyPair || permissionsLoading) return false;

    const now = Math.floor(Date.now() / 1000);
    return (
      permissions?.some(
        (perm: { key?: { publicKey?: string }; expiry?: number }) =>
          perm.key?.publicKey === keyPair?.publicKey && (perm.expiry ?? 0) > now
      ) ?? false
    );
  }, [permissions, permissionsLoading]);

  // Load session key from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storageKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith(SESSION_KEY_STORAGE_PREFIX)
      );

      for (const storageKey of storageKeys) {
        const keyData = localStorage.getItem(storageKey);
        if (keyData) {
          const parsed = JSON.parse(keyData);
          if (parsed.publicKey && parsed.privateKey && parsed.expiry > Date.now() / 1000) {
            keyPair = { privateKey: parsed.privateKey, publicKey: parsed.publicKey };
            setSessionExpiry(parsed.expiry);
            break;
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Calculate time remaining
  const timeRemaining = useMemo((): TimeRemaining | null => {
    if (!sessionExpiry) return null;

    const now = Math.floor(Date.now() / 1000);
    const remaining = sessionExpiry - now;

    if (remaining <= 0) {
      return { seconds: 0, minutes: 0, hours: 0, expired: true };
    }

    return {
      seconds: remaining % 60,
      minutes: Math.floor((remaining % 3600) / 60),
      hours: Math.floor(remaining / 3600),
      expired: false,
    };
  }, [sessionExpiry]);

  // Connect wallet
  const connect = useCallback(async () => {
    try {
      setError(null);
      wagmiConnect({ connector: riseWalletConnector });
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to connect');
    }
  }, [wagmiConnect]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    Actions.disconnect(wagmiConfig);
    wagmiDisconnect();
    keyPair = null;
    setSessionExpiry(null);
  }, [wagmiDisconnect]);

  // Create session key with P256
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);

      // Generate P256 key pair
      const newKeyPair = generateKeyPair();
      keyPair = newKeyPair;

      const expiry = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

      // Store in localStorage
      localStorage.setItem(
        `${SESSION_KEY_STORAGE_PREFIX}.${newKeyPair.publicKey}`,
        JSON.stringify({ ...newKeyPair, expiry })
      );

      // Grant permissions using Porto hook
      await grantPermissions.mutateAsync({
        key: { publicKey: newKeyPair.publicKey, type: 'p256' as const },
        expiry,
        feeToken: {
          limit: '1',
          symbol: 'ETH',
        },
        permissions: GAME_PERMISSIONS,
      });

      setSessionExpiry(expiry);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create session key');
      return false;
    }
  }, [isConnected, address, grantPermissions]);

  // Revoke session key
  const revokeSessionKey = useCallback(() => {
    if (keyPair) {
      localStorage.removeItem(`${SESSION_KEY_STORAGE_PREFIX}.${keyPair.publicKey}`);
    }
    keyPair = null;
    setSessionExpiry(null);
  }, []);

  // Send transaction with session key (fast path)
  const sendTransaction = useCallback(
    async (functionName: string, value?: bigint): Promise<`0x${string}` | null> => {
      if (!isConnected || !address) {
        setError('Wallet not connected');
        return null;
      }

      const validFunctions = ['placeBet', 'hit', 'stand', 'double', 'surrender'];
      if (!validFunctions.includes(functionName)) {
        setError(`Invalid function: ${functionName}`);
        return null;
      }

      try {
        setError(null);

        // Encode function data
        const data = viemEncodeFunctionData({
          abi: RISEJACK_ABI,
          functionName: functionName as 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
        });

        // If we have a session key, use fast path
        if (hasSessionKey && keyPair && connector) {
          const provider = await connector.getProvider();

          // 1. Prepare calls
          const prepared = (await (
            provider as {
              request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
            }
          ).request({
            method: 'wallet_prepareCalls',
            params: [
              {
                calls: [
                  {
                    to: contractAddress,
                    value: value ? `0x${value.toString(16)}` : '0x0',
                    data,
                  },
                ],
                key: { type: 'p256', publicKey: keyPair.publicKey },
              },
            ],
          })) as { digest: `0x${string}` };

          // 2. Sign locally with P256
          const { digest, ...requestParams } = prepared;
          const signature = signWithSessionKey(digest, keyPair.privateKey);

          // 3. Send prepared calls
          const response = (await (
            provider as {
              request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
            }
          ).request({
            method: 'wallet_sendPreparedCalls',
            params: [{ ...requestParams, signature }],
          })) as [{ id: `0x${string}` }] | `0x${string}`;

          const callId = Array.isArray(response) ? response[0]?.id : response;
          return callId as `0x${string}`;
        } else {
          // Fallback: regular transaction (requires popup)
          const provider = await connector?.getProvider();
          if (!provider) {
            setError('No provider available');
            return null;
          }

          const hash = await (
            provider as {
              request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
            }
          ).request({
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
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'Transaction failed');
        return null;
      }
    },
    [isConnected, address, hasSessionKey, connector, contractAddress]
  );

  return {
    address: address ?? null,
    isConnected,
    isConnecting,
    hasSessionKey,
    sessionExpiry: timeRemaining,
    error,

    connect,
    disconnect,
    createSessionKey,
    revokeSessionKey,
    sendTransaction,
  };
}
