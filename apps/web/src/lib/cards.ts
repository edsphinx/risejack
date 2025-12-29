import { RANK_NAMES, SUIT_SYMBOLS } from '@risejack/shared';
import type { CardDisplay } from '@risejack/shared';

export function getCardDisplay(cardIndex: number): CardDisplay {
    const rank = cardIndex % 13;
    const suit = Math.floor(cardIndex / 13);
    const suitSymbol = SUIT_SYMBOLS[suit];

    return {
        rank: RANK_NAMES[rank],
        suit: suitSymbol,
        color: suit === 1 || suit === 2 ? 'red' : 'black',
    };
}
