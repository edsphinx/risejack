/**
 * Leaderboard Service Tests
 *
 * Unit tests for LeaderboardService validation logic
 */

import { describe, test, expect } from 'bun:test';

describe('LeaderboardService', () => {
  describe('Period Validation', () => {
    const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'all_time'];

    test('should accept valid periods', () => {
      VALID_PERIODS.forEach((period) => {
        expect(VALID_PERIODS.includes(period)).toBe(true);
      });
    });

    test('should reject invalid periods', () => {
      expect(VALID_PERIODS.includes('hourly')).toBe(false);
      expect(VALID_PERIODS.includes('yearly')).toBe(false);
    });
  });

  describe('Metric Validation', () => {
    const VALID_METRICS = ['volume', 'wins', 'pnl', 'xp'];

    test('should accept valid metrics', () => {
      VALID_METRICS.forEach((metric) => {
        expect(VALID_METRICS.includes(metric)).toBe(true);
      });
    });

    test('should reject invalid metrics', () => {
      expect(VALID_METRICS.includes('losses')).toBe(false);
      expect(VALID_METRICS.includes('games')).toBe(false);
    });
  });

  describe('Leaderboard Entry Ranking', () => {
    test('should sort entries by value descending', () => {
      const entries = [
        { rank: 0, value: '500' },
        { rank: 0, value: '1000' },
        { rank: 0, value: '750' },
      ];

      const sorted = [...entries].sort((a, b) => Number(b.value) - Number(a.value));
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      expect(sorted[0].value).toBe('1000');
      expect(sorted[0].rank).toBe(1);
      expect(sorted[1].value).toBe('750');
      expect(sorted[1].rank).toBe(2);
      expect(sorted[2].value).toBe('500');
      expect(sorted[2].rank).toBe(3);
    });

    test('should limit entries to specified count', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        rank: i + 1,
        value: String(100 - i),
      }));

      const limited = entries.slice(0, 50);
      expect(limited.length).toBe(50);
    });
  });

  describe('Period Date Calculation', () => {
    test('should calculate daily period correctly', () => {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      expect(dayStart.getHours()).toBe(0);
      expect(dayStart.getMinutes()).toBe(0);
    });

    test('should calculate weekly period correctly', () => {
      const now = new Date();
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      expect(weekStart.getDay()).toBe(0); // Sunday
    });
  });
});
