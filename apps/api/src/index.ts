/**
 * Rise Casino API
 *
 * Powered by Hono + Prisma + Supabase
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { rateLimiter } from 'hono-rate-limiter';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

// Route imports
import users from './routes/users';
import referrals from './routes/referrals';
import leaderboard from './routes/leaderboard';
import events from './routes/events';
import activity from './routes/activity';
import health from './routes/health';

const app = new Hono();

// Request ID middleware for debugging without exposing sensitive data
app.use('*', async (c, next) => {
  const requestId = randomBytes(8).toString('hex');
  c.res.headers.set('X-Request-ID', requestId);
  await next();
});

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://risecasino.xyz'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
app.use('*', prettyJSON());

// Rate limiting: 100 requests per minute per IP (prevents abuse)
app.use(
  '*',
  rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per window
    standardHeaders: 'draft-6',
    keyGenerator: (c) => {
      // Use the most reliable IP source available
      // CF-Connecting-IP is set by Cloudflare and is trusted
      const cfConnectingIp = c.req.header('cf-connecting-ip');
      const realIp = c.req.header('x-real-ip');
      const forwardedFor = c.req.header('x-forwarded-for');

      return (
        cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown')
      );
    },
    message: { error: 'Too many requests, please try again later' },
  })
);

// Root endpoint - minimal info to prevent API reconnaissance
app.get('/', (c) => {
  return c.json({
    name: 'Rise Casino API',
    version: '1.0.0',
    status: 'operational',
  });
});

// Mount routes
app.route('/health', health);
app.route('/api/users', users);
app.route('/api/referrals', referrals);
app.route('/api/leaderboard', leaderboard);
app.route('/api/events', events);
app.route('/api/activity', activity);

// Global stats endpoint
app.get('/api/stats', async (c) => {
  // TODO: Implement with Prisma once DB is connected
  return c.json({
    totalGames: 0,
    totalPlayers: 0,
    totalVolume: '0',
    houseEdge: '1.5%',
    updatedAt: new Date().toISOString(),
  });
});

// 404 handler - CWE-209: Don't expose path to prevent info disclosure
app.notFound((c) => {
  // Never log path details to prevent information disclosure
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  // CWE-209: Only log error message to prevent info disclosure
  if (process.env.NODE_ENV === 'production') {
    console.error('API Error:', err.message);
  } else {
    // In development, still avoid logging full stack trace with sensitive paths
    console.error('API Error:', {
      message: err.message,
      name: err.name,
    });
  }
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3001;
const isHttps = process.env.HTTPS === 'true';
const protocol = isHttps ? 'https' : 'http';

// eslint-disable-next-line no-console
console.log(`🎰 Rise Casino API running on ${protocol}://localhost:${port}`);

// TLS configuration for local HTTPS development
const getTlsConfig = () => {
  if (!isHttps) return undefined;

  try {
    // Use absolute paths to prevent path traversal
    const baseDir = process.cwd();
    const keyPath = path.resolve(baseDir, 'localhost+2-key.pem');
    const certPath = path.resolve(baseDir, 'localhost+2.pem');

    // Validate paths are within expected directory
    if (!keyPath.startsWith(baseDir) || !certPath.startsWith(baseDir)) {
      throw new Error('Invalid certificate path');
    }

    // Check if files exist before returning
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      throw new Error('Certificates not found');
    }

    // Use Bun's native file reading with validated absolute paths
    const key = Bun.file(keyPath);
    const cert = Bun.file(certPath);

    return { key, cert };
  } catch {
    console.warn('⚠️  TLS certificates not found. Run: mkcert localhost 127.0.0.1 ::1');
    return undefined;
  }
};

export default {
  port,
  fetch: app.fetch,
  tls: getTlsConfig(),
};
