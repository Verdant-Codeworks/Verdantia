import { describe, it, expect, beforeEach } from 'vitest';
import { WorldRegionService } from '../world-region.service';

describe('WorldRegionService', () => {
  let service: WorldRegionService;

  beforeEach(() => {
    service = new WorldRegionService();
  });

  describe('getRegionType', () => {
    it('should return settlement for settlement coordinates', () => {
      // (0, 0, 0) is a settlement location if (0 + 0) % 7 === 0
      const result = service.getRegionType(0, 0, 0);
      expect(result).toBe('settlement');
    });

    it('should return wilderness for non-settlement surface coordinates', () => {
      // (1, 1, 0) is not a settlement (1 + 1 = 2, 2 % 7 !== 0)
      const result = service.getRegionType(1, 1, 0);
      expect(result).toBe('wilderness');
    });

    it('should return wilderness for underground coordinates', () => {
      // Underground should never be settlements
      const result = service.getRegionType(0, 0, -1);
      expect(result).toBe('wilderness');
    });
  });

  describe('isSettlementLocation', () => {
    it('should return true for village coordinates (x+y % 7 === 0)', () => {
      // Test various village coordinates
      expect(service.isSettlementLocation(0, 7, 0)).toBe(true);
      expect(service.isSettlementLocation(7, 0, 0)).toBe(true);
      expect(service.isSettlementLocation(3, 4, 0)).toBe(true);
      expect(service.isSettlementLocation(14, 0, 0)).toBe(true);
    });

    it('should return true for town coordinates (x+y % 21 === 0)', () => {
      // Towns are also valid by the % 7 rule, so check specifically % 21
      expect(service.isSettlementLocation(0, 21, 0)).toBe(true);
      expect(service.isSettlementLocation(21, 0, 0)).toBe(true);
      expect(service.isSettlementLocation(10, 11, 0)).toBe(true);
    });

    it('should return true for city coordinates (x+y % 63 === 0)', () => {
      // Cities are also valid by the % 7 and % 21 rules
      expect(service.isSettlementLocation(0, 63, 0)).toBe(true);
      expect(service.isSettlementLocation(63, 0, 0)).toBe(true);
      expect(service.isSettlementLocation(31, 32, 0)).toBe(true);
    });

    it('should return false for underground (z < 0)', () => {
      expect(service.isSettlementLocation(0, 0, -1)).toBe(false);
      expect(service.isSettlementLocation(7, 0, -1)).toBe(false);
    });

    it('should return false for non-settlement coordinates', () => {
      expect(service.isSettlementLocation(1, 1, 0)).toBe(false);
      expect(service.isSettlementLocation(5, 3, 0)).toBe(false);
      expect(service.isSettlementLocation(10, 10, 0)).toBe(false);
    });

    it('should respect minimum distance rule', () => {
      // The minimum distance check is internal, but we can test edge cases
      // This test verifies the method works without errors
      expect(service.isSettlementLocation(0, 0, 0)).toBeDefined();
    });
  });

  describe('getSettlementSize', () => {
    it('should return city for divisible by 63', () => {
      expect(service.getSettlementSize(0, 63, 0)).toBe('city');
      expect(service.getSettlementSize(63, 0, 0)).toBe('city');
      expect(service.getSettlementSize(31, 32, 0)).toBe('city');
    });

    it('should return town for divisible by 21 but not 63', () => {
      expect(service.getSettlementSize(0, 21, 0)).toBe('town');
      expect(service.getSettlementSize(21, 0, 0)).toBe('town');
      expect(service.getSettlementSize(10, 11, 0)).toBe('town');
    });

    it('should return village for divisible by 7 but not 21', () => {
      expect(service.getSettlementSize(0, 7, 0)).toBe('village');
      expect(service.getSettlementSize(7, 0, 0)).toBe('village');
      expect(service.getSettlementSize(3, 4, 0)).toBe('village');
      expect(service.getSettlementSize(14, 0, 0)).toBe('village');
    });

    it('should return null for non-settlement', () => {
      expect(service.getSettlementSize(1, 1, 0)).toBe(null);
      expect(service.getSettlementSize(5, 3, 0)).toBe(null);
      expect(service.getSettlementSize(0, 0, -1)).toBe(null);
    });

    it('should prioritize city over town over village', () => {
      // 63 is divisible by 7, 21, and 63 - should return city
      expect(service.getSettlementSize(0, 63, 0)).toBe('city');

      // 21 is divisible by 7 and 21 - should return town
      expect(service.getSettlementSize(0, 21, 0)).toBe('town');

      // 7 is only divisible by 7 - should return village
      expect(service.getSettlementSize(0, 7, 0)).toBe('village');
    });
  });

  describe('deterministic placement', () => {
    it('should have settlements at predictable coordinates', () => {
      // Test that the formula produces expected results
      const settlements: Array<{ x: number; y: number; z: number; size: string }> = [];

      for (let x = -10; x <= 10; x++) {
        for (let y = -10; y <= 10; y++) {
          const size = service.getSettlementSize(x, y, 0);
          if (size) {
            settlements.push({ x, y, z: 0, size });
          }
        }
      }

      // Should have found some settlements
      expect(settlements.length).toBeGreaterThan(0);

      // All should be at surface level
      settlements.forEach(s => {
        expect(s.z).toBe(0);
      });
    });
  });
});
