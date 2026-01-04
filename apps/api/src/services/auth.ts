/**
 * Auth Service
 *
 * Handles wallet-based JWT authentication using SIWE-style signature verification.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { verifyMessage, type Address } from 'viem';
import { randomBytes } from 'crypto';

// In-memory nonce store (use Redis in production for multi-instance)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Clean expired nonces every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of nonceStore.entries()) {
        if (value.expiresAt < now) {
            nonceStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

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
export function generateNonce(wallet: string): string {
    const normalizedWallet = wallet.toLowerCase();
    const nonce = randomBytes(32).toString('hex');

    // Store nonce with 5 minute expiration
    nonceStore.set(normalizedWallet, {
        nonce,
        expiresAt: Date.now() + 5 * 60 * 1000,
    });

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

    // Check nonce exists and is valid
    const stored = nonceStore.get(normalizedWallet);
    if (!stored || stored.expiresAt < Date.now()) {
        nonceStore.delete(normalizedWallet);
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
            nonceStore.delete(normalizedWallet);
        }

        return isValid;
    } catch {
        return false;
    }
}

/**
 * Create JWT token for authenticated user
 */
export async function createToken(
    wallet: string,
    userId?: string
): Promise<string> {
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
