import { RANK_NAMES, SUIT_SYMBOLS } from '@risejack/shared';
import type { CardDisplay } from '@risejack/shared';

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
