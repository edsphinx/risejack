/**
 * Rise Casino API
 *
 * Powered by Hono + Prisma + Supabase
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import path from 'path';

// Route imports
import users from './routes/users';
import referrals from './routes/referrals';
import leaderboard from './routes/leaderboard';
import events from './routes/events';
import activity from './routes/activity';
import health from './routes/health';

const app = new Hono();

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

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Rise Casino API',
    version: '1.0.0',
    description: 'Backend for Rise Casino - Leaderboards, Referrals, User Stats',
    endpoints: {
      health: {
        status: 'GET /health',
        live: 'GET /health/live',
        ready: 'GET /health/ready',
      },
      users: {
        profile: 'GET /api/users/:walletAddress',
        register: 'POST /api/users/register',
        games: 'GET /api/users/:walletAddress/games',
      },
      referrals: {
        stats: 'GET /api/referrals/:walletAddress',
        history: 'GET /api/referrals/:walletAddress/history',
        register: 'POST /api/referrals/register',
      },
      leaderboard: {
        cached: 'GET /api/leaderboard/:period',
        live: 'GET /api/leaderboard/live/:metric',
      },
      events: {
        log: 'POST /api/events',
        types: 'GET /api/events/types',
        funnel: 'GET /api/events/funnel',
      },
    },
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
  // CWE-209: Only log error message in production to prevent info disclosure
  if (process.env.NODE_ENV === 'production') {
    console.error('API Error:', err.message);
  } else {
    console.error('API Error:', err);
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
    // Use path.join to prevent path traversal attacks
    const keyPath = path.join(process.cwd(), 'localhost+2-key.pem');
    const certPath = path.join(process.cwd(), 'localhost+2.pem');

    // Use Bun's native file reading with absolute paths
    const key = Bun.file(keyPath);
    const cert = Bun.file(certPath);

    // Check if files exist before returning
    if (!key.size || !cert.size) {
      throw new Error('Certificates not found');
    }

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
