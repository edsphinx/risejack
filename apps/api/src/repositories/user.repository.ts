/**
 * User Repository
 *
 * Data access layer for user-related database operations.
 * All Prisma interactions for users are centralized here.
 */

import prisma from '../db/client';
import type { User } from '@prisma/client';

// ==================== READ OPERATIONS ====================

export async function findUserByWallet(walletAddress: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
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

export async function getUserWithStats(walletAddress: string) {
  return prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: {
      id: true,
      walletAddress: true,
      displayName: true,
      avatarUrl: true,
      xp: true,
      level: true,
      vipTier: true,
      referralCode: true,
      createdAt: true,
      lastSeenAt: true,
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
}): Promise<User> {
  return prisma.user.create({
    data: {
      walletAddress: data.walletAddress.toLowerCase(),
      displayName: data.displayName,
      referrerId: data.referrerId,
      referralCode: data.referralCode,
    },
  });
}

export async function upsertUser(data: {
  walletAddress: string;
  displayName?: string;
  referrerId?: string;
  referralCode?: string;
}): Promise<User> {
  const normalizedWallet = data.walletAddress.toLowerCase();

  return prisma.user.upsert({
    where: { walletAddress: normalizedWallet },
    update: {
      lastSeenAt: new Date(),
      ...(data.displayName && { displayName: data.displayName }),
    },
    create: {
      walletAddress: normalizedWallet,
      displayName: data.displayName,
      referrerId: data.referrerId,
      referralCode: data.referralCode || generateReferralCode(),
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
