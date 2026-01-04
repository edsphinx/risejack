import { RANK_NAMES, SUIT_SYMBOLS, type CardDisplay } from '../types';

// Re-export XP utils
export * from './xp';

/**
 * Convert a card number (0-51) to CardDisplay object
 */
export function getCardDisplay(cardIndex: number): CardDisplay {
  const rank = cardIndex % 13;
  const suit = Math.floor(cardIndex / 13);

  return {
    rank: RANK_NAMES[rank],
    suit: SUIT_SYMBOLS[suit],
    color: suit === 1 || suit === 2 ? 'red' : 'black',
  };
}

/**
 * Calculate hand value from card numbers
 */
export function calculateHandValue(cards: number[]): { value: number; isSoft: boolean } {
  let total = 0;
  let aces = 0;

  for (const cardNum of cards) {
    const cardValue = cardNum % 13;
    if (cardValue === 0) {
      aces++;
      total += 11;
    } else if (cardValue >= 10) {
      total += 10;
    } else {
      total += cardValue + 1;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { value: total, isSoft: aces > 0 && total <= 21 };
}

/**
 * Check if hand is a blackjack
 */
export function isBlackjack(cards: number[]): boolean {
  if (cards.length !== 2) return false;
  const { value } = calculateHandValue(cards);
  return value === 21;
}

/**
 * Check if hand is busted
 */
export function isBusted(cards: number[]): boolean {
  const { value } = calculateHandValue(cards);
  return value > 21;
}

/**
 * Format ETH amount for display (precision-safe for large amounts)
 * Uses string manipulation to avoid Number precision loss
 */
export function formatEth(wei: bigint, decimals = 4): string {
  if (wei === 0n) return '0.' + '0'.repeat(decimals);

  const isNegative = wei < 0n;
  const absWei = isNegative ? -wei : wei;
  const weiStr = absWei.toString().padStart(19, '0');

  const integerPart = weiStr.slice(0, -18) || '0';
  const decimalPart = weiStr.slice(-18).padStart(18, '0').slice(0, decimals);

  const formatted = `${integerPart}.${decimalPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse ETH string to wei (precision-safe)
 */
export function parseEth(eth: string): bigint {
  if (!eth || eth.trim() === '') return 0n;

  const [intPart = '0', decPart = ''] = eth.split('.');
  const paddedDec = decPart.padEnd(18, '0').slice(0, 18);
  const weiStr = intPart + paddedDec;

  return BigInt(weiStr);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Calculate time remaining from expiry timestamp
 */
export function getTimeRemaining(expiry: number): {
  seconds: number;
  minutes: number;
  hours: number;
  expired: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiry - now;

  if (remaining <= 0) {
    return { seconds: 0, minutes: 0, hours: 0, expired: true };
  }

  return {
    seconds: remaining % 60,
    minutes: Math.floor((remaining % 3600) / 60),
    hours: Math.floor(remaining / 3600),
    expired: false,
  };
}
