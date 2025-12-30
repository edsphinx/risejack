/**
 * Crypto Service - P256 key generation and signing
 * Handles all WebAuthn-compatible cryptographic operations.
 */

import { P256, Signature } from 'ox';

interface KeyPair {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
}

/**
 * Generate a new P256 key pair
 */
function generateKeyPair(): KeyPair {
  const privateKey = P256.randomPrivateKey();
  const publicKey = P256.getPublicKey({ privateKey });

  // Format public key as concatenated x,y coordinates
  const formattedPublicKey =
    `0x${publicKey.x.toString(16).padStart(64, '0')}${publicKey.y.toString(16).padStart(64, '0')}` as `0x${string}`;

  return {
    privateKey,
    publicKey: formattedPublicKey,
  };
}

/**
 * Sign a digest with a P256 private key
 * @param digest - The hash/digest to sign
 * @param privateKey - The P256 private key
 * @returns Signature in hex format
 */
function signDigest(digest: `0x${string}`, privateKey: `0x${string}`): `0x${string}` {
  const signature = P256.sign({
    payload: digest,
    privateKey,
  });

  return Signature.toHex(signature) as `0x${string}`;
}

export const CryptoService = {
  generateKeyPair,
  signDigest,
} as const;

export type { KeyPair };
