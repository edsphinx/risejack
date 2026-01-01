/**
 * Leaderboard Route Tests
 *
 * Tests for GET /leaderboard/:period, GET /leaderboard/live/:metric
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import leaderboard from '../../routes/leaderboard';

// Mock LeaderboardService
mock.module('../../services/leaderboard.service', () => ({
  getCachedLeaderboard: mock((period: string) => {
    if (
      period === 'daily' ||
      period === 'weekly' ||
      period === 'monthly' ||
      period === 'all_time'
    ) {
      return Promise.resolve({
        period,
        entries: [
          { rank: 1, walletAddress: '0x123...', displayName: 'Player1', value: '1000' },
          { rank: 2, walletAddress: '0x456...', displayName: 'Player2', value: '800' },
        ],
        generatedAt: new Date().toISOString(),
      });
    }
    return Promise.resolve(null);
  }),
  getLiveLeaderboard: mock((metric: string, _limit: number) =>
    Promise.resolve({
      metric,
      entries: [{ rank: 1, walletAddress: '0x123...', displayName: 'Player1', value: '1000' }],
      generatedAt: new Date().toISOString(),
    })
  ),
}));

const app = new Hono();
app.route('/leaderboard', leaderboard);

describe('Leaderboard Routes', () => {
  describe('GET /leaderboard/:period', () => {
    test('should return daily leaderboard', async () => {
      const response = await app.request('/leaderboard/daily');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBe('daily');
      expect(json.entries).toBeArray();
    });

    test('should return weekly leaderboard', async () => {
      const response = await app.request('/leaderboard/weekly');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBe('weekly');
    });

    test('should return monthly leaderboard', async () => {
      const response = await app.request('/leaderboard/monthly');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBe('monthly');
    });

    test('should return all_time leaderboard', async () => {
      const response = await app.request('/leaderboard/all_time');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBe('all_time');
    });

    test('should reject invalid period', async () => {
      const response = await app.request('/leaderboard/invalid');

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Invalid period');
    });
  });

  describe('GET /leaderboard/live/:metric', () => {
    test('should return live volume leaderboard', async () => {
      const response = await app.request('/leaderboard/live/volume');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.metric).toBe('volume');
      expect(json.entries).toBeArray();
    });

    test('should return live wins leaderboard', async () => {
      const response = await app.request('/leaderboard/live/wins');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.metric).toBe('wins');
    });

    test('should return live pnl leaderboard', async () => {
      const response = await app.request('/leaderboard/live/pnl');

      expect(response.status).toBe(200);
    });

    test('should return live xp leaderboard', async () => {
      const response = await app.request('/leaderboard/live/xp');

      expect(response.status).toBe(200);
    });

    test('should reject invalid metric', async () => {
      const response = await app.request('/leaderboard/live/invalid');

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Invalid metric');
    });

    test('should accept limit parameter', async () => {
      const response = await app.request('/leaderboard/live/volume?limit=10');

      expect(response.status).toBe(200);
    });
  });
});
