/**
 * Middleware exports
 */

export { requireAdmin, sanitizeError, safeLog } from './admin';
export {
  isValidWalletAddress,
  isValidTxHash,
  isValidUUID,
  isValidReferralCode,
  isValidChainId,
  sanitizeString,
} from './validation';

/**
 * Validate and sanitize date range for queries.
 * Prevents DoS attacks from unbounded date range queries.
 *
 * @param days - Number of days to query
 * @param minDays - Minimum allowed days (default: 1)
 * @param maxDays - Maximum allowed days (default: 365)
 * @param defaultDays - Default if invalid (default: 7)
 */
export function sanitizeDateRange(
  days: number | string | undefined,
  minDays: number = 1,
  maxDays: number = 365,
  defaultDays: number = 7
): number {
  const parsed = typeof days === 'string' ? parseInt(days, 10) : days;

  if (parsed === undefined || parsed === null || isNaN(parsed)) {
    return defaultDays;
  }

  return Math.min(Math.max(minDays, Math.floor(parsed)), maxDays);
}
