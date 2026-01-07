/**
 * Balance Events - Global event emitter for balance changes
 *
 * Used to notify all balance hooks to refresh when a transaction
 * modifies the user's token balances.
 *
 * This allows the header balance to update immediately after:
 * - Faucet claims
 * - Game wins/losses
 * - Token approvals
 * - Any other balance-changing transaction
 */

type BalanceEventListener = () => void;

const listeners: Set<BalanceEventListener> = new Set();

/**
 * Subscribe to balance change events
 * Returns unsubscribe function
 */
export function onBalanceChange(listener: BalanceEventListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Emit balance change event - all subscribed hooks will refresh
 * Call this after any transaction that modifies token balances
 */
export function emitBalanceChange(): void {
    listeners.forEach(listener => listener());
}
