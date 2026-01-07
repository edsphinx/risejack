/**
 * useGameEventsCasino - WebSocket-based event listener for VyreJackCore games
 *
 * Listens for:
 * - GameResolved: When game finishes with final result
 * - CardDealt: When a card is dealt (real-time card tracking)
 *
 * This is the Casino version - listens to VyreJackCore contract.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { createPublicClient, webSocket } from 'viem';
import { riseTestnet, VYREJACKCORE_ADDRESS } from '@/lib/contract';
import { VYREJACKCORE_ABI } from '@vyrejack/shared';
import { logger } from '@/lib/logger';
import type { GameResult } from '@vyrejack/shared';

// Rise Chain Testnet WebSocket URL
const WSS_URL = 'wss://testnet.riselabs.xyz/ws';

// GameState enum values from VyreJackCore contract
const GameStateToResult: Record<number, GameResult> = {
  5: 'win', // PlayerWin
  6: 'lose', // DealerWin
  7: 'push', // Push
  8: 'blackjack', // PlayerBlackjack
};

export interface GameResolvedEvent {
  result: GameResult;
  payout: bigint;
  playerFinalValue: number;
  dealerFinalValue: number;
}

export interface CardDealtEvent {
  card: number;
  isDealer: boolean;
  faceUp: boolean;
}

interface GameEventsCasinoCallbacks {
  onGameResolved: (event: GameResolvedEvent) => void;
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
  const unwatchGameResolvedRef = useRef<(() => void) | null>(null);
  const unwatchCardDealtRef = useRef<(() => void) | null>(null);
  const clientRef = useRef<ReturnType<typeof createPublicClient> | null>(null);

  // Stable callback refs
  const onGameResolvedRef = useRef(callbacks.onGameResolved);
  const onCardDealtRef = useRef(callbacks.onCardDealt);
  onGameResolvedRef.current = callbacks.onGameResolved;
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

      // Watch for GameResolved events
      const unwatchGameResolved = client.watchContractEvent({
        address: VYREJACKCORE_ADDRESS,
        abi: VYREJACKCORE_ABI,
        eventName: 'GameResolved',
        args: {
          player: playerAddress,
        },
        onLogs: (logs) => {
          logger.log('[GameEventsCasino] GameResolved events:', logs.length);

          for (const log of logs) {
            const args = log.args as {
              player: `0x${string}`;
              result: number | bigint;
              payout: bigint;
              playerFinalValue: number | bigint;
              dealerFinalValue: number | bigint;
            };

            const resultNum = typeof args.result === 'bigint' ? Number(args.result) : args.result;
            const result = GameStateToResult[resultNum];

            const playerFinalValue =
              typeof args.playerFinalValue === 'bigint'
                ? Number(args.playerFinalValue)
                : args.playerFinalValue;
            const dealerFinalValue =
              typeof args.dealerFinalValue === 'bigint'
                ? Number(args.dealerFinalValue)
                : args.dealerFinalValue;

            logger.log('[GameEventsCasino] GameResolved:', {
              result,
              payout: args.payout,
              playerFinalValue,
              dealerFinalValue,
            });

            if (result) {
              onGameResolvedRef.current({
                result,
                payout: args.payout,
                playerFinalValue,
                dealerFinalValue,
              });
            }
          }
        },
        onError: (error) => {
          logger.error('[GameEventsCasino] GameResolved error:', error);
        },
      });
      unwatchGameResolvedRef.current = unwatchGameResolved;

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
      if (unwatchGameResolvedRef.current) {
        unwatchGameResolvedRef.current();
        unwatchGameResolvedRef.current = null;
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
