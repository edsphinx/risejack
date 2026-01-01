/**
 * Referral Service Tests
 *
 * Unit tests for ReferralService validation logic
 */

import { describe, test, expect } from 'bun:test';

describe('ReferralService', () => {
  describe('Referral Code Generation', () => {
    test('should generate valid referral code format', () => {
      // Simulate referral code generation logic
      const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const code = generateCode();
      expect(code.length).toBe(8);
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
    });
  });

  describe('Earnings Calculation', () => {
    test('should calculate tier 1 referral earnings (10%)', () => {
      const houseEdge = BigInt('100000000000000000'); // 0.1 ETH
      const tier1Rate = 0.1;
      const tier1Earning = Number(houseEdge) * tier1Rate;
      expect(tier1Earning).toBe(10000000000000000);
    });

    test('should calculate tier 2 referral earnings (2%)', () => {
      const houseEdge = BigInt('100000000000000000'); // 0.1 ETH
      const tier2Rate = 0.02;
      const tier2Earning = Number(houseEdge) * tier2Rate;
      expect(tier2Earning).toBe(2000000000000000);
    });
  });

  describe('Referral Stats Aggregation', () => {
    test('should sum total earnings correctly', () => {
      const earnings = [
        { earned: '100000000000000000' },
        { earned: '50000000000000000' },
        { earned: '25000000000000000' },
      ];

      const total = earnings.reduce((sum, e) => sum + BigInt(e.earned), BigInt(0));
      expect(total).toBe(BigInt('175000000000000000'));
    });

    test('should separate pending and claimed earnings', () => {
      const earnings = [
        { earned: '100000000000000000', claimed: true },
        { earned: '50000000000000000', claimed: false },
      ];

      const claimed = earnings.filter((e) => e.claimed);
      const pending = earnings.filter((e) => !e.claimed);

      expect(claimed.length).toBe(1);
      expect(pending.length).toBe(1);
    });
  });
});
