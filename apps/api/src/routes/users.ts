/**
 * User API Routes
 */

import { Hono } from 'hono';
import prisma from '../db/client';

const users = new Hono();

/**
 * GET /users/:walletAddress
 * Returns user profile and stats
 */
users.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress').toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
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

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get game stats
    const gameStats = await prisma.game.aggregate({
      where: { userId: user.id },
      _sum: {
        betAmount: true,
        pnl: true,
      },
      _count: {
        _all: true,
      },
    });

    const wins = await prisma.game.count({
      where: {
        userId: user.id,
        outcome: { in: ['win', 'blackjack'] },
      },
    });

    return c.json({
      profile: {
        walletAddress: user.walletAddress,
        displayName:
          user.displayName || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`,
        avatarUrl: user.avatarUrl,
        xp: user.xp,
        level: user.level,
        vipTier: user.vipTier,
        referralCode: user.referralCode,
        memberSince: user.createdAt,
        lastSeen: user.lastSeenAt,
      },
      stats: {
        totalGames: user._count.games,
        totalWagered: gameStats._sum.betAmount || '0',
        totalPnL: gameStats._sum.pnl || '0',
        wins,
        losses: (gameStats._count._all || 0) - wins,
        winRate: gameStats._count._all ? ((wins / gameStats._count._all) * 100).toFixed(1) : '0',
        referrals: user._count.referees,
      },
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

/**
 * POST /users/register
 * Register or update a user (called on wallet connect)
 */
users.post('/register', async (c) => {
  const body = await c.req.json();
  const { walletAddress, displayName } = body;

  if (!walletAddress) {
    return c.json({ error: 'walletAddress required' }, 400);
  }

  try {
    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: {
        lastSeenAt: new Date(),
        ...(displayName && { displayName }),
      },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        displayName,
        referralCode: generateReferralCode(),
      },
    });

    return c.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        referralCode: user.referralCode,
        xp: user.xp,
        level: user.level,
        vipTier: user.vipTier,
      },
    });
  } catch (error) {
    console.error('User register error:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

/**
 * GET /users/:walletAddress/games
 * Returns user's game history
 */
users.get('/:walletAddress/games', async (c) => {
  const walletAddress = c.req.param('walletAddress').toLowerCase();
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { id: true },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const games = await prisma.game.findMany({
      where: { userId: user.id },
      orderBy: { endedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.game.count({
      where: { userId: user.id },
    });

    return c.json({
      games: games.map((g) => ({
        id: g.id,
        gameType: g.gameType,
        betAmount: g.betAmount,
        currency: g.currency,
        payout: g.payout,
        pnl: g.pnl,
        outcome: g.outcome,
        txHash: g.txHash,
        playedAt: g.endedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('User games error:', error);
    return c.json({ error: 'Failed to fetch games' }, 500);
  }
});

// Helper to generate unique referral codes
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default users;
