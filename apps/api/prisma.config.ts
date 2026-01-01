// Prisma configuration for Rise Casino API (Prisma v7+)
// Uses DIRECT_URL for CLI operations (migrations) when available
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use DIRECT_URL for migrations if available (bypasses connection pooler)
    // Falls back to DATABASE_URL for regular operations
    // SECURITY: Use generic error to prevent connection string exposure
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      (() => {
        throw new Error('Database configuration error');
      })(),
  },
});
