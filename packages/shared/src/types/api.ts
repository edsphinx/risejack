/**
 * API Types for Rise Casino
 *
 * All types used by the Hono API and consumed by the frontend.
 * These types are derived from Prisma schema but simplified for API responses.
 */

// ==================== USER TYPES ====================

export interface UserProfile {
  id: string;
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  vipTier: VipTier;
  referralCode: string;
  memberSince: string; // ISO date
  lastSeen: string | null; // ISO date
}

export type VipTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface UserStats {
  totalGames: number;
  totalWagered: string; // BigInt as string
  totalPnL: string; // BigInt as string
  wins: number;
  losses: number;
  winRate: string; // percentage
  referrals: number;
}

export interface UserProfileResponse {
  profile: UserProfile;
  stats: UserStats;
}

// ==================== GAME TYPES ====================

export type GameType = 'blackjack' | 'roulette' | 'poker' | 'slots';

export type GameOutcome = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender';

export interface GameRecord {
  id: string;
  gameType: GameType;
  betAmount: string; // BigInt as string (Wei)
  currency: string;
  payout: string;
  pnl: string;
  outcome: GameOutcome;
  txHash: string;
  playedAt: string; // ISO date
}

export interface GameHistoryResponse {
  games: GameRecord[];
  pagination: PaginationInfo;
}

// ==================== REFERRAL TYPES ====================

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  directReferrals: number;
  referees: RefereeInfo[];
  stats: {
    totalEarnings: string;
    totalTransactions: number;
    unclaimedEarnings: string;
  };
}

export interface RefereeInfo {
  displayName: string;
  joinedAt: string; // ISO date
}

export interface ReferralEarningRecord {
  id: string;
  tier: 1 | 2;
  earned: string;
  currency: string;
  claimed: boolean;
  createdAt: string;
  referee: {
    name: string;
  };
  game: {
    type: GameType;
    txHash: string;
  };
}

export interface ReferralHistoryResponse {
  history: ReferralEarningRecord[];
  pagination: PaginationMeta;
}

// ==================== LEADERBOARD TYPES ====================

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export type LeaderboardMetric = 'volume' | 'wins' | 'pnl' | 'xp';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  walletAddress: string;
  vipTier: VipTier;
  value: number | string;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  periodStart?: string;
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  generatedAt: string;
  cached?: boolean;
}

// ==================== EVENT TYPES ====================

export type EventType =
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'game_start'
  | 'game_action'
  | 'referral_click'
  | 'vip_upgrade'
  | 'email_subscribe'
  | 'page_view';

export interface LogEventRequest {
  walletAddress?: string;
  eventType: EventType;
  eventData?: Record<string, unknown>;
  sessionId?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

export interface LogEventResponse {
  success: boolean;
  eventId: string;
}

export interface FunnelEntry {
  eventType: EventType;
  totalEvents: number;
  uniqueUsers: number;
}

export interface FunnelResponse {
  period: {
    days: number;
    since: string;
  };
  funnel: FunnelEntry[];
}

// ==================== COMMON TYPES ====================

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface ApiSuccess {
  success: true;
  message?: string;
}
