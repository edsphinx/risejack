import type { Address } from 'viem';

/**
 * Game state enum matching the smart contract
 */
export enum GameState {
    Idle = 0,
    WaitingForDeal = 1,
    PlayerTurn = 2,
    WaitingForHit = 3,
    DealerTurn = 4,
    PlayerWin = 5,
    DealerWin = 6,
    Push = 7,
    PlayerBlackjack = 8,
}

/**
 * Game data from smart contract
 */
export interface GameData {
    player: Address;
    bet: bigint;
    playerCards: readonly number[];
    dealerCards: readonly number[];
    state: GameState;
    timestamp: bigint;
    isDoubled: boolean;
}

/**
 * Hand value with soft indicator
 */
export interface HandValue {
    value: number;
    isSoft: boolean;
}

/**
 * Bet limits from contract
 */
export interface BetLimits {
    min: bigint;
    max: bigint;
}

/**
 * Game action types
 */
export type GameAction = 'hit' | 'stand' | 'double' | 'surrender';

/**
 * Game result for UI display
 */
export type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null;
