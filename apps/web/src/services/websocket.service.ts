/**
 * WebSocket Event Service for RiseJack
 *
 * Provides real-time event monitoring using WebSocket and shreds,
 * similar to Meteoro's implementation.
 */

import { createPublicClient, webSocket, type Log } from 'viem';
import { shredActions } from 'shreds/viem';
import { riseTestnet, RISEJACK_ABI, RISEJACK_ADDRESS } from '@/lib/contract';
import type { GameResult } from '@risejack/shared';

// Rise Chain Testnet WebSocket URL
const WSS_URL = 'wss://testnet.riselabs.xyz/ws';

// Game state enum mapping from contract
const GameStateToResult: Record<number, GameResult> = {
  5: 'win', // PlayerWin
  6: 'lose', // DealerWin
  7: 'push', // Push
  8: 'blackjack', // PlayerBlackjack
};

export interface GameEndEvent {
  player: `0x${string}`;
  result: GameResult;
  payout: bigint;
}

// WebSocket client instance (singleton) - use any to allow extension
let wsClient:
  | (ReturnType<typeof createPublicClient> & {
      watchContractEvent: (...args: unknown[]) => () => void;
    })
  | null = null;
let eventUnwatch: (() => void) | null = null;

/**
 * Initialize WebSocket client for event monitoring
 */
export function initWebSocketClient(): typeof wsClient {
  if (wsClient) return wsClient;

  try {
    wsClient = createPublicClient({
      chain: riseTestnet as any,
      transport: webSocket(WSS_URL),
    }).extend(shredActions) as any;

    console.log('[WS] WebSocket client initialized');
    return wsClient;
  } catch (error) {
    console.error('[WS] Failed to initialize WebSocket client:', error);
    return null;
  }
}

/**
 * Get the WebSocket client (initialize if needed)
 */
export function getWebSocketClient() {
  return wsClient || initWebSocketClient();
}

/**
 * Start monitoring GameEnded events for a specific player
 * @param playerAddress The player address to monitor
 * @param onGameEnd Callback when game ends
 * @returns Unwatch function to stop monitoring
 */
export function startGameEventMonitoring(
  playerAddress: `0x${string}`,
  onGameEnd: (event: GameEndEvent) => void
): () => void {
  const client = getWebSocketClient();

  if (!client) {
    console.error('[WS] Cannot start monitoring - no WebSocket client');
    return () => {};
  }

  console.log('[WS] Starting GameEnded event monitoring for:', playerAddress);

  try {
    const unwatch = client.watchContractEvent({
      address: RISEJACK_ADDRESS,
      abi: RISEJACK_ABI,
      eventName: 'GameEnded',
      args: {
        player: playerAddress,
      },
      onLogs: (logs: Log[]) => {
        console.log('[WS] GameEnded events received:', logs.length);

        for (const log of logs) {
          try {
            // Parse the event data - logs from watchContractEvent have decoded args
            const eventLog = log as unknown as {
              args: { player: `0x${string}`; result: number; payout: bigint };
            };
            const args = eventLog.args;
            const result = GameStateToResult[args.result];

            if (result && args.player.toLowerCase() === playerAddress.toLowerCase()) {
              console.log('[WS] GameEnded for player:', { result, payout: args.payout });
              onGameEnd({
                player: args.player,
                result,
                payout: args.payout,
              });
            }
          } catch (error) {
            console.error('[WS] Error parsing GameEnded event:', error);
          }
        }
      },
      onError: (error: Error) => {
        console.error('[WS] Event monitoring error:', error);
      },
    });

    eventUnwatch = unwatch;
    console.log('[WS] Event monitoring started successfully');
    return unwatch;
  } catch (error) {
    console.error('[WS] Failed to start event monitoring:', error);
    return () => {};
  }
}

/**
 * Stop all event monitoring
 */
export function stopEventMonitoring(): void {
  if (eventUnwatch) {
    eventUnwatch();
    eventUnwatch = null;
    console.log('[WS] Event monitoring stopped');
  }
}

/**
 * Clean up WebSocket connection
 */
export function disconnectWebSocket(): void {
  stopEventMonitoring();
  wsClient = null;
  console.log('[WS] WebSocket disconnected');
}

export const WebSocketService = {
  init: initWebSocketClient,
  getClient: getWebSocketClient,
  startGameMonitoring: startGameEventMonitoring,
  stopMonitoring: stopEventMonitoring,
  disconnect: disconnectWebSocket,
};
