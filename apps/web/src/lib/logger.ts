/// <reference types="vite/client" />

/**
 * Environment-aware logger
 * Only outputs logs in development mode to prevent
 * exposing sensitive information in production
 */
const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) console.log(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
    error: (...args: unknown[]) => {
        // Always log errors, even in production
        console.error(...args);
    },
};
