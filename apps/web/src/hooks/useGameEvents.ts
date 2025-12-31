/**
 * useGameEvents - WebSocket-based event listener for game events
 *
 * Listens for:
 * - GameEnded: When game finishes (from VRF callback)
 * - CardDealt: When a card is dealt (keeps hand cache updated in real-time)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { createPublicClient, webSocket } from 'viem';
import { riseTestnet, RISEJACK_ABI, RISEJACK_ADDRESS } from '@/lib/contract';
import { logger } from '@/lib/logger';
import type { GameResult } from '@risejack/shared';

// Rise Chain Testnet WebSocket URL
const WSS_URL = 'wss://testnet.riselabs.xyz/ws';

// GameState enum values from contract
const GameStateToResult: Record<number, GameResult> = {
  5: 'win', // PlayerWin
  6: 'lose', // DealerWin
  7: 'push', // Push
  8: 'blackjack', // PlayerBlackjack
};

export interface GameEndEvent {
  result: GameResult;
  payout: bigint;
  playerFinalValue: number;
  dealerFinalValue: number;
  playerCardCount: number;
  dealerCardCount: number;
}

export interface CardDealtEvent {
  card: number;
  isDealer: boolean;
  faceUp: boolean;
}

interface GameEventsCallbacks {
  onGameEnd: (event: GameEndEvent) => void;
  onCardDealt?: (event: CardDealtEvent) => void;
}

export function useGameEvents(
  playerAddress: `0x${string}` | null,
  callbacks: GameEventsCallbacks | ((event: GameEndEvent) => void)
) {
  const [isConnected, setIsConnected] = useState(false);
  const unwatchGameEndedRef = useRef<(() => void) | null>(null);
  const unwatchCardDealtRef = useRef<(() => void) | null>(null);
  const clientRef = useRef<ReturnType<typeof createPublicClient> | null>(null);

  // Normalize callbacks
  const normalizedCallbacks =
    typeof callbacks === 'function' ? { onGameEnd: callbacks } : callbacks;

  // Stable callback refs
  const onGameEndRef = useRef(normalizedCallbacks.onGameEnd);
  const onCardDealtRef = useRef(normalizedCallbacks.onCardDealt);
  onGameEndRef.current = normalizedCallbacks.onGameEnd;
  onCardDealtRef.current = normalizedCallbacks.onCardDealt;

  // Start watching for events
  useEffect(() => {
    if (!playerAddress) {
      setIsConnected(false);
      return;
    }

    logger.log('[GameEvents] Starting WebSocket event monitoring for:', playerAddress);

    try {
      // Create WebSocket client
      const client = createPublicClient({
        chain: riseTestnet as Parameters<typeof createPublicClient>[0]['chain'],
        transport: webSocket(WSS_URL),
      });
      clientRef.current = client;

      // Watch for GameEnded events
      const unwatchGameEnded = client.watchContractEvent({
        address: RISEJACK_ADDRESS,
        abi: RISEJACK_ABI,
        eventName: 'GameEnded',
        args: {
          player: playerAddress,
        },
        onLogs: (logs) => {
          logger.log('[GameEvents] Received GameEnded events:', logs.length);

          for (const log of logs) {
            const args = log.args as {
              player: `0x${string}`;
              result: number | bigint;
              payout: bigint;
              playerFinalValue: number | bigint;
              dealerFinalValue: number | bigint;
              playerCardCount: number | bigint;
              dealerCardCount: number | bigint;
            };
            const resultNum =
              typeof args.result === 'bigint' ? Number(args.result) : (args.result as number);
            const result = GameStateToResult[resultNum];

            const playerFinalValue =
              typeof args.playerFinalValue === 'bigint'
                ? Number(args.playerFinalValue)
                : args.playerFinalValue;
            const dealerFinalValue =
              typeof args.dealerFinalValue === 'bigint'
                ? Number(args.dealerFinalValue)
                : args.dealerFinalValue;
            const playerCardCount =
              typeof args.playerCardCount === 'bigint'
                ? Number(args.playerCardCount)
                : args.playerCardCount;
            const dealerCardCount =
              typeof args.dealerCardCount === 'bigint'
                ? Number(args.dealerCardCount)
                : args.dealerCardCount;

            logger.log('[GameEvents] GameEnded:', {
              player: args.player,
              result,
              payout: args.payout,
              playerFinalValue,
              dealerFinalValue,
              playerCardCount,
              dealerCardCount,
            });

            if (result) {
              onGameEndRef.current({
                result,
                payout: args.payout,
                playerFinalValue,
                dealerFinalValue,
                playerCardCount,
                dealerCardCount,
              });
            }
          }
        },
        onError: (error) => {
          logger.error('[GameEvents] GameEnded WebSocket error:', error);
        },
      });
      unwatchGameEndedRef.current = unwatchGameEnded;

      // Watch for CardDealt events (to keep hand cache updated in real-time)
      const unwatchCardDealt = client.watchContractEvent({
        address: RISEJACK_ADDRESS,
        abi: RISEJACK_ABI,
        eventName: 'CardDealt',
        args: {
          player: playerAddress,
        },
        onLogs: (logs) => {
          logger.log('[GameEvents] Received CardDealt events:', logs.length);

          for (const log of logs) {
            const args = log.args as {
              player: `0x${string}`;
              card: number | bigint;
              isDealer: boolean;
              faceUp: boolean;
            };
            const cardNum = typeof args.card === 'bigint' ? Number(args.card) : args.card;

            logger.log('[GameEvents] CardDealt:', {
              card: cardNum,
              isDealer: args.isDealer,
              faceUp: args.faceUp,
            });

            if (onCardDealtRef.current) {
              onCardDealtRef.current({
                card: cardNum,
                isDealer: args.isDealer,
                faceUp: args.faceUp,
              });
            }
          }
        },
        onError: (error) => {
          logger.error('[GameEvents] CardDealt WebSocket error:', error);
        },
      });
      unwatchCardDealtRef.current = unwatchCardDealt;

      setIsConnected(true);
      logger.log('[GameEvents] WebSocket connected successfully (GameEnded + CardDealt)');
    } catch (error) {
      logger.error('[GameEvents] Failed to start WebSocket:', error);
      setIsConnected(false);
    }

    // Cleanup
    return () => {
      logger.log('[GameEvents] Stopping WebSocket monitoring');
      if (unwatchGameEndedRef.current) {
        unwatchGameEndedRef.current();
        unwatchGameEndedRef.current = null;
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
