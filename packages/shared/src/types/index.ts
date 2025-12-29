/**
 * Game state enum matching the smart contract
 */
export enum GameState {
    Idle = 0,
    WaitingForReveal = 1,
    PlayerTurn = 2,
    DealerTurn = 3,
    PlayerWin = 4,
    DealerWin = 5,
    Push = 6,
    Blackjack = 7
}

/**
 * Card suits
 */
export enum Suit {
    Hearts = 'hearts',
    Diamonds = 'diamonds',
    Clubs = 'clubs',
    Spades = 'spades'
}

/**
 * Card representation
 */
export interface Card {
    value: number // 0-12 (0 = Ace, 1 = 2, ..., 12 = King)
    suit: Suit
}

/**
 * Game data from smart contract
 */
export interface Game {
    player: `0x${string}`
    bet: bigint
    playerCards: number[]
    dealerCards: number[]
    state: GameState
    commitHash: `0x${string}`
    timestamp: bigint
}

/**
 * Player stats
 */
export interface PlayerStats {
    address: `0x${string}`
    totalGames: number
    wins: number
    losses: number
    pushes: number
    blackjacks: number
    totalWagered: bigint
    totalWon: bigint
}

/**
 * Session key data for Rise Wallet
 */
export interface SessionKeyData {
    privateKey: `0x${string}`
    publicKey: `0x${string}`
    expiry: number
    createdAt: number
    address: `0x${string}`
}

/**
 * Time remaining for session key
 */
export interface TimeRemaining {
    seconds: number
    minutes: number
    hours: number
    expired: boolean
}

/**
 * Game action types
 */
export type GameAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender'

/**
 * Transaction status
 */
export type TxStatus = 'pending' | 'confirmed' | 'failed'
