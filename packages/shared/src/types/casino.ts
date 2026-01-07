/**
 * VyreCasino Architecture Types
 *
 * Types for the VyreCasino orchestrator and game contracts.
 * Used across frontend hooks, services, and components.
 */

import type { Address } from 'viem';

// =============================================================================
// CHIP TIERS (Betting denominations)
// =============================================================================

/**
 * Poker chip tier indices (0-11)
 * Match VyreCasino.CHIP_TIERS array
 */
export type ChipTierIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * Chip tier configuration
 */
export interface ChipTier {
  index: ChipTierIndex;
  value: bigint;
  label: string;
  color: string;
}

/**
 * Standard chip tiers for CHIP token (18 decimals)
 */
export const CHIP_TIERS: ChipTier[] = [
  { index: 0, value: 1n * 10n ** 18n, label: '1', color: '#FFFFFF' }, // White
  { index: 1, value: 5n * 10n ** 18n, label: '5', color: '#EF4444' }, // Red
  { index: 2, value: 10n * 10n ** 18n, label: '10', color: '#3B82F6' }, // Blue
  { index: 3, value: 25n * 10n ** 18n, label: '25', color: '#22C55E' }, // Green
  { index: 4, value: 50n * 10n ** 18n, label: '50', color: '#F97316' }, // Orange
  { index: 5, value: 100n * 10n ** 18n, label: '100', color: '#000000' }, // Black
  { index: 6, value: 250n * 10n ** 18n, label: '250', color: '#A855F7' }, // Purple
  { index: 7, value: 500n * 10n ** 18n, label: '500', color: '#EC4899' }, // Pink
  { index: 8, value: 1000n * 10n ** 18n, label: '1K', color: '#FBBF24' }, // Yellow
  { index: 9, value: 2500n * 10n ** 18n, label: '2.5K', color: '#14B8A6' }, // Teal
  { index: 10, value: 5000n * 10n ** 18n, label: '5K', color: '#6366F1' }, // Indigo
  { index: 11, value: 10000n * 10n ** 18n, label: '10K', color: '#DC2626' }, // Crimson
];

// =============================================================================
// CASINO GAME RESULT
// =============================================================================

/**
 * Result returned from VyreCasino.play() or IVyreGame.play()
 */
export interface CasinoGameResult {
  won: boolean;
  payout: bigint;
  metadata: `0x${string}`;
}

/**
 * Bet info passed to games
 */
export interface BetInfo {
  token: Address;
  amount: bigint;
  chipTier: ChipTierIndex;
}

// =============================================================================
// GAME STATE (VyreJackCore specific)
// =============================================================================

/**
 * VyreJackCore game states (matches contract enum)
 */
export enum VyreJackGameState {
  Idle = 0,
  WaitingForDeal = 1,
  PlayerTurn = 2,
  WaitingForHit = 3,
  DealerTurn = 4,
  GameEnded = 5,
}

/**
 * VyreJackCore game data from getGame()
 */
export interface VyreJackGame {
  player: Address;
  token: Address;
  bet: bigint;
  playerCards: readonly number[];
  dealerCards: readonly number[];
  state: VyreJackGameState;
  timestamp: bigint;
  isDoubled: boolean;
}

// =============================================================================
// REFERRALS
// =============================================================================

/**
 * Referral earnings data
 */
export interface ReferralEarnings {
  referrer: Address;
  token: Address;
  amount: bigint;
}

// =============================================================================
// CASINO CONFIG
// =============================================================================

/**
 * Casino configuration (read from VyreCasino)
 */
export interface CasinoConfig {
  houseEdgeBps: number;
  referralShareBps: number;
  treasuryShareBps: number;
  buybackShareBps: number;
  paused: boolean;
}
