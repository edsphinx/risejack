/**
 * Clear Rise Wallet's IndexedDB data (porto database)
 * This forces a fresh connection on next attempt
 */
export async function clearRiseWalletData(): Promise<boolean> {
    try {
        // First, clear localStorage entries related to porto/rise wallet
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('porto') || key.includes('rise') || key.includes('wagmi') || key.includes('risejack'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Try to clear IndexedDB 'porto' database
        let wasBlocked = false;
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase('porto');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                // Database is blocked by active connections
                console.warn('IndexedDB deletion blocked by active connections');
                wasBlocked = true;
                resolve();
            };
        });

        // If IndexedDB was blocked, we need to force close connections
        // The only reliable way is to reload the page
        if (wasBlocked) {
            console.log('🔧 IndexedDB blocked - will retry deletion after reload...');
            // Set a flag so we know to delete on next load
            sessionStorage.setItem('risejack.pendingDbDelete', 'true');
            // Return true - the modal will trigger a reload
            return true;
        }

        console.log('🔧 Rise Wallet data cleared successfully');
        return true;
    } catch (error) {
        console.error('Failed to clear Rise Wallet data:', error);
        return false;
    }
}

/**
 * Check if there's a pending database deletion from a blocked attempt
 * Call this on app startup
 */
export async function checkPendingDbDelete(): Promise<void> {
    if (sessionStorage.getItem('risejack.pendingDbDelete') === 'true') {
        sessionStorage.removeItem('risejack.pendingDbDelete');
        console.log('🔧 Completing pending database deletion...');

        // Now the old connections should be closed, try again
        await new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase('porto');
            request.onsuccess = () => {
                console.log('🔧 Porto database deleted successfully');
                resolve();
            };
            request.onerror = () => {
                console.warn('🔧 Porto database deletion failed, but continuing...');
                resolve();
            };
            request.onblocked = () => {
                console.warn('🔧 Porto database still blocked, may need browser restart');
                resolve();
            };
        });
    }
}

/**
 * Check if an error indicates corrupted wallet state
 * These errors often occur when IndexedDB data is stale or corrupted
 */
export function isCorruptedStateError(error: unknown): boolean {
    if (!error) return false;

    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Patterns that indicate corrupted state rather than user action
    const corruptionPatterns = [
        'user rejected',
        'userrejectedrequesterror',
        'request was rejected',
        'connection was cancelled',
    ];

    return corruptionPatterns.some((pattern) => lowerMessage.includes(pattern));
}

/**
 * Storage key for tracking failed attempts
 */
const FAILED_ATTEMPTS_KEY = 'risejack.walletFailedAttempts';
const FAILURE_WINDOW_MS = 60000; // 1 minute window

interface FailureRecord {
    count: number;
    firstFailure: number;
}

/**
 * Record a connection failure
 * Returns the number of consecutive failures
 */
export function recordConnectionFailure(): number {
    try {
        const stored = localStorage.getItem(FAILED_ATTEMPTS_KEY);
        const record: FailureRecord = stored ? JSON.parse(stored) : { count: 0, firstFailure: 0 };
        const now = Date.now();

        // Reset if outside the failure window
        if (now - record.firstFailure > FAILURE_WINDOW_MS) {
            record.count = 1;
            record.firstFailure = now;
        } else {
            record.count += 1;
        }

        localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(record));
        return record.count;
    } catch {
        return 1;
    }
}

/**
 * Clear failure record (call on successful connection)
 */
export function clearConnectionFailures(): void {
    try {
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    } catch {
        // Ignore
    }
}

/**
 * Get current failure count
 */
export function getFailureCount(): number {
    try {
        const stored = localStorage.getItem(FAILED_ATTEMPTS_KEY);
        if (!stored) return 0;
        const record: FailureRecord = JSON.parse(stored);
        const now = Date.now();
        // Check if within window
        if (now - record.firstFailure > FAILURE_WINDOW_MS) {
            return 0;
        }
        return record.count;
    } catch {
        return 0;
    }
}
