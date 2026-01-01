/**
 * User Repository
 *
 * Data access layer for user-related database operations.
 * All Prisma interactions for users are centralized here.
 */

import { randomBytes } from 'crypto';
import prisma from '../db/client';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';

const DEFAULT_CHAIN_ID = 713715; // Rise Testnet

// XP configuration constants
const XP_PER_LEVEL = 100;
const MAX_XP_PER_UPDATE = 1000; // Prevent XP manipulation
const MIN_XP_PER_UPDATE = 0;

// ==================== READ OPERATIONS ====================

export async function findUserByWallet(
  walletAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<User | null> {
  // Validate wallet address format (42 chars, starts with 0x, hex)
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return null; // Invalid format, return null
  }

  return prisma.user.findUnique({
    where: {
      walletAddress_chainId: {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
    },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  // Validate UUID format to prevent injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null; // Invalid format, return null
  }

  return prisma.user.findUnique({
    where: { id },
  });
}

export async function findUserByReferralCode(referralCode: string): Promise<User | null> {
  // Validate referral code format (8 alphanumeric characters)
  if (!/^[A-Z0-9]{8}$/.test(referralCode)) {
    return null; // Invalid format, return null
  }

  return prisma.user.findUnique({
    where: { referralCode },
  });
}

export async function getUserWithStats(walletAddress: string, chainId: number = DEFAULT_CHAIN_ID) {
  // Validate wallet address format (42 chars, starts with 0x, hex)
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return null; // Invalid format, return null
  }

  return prisma.user.findUnique({
    where: {
      walletAddress_chainId: {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
    },
    include: {
      _count: {
        select: {
          games: true,
          referees: true,
        },
      },
    },
  });
}

export async function getReferees(userId: string) {
  // Validate userId format (UUID) to prevent SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return []; // Invalid format, return empty array
  }

  return prisma.user.findMany({
    where: { referrerId: userId },
    select: {
      id: true,
      displayName: true,
      walletAddress: true,
      createdAt: true,
    },
  });
}

// ==================== WRITE OPERATIONS ====================

export async function createUser(data: {
  walletAddress: string;
  displayName?: string;
  referrerId?: string;
  referralCode: string;
  chainId?: number;
}): Promise<User> {
  // Validate wallet address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(data.walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  // Validate referral code format
  if (!/^[A-Z0-9]{8}$/.test(data.referralCode)) {
    throw new Error('Invalid referral code format');
  }

  // Validate referrerId if provided
  if (
    data.referrerId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      data.referrerId
    )
  ) {
    throw new Error('Invalid referrer ID format');
  }

  // Validate displayName if provided (max 64 chars to prevent XSS/DB issues)
  if (data.displayName !== undefined) {
    if (typeof data.displayName !== 'string' || data.displayName.length > 64) {
      throw new Error('Invalid display name format or length');
    }
    data.displayName = data.displayName.trim();
  }

  return prisma.user.create({
    data: {
      walletAddress: data.walletAddress.toLowerCase(),
      displayName: data.displayName,
      referrerId: data.referrerId,
      referralCode: data.referralCode,
      chainId: data.chainId || DEFAULT_CHAIN_ID,
    },
  });
}

export async function upsertUser(data: {
  walletAddress: string;
  displayName?: string;
  referrerId?: string;
  referralCode?: string;
  chainId?: number;
}): Promise<User> {
  // Validate wallet address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(data.walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  // Validate referrerId if provided
  if (
    data.referrerId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      data.referrerId
    )
  ) {
    throw new Error('Invalid referrer ID format');
  }

  // Validate displayName if provided (max 64 chars to prevent XSS/DB issues)
  if (data.displayName !== undefined) {
    if (typeof data.displayName !== 'string' || data.displayName.length > 64) {
      throw new Error('Invalid display name format or length');
    }
    data.displayName = data.displayName.trim();
  }

  const normalizedWallet = data.walletAddress.toLowerCase();
  const chainId = data.chainId || DEFAULT_CHAIN_ID;

  // Generate unique referral code with collision detection
  const referralCode = data.referralCode || (await generateUniqueReferralCode());

  return prisma.user.upsert({
    where: {
      walletAddress_chainId: {
        walletAddress: normalizedWallet,
        chainId,
      },
    },
    update: {
      lastSeenAt: new Date(),
      ...(data.displayName && { displayName: data.displayName }),
    },
    create: {
      walletAddress: normalizedWallet,
      displayName: data.displayName,
      referrerId: data.referrerId,
      referralCode,
      chainId,
    },
  });
}

