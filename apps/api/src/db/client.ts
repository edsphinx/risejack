/**
 * Prisma Database Client for Rise Casino API
 *
 * Uses @prisma/adapter-pg for Prisma 7+ compatibility with Supabase PostgreSQL.
 *
 * SECURITY: Connection strings and database errors are never exposed to clients.
 */

import { Pool, PoolClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Get database URL securely from environment.
 * Throws a generic error to prevent connection string exposure.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Generic error - never expose that DATABASE_URL is the issue
    throw new Error('Database configuration error');
  }
  return url;
}

// Create PostgreSQL connection pool with secure configuration
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  // Connection pool configuration for production
  max: 10, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if connection takes > 5s
});

/**
 * Thread-safe health status tracking using atomic operations.
 * Uses a closure to prevent direct external modification.
 */
const healthStatus = (() => {
  let healthy = true;

  return {
    get: () => healthy,
    setHealthy: () => {
      healthy = true;
    },
    setUnhealthy: () => {
      healthy = false;
    },
  };
})();

// Handle pool errors securely - never log connection details
pool.on('error', (_err: Error) => {
  // Log generic error without exposing connection details
  console.error('Database pool error occurred');
  healthStatus.setUnhealthy();
  // Don't exit - let the connection retry mechanism handle it
});

pool.on('connect', (_client: PoolClient) => {
  // Connection established - update health status
  healthStatus.setHealthy();
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
    // Only log errors, never queries (which could contain sensitive data)
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handlers for connection cleanup
let isShuttingDown = false;

async function cleanup() {
  // Use atomic compare-and-swap to prevent race conditions
  const wasShuttingDown = isShuttingDown;
  isShuttingDown = true;

  if (wasShuttingDown) {
    return; // Prevent concurrent cleanup
  }

  // Handle each cleanup step separately to ensure both are attempted (CWE-404)
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error(
      'Failed to disconnect Prisma client:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  try {
    await pool.end();
  } catch (error) {
    console.error(
      'Failed to close connection pool:',
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
 * Never exposes connection details in errors.
 *
 * Uses closure-based health tracking for thread-safety.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  if (!healthStatus.get()) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.setHealthy();
    return true;
  } catch {
    healthStatus.setUnhealthy();
    return false;
  }
}

// Export pool for testing only - prevents direct DB access in production
export const testPool = process.env.NODE_ENV === 'test' ? pool : undefined;

export default prisma;
