/**
 * Users Route Tests
 *
 * Tests for GET /users/:wallet, POST /users/register, GET /users/:wallet/games
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import users from '../../routes/users';
import { createMockUser, createMockGame, TEST_WALLET } from '../setup';

// Mock UserService
mock.module('../../services/user.service', () => ({
  getUserProfile: mock((wallet: string) => {
    if (wallet.toLowerCase() === TEST_WALLET.toLowerCase()) {
      return Promise.resolve(createMockUser());
    }
    return Promise.resolve(null);
  }),
  registerUser: mock((wallet: string, displayName?: string) =>
    Promise.resolve(createMockUser({ displayName: displayName || 'NewUser' }))
  ),
  registerReferral: mock(() => Promise.resolve({ success: true, userReferralCode: 'NEWCODE' })),
}));

// Mock GameService
mock.module('../../services/game.service', () => ({
  getGameHistory: mock((wallet: string) => {
    if (wallet.toLowerCase() === TEST_WALLET.toLowerCase()) {
      return Promise.resolve({
        games: [createMockGame()],
        total: 1,
        stats: { totalBet: '1000000000000000000', totalPnl: '500000000000000000' },
      });
    }
    return Promise.resolve(null);
  }),
}));

const app = new Hono();
app.route('/users', users);

describe('Users Routes', () => {
  describe('GET /users/:walletAddress', () => {
    test('should return user profile for existing user', async () => {
      const response = await app.request(`/users/${TEST_WALLET}`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.walletAddress).toBe(TEST_WALLET.toLowerCase());
      expect(json.displayName).toBe('TestUser');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await app.request('/users/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });
  });

  describe('POST /users/register', () => {
    test('should register a new user', async () => {
      const response = await app.request('/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: TEST_WALLET,
          displayName: 'NewPlayer',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.user).toBeDefined();
    });

    test('should reject missing wallet address', async () => {
      const response = await app.request('/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'NoWallet',
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('walletAddress');
    });
  });

  describe('GET /users/:walletAddress/games', () => {
    test('should return game history for existing user', async () => {
      const response = await app.request(`/users/${TEST_WALLET}/games`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.games).toBeArray();
      expect(json.total).toBe(1);
    });

    test('should return 404 for non-existent user', async () => {
      const response = await app.request('/users/0x0000000000000000000000000000000000000000/games');

      expect(response.status).toBe(404);
    });

    test('should accept pagination parameters', async () => {
      const response = await app.request(`/users/${TEST_WALLET}/games?limit=10&offset=0`);

      expect(response.status).toBe(200);
    });
  });
});
