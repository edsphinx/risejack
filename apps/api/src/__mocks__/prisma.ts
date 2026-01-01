/**
 * Prisma Mock
 *
 * Mock implementation of Prisma client for unit testing.
 * Uses Bun's mock utilities.
 */

import { mock } from 'bun:test';

// Create mock functions for all Prisma operations
export const mockPrisma = {
  user: {
    findUnique: mock(() => Promise.resolve(null)),
    findFirst: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve({})),
    update: mock(() => Promise.resolve({})),
    upsert: mock(() => Promise.resolve({})),
  },
  game: {
    findMany: mock(() => Promise.resolve([])),
    count: mock(() => Promise.resolve(0)),
    aggregate: mock(() => Promise.resolve({ _sum: { pnl: null } })),
  },
  eventLog: {
    create: mock(() => Promise.resolve({ id: 'test-event-id' })),
    groupBy: mock(() => Promise.resolve([])),
  },
  referralEarning: {
    findMany: mock(() => Promise.resolve([])),
    aggregate: mock(() => Promise.resolve({ _sum: { earned: null } })),
    count: mock(() => Promise.resolve(0)),
  },
  leaderboardSnapshot: {
    findFirst: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({})),
  },
  session: {
    create: mock(() => Promise.resolve({})),
  },
  $queryRaw: mock(() => Promise.resolve([])),
};

// Helper to reset all mocks
export function resetAllMocks() {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as ReturnType<typeof mock>).mockClear();
        }
      });
    }
  });
}

export default mockPrisma;
