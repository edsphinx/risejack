/**
 * Events Route Tests
 *
 * Tests for POST /events, GET /events/types, GET /events/funnel
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import events from '../../routes/events';

// Mock the EventService
mock.module('../../services/event.service', () => ({
  isValidEventType: mock((type: string) =>
    [
      'wallet_connect',
      'wallet_disconnect',
      'game_start',
      'game_action',
      'referral_click',
      'vip_upgrade',
      'email_subscribe',
      'page_view',
    ].includes(type)
  ),
  getValidEventTypes: mock(() => [
    'wallet_connect',
    'wallet_disconnect',
    'game_start',
    'game_action',
    'referral_click',
    'vip_upgrade',
    'email_subscribe',
    'page_view',
  ]),
  logEvent: mock(() => Promise.resolve('test-event-id')),
  getFunnelAnalytics: mock(() =>
    Promise.resolve({
      period: { days: 7, since: new Date().toISOString() },
      funnel: [
        { eventType: 'wallet_connect', totalEvents: 100, uniqueUsers: 50 },
        { eventType: 'game_start', totalEvents: 80, uniqueUsers: 40 },
      ],
    })
  ),
}));

const app = new Hono();
app.route('/events', events);

describe('Events Routes', () => {
  describe('POST /events', () => {
    test('should log a valid event', async () => {
      const response = await app.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890123456789012345678901234567890',
          eventType: 'wallet_connect',
          eventData: { provider: 'metamask' },
          deviceType: 'desktop',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.eventId).toBe('test-event-id');
    });

    test('should reject invalid event type', async () => {
      const response = await app.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890123456789012345678901234567890',
          eventType: 'invalid_event_type',
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Invalid eventType');
    });

    test('should reject missing event type', async () => {
      const response = await app.request('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x1234567890123456789012345678901234567890',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /events/types', () => {
    test('should return valid event types', async () => {
      const response = await app.request('/events/types');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.eventTypes).toBeArray();
      expect(json.eventTypes).toContain('wallet_connect');
      expect(json.eventTypes).toContain('game_start');
    });
  });

  describe('GET /events/funnel', () => {
    test('should return funnel analytics with default days', async () => {
      const response = await app.request('/events/funnel');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBeDefined();
      expect(json.funnel).toBeArray();
    });

    test('should accept custom days parameter', async () => {
      const response = await app.request('/events/funnel?days=30');

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.period).toBeDefined();
    });
  });
});
