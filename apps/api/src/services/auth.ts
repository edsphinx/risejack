/**
 * Auth Service
 *
 * Handles wallet-based JWT authentication using SIWE-style signature verification.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { verifyMessage, type Address } from 'viem';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';

/**
 * Nonce Storage - Redis for production, in-memory for development
 *
 * Production: Uses Redis with automatic TTL (no manual cleanup needed)
 * Development: Uses in-memory Map with setInterval cleanup
 */

// Check if Redis is configured (use standard Redis URL format)
// Format: redis://default:PASSWORD@HOST:PORT
const REDIS_URL = process.env.REDIS_URL;
const USE_REDIS = !!REDIS_URL;

// Redis client (lazy initialized)
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient && REDIS_URL) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    redisClient.on('error', (err) => console.error('Redis connection error:', err));
    redisClient.on('connect', () => console.log('✅ Connected to Redis'));
  }
  return redisClient!;
}

// In-memory fallback for development (when no Redis URL)
const inMemoryNonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Clean expired nonces every 5 minutes (only for in-memory store)
if (!USE_REDIS) {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, value] of inMemoryNonceStore.entries()) {
        if (value.expiresAt < now) {
          inMemoryNonceStore.delete(key);
        }
      }
    },
    5 * 60 * 1000
  );
}

// Redis helper functions
async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!USE_REDIS) {
    // In-memory fallback
    inMemoryNonceStore.set(key, { nonce: value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return;
  }
  try {
    await getRedis().setex(key, ttlSeconds, value);
  } catch (error) {
    console.error('Redis SET error, using in-memory fallback:', error);
    inMemoryNonceStore.set(key, { nonce: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

async function redisGet(key: string): Promise<string | null> {
  if (!USE_REDIS) {
    // In-memory fallback
    const stored = inMemoryNonceStore.get(key);
    if (!stored || stored.expiresAt < Date.now()) {
      inMemoryNonceStore.delete(key);
      return null;
    }
    return stored.nonce;
  }
  try {
    return await getRedis().get(key);
  } catch (error) {
    console.error('Redis GET error, using in-memory fallback:', error);
    const stored = inMemoryNonceStore.get(key);
    return stored?.nonce || null;
  }
}

async function redisDel(key: string): Promise<void> {
  if (!USE_REDIS) {
    inMemoryNonceStore.delete(key);
    return;
  }
  try {
    await getRedis().del(key);
  } catch (error) {
    console.error('Redis DEL error:', error);
    inMemoryNonceStore.delete(key);
  }
}

export interface AuthPayload extends JWTPayload {
  wallet: string;
  userId?: string;
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Generate a nonce for wallet authentication
 */
export async function generateNonce(wallet: string): Promise<string> {
  const normalizedWallet = wallet.toLowerCase();
  const nonce = randomBytes(32).toString('hex');
  const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes

  // Store nonce with 5 minute expiration
  if (USE_REDIS) {
    await redisSet(`nonce:${normalizedWallet}`, nonce, NONCE_TTL_SECONDS);
  } else {
    inMemoryNonceStore.set(normalizedWallet, {
      nonce,
      expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000,
    });
  }

  return nonce;
}

/**
 * Get the expected message to be signed
 */
export function getSignMessage(wallet: string, nonce: string): string {
  return `Sign this message to authenticate with Rise Casino.\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

/**
 * Verify wallet signature and consume nonce
 */
export async function verifySignature(
  wallet: string,
  signature: string,
  message: string
): Promise<boolean> {
  const normalizedWallet = wallet.toLowerCase();

  // Get stored nonce (Redis or in-memory)
  let storedNonce: string | null = null;

  if (USE_REDIS) {
    storedNonce = await redisGet(`nonce:${normalizedWallet}`);
    if (!storedNonce) return false;
  } else {
    const stored = inMemoryNonceStore.get(normalizedWallet);
    if (!stored || stored.expiresAt < Date.now()) {
      inMemoryNonceStore.delete(normalizedWallet);
      return false;
    }
    storedNonce = stored.nonce;
  }

  // Extract nonce from message and verify it matches stored nonce
  const expectedMessage = getSignMessage(wallet, storedNonce);
  if (message !== expectedMessage) {
    return false;
  }

  // Verify the signature using viem
  try {
    const isValid = await verifyMessage({
      address: wallet as Address,
      message,
      signature: signature as `0x${string}`,
    });

    // Consume nonce (one-time use)
    if (isValid) {
      if (USE_REDIS) {
        await redisDel(`nonce:${normalizedWallet}`);
      } else {
        inMemoryNonceStore.delete(normalizedWallet);
      }
    }

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Create JWT token for authenticated user
 */
export async function createToken(wallet: string, userId?: string): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const expirationTime = parseExpiration(expiresIn);

  const token = await new SignJWT({ wallet: wallet.toLowerCase(), userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .setIssuer('rise-casino')
    .setAudience('rise-casino-api')
    .sign(getJwtSecret());

  return token;
}

/**
 * Verify JWT token and return payload
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: 'rise-casino',
      audience: 'rise-casino-api',
    });

    return payload as AuthPayload;
  } catch {
    return null;
  }
}

/**
 * Parse expiration string to Date
 */
function parseExpiration(exp: string): Date | string {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return exp;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}
