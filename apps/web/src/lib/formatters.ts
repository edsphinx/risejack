/**
 * Formatters - Pure utility functions for formatting data
 * No side effects, no state, just data transformation
 */

/**
 * Shorten an Ethereum address for display
 * @example shortenAddress('0x1234567890abcdef...', 6, 4) => '0x1234...cdef'
 */
export function shortenAddress(
    address: string,
    prefixLength = 6,
    suffixLength = 4
): string {
    if (!address) return '';
    if (address.length <= prefixLength + suffixLength) return address;
    return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * Safely parse a string to number, returning fallback on NaN
 * Strips common suffixes like ETH, USD, etc before parsing
 */
export function safeParseNumber(value: string | null | undefined, fallback = 0): number {
    if (!value) return fallback;
    // Remove any non-numeric suffix (e.g., " ETH", " USD")
    const cleanValue = value.replace(/\s*[A-Za-z]+$/, '').trim();
    const num = Number(cleanValue);
    return isNaN(num) ? fallback : num;
}

/**
 * Format ETH balance for display with safe NaN handling
 * @param balance - Balance in wei as bigint or formatted string
 * @param decimals - Number of decimal places to show
 */
export function formatEthBalance(
    balance: string | null,
    decimals = 4
): string {
    if (!balance) return '...';
    try {
        const num = safeParseNumber(balance);
        return `${num.toFixed(decimals)} ETH`;
    } catch {
        return '-- ETH';
    }
}

/**
 * Format session time remaining
 */
export function formatSessionTime(time: {
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
} | null): string {
    if (!time || time.expired) return 'Expired';
    const parts: string[] = [];
    if (time.hours > 0) parts.push(`${time.hours}h`);
    if (time.minutes > 0) parts.push(`${time.minutes}m`);
    if (time.hours === 0) parts.push(`${time.seconds}s`);
    return parts.join(' ') || '0s';
}

/**
 * Format time elapsed (for game history)
 */
export function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Format crypto amount with symbol
 */
export function formatCryptoAmount(
    amount: number | string,
    symbol = 'ETH',
    decimals = 4
): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return `-- ${symbol}`;
    return `${num.toFixed(decimals)} ${symbol}`;
}
