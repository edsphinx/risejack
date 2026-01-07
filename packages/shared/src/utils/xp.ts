/**
 * XP and Level Calculation Utils
 * 
 * Single source of truth for XP leveling system.
 * Uses exponential scaling: level = floor(sqrt(xp / BASE_XP))
 * 
 * @example
 * Level 1:  50 XP required
 * Level 2:  200 XP required
 * Level 10: 5,000 XP required
 * Level 50: 125,000 XP required
 */

// Base XP per level^2 (50 * level^2 = XP needed)
export const BASE_XP = 50;

/**
 * Calculate level from total XP using sqrt-based exponential scaling.
 * Formula: level = floor(sqrt(xp / BASE_XP))
 */
export function calculateLevelFromXp(xp: number): number {
    if (xp < BASE_XP) return 0;
    return Math.floor(Math.sqrt(xp / BASE_XP));
}

/**
 * Calculate XP required to reach a specific level.
 * Formula: xp = BASE_XP * level^2
 */
export function getXpRequiredForLevel(level: number): number {
    return BASE_XP * level * level;
}

/**
 * Get XP progress within current level.
 * Returns current level, progress percentage, and XP needed for next level.
 */
export function getLevelProgress(xp: number): {
    level: number;
    progress: number;
    xpToNext: number;
    currentLevelXp: number;
    nextLevelXp: number;
} {
    const level = calculateLevelFromXp(xp);
    const currentLevelXp = getXpRequiredForLevel(level);
    const nextLevelXp = getXpRequiredForLevel(level + 1);
    const xpInLevel = xp - currentLevelXp;
    const xpNeeded = nextLevelXp - currentLevelXp;
    const progress = xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 0;

    return {
        level,
        progress,
        xpToNext: nextLevelXp - xp,
        currentLevelXp,
        nextLevelXp,
    };
}

/**
 * Format XP for display (e.g., 12500 -> "12.5k")
 */
export function formatXp(xp: number): string {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`;
    return xp.toString();
}
