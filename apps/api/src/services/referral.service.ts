/**
 * Referral Service
 *
 * Business logic layer for referral operations.
 */

import { UserRepository, ReferralRepository } from '../repositories';
import type { ReferralStats, RefereeInfo, ReferralEarningRecord, GameType } from '@risejack/shared';

export async function getReferralStats(walletAddress: string): Promise<ReferralStats | null> {
  const user = await UserRepository.findUserByWallet(walletAddress);

  if (!user) return null;

  const [referees, earningsSummary] = await Promise.all([
    UserRepository.getReferees(user.id),
    ReferralRepository.getEarningsSummary(user.id),
  ]);

  const refereesInfo: RefereeInfo[] = referees.map((r) => ({
    displayName: r.displayName || `${r.walletAddress.slice(0, 6)}...${r.walletAddress.slice(-4)}`,
    joinedAt: r.createdAt.toISOString(),
  }));

  return {
    referralCode: user.referralCode,
    referralLink: `https://risecasino.xyz/r/${user.referralCode}`,
    directReferrals: referees.length,
    referees: refereesInfo,
    stats: {
      totalEarnings: earningsSummary.totalEarnings,
      totalTransactions: earningsSummary.totalTransactions,
      unclaimedEarnings: earningsSummary.unclaimedEarnings,
    },
  };
}

export async function getReferralHistory(
  walletAddress: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ReferralEarningRecord[] | null> {
  const user = await UserRepository.findUserByWallet(walletAddress);

  if (!user) return null;

  const earnings = await ReferralRepository.getReferralEarnings(user.id, options);

  return earnings.map((e) => ({
    id: e.id,
    tier: e.tier as 1 | 2,
    earned: e.earned,
    currency: e.currency,
    claimed: e.claimed,
    createdAt: e.createdAt.toISOString(),
    referee: {
      name: e.referee.displayName || `${e.referee.walletAddress.slice(0, 6)}...`,
    },
    game: {
      type: e.game.gameType as GameType,
      txHash: e.game.txHash,
    },
  }));
}
