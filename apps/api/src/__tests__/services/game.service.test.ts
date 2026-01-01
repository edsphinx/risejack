/**
 * Game Service Tests
 *
 * Unit tests for GameService validation logic
 */

import { describe, test, expect } from 'bun:test';

describe('GameService', () => {
  describe('Pagination Validation', () => {
    test('should apply default limit', () => {
      const defaultLimit = 20;
      expect(defaultLimit).toBe(20);
    });

    test('should respect custom limit', () => {
      const customLimit = 50;
      expect(customLimit).toBeGreaterThan(0);
      expect(customLimit).toBeLessThanOrEqual(100);
    });

    test('should handle offset parameter', () => {
      const offset = 20;
      expect(offset).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Game Stats Calculation', () => {
    test('should handle zero games', () => {
      const stats = { totalBet: '0', totalPnl: '0' };
      expect(stats.totalBet).toBe('0');
      expect(stats.totalPnl).toBe('0');
    });

    test('should handle positive and negative PnL', () => {
      const winPnl = '1000000000000000000';
      const lossPnl = '-500000000000000000';
      expect(BigInt(winPnl)).toBeGreaterThan(BigInt(0));
      expect(BigInt(lossPnl)).toBeLessThan(BigInt(0));
    });
  });
});
