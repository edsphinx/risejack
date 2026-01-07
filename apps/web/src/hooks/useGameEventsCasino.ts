/**
 * useGameEventsCasino - WebSocket-based event listener for VyreJackCore games
 *
 * Listens for:
 * - GamePlayed: When game finishes (emitted via IVyreGame interface)
 * - CardDealt: When a card is dealt (real-time card tracking)
 *
 * NOTE: VyreJackCore emits IVyreGame.GamePlayed, NOT GameResolved.
 * The GameResolved event is defined but never emitted (contract bug).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { createPublicClient, webSocket } from 'viem';
import { riseTestnet, VYREJACKCORE_ADDRESS } from '@/lib/contract';
import { VYREJACKCORE_ABI } from '@vyrejack/shared';
import { logger } from '@/lib/logger';
import type { GameResult } from '@vyrejack/shared';

// Rise Chain Testnet WebSocket URL
const WSS_URL = 'wss://testnet.riselabs.xyz/ws';

// GamePlayed event ABI (from IVyreGame interface)
const GAME_PLAYED_ABI = [
  {
    type: 'event',
    name: 'GamePlayed',
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'bet', type: 'uint256' },
      { indexed: false, name: 'won', type: 'bool' },
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
  },
] as const;

export interface GamePlayedEvent {
  result: GameResult;
  payout: bigint;
  bet: bigint;
  won: boolean;
}

export interface CardDealtEvent {
  card: number;
  isDealer: boolean;
  faceUp: boolean;
}

interface GameEventsCasinoCallbacks {
  onGamePlayed: (event: GamePlayedEvent) => void;
  onCardDealt?: (event: CardDealtEvent) => void;
}

/**
 * Hook for WebSocket-based VyreJackCore event listening
 */
export function useGameEventsCasino(
  playerAddress: `0x${string}` | null,
  callbacks: GameEventsCasinoCallbacks
) {
  const [isConnected, setIsConnected] = useState(false);
  const unwatchGamePlayedRef = useRef<(() => void) | null>(null);
  const unwatchCardDealtRef = useRef<(() => void) | null>(null);
  const clientRef = useRef<ReturnType<typeof createPublicClient> | null>(null);

  // Stable callback refs
  const onGamePlayedRef = useRef(callbacks.onGamePlayed);
  const onCardDealtRef = useRef(callbacks.onCardDealt);
  onGamePlayedRef.current = callbacks.onGamePlayed;
  onCardDealtRef.current = callbacks.onCardDealt;

  useEffect(() => {
    if (!playerAddress) {
      setIsConnected(false);
      return;
    }

    logger.log('[GameEventsCasino] Starting WebSocket for:', playerAddress);

    try {
      // Create WebSocket client
      const client = createPublicClient({
        chain: riseTestnet as Parameters<typeof createPublicClient>[0]['chain'],
        transport: webSocket(WSS_URL),
      });
      clientRef.current = client;

      // Watch for GamePlayed events (emitted by VyreJackCore via IVyreGame)
      const unwatchGamePlayed = client.watchContractEvent({
        address: VYREJACKCORE_ADDRESS,
        abi: GAME_PLAYED_ABI,
        eventName: 'GamePlayed',
        args: {
          player: playerAddress,
        },
        onLogs: (logs) => {
          logger.log('[GameEventsCasino] GamePlayed events:', logs.length);

          for (const log of logs) {
            const args = log.args as {
              player: `0x${string}`;
              token: `0x${string}`;
              bet: bigint;
              won: boolean;
              payout: bigint;
            };

            // Determine result from won/payout
            // Note: We don't have exact values, need to calculate from accumulated cards
            let result: GameResult;
            if (args.payout > args.bet) {
              // Won more than bet - could be blackjack (1.5x) or win (2x)
              result = args.payout > args.bet * 2n ? 'blackjack' : 'win';
            } else if (args.payout === args.bet) {
              result = 'push';
            } else {
              result = 'lose';
            }

            logger.log('[GameEventsCasino] GamePlayed:', {
              won: args.won,
              bet: args.bet.toString(),
              payout: args.payout.toString(),
              result,
            });

            onGamePlayedRef.current({
              result,
              payout: args.payout,
              bet: args.bet,
              won: args.won,
            });
          }
        },
        onError: (error) => {
          logger.error('[GameEventsCasino] GamePlayed error:', error);
        },
      });
      unwatchGamePlayedRef.current = unwatchGamePlayed;

      // Watch for CardDealt events
      const unwatchCardDealt = client.watchContractEvent({
        address: VYREJACKCORE_ADDRESS,
        abi: VYREJACKCORE_ABI,
        eventName: 'CardDealt',
        args: {
          player: playerAddress,
        },
        onLogs: (logs) => {
          logger.log('[GameEventsCasino] CardDealt events:', logs.length);

          for (const log of logs) {
            const args = log.args as {
              player: `0x${string}`;
              card: number | bigint;
              isDealer: boolean;
              faceUp: boolean;
            };

            const card = typeof args.card === 'bigint' ? Number(args.card) : args.card;

            logger.log('[GameEventsCasino] CardDealt:', {
              card,
              isDealer: args.isDealer,
              faceUp: args.faceUp,
            });

            if (onCardDealtRef.current) {
              onCardDealtRef.current({
                card,
                isDealer: args.isDealer,
                faceUp: args.faceUp,
              });
            }
          }
        },
        onError: (error) => {
          logger.error('[GameEventsCasino] CardDealt error:', error);
        },
      });
      unwatchCardDealtRef.current = unwatchCardDealt;

      setIsConnected(true);
      logger.log('[GameEventsCasino] WebSocket connected');
    } catch (error) {
      logger.error('[GameEventsCasino] Failed to start WebSocket:', error);
      setIsConnected(false);
    }

    // Cleanup
    return () => {
      logger.log('[GameEventsCasino] Stopping WebSocket');
      if (unwatchGamePlayedRef.current) {
        unwatchGamePlayedRef.current();
        unwatchGamePlayedRef.current = null;
      }
      if (unwatchCardDealtRef.current) {
        unwatchCardDealtRef.current();
        unwatchCardDealtRef.current = null;
      }
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [playerAddress]);

  return { isConnected };
}
