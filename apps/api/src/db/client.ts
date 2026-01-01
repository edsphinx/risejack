/**
 * Prisma Database Client for Rise Casino API
 *
 * Uses @prisma/adapter-pg for Prisma 7+ compatibility with Supabase PostgreSQL.
 */

import { Pool, PoolClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString,
  // Connection pool configuration for production
  max: 10, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if connection takes > 5s
});

// Handle pool errors to prevent unhandled promise rejections
pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
  // Don't exit - let the connection retry mechanism handle it
});

// Track connection state for health checks
let isPoolHealthy = true;

pool.on('connect', (_client: PoolClient) => {
  isPoolHealthy = true;
});

pool.on('remove', () => {
  // Connection removed from pool - normal behavior
});

const adapter = new PrismaPg(pool);

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handlers for connection cleanup
async function cleanup() {
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    console.error(
      'Error during database cleanup:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Handle process termination signals
process.on('beforeExit', cleanup);
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

/**
 * Check if database connection is healthy.
 * Use this for health check endpoints.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  if (!isPoolHealthy) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    isPoolHealthy = false;
    return false;
  }
}

// Export pool for potential direct access (testing, etc.)
export { pool };

export default prisma;
