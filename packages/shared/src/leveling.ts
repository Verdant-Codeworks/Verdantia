/**
 * Leveling system with exponential XP scaling and no level cap.
 */

export const XP_BASE = 100;
export const XP_EXPONENT = 1.5;

/**
 * Stat gain multipliers for extensibility (e.g., skill bonuses).
 */
export interface StatMultipliers {
  maxHp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

/**
 * Stat gains awarded on level up.
 */
export interface StatGains {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

/**
 * Calculate the total XP required to reach a given level.
 * Level 1 requires 0 XP (starting level).
 *
 * Formula: floor(XP_BASE * (level - 1)^XP_EXPONENT)
 *
 * Examples:
 * - Level 2: 100 XP
 * - Level 5: 800 XP
 * - Level 10: 2700 XP
 * - Level 20: 8300 XP
 */
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(XP_BASE * Math.pow(level - 1, XP_EXPONENT));
}

/**
 * Calculate XP progress percentage toward the next level (0-100).
 */
export function getXpProgress(currentXp: number, currentLevel: number): number {
  const currentThreshold = getXpForLevel(currentLevel);
  const nextThreshold = getXpForLevel(currentLevel + 1);
  const xpIntoLevel = currentXp - currentThreshold;
  const xpNeededForLevel = nextThreshold - currentThreshold;

  if (xpNeededForLevel <= 0) return 100;

  return Math.min(100, Math.max(0, (xpIntoLevel / xpNeededForLevel) * 100));
}

/**
 * Calculate stat gains for leveling up to the given level.
 * Stats scale with level: base gains increase by 10% per level.
 * Multipliers can be provided for skill/class bonuses.
 */
export function getStatGains(level: number, multipliers: StatMultipliers = {}): StatGains {
  const scale = 1 + 0.1 * (level - 1);
  return {
    maxHp: Math.floor(5 * scale * (multipliers.maxHp ?? 1)),
    attack: Math.floor(2 * scale * (multipliers.attack ?? 1)),
    defense: Math.floor(1 * scale * (multipliers.defense ?? 1)),
    speed: Math.floor(1 * scale * (multipliers.speed ?? 1)),
  };
}
