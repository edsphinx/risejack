import type { GameResult } from './game';

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
