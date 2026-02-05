import { describe, it, expect } from 'vitest';
import {
  XP_BASE,
  XP_EXPONENT,
  getXpForLevel,
  getXpProgress,
  getStatGains,
} from '../leveling';

describe('leveling', () => {
  describe('getXpForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(getXpForLevel(1)).toBe(0);
    });

    it('returns 0 for level 0 or below', () => {
      expect(getXpForLevel(0)).toBe(0);
      expect(getXpForLevel(-1)).toBe(0);
    });

    it('returns XP_BASE for level 2', () => {
      expect(getXpForLevel(2)).toBe(XP_BASE);
    });

    it('follows exponential curve', () => {
      // Level 3: floor(100 * 2^1.5) = floor(100 * 2.828...) = 282
      expect(getXpForLevel(3)).toBe(Math.floor(XP_BASE * Math.pow(2, XP_EXPONENT)));

      // Level 5: floor(100 * 4^1.5) = floor(100 * 8) = 800
      expect(getXpForLevel(5)).toBe(800);

      // Level 10: floor(100 * 9^1.5) = floor(100 * 27) = 2700
      expect(getXpForLevel(10)).toBe(2700);
    });

    it('has no level cap - works for high levels', () => {
      expect(getXpForLevel(20)).toBeGreaterThan(0);
      expect(getXpForLevel(50)).toBeGreaterThan(0);
      expect(getXpForLevel(100)).toBeGreaterThan(0);

      // XP should increase with each level
      expect(getXpForLevel(100)).toBeGreaterThan(getXpForLevel(50));
      expect(getXpForLevel(50)).toBeGreaterThan(getXpForLevel(20));
    });

    it('returns increasing values for consecutive levels', () => {
      for (let level = 2; level < 20; level++) {
        expect(getXpForLevel(level + 1)).toBeGreaterThan(getXpForLevel(level));
      }
    });
  });

  describe('getXpProgress', () => {
    it('returns 0 at the start of a level', () => {
      // At level 2 with exactly 100 XP (the threshold for level 2)
      expect(getXpProgress(100, 2)).toBe(0);
    });

    it('returns 100 when at next level threshold', () => {
      // Level 2 threshold: 100, Level 3 threshold: 282
      // At 282 XP while still level 2
      expect(getXpProgress(282, 2)).toBe(100);
    });

    it('returns correct percentage mid-progress', () => {
      // Level 2: 100 XP, Level 3: 282 XP
      // Mid-point would be 100 + (282-100)/2 = 191 XP = 50%
      const midpoint = 100 + (282 - 100) / 2;
      expect(getXpProgress(midpoint, 2)).toBeCloseTo(50, 1);
    });

    it('clamps to 0-100 range', () => {
      // Below current level threshold (edge case)
      expect(getXpProgress(50, 2)).toBe(0);

      // Way above next level threshold
      expect(getXpProgress(10000, 2)).toBe(100);
    });

    it('works for level 1', () => {
      // Level 1: 0 XP, Level 2: 100 XP
      expect(getXpProgress(0, 1)).toBe(0);
      expect(getXpProgress(50, 1)).toBe(50);
      expect(getXpProgress(100, 1)).toBe(100);
    });
  });

  describe('getStatGains', () => {
    it('returns base gains at level 1', () => {
      const gains = getStatGains(1);
      expect(gains.maxHp).toBe(5);
      expect(gains.attack).toBe(2);
      expect(gains.defense).toBe(1);
      expect(gains.speed).toBe(1);
    });

    it('scales gains with level', () => {
      const gainsL1 = getStatGains(1);
      const gainsL10 = getStatGains(10);

      // Level 10: scale = 1 + 0.1 * 9 = 1.9
      expect(gainsL10.maxHp).toBeGreaterThan(gainsL1.maxHp);
      expect(gainsL10.attack).toBeGreaterThan(gainsL1.attack);
    });

    it('applies multipliers correctly', () => {
      const gains = getStatGains(1, { maxHp: 2, attack: 1.5 });

      // Base maxHp = 5 * 2 = 10
      expect(gains.maxHp).toBe(10);
      // Base attack = 2 * 1.5 = 3
      expect(gains.attack).toBe(3);
      // defense/speed unchanged (no multiplier)
      expect(gains.defense).toBe(1);
      expect(gains.speed).toBe(1);
    });

    it('handles partial multipliers', () => {
      const gains = getStatGains(1, { maxHp: 2 });
      expect(gains.maxHp).toBe(10);
      expect(gains.attack).toBe(2); // Default multiplier of 1
    });

    it('floors results', () => {
      // Level 2: scale = 1.1
      // maxHp = floor(5 * 1.1) = floor(5.5) = 5
      // attack = floor(2 * 1.1) = floor(2.2) = 2
      const gains = getStatGains(2);
      expect(gains.maxHp).toBe(5);
      expect(gains.attack).toBe(2);
    });

    it('produces increasing gains at higher levels', () => {
      const gainsL5 = getStatGains(5);
      const gainsL15 = getStatGains(15);
      const gainsL25 = getStatGains(25);

      expect(gainsL15.maxHp).toBeGreaterThan(gainsL5.maxHp);
      expect(gainsL25.maxHp).toBeGreaterThan(gainsL15.maxHp);
    });
  });
});
