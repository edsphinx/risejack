/**
 * User Service
 *
 * Business logic layer for user operations.
 */

import { UserRepository, GameRepository } from '../repositories';
import type { UserProfile, UserStats, UserProfileResponse, VipTier } from '@risejack/shared';

export async function getUserProfile(walletAddress: string): Promise<UserProfileResponse | null> {
  const user = await UserRepository.getUserWithStats(walletAddress);

  if (!user) return null;

  const gameStats = await GameRepository.getGameStats(user.id);

  const profile: UserProfile = {
    id: user.id,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    xp: user.xp,
    level: user.level,
    vipTier: user.vipTier as VipTier,
    referralCode: user.referralCode,
    memberSince: user.createdAt.toISOString(),
    lastSeen: user.lastSeenAt?.toISOString() || null,
  };

  const winRate =
    gameStats.totalGames > 0 ? ((gameStats.wins / gameStats.totalGames) * 100).toFixed(1) : '0';

  const stats: UserStats = {
    totalGames: gameStats.totalGames,
    totalWagered: gameStats.totalWagered,
    totalPnL: gameStats.totalPnL,
    wins: gameStats.wins,
    losses: gameStats.losses,
    winRate,
    referrals: user._count.referees,
  };

  return { profile, stats };
}

export async function registerUser(walletAddress: string, displayName?: string) {
  const user = await UserRepository.upsertUser({
    walletAddress,
    displayName,
  });

  return {
    id: user.id,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    referralCode: user.referralCode,
    xp: user.xp,
    level: user.level,
    vipTier: user.vipTier as VipTier,
  };
}

export async function registerReferral(
  walletAddress: string,
  referralCode: string
): Promise<{ success: boolean; error?: string; userReferralCode?: string }> {
  // Find referrer by code
  const referrer = await UserRepository.findUserByReferralCode(referralCode);

  if (!referrer) {
    return { success: false, error: 'Invalid referral code' };
  }

  // Check if user exists and already has a referrer
  const existingUser = await UserRepository.findUserByWallet(walletAddress);

  if (existingUser?.referrerId) {
    return { success: false, error: 'User already has a referrer' };
  }

  // Create or update user with referrer
  const user = await UserRepository.upsertUser({
    walletAddress,
    referrerId: referrer.id,
  });

  return {
    success: true,
    userReferralCode: user.referralCode,
  };
}
