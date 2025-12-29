import type { Card, Suit } from '../types'

/**
 * Card value names for display
 */
const VALUE_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/**
 * Suit symbols for display
 */
const SUIT_SYMBOLS: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
}

/**
 * Convert a card number (0-51) to Card object
 */
export function numberToCard(n: number): Card {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
    return {
        value: n % 13,
        suit: suits[Math.floor(n / 13)]
    }
}

/**
 * Get display name for a card
 */
export function getCardDisplayName(card: Card): string {
    return `${VALUE_NAMES[card.value]}${SUIT_SYMBOLS[card.suit]}`
}

/**
 * Calculate hand value from card numbers
 */
export function calculateHandValue(cards: number[]): { value: number; isSoft: boolean } {
    let total = 0
    let aces = 0

    for (const cardNum of cards) {
        const cardValue = cardNum % 13
        if (cardValue === 0) {
            // Ace
            aces++
            total += 11
        } else if (cardValue >= 10) {
            // Face cards
            total += 10
        } else {
            total += cardValue + 1
        }
    }

    // Adjust for aces if over 21
    while (total > 21 && aces > 0) {
        total -= 10
        aces--
    }

    return { value: total, isSoft: aces > 0 && total <= 21 }
}

/**
 * Check if hand is a blackjack
 */
export function isBlackjack(cards: number[]): boolean {
    if (cards.length !== 2) return false
    const { value } = calculateHandValue(cards)
    return value === 21
}

/**
 * Check if hand is busted
 */
export function isBusted(cards: number[]): boolean {
    const { value } = calculateHandValue(cards)
    return value > 21
}

/**
 * Format ETH amount for display
 */
export function formatEth(wei: bigint, decimals = 4): string {
    const eth = Number(wei) / 1e18
    return eth.toFixed(decimals)
}

/**
 * Parse ETH string to wei
 */
export function parseEth(eth: string): bigint {
    return BigInt(Math.floor(parseFloat(eth) * 1e18))
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Calculate time remaining from expiry timestamp
 */
export function getTimeRemaining(expiry: number): {
    seconds: number
    minutes: number
    hours: number
    expired: boolean
} {
    const now = Math.floor(Date.now() / 1000)
    const remaining = expiry - now

    if (remaining <= 0) {
        return { seconds: 0, minutes: 0, hours: 0, expired: true }
    }

    return {
        seconds: remaining % 60,
        minutes: Math.floor((remaining % 3600) / 60),
        hours: Math.floor(remaining / 3600),
        expired: false
    }
}
