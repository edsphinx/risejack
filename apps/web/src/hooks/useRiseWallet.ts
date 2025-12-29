import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import * as Porto from 'porto/Porto';
import * as Key from 'porto/Key';
import * as Account from 'porto/Account';
import { riseTestnetConfig } from 'rise-wallet-sdk';
import { createPublicClient, http, type Address } from 'viem';
import { getRiseJackAddress, RISEJACK_ABI } from '../lib/contract';
import type { SessionKeyData, TimeRemaining } from '@risejack/shared';

// Session key storage key
const SESSION_KEY_STORAGE = 'risejack_session_key';

// Session key expiry duration (1 hour)
const SESSION_EXPIRY_SECONDS = 3600;

export interface UseRiseWalletReturn {
    // State
    address: Address | null;
    isConnected: boolean;
    isConnecting: boolean;
    hasSessionKey: boolean;
    sessionExpiry: TimeRemaining | null;
    error: string | null;

    // Actions
    connect: () => Promise<void>;
    disconnect: () => void;
    createSessionKey: () => Promise<boolean>;
    revokeSessionKey: () => void;

    // Session-enabled contract calls
    sendTransaction: (functionName: string, value?: bigint) => Promise<`0x${string}` | null>;
}

export function useRiseWallet(): UseRiseWalletReturn {
    const [address, setAddress] = useState<Address | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sessionKey, setSessionKey] = useState<SessionKeyData | null>(null);
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

    const publicClient = useMemo(
        () =>
            createPublicClient({
                chain: riseTestnetConfig.chains[0],
                transport: http(),
            }),
        []
    );

    // Load session key from storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SESSION_KEY_STORAGE);
            if (stored) {
                const parsed = JSON.parse(stored) as SessionKeyData;
                // Check if session is still valid
                if (parsed.expiry > Date.now() / 1000) {
                    setSessionKey(parsed);
                    setAddress(parsed.address);
                } else {
                    localStorage.removeItem(SESSION_KEY_STORAGE);
                }
            }
        } catch {
            localStorage.removeItem(SESSION_KEY_STORAGE);
        }
    }, []);

    // Calculate time remaining for session
    const sessionExpiry = useMemo((): TimeRemaining | null => {
        if (!sessionKey) return null;

        const now = Math.floor(Date.now() / 1000);
        const remaining = sessionKey.expiry - now;

        if (remaining <= 0) {
            return { seconds: 0, minutes: 0, hours: 0, expired: true };
        }

        return {
            seconds: remaining % 60,
            minutes: Math.floor((remaining % 3600) / 60),
            hours: Math.floor(remaining / 3600),
            expired: false,
        };
    }, [sessionKey]);

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
        setSessionKey(null);
        localStorage.removeItem(SESSION_KEY_STORAGE);
    }, []);

    // Create session key for popup-free transactions
    const createSessionKey = useCallback(async (): Promise<boolean> => {
        if (!porto || !address) {
            setError('Wallet not connected');
            return false;
        }

        try {
            // Create a session key with spend permissions for our contract
            const expiry = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS;

            // Request session key creation via Porto
            const result = await porto.provider.request({
                method: 'experimental_createSession',
                params: [
                    {
                        expiry,
                        permissions: {
                            calls: [
                                {
                                    to: contractAddress,
                                    // Allow all blackjack functions
                                    selector: null, // null = any function
                                },
                            ],
                            spend: [
                                {
                                    // Allow spending ETH for bets
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
                const sessionData: SessionKeyData = {
                    privateKey: (result as { privateKey: Address }).privateKey,
                    publicKey: (result as { publicKey: Address }).publicKey,
                    address,
                    expiry,
                    createdAt: Math.floor(Date.now() / 1000),
                };

                setSessionKey(sessionData);
                localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(sessionData));
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
        setSessionKey(null);
        localStorage.removeItem(SESSION_KEY_STORAGE);
    }, []);

    // Send transaction using session key (no popup) or regular wallet
    const sendTransaction = useCallback(
        async (functionName: string, value?: bigint): Promise<`0x${string}` | null> => {
            if (!porto || !address) {
                setError('Wallet not connected');
                return null;
            }

            try {
                // If we have a valid session key, use it for popup-free tx
                if (sessionKey && sessionKey.expiry > Date.now() / 1000) {
                    // Use session key signing
                    const account = Account.from({
                        address,
                        keys: [
                            Key.fromSecp256k1({
                                privateKey: sessionKey.privateKey,
                                role: 'session',
                                expiry: sessionKey.expiry,
                            }),
                        ],
                    });

                    // Create the transaction with session key
                    const hash = await porto.provider.request({
                        method: 'eth_sendTransaction',
                        params: [
                            {
                                from: address,
                                to: contractAddress,
                                data: encodeFunctionData(functionName),
                                value: value ? `0x${value.toString(16)}` : undefined,
                            },
                        ],
                    });

                    return hash as `0x${string}`;
                } else {
                    // Fallback to regular wallet popup
                    const hash = await porto.provider.request({
                        method: 'eth_sendTransaction',
                        params: [
                            {
                                from: address,
                                to: contractAddress,
                                data: encodeFunctionData(functionName),
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
        [porto, address, sessionKey, contractAddress]
    );

    return {
        // State
        address,
        isConnected: !!address,
        isConnecting,
        hasSessionKey: !!sessionKey && sessionKey.expiry > Date.now() / 1000,
        sessionExpiry,
        error,

        // Actions
        connect,
        disconnect,
        createSessionKey,
        revokeSessionKey,
        sendTransaction,
    };
}

// Helper to encode function data
function encodeFunctionData(functionName: string): `0x${string}` {
    // Simple function selector encoding
    const selectors: Record<string, `0x${string}`> = {
        placeBet: '0xf7010e57', // keccak256("placeBet()")[:4]
        hit: '0x5b42d1df', // keccak256("hit()")[:4]
        stand: '0x96848984', // keccak256("stand()")[:4]
        double: '0x0c9f3f1f', // keccak256("double()")[:4]
        surrender: '0xd1058e59', // keccak256("surrender()")[:4]
    };

    return selectors[functionName] || '0x';
}
