/**
 * Referral API Routes
 */

import { Hono } from 'hono';
import prisma from '../db/client';

const referrals = new Hono();

/**
 * GET /referrals/:walletAddress
 * Returns referral stats for a user
 */
referrals.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress').toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        referralCode: true,
        referees: {
          select: {
            id: true,
            displayName: true,
            walletAddress: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get earnings summary
    const earnings = await prisma.referralEarning.aggregate({
      where: { referrerId: user.id },
      _sum: {
        earned: true,
      },
      _count: true,
    });

    // Get unclaimed earnings
    const unclaimed = await prisma.referralEarning.aggregate({
      where: {
        referrerId: user.id,
        claimed: false,
      },
      _sum: {
        earned: true,
      },
    });

    return c.json({
      referralCode: user.referralCode,
      referralLink: `https://risecasino.xyz/r/${user.referralCode}`,
      directReferrals: user.referees.length,
      referees: user.referees.map((r) => ({
        displayName:
          r.displayName || `${r.walletAddress.slice(0, 6)}...${r.walletAddress.slice(-4)}`,
        joinedAt: r.createdAt,
      })),
      stats: {
        totalEarnings: earnings._sum.earned || '0',
        totalTransactions: earnings._count,
        unclaimedEarnings: unclaimed._sum.earned || '0',
      },
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    return c.json({ error: 'Failed to fetch referral stats' }, 500);
  }
});

/**
 * GET /referrals/:walletAddress/history
 * Returns detailed earning history
 */
referrals.get('/:walletAddress/history', async (c) => {
  const walletAddress = c.req.param('walletAddress').toLowerCase();
  const limit = Number(c.req.query('limit')) || 50;
  const offset = Number(c.req.query('offset')) || 0;

  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { id: true },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const history = await prisma.referralEarning.findMany({
      where: { referrerId: user.id },
      include: {
        referee: {
          select: {
            displayName: true,
            walletAddress: true,
          },
        },
        game: {
          select: {
            gameType: true,
            txHash: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return c.json({
      history: history.map((h) => ({
        id: h.id,
        tier: h.tier,
        earned: h.earned,
        currency: h.currency,
        claimed: h.claimed,
        createdAt: h.createdAt,
        referee: {
          name: h.referee.displayName || `${h.referee.walletAddress.slice(0, 6)}...`,
        },
        game: {
          type: h.game.gameType,
          txHash: h.game.txHash,
        },
      })),
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Referral history error:', error);
    return c.json({ error: 'Failed to fetch referral history' }, 500);
  }
});

/**
 * POST /referrals/register
 * Register a referral link (called when user first connects with ?ref=CODE)
 */
referrals.post('/register', async (c) => {
  const body = await c.req.json();
  const { walletAddress, referralCode } = body;

  if (!walletAddress || !referralCode) {
    return c.json({ error: 'walletAddress and referralCode required' }, 400);
  }

  try {
    // Find referrer by code
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!referrer) {
      return c.json({ error: 'Invalid referral code' }, 400);
    }

    // Check if user exists and already has a referrer
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: { referrerId: true },
    });

    if (existingUser?.referrerId) {
      return c.json({ error: 'User already has a referrer' }, 400);
    }

    // Create or update user with referrer
    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { referrerId: referrer.id },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        referrerId: referrer.id,
        referralCode: generateReferralCode(),
      },
    });

    return c.json({
      success: true,
      message: 'Referral registered successfully',
      userReferralCode: user.referralCode,
    });
  } catch (error) {
    console.error('Referral register error:', error);
    return c.json({ error: 'Failed to register referral' }, 500);
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

export default referrals;
