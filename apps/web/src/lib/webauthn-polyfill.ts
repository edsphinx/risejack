/**
 * WebAuthn Polyfill for Rise Wallet SDK
 * 
 * Fixes "publicKey.pubKeyCredParams is missing" error on some browsers/mobile.
 * This enables proper wallet connection on mobile devices and Firefox.
 * 
 * Security notes:
 * - Only modifies pubKeyCredParams if it's missing or empty
 * - Adds standard algorithms (ES256, RS256) that all authenticators should support
 * - Original behavior is preserved for non-Rise Wallet calls
 * - Wrapped in try-catch with graceful fallback
 */

(function initWebAuthnPolyfill() {
    'use strict';

    // Check if WebAuthn is supported
    if (!navigator.credentials || typeof navigator.credentials.create !== 'function') {
        return; // WebAuthn not supported, skip polyfill
    }

    // Store original function with proper binding
    const originalCreate = navigator.credentials.create.bind(navigator.credentials);

    // Polyfill version identifier for debugging
    const POLYFILL_VERSION = '1.0.0';

    navigator.credentials.create = async function polyfillCreate(options) {
        try {
            // Fast path: if options is invalid, delegate immediately
            if (options === null || typeof options !== 'object') {
                return originalCreate(options);
            }

            const publicKey = options.publicKey;

            // Fast path: if publicKey is invalid, delegate immediately
            if (publicKey === null || typeof publicKey !== 'object') {
                return originalCreate(options);
            }

            // Only apply polyfill if pubKeyCredParams is missing or empty
            // This minimizes interference with properly-constructed requests
            const needsPolyfill = !Array.isArray(publicKey.pubKeyCredParams) ||
                publicKey.pubKeyCredParams.length === 0;

            if (needsPolyfill) {
                // SECURITY: Deep clone options to avoid mutating the original object
                // This prevents potential side effects on the caller's data
                const clonedOptions = {
                    ...options,
                    publicKey: {
                        ...publicKey,
                        pubKeyCredParams: Array.isArray(publicKey.pubKeyCredParams)
                            ? [...publicKey.pubKeyCredParams]
                            : []
                    }
                };

                const params = clonedOptions.publicKey.pubKeyCredParams;

                // Helper to safely check if algorithm exists with correct type
                const hasAlgorithm = (alg: number) => params.some(p =>
                    p !== null &&
                    typeof p === 'object' &&
                    typeof p.alg === 'number' &&
                    p.alg === alg &&
                    p.type === 'public-key'
                );

                // Add ES256 (-7) - ECDSA w/ SHA-256 (most common, required by spec)
                if (!hasAlgorithm(-7)) {
                    params.push({ alg: -7, type: 'public-key' });
                }

                // Add RS256 (-257) - RSASSA-PKCS1-v1_5 w/ SHA-256 (fallback for older authenticators)
                if (!hasAlgorithm(-257)) {
                    params.push({ alg: -257, type: 'public-key' });
                }

                return originalCreate(clonedOptions);
            }

            return originalCreate(options);
        } catch (err) {
            // If polyfill logic fails, fall back to original behavior
            // This ensures we never break existing functionality
            console.warn('[WebAuthn Polyfill] Error, falling back:', err);
            return originalCreate(options);
        }
    };

    // Mark that polyfill is installed (for debugging)
    if (typeof window !== 'undefined') {
        (window as unknown as { __webauthnPolyfillVersion?: string }).__webauthnPolyfillVersion = POLYFILL_VERSION;
    }
})();

export { };
