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
 * Card suits
 */
export enum Suit {
    Spades = 0,
    Hearts = 1,
    Diamonds = 2,
    Clubs = 3,
}

/**
 * Card rank names
 */
export const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/**
 * Suit symbols for display
 */
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;

/**
 * Card display info
 */
export interface CardDisplay {
    rank: string;
    suit: string;
    color: 'red' | 'black';
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
 * Session key data for Rise Wallet
 */
export interface SessionKeyData {
    privateKey: Address;
    publicKey: Address;
    expiry: number;
    createdAt: number;
    address: Address;
}

/**
 * Time remaining for session key
 */
export interface TimeRemaining {
    seconds: number;
    minutes: number;
    hours: number;
    expired: boolean;
}

/**
 * Game action types
 */
export type GameAction = 'hit' | 'stand' | 'double' | 'surrender';

/**
 * Transaction status
 */
export type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

/**
 * Game result for UI display
 */
export type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null;

/**
 * Playing card component props
 */
export interface PlayingCardProps {
    cardIndex: number;
    faceUp?: boolean;
    delay?: number;
    isNew?: boolean;
}

/**
 * Hand component props
 */
export interface HandProps {
    cards: readonly number[];
    value?: number;
    isSoft?: boolean;
    isDealer?: boolean;
    hideSecond?: boolean;
    result?: GameResult;
}

/**
 * Action buttons props
 */
export interface ActionButtonsProps {
    onHit: () => void;
    onStand: () => void;
    onDouble: () => void;
    onSurrender: () => void;
    canDouble: boolean;
    canSurrender: boolean;
    isLoading: boolean;
}

/**
 * Bet input props
 */
export interface BetInputProps {
    minBet: bigint;
    maxBet: bigint;
    onPlaceBet: (amount: string) => void;
    isLoading: boolean;
}
