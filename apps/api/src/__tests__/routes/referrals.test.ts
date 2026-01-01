/**
 * Referrals Route Tests
 *
 * Tests for GET /referrals/:wallet, GET /referrals/:wallet/history, POST /referrals/register
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import referrals from '../../routes/referrals';
import { TEST_WALLET } from '../setup';

// Mock ReferralService
mock.module('../../services/referral.service', () => ({
  getReferralStats: mock((wallet: string) => {
    if (wallet.toLowerCase() === TEST_WALLET.toLowerCase()) {
      return Promise.resolve({
        referralCode: 'TESTCODE',
        totalReferees: 5,
        tier1Referees: 5,
        tier2Referees: 0,
        totalEarned: '1000000000000000000',
        pendingEarnings: '500000000000000000',
        claimedEarnings: '500000000000000000',
      });
    }
    return Promise.resolve(null);
  }),
  getReferralHistory: mock((wallet: string) => {
    if (wallet.toLowerCase() === TEST_WALLET.toLowerCase()) {
      return Promise.resolve([
        {
          id: 'earning-1',
          earned: '100000000000000000',
          tier: 1,
          gameId: 'game-1',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    return Promise.resolve(null);
  }),
}));

// Mock UserService
mock.module('../../services/user.service', () => ({
  registerReferral: mock((wallet: string, code: string) => {
    if (code === 'VALIDCODE') {
      return Promise.resolve({ success: true, userReferralCode: 'NEWUSERCODE' });
    }
    return Promise.resolve({ success: false, error: 'Invalid referral code' });
  }),
}));

const app = new Hono();
app.route('/referrals', referrals);

describe('Referrals Routes', () => {
  describe('GET /referrals/:walletAddress', () => {
    test('should return referral stats for existing user', async () => {
      const response = await app.request(`/referrals/${TEST_WALLET}`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.referralCode).toBe('TESTCODE');
      expect(json.totalReferees).toBe(5);
      expect(json.totalEarned).toBeDefined();
    });

    test('should return 404 for non-existent user', async () => {
      const response = await app.request('/referrals/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });
  });

  describe('GET /referrals/:walletAddress/history', () => {
    test('should return referral history for existing user', async () => {
      const response = await app.request(`/referrals/${TEST_WALLET}/history`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.history).toBeArray();
      expect(json.pagination).toBeDefined();
    });

    test('should return 404 for non-existent user', async () => {
      const response = await app.request(
        '/referrals/0x0000000000000000000000000000000000000000/history'
      );

      expect(response.status).toBe(404);
    });

    test('should accept pagination parameters', async () => {
      const response = await app.request(`/referrals/${TEST_WALLET}/history?limit=10&offset=5`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.pagination.limit).toBe(10);
      expect(json.pagination.offset).toBe(5);
    });
  });

  describe('POST /referrals/register', () => {
    test('should register valid referral', async () => {
      const response = await app.request('/referrals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: TEST_WALLET,
          referralCode: 'VALIDCODE',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.userReferralCode).toBe('NEWUSERCODE');
    });

    test('should reject invalid referral code', async () => {
      const response = await app.request('/referrals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: TEST_WALLET,
          referralCode: 'INVALIDCODE',
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Invalid');
    });

    test('should reject missing required fields', async () => {
      const response = await app.request('/referrals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: TEST_WALLET,
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('required');
    });
  });
});
