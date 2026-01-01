/**
 * Input Validation Utilities
 *
 * Provides validation functions for user inputs to prevent security issues.
 */

/**
 * Validate Ethereum wallet address format.
 * @param address - Address to validate
 * @returns true if valid Ethereum address format
 */
export function isValidWalletAddress(address: string | undefined | null): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Must be 42 characters (0x + 40 hex chars)
  if (address.length !== 42) {
    return false;
  }

  // Must start with 0x
  if (!address.startsWith('0x')) {
    return false;
  }

  // Must be valid hex after 0x
  const hexPart = address.slice(2);
  return /^[0-9a-fA-F]{40}$/.test(hexPart);
}

/**
 * Validate transaction hash format.
 * @param txHash - Transaction hash to validate
 * @returns true if valid transaction hash format
 */
export function isValidTxHash(txHash: string | undefined | null): boolean {
  if (!txHash || typeof txHash !== 'string') {
    return false;
  }

  // Must be 66 characters (0x + 64 hex chars)
  if (txHash.length !== 66) {
    return false;
  }

  // Must start with 0x
  if (!txHash.startsWith('0x')) {
    return false;
  }

  // Must be valid hex after 0x
  const hexPart = txHash.slice(2);
  return /^[0-9a-fA-F]{64}$/.test(hexPart);
}

/**
 * Validate UUID format.
 * @param id - UUID to validate
 * @returns true if valid UUID format
 */
export function isValidUUID(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validate referral code format.
 * Must be 8 alphanumeric characters.
 */
export function isValidReferralCode(code: string | undefined | null): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  return /^[A-Z0-9]{8}$/.test(code);
}

/**
 * Validate chain ID is a reasonable positive integer.
 */
export function isValidChainId(chainId: number | undefined | null): boolean {
  if (chainId === undefined || chainId === null) {
    return false;
  }

  // Must be positive integer, reasonable range (1 to 10 billion)
  return Number.isInteger(chainId) && chainId > 0 && chainId < 10_000_000_000;
}

/**
 * Sanitize a string for safe use (remove control characters, trim).
 */
export function sanitizeString(input: string | undefined | null, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove control characters (ASCII 0-31 and 127), trim, and enforce max length
  // Using character code filtering to avoid no-control-regex ESLint error
  return input
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127; // Keep printable ASCII only
    })
    .join('')
    .trim()
    .slice(0, maxLength);
}
