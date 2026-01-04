import { RANK_NAMES, SUIT_SYMBOLS } from '@vyrejack/shared';
import type { CardDisplay } from '@vyrejack/shared';

const MAX_CARD_INDEX = 51; // 52 cards (0-51)

/**
 * Convert a card index (0-51) to display info
 * @param cardIndex - Card index from 0 to 51
 * @returns CardDisplay object with rank, suit, and color
 * @throws Error if cardIndex is out of bounds
 */
export function getCardDisplay(cardIndex: number): CardDisplay {
    // Validate input
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex > MAX_CARD_INDEX) {
        console.warn(`Invalid card index: ${cardIndex}, using Ace of Spades as fallback`);
        return { rank: 'A', suit: '♠', color: 'black' };
    }

    const rank = cardIndex % 13;
    const suit = Math.floor(cardIndex / 13);
    const suitSymbol = SUIT_SYMBOLS[suit];

    return {
        rank: RANK_NAMES[rank],
        suit: suitSymbol,
        color: suit === 1 || suit === 2 ? 'red' : 'black',
    };
}

/**
 * Safe card display that never throws
 */
export function safeGetCardDisplay(cardIndex: number): CardDisplay {
    try {
        return getCardDisplay(cardIndex);
    } catch {
        return { rank: '?', suit: '?', color: 'black' };
    }
}

/**
 * Get SVG image URL for a card
 * Uses poker-qr SVG files - naming: {rank}{suit}.svg
 * Ranks: A, 2-9, T (10), J, Q, K
 * Suits: S (spades), H (hearts), D (diamonds), C (clubs)
 */
export function getCardImageUrl(cardIndex: number): string {
    const suits = ['S', 'H', 'D', 'C']; // Spades, Hearts, Diamonds, Clubs
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

    // Validate
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex > 51) {
        return '/assets/cards/AS.svg'; // Fallback to Ace of Spades
    }

    const suit = suits[Math.floor(cardIndex / 13)];
    const rank = ranks[cardIndex % 13];

    return `/assets/cards/${rank}${suit}.svg`;
}

/**
 * Get card back image URL - RB = Rise Back
 */
export function getCardBackUrl(): string {
    return '/assets/cards/RB.svg';
}
