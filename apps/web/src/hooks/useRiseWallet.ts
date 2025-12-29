/**
 * Rise Wallet Hook - Direct integration without wagmi
 * Based on working Meteoro implementation
 */
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { RiseWallet } from 'rise-wallet';
import { P256, Signature } from 'ox';
import { encodeFunctionData as viemEncodeFunctionData } from 'viem';
import { getRiseJackAddress, RISEJACK_ABI } from '../lib/contract';
import type { TimeRemaining } from '@risejack/shared';

// Session key expiry (1 hour)
const SESSION_EXPIRY_SECONDS = 3600;
const SESSION_KEY_STORAGE_PREFIX = 'risejack.sessionKey';

// Module-level Rise Wallet instance
let riseWalletInstance: ReturnType<typeof RiseWallet.create> | null = null;

// Module-level key pair storage
let keyPair: { privateKey: `0x${string}`; publicKey: `0x${string}` } | null = null;

// Generate P256 key pair
function generateKeyPair() {
  const privateKey = P256.randomPrivateKey();
  const publicKey = P256.getPublicKey({ privateKey });
  return {
    privateKey,
    publicKey:
      `0x${publicKey.x.toString(16).padStart(64, '0')}${publicKey.y.toString(16).padStart(64, '0')}` as `0x${string}`,
  };
}