/**
 * Update user XP with proper validation and level calculation.
 * Level is calculated from TOTAL XP, not incremented per update.
 *
 * SECURITY: Uses atomic UPDATE to prevent race conditions from concurrent calls.
 */
export async function updateUserXp(userId: string, xpToAdd: number): Promise<void> {
  // Validate XP bounds to prevent manipulation
  const validatedXp = Math.min(Math.max(MIN_XP_PER_UPDATE, Math.floor(xpToAdd)), MAX_XP_PER_UPDATE);

  if (validatedXp <= 0) {
    return; // No XP to add
  }

  // Validate userId format (UUID) to prevent SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid user ID format');
  }

  // Atomic update using single SQL statement to prevent race conditions
  // This calculates new XP and level in one operation
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET 
        xp = xp + ${validatedXp},
        level = FLOOR((xp + ${validatedXp}) / ${XP_PER_LEVEL}),
        "lastSeenAt" = NOW()
      WHERE id = ${userId}
    `
  );
}

export async function setUserReferrer(userId: string, referrerId: string): Promise<void> {
  // Validate userId format (UUID) to prevent SQL injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid user ID format');
  }
  // Validate referrerId format (UUID) to prevent SQL injection
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referrerId)
  ) {
    throw new Error('Invalid referrer ID format');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { referrerId },
  });
}

// ==================== HELPERS ====================

/**
 * Generate a unique referral code with collision detection.
 * Uses rejection sampling to avoid modulo bias.
 * Retries up to 10 times if collision detected.
 */
async function generateUniqueReferralCode(maxRetries: number = 10): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateReferralCode();

    // Check for collision
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code; // Unique code found
    }
  }

  // Fallback: generate a new secure code by combining two random codes (extremely rare case)
  // Never use predictable timestamps for security-sensitive codes
  const fallbackCode = generateReferralCode() + generateReferralCode().slice(0, 4);
  return fallbackCode.slice(0, 8); // Ensure 8 character limit
}

/**
 * Generate a cryptographically secure referral code.
 * Uses rejection sampling to avoid modulo bias.
 *
 * With 36 characters (A-Z, 0-9) and 8-char codes:
 * - Total combinations: 36^8 = 2.8 trillion
 * - Collision probability is negligible
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charsLength = chars.length; // 36

  // Use rejection sampling to avoid modulo bias
  // 256 / 36 = 7.11, so values >= 252 (36*7) are rejected
  const maxValidByte = Math.floor(256 / charsLength) * charsLength; // 252

  let code = '';
  let bytesNeeded = 8;
  let maxIterations = 1000; // Prevent infinite loops

  while (bytesNeeded > 0 && maxIterations > 0) {
    const batch = randomBytes(bytesNeeded * 2); // Get extra bytes for rejections

    for (let i = 0; i < batch.length && bytesNeeded > 0; i++) {
      if (batch[i] < maxValidByte) {
        code += chars.charAt(batch[i] % charsLength);
        bytesNeeded--;
      }
      // Reject bytes >= 252 to avoid bias
    }
    maxIterations--;
  }

  if (bytesNeeded > 0) {
    throw new Error('Failed to generate referral code');
  }

  return code;
}

export { generateReferralCode };
