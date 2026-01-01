/**
 * Health Check Route
 *
 * Provides health check endpoint for monitoring and load balancers.
 * Includes database connectivity verification.
 */

import { Hono } from 'hono';
import { isDatabaseHealthy } from '../db/client';

const health = new Hono();

/**
 * GET /health
 * Returns service health status including database connectivity
 */
health.get('/', async (c) => {
  const startTime = Date.now();

  // Check database connectivity
  const dbHealthy = await isDatabaseHealthy();

  const responseTime = Date.now() - startTime;

  if (!dbHealthy) {
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'unhealthy', responseTime },
          api: { status: 'healthy' },
        },
      },
      503
    );
  }

  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'healthy', responseTime },
      api: { status: 'healthy' },
    },
  });
});

/**
 * GET /health/live
 * Simple liveness probe - always returns 200 if API is running
 */
health.get('/live', (c) => {
  return c.json({ status: 'ok' });
});

/**
 * GET /health/ready
 * Readiness probe - checks if the service is ready to accept traffic
 */
health.get('/ready', async (c) => {
  const dbHealthy = await isDatabaseHealthy();

  if (!dbHealthy) {
    return c.json({ status: 'not ready', reason: 'database unavailable' }, 503);
  }

  return c.json({ status: 'ready' });
});

export default health;
