/**
 * Card suits enum
 */
export enum Suit {
    Spades = 0,
    Hearts = 1,
    Diamonds = 2,
    Clubs = 3,
}

/**
 * Card rank names for display
 */
export const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/**
 * Suit symbols for display
 */
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;

/**
 * Card display info for UI
 */
export interface CardDisplay {
    rank: string;
    suit: string;
    color: 'red' | 'black';
}
