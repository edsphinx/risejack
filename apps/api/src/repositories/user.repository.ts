/**
 * User Repository
 *
 * Data access layer for user-related database operations.
 * All Prisma interactions for users are centralized here.
 */

import prisma from '../db/client';
import type { User } from '@prisma/client';

const DEFAULT_CHAIN_ID = 713715; // Rise Testnet

// ==================== READ OPERATIONS ====================

export async function findUserByWallet(
  walletAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<User | null> {
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
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function findUserByReferralCode(referralCode: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { referralCode },
  });
}

export async function getUserWithStats(walletAddress: string, chainId: number = DEFAULT_CHAIN_ID) {
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
  const normalizedWallet = data.walletAddress.toLowerCase();
  const chainId = data.chainId || DEFAULT_CHAIN_ID;

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
      referralCode: data.referralCode || generateReferralCode(),
      chainId,
    },
  });
}

export async function updateUserXp(userId: string, xpToAdd: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: { increment: xpToAdd },
      // Level up every 100 XP
      level: {
        increment: Math.floor(xpToAdd / 100),
      },
      lastSeenAt: new Date(),
    },
  });
}

export async function setUserReferrer(userId: string, referrerId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { referrerId },
  });
}

// ==================== HELPERS ====================

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export { generateReferralCode };