// Sign with session key
function signWithSessionKey(digest: `0x${string}`, privateKey: `0x${string}`): string {
  return Signature.toHex(
    P256.sign({
      payload: digest,
      privateKey,
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
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);

  const contractAddress = useMemo(() => getRiseJackAddress(), []);

  // Check if we have a usable session key
  const hasSessionKey = useMemo(() => {
    if (!keyPair) return false;
    const stored = localStorage.getItem(`${SESSION_KEY_STORAGE_PREFIX}.${keyPair.publicKey}`);
    if (!stored) return false;
    const data = JSON.parse(stored);
    return data.expiry > Math.floor(Date.now() / 1000);
  }, [sessionExpiry]);

  // Calculate time remaining
  const timeRemaining: TimeRemaining | null = useMemo(() => {
    if (!sessionExpiry) return null;
    const now = Math.floor(Date.now() / 1000);
    const remaining = sessionExpiry - now;
    if (remaining <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      hours: Math.floor(remaining / 3600),
      minutes: Math.floor((remaining % 3600) / 60),
      seconds: remaining % 60,
      expired: false,
    };
  }, [sessionExpiry]);

  // Initialize Rise Wallet on mount
  useEffect(() => {
    if (!riseWalletInstance) {
      console.log('[RiseJack] Creating Rise Wallet instance...');
      riseWalletInstance = RiseWallet.create();
    }

    // Check for saved wallet
    const savedWallet = localStorage.getItem('risejack.wallet');
    if (savedWallet) {
      const wallet = JSON.parse(savedWallet);
      console.log('[RiseJack] Found saved wallet:', wallet.address);

      // Verify wallet is still connected
      riseWalletInstance.provider
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (
            accounts &&
            accounts.length > 0 &&
            accounts[0].toLowerCase() === wallet.address.toLowerCase()
          ) {
            console.log('[RiseJack] Wallet session valid, auto-reconnecting...');
            setAddress(accounts[0]);
            setIsConnected(true);

            // Load session key
            loadSessionKey();
          } else {
            console.log('[RiseJack] Wallet session expired');
            localStorage.removeItem('risejack.wallet');
          }
        })
        .catch(() => {
          console.log('[RiseJack] Could not verify wallet session');
        });
    }
  }, []);

  // Load session key from localStorage
  const loadSessionKey = useCallback(() => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(SESSION_KEY_STORAGE_PREFIX + '.')
    );
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.expiry > Math.floor(Date.now() / 1000)) {
          keyPair = { privateKey: data.privateKey, publicKey: data.publicKey };
          setSessionExpiry(data.expiry);
          console.log('[RiseJack] Loaded existing session key');
          return;
        }
      }
    }
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!riseWalletInstance) {
      setError('Rise Wallet not initialized');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      console.log('[RiseJack] Connecting to Rise Wallet...');
      console.log('[RiseJack] Requesting accounts via eth_requestAccounts...');

      const accounts = await riseWalletInstance.provider.request({
        method: 'eth_requestAccounts',
      });

      console.log('[RiseJack] Connected accounts:', accounts);

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from Rise Wallet');
      }

      const walletAddress = accounts[0];
      setAddress(walletAddress);
      setIsConnected(true);

      // Save wallet
      localStorage.setItem('risejack.wallet', JSON.stringify({ address: walletAddress }));

      // Load or create session key
      loadSessionKey();
    } catch (err: unknown) {
      console.error('[RiseJack] Connect error:', err);
      const message = err instanceof Error ? err.message : 'Failed to connect';
      if (message.includes('rejected') || message.includes('cancelled')) {
        setError('Connection was cancelled');
      } else {
        setError(message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [loadSessionKey]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
    keyPair = null;
    setSessionExpiry(null);
    localStorage.removeItem('risejack.wallet');
    console.log('[RiseJack] Wallet disconnected');
  }, []);

  // Create session key
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !riseWalletInstance) {
      setError('Wallet not connected');
      return false;
    }

    try {
      setError(null);
      console.log('[RiseJack] Creating session key...');

      // Generate P256 key pair
      const newKeyPair = generateKeyPair();
      keyPair = newKeyPair;

      const expiry = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

      // Store in localStorage
      localStorage.setItem(
        `${SESSION_KEY_STORAGE_PREFIX}.${newKeyPair.publicKey}`,
        JSON.stringify({
          publicKey: newKeyPair.publicKey,
          privateKey: newKeyPair.privateKey,
          expiry,
          createdAt: Date.now(),
        })
      );

      // Grant permissions via Rise Wallet
      const limitHex = `0x${10000000000000000000n.toString(16)}` as `0x${string}`;

      await riseWalletInstance.provider.request({
        method: 'wallet_grantPermissions',
        params: [
          {
            key: { publicKey: newKeyPair.publicKey, type: 'p256' as const },
            expiry,
            feeToken: {
              limit: '10',
              symbol: 'ETH',
            },
            permissions: {
              calls: [{ to: contractAddress, signature: '0x' as `0x${string}` }],
              spend: [
                {
                  limit: limitHex,
                  period: 'day' as const,
                  token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
                },
              ],
            },
          },
        ],
      });

      setSessionExpiry(expiry);
      console.log('[RiseJack] Session key created successfully');
      return true;
    } catch (err: unknown) {
      console.error('[RiseJack] Session key creation failed:', err);
      keyPair = null;
      setError('Failed to create session key');
      return false;
    }
  }, [isConnected, address, contractAddress]);

  // Revoke session key
  const revokeSessionKey = useCallback(() => {
    if (keyPair) {
      localStorage.removeItem(`${SESSION_KEY_STORAGE_PREFIX}.${keyPair.publicKey}`);
    }
    keyPair = null;
    setSessionExpiry(null);
    console.log('[RiseJack] Session key revoked');
  }, []);

  // Send transaction
  const sendTransaction = useCallback(
    async (functionName: string, value?: bigint): Promise<`0x${string}` | null> => {
      if (!isConnected || !address || !riseWalletInstance) {
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
        const provider = riseWalletInstance.provider;

        // Encode function data
        const data = viemEncodeFunctionData({
          abi: RISEJACK_ABI,
          functionName: functionName as 'placeBet' | 'hit' | 'stand' | 'double' | 'surrender',
        });

        const hexValue = value
          ? (`0x${value.toString(16)}` as `0x${string}`)
          : ('0x0' as `0x${string}`);

        // Check if we have a valid session key
        if (hasSessionKey && keyPair) {
          console.log('[RiseJack] Using session key for fast transaction...');

          // 1. Prepare calls
          const prepareParams = [
            {
              calls: [{ to: contractAddress, value: hexValue, data }],
              key: { type: 'p256' as const, publicKey: keyPair.publicKey },
            },
          ] as const;

          const prepared = await provider.request({
            method: 'wallet_prepareCalls',
            params: prepareParams,
          });

          const { digest, ...requestParams } = prepared;

          // 2. Sign digest locally
          const signature = signWithSessionKey(digest, keyPair.privateKey);

          // 3. Send prepared calls
          const response = await provider.request({
            method: 'wallet_sendPreparedCalls',
            params: [{ ...requestParams, signature: signature as `0x${string}` }],
          });

          const callId = response[0]?.id;
          console.log('[RiseJack] Transaction sent:', callId);

          // Fire and forget status check
          provider
            .request({ method: 'wallet_getCallsStatus', params: [callId] })
            .then((status) => console.log('[RiseJack] Status:', status))
            .catch(() => {});

          return callId;
        } else {
          // Fallback: use passkey (popup)
          console.log('[RiseJack] Using passkey for transaction...');

          const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: contractAddress, value: hexValue, data }],
          });

          console.log('[RiseJack] Transaction sent:', txHash);
          return txHash;
        }
      } catch (err: unknown) {
        console.error('[RiseJack] Transaction error:', err);
        const message = err instanceof Error ? err.message : '';
        if (message.includes('rejected') || message.includes('cancelled')) {
          setError('Transaction was cancelled');
        } else {
          setError('Transaction failed. Please try again.');
        }
        return null;
      }
    },
    [isConnected, address, hasSessionKey, contractAddress]
  );

  return {
    address,
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
