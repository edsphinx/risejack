/**
 * App Integration Tests
 *
 * Tests for app-level functionality: health check, 404, error handling
 */

import { describe, test, expect } from 'bun:test';
import app from '../../index';

describe('App Integration', () => {
  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await app.fetch(new Request('http://localhost/health'));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('risecasino-api');
      expect(json.version).toBe('1.0.0');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    test('should return API info', async () => {
      const response = await app.fetch(new Request('http://localhost/'));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.name).toBe('Rise Casino API');
      expect(json.version).toBe('1.0.0');
      expect(json.endpoints).toBeDefined();
    });

    test('should list all endpoints', async () => {
      const response = await app.fetch(new Request('http://localhost/'));
      const json = await response.json();

      expect(json.endpoints.health).toBe('GET /health');
      expect(json.endpoints.users).toBeDefined();
      expect(json.endpoints.referrals).toBeDefined();
      expect(json.endpoints.leaderboard).toBeDefined();
      expect(json.endpoints.events).toBeDefined();
    });
  });

  describe('GET /api/stats', () => {
    test('should return global stats', async () => {
      const response = await app.fetch(new Request('http://localhost/api/stats'));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.totalGames).toBeDefined();
      expect(json.totalPlayers).toBeDefined();
      expect(json.houseEdge).toBe('1.5%');
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await app.fetch(new Request('http://localhost/unknown/path'));

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Not found');
      expect(json.path).toBe('/unknown/path');
    });

    test('should return 404 for unknown API routes', async () => {
      const response = await app.fetch(new Request('http://localhost/api/nonexistent'));

      expect(response.status).toBe(404);
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers for allowed origins', async () => {
      const response = await app.fetch(
        new Request('http://localhost/health', {
          headers: { Origin: 'http://localhost:5173' },
        })
      );

      expect(response.status).toBe(200);
      // CORS headers should be present
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });
  });
});
