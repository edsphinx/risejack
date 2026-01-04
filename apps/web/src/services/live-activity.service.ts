/**
 * Live Activity Service
 *
 * Subscribes to ALL GameEnded events via Shreds WebSocket
 * for real-time activity ticker on homepage.
 */

import { createPublicClient, webSocket, formatEther, type Log } from 'viem';
import { shredActions } from 'shreds/viem';
import { riseTestnet, RISEJACK_ABI, RISEJACK_ADDRESS } from '@/lib/contract';
import { logger } from '@/lib/logger';
import type { GameResult } from '@risejack/shared';

const WSS_URL = 'wss://testnet.riselabs.xyz/ws';

// Game state enum mapping from contract
const GameStateToResult: Record<number, GameResult> = {
    5: 'win',
    6: 'lose',
    7: 'push',
    8: 'blackjack',
};

export interface LiveWinEvent {
    address: string;
    amount: number;
    game: string;
    result: GameResult;
    timestamp: number;
}

type LiveWinCallback = (win: LiveWinEvent) => void;

// Singleton state
let wsClient: ReturnType<typeof createPublicClient> | null = null;
let unwatch: (() => void) | null = null;
const subscribers = new Set<LiveWinCallback>();
const recentWins: LiveWinEvent[] = [];
const MAX_WINS = 20;

/**
 * Initialize the shreds WebSocket client
 */
function initClient() {
    if (wsClient) return wsClient;

    try {
        wsClient = createPublicClient({
            chain: riseTestnet as any,
            transport: webSocket(WSS_URL),
        }).extend(shredActions) as any;

        logger.log('[LiveActivity] Shreds WebSocket client initialized');
        return wsClient;
    } catch (error) {
        logger.error('[LiveActivity] Failed to initialize:', error);
        return null;
    }
}

/**
 * Start watching for all GameEnded events
 */
function startWatching() {
    if (unwatch) return; // Already watching

    const client = initClient();
    if (!client) return;

    try {
        unwatch = (client as any).watchContractEvent({
            address: RISEJACK_ADDRESS,
            abi: RISEJACK_ABI,
            eventName: 'GameEnded',
            onLogs: (logs: Log[]) => {
                for (const log of logs) {
                    try {
                        const eventLog = log as unknown as {
                            args: {
                                player: `0x${string}`;
                                result: number;
                                payout: bigint;
                            };
                        };
                        const args = eventLog.args;
                        const result = GameStateToResult[args.result];

                        // Only show wins (not losses/pushes)
                        if (result && (result === 'win' || result === 'blackjack')) {
                            const win: LiveWinEvent = {
                                address: `${args.player.slice(0, 6)}...${args.player.slice(-4)}`,
                                amount: parseFloat(formatEther(args.payout)),
                                game: 'RiseJack',
                                result,
                                timestamp: Date.now(),
                            };

                            // Add to recent wins
                            recentWins.unshift(win);
                            if (recentWins.length > MAX_WINS) {
                                recentWins.pop();
                            }

                            // Notify all subscribers
                            for (const callback of subscribers) {
                                try {
                                    callback(win);
                                } catch (err) {
                                    logger.error('[LiveActivity] Subscriber error:', err);
                                }
                            }

                            logger.log('[LiveActivity] New win:', win);
                        }
                    } catch (error) {
                        logger.error('[LiveActivity] Error parsing event:', error);
                    }
                }
            },
            onError: (error: Error) => {
                logger.error('[LiveActivity] WebSocket error:', error);
            },
        });

        logger.log('[LiveActivity] Started watching GameEnded events');
    } catch (error) {
        logger.error('[LiveActivity] Failed to start watching:', error);
    }
}

/**
 * Subscribe to live wins
 */
export function subscribeLiveWins(callback: LiveWinCallback): () => void {
    subscribers.add(callback);

    // Start watching if first subscriber
    if (subscribers.size === 1) {
        startWatching();
    }

    // Return unsubscribe function
    return () => {
        subscribers.delete(callback);

        // Stop watching if no more subscribers
        if (subscribers.size === 0 && unwatch) {
            unwatch();
            unwatch = null;
            logger.log('[LiveActivity] Stopped watching (no subscribers)');
        }
    };
}

/**
 * Get recent wins (for initial render)
 */
export function getRecentWins(): LiveWinEvent[] {
    return [...recentWins];
}

/**
 * Cleanup
 */
export function disconnectLiveActivity() {
    if (unwatch) {
        unwatch();
        unwatch = null;
    }
    wsClient = null;
    subscribers.clear();
    recentWins.length = 0;
    logger.log('[LiveActivity] Disconnected');
}

export const LiveActivityService = {
    subscribe: subscribeLiveWins,
    getRecent: getRecentWins,
    disconnect: disconnectLiveActivity,
};
