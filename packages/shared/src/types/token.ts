/**
 * Token Types
 *
 * Types for ERC20 token interactions.
 * Used across frontend for balance/allowance management.
 */

import type { Address } from 'viem';

// =============================================================================
// TOKEN INFO
// =============================================================================

/**
 * Token metadata
 */
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Known tokens in the VyreCasino ecosystem
 */
export type TokenSymbol = 'CHIP' | 'USDC' | 'ETH';

// =============================================================================
// BALANCE & ALLOWANCE
// =============================================================================

/**
 * Token balance with formatted value
 */
export interface TokenBalance {
  raw: bigint;
  formatted: string;
  decimals: number;
}

/**
 * Allowance state for a spender
 */
export interface AllowanceState {
  amount: bigint;
  isUnlimited: boolean;
  isApproved: boolean; // amount > 0
}

// =============================================================================
// TOKEN ACTIONS
// =============================================================================

/**
 * Approval request
 */
export interface ApprovalRequest {
  token: Address;
  spender: Address;
  amount: bigint;
  unlimited?: boolean;
}

/**
 * Transfer request
 */
export interface TransferRequest {
  token: Address;
  to: Address;
  amount: bigint;
}
