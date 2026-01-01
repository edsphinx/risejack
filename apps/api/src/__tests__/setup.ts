/**
 * Test Setup
 *
 * Global test configuration and utilities.
 */

import { beforeEach, afterEach } from 'bun:test';
import { resetAllMocks } from '../__mocks__/prisma';

// Reset mocks before each test
beforeEach(() => {
  resetAllMocks();
});

// Cleanup after each test
afterEach(() => {
  // Any cleanup needed
});

// Test utilities - Use obviously fake addresses
export const TEST_WALLET = '0x0000000000000000000000000000000000000001' as const;
export const TEST_WALLET_2 = '0x0000000000000000000000000000000000000002' as const;

export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    walletAddress: TEST_WALLET.toLowerCase(),
    displayName: 'TestUser',
    xp: 100,
    level: 2,
    vipTier: 'bronze',
    referralCode: 'TESTCODE',
    referrerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
    ...overrides,
  };
}

export function createMockGame(overrides = {}) {
  return {
    id: 'test-game-id',
    userId: 'test-user-id',
    gameType: 'blackjack',
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: '12345',
    betAmount: '1000000000000000000',
    currency: 'ETH',
    payout: '2000000000000000000',
    pnl: '1000000000000000000',
    outcome: 'win',
    gameData: { playerHand: [10, 11], dealerHand: [8, 9] },
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockEvent(overrides = {}) {
  return {
    id: 'test-event-id',
    userId: 'test-user-id',
    walletAddress: TEST_WALLET.toLowerCase(),
    eventType: 'wallet_connect',
    eventData: {},
    sessionId: null,
    deviceType: 'desktop',
    ipGeoCountry: 'US',
    createdAt: new Date(),
    ...overrides,
  };
}
