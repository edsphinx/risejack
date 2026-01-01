/**
 * Event Service Tests
 *
 * Tests for event service pure functions (no DB dependencies)
 */

import { describe, test, expect } from 'bun:test';
import { isValidEventType, getValidEventTypes } from '../../services/event.service';

describe('EventService', () => {
  describe('isValidEventType', () => {
    test('should return true for valid event types', () => {
      expect(isValidEventType('wallet_connect')).toBe(true);
      expect(isValidEventType('wallet_disconnect')).toBe(true);
      expect(isValidEventType('game_start')).toBe(true);
      expect(isValidEventType('game_action')).toBe(true);
      expect(isValidEventType('referral_click')).toBe(true);
      expect(isValidEventType('vip_upgrade')).toBe(true);
      expect(isValidEventType('email_subscribe')).toBe(true);
      expect(isValidEventType('page_view')).toBe(true);
    });

    test('should return false for invalid event types', () => {
      expect(isValidEventType('invalid_type')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType('WALLET_CONNECT')).toBe(false);
    });
  });

  describe('getValidEventTypes', () => {
    test('should return all valid event types', () => {
      const types = getValidEventTypes();

      expect(types).toBeArray();
      expect(types.length).toBe(8);
      expect(types).toContain('wallet_connect');
      expect(types).toContain('game_start');
    });

    test('should return a copy, not the original array', () => {
      const types1 = getValidEventTypes();
      const types2 = getValidEventTypes();

      expect(types1).not.toBe(types2);
      expect(types1).toEqual(types2);
    });
  });
});
