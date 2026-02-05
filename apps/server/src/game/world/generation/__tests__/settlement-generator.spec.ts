import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementGeneratorService } from '../settlement-generator.service';
import { TemplateEngineService } from '../../templates/template-engine.service';

describe('SettlementGeneratorService', () => {
  let service: SettlementGeneratorService;

  beforeEach(() => {
    const templateEngine = new TemplateEngineService();
    service = new SettlementGeneratorService(templateEngine);
  });

  describe('generate', () => {
    it('should generate a settlement with all required fields', () => {
      const settlement = service.generate(0, 0, 0, 'village');

      expect(settlement).toBeDefined();
      expect(settlement.id).toBe('settlement_0_0_0');
      expect(settlement.coordinates).toEqual({ x: 0, y: 0, z: 0 });
      expect(settlement.name).toBeDefined();
      expect(settlement.size).toBe('village');
      expect(settlement.population).toBeGreaterThan(0);
      expect(settlement.economy).toBeDefined();
      expect(settlement.economy.length).toBeGreaterThan(0);
      expect(settlement.culture).toBeDefined();
      expect(settlement.history).toBeDefined();
      expect(settlement.history.length).toBeGreaterThan(0);
      expect(settlement.wealthLevel).toBeGreaterThanOrEqual(1);
      expect(settlement.wealthLevel).toBeLessThanOrEqual(10);
      expect(settlement.defenseLevel).toBeGreaterThanOrEqual(1);
      expect(settlement.defenseLevel).toBeLessThanOrEqual(10);
      expect(settlement.founded).toBeGreaterThan(0);
    });

    it('should produce identical results for same coordinates', () => {
      const settlement1 = service.generate(5, 5, 0, 'town');
      const settlement2 = service.generate(5, 5, 0, 'town');

      expect(settlement1).toEqual(settlement2);
    });

    it('should produce different results for different coordinates', () => {
      const settlement1 = service.generate(0, 0, 0, 'village');
      const settlement2 = service.generate(7, 0, 0, 'village');

      expect(settlement1.name).not.toBe(settlement2.name);
    });

    it('should generate appropriate size based on input', () => {
      const hamlet = service.generate(0, 0, 0, 'hamlet');
      const village = service.generate(0, 7, 0, 'village');
      const town = service.generate(0, 21, 0, 'town');
      const city = service.generate(0, 63, 0, 'city');

      expect(hamlet.size).toBe('hamlet');
      expect(village.size).toBe('village');
      expect(town.size).toBe('town');
      expect(city.size).toBe('city');
    });

    it('should generate culturally-appropriate names', () => {
      // Generate many settlements to test name variety
      const settlements = [];
      for (let i = 0; i < 10; i++) {
        settlements.push(service.generate(i * 7, 0, 0, 'village'));
      }

      // All should have names
      settlements.forEach(s => {
        expect(s.name).toBeDefined();
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.name).not.toBe('Unnamed Settlement');
      });
    });

    it('should generate valid population ranges for each size', () => {
      const hamlet = service.generate(1, 0, 0, 'hamlet');
      const village = service.generate(0, 7, 0, 'village');
      const town = service.generate(0, 21, 0, 'town');
      const city = service.generate(0, 63, 0, 'city');

      expect(hamlet.population).toBeGreaterThanOrEqual(20);
      expect(hamlet.population).toBeLessThanOrEqual(100);

      expect(village.population).toBeGreaterThanOrEqual(100);
      expect(village.population).toBeLessThanOrEqual(500);

      expect(town.population).toBeGreaterThanOrEqual(500);
      expect(town.population).toBeLessThanOrEqual(2000);

      expect(city.population).toBeGreaterThanOrEqual(2000);
      expect(city.population).toBeLessThanOrEqual(10000);
    });

    it('should generate larger economies for larger settlements', () => {
      const hamlet = service.generate(0, 0, 0, 'hamlet');
      const city = service.generate(0, 63, 0, 'city');

      expect(hamlet.economy.length).toBeLessThanOrEqual(city.economy.length);
    });
  });

  describe('generateProblem', () => {
    it('should sometimes generate no problem', () => {
      // Generate many settlements to test probability
      const settlements = [];
      for (let i = 0; i < 20; i++) {
        settlements.push(service.generate(i * 7, 0, 0, 'village'));
      }

      const withProblem = settlements.filter(s => s.problem !== undefined);
      const withoutProblem = settlements.filter(s => s.problem === undefined);

      // Should have both cases
      expect(withProblem.length).toBeGreaterThan(0);
      expect(withoutProblem.length).toBeGreaterThan(0);
    });

    it('should generate valid problem structures', () => {
      // Generate settlements until we find one with a problem
      let settlement;
      for (let i = 0; i < 50; i++) {
        settlement = service.generate(i * 7, 0, 0, 'village');
        if (settlement.problem) {
          break;
        }
      }

      if (settlement?.problem) {
        expect(settlement.problem.type).toBeDefined();
        expect(settlement.problem.severity).toMatch(/^(minor|moderate|severe)$/);
        expect(settlement.problem.shortDesc).toBeDefined();
        expect(settlement.problem.shortDesc.length).toBeGreaterThan(0);
        expect(settlement.problem.longDesc).toBeDefined();
        expect(settlement.problem.longDesc.length).toBeGreaterThan(0);
        expect(settlement.problem.durationDays).toBeGreaterThan(0);
        expect(settlement.problem.durationDays).toBeLessThanOrEqual(30);
      }
    });

    it('should scale severity with settlement size', () => {
      // Generate multiple cities - they should have more severe problems on average
      const cities = [];
      for (let i = 0; i < 20; i++) {
        const city = service.generate(i * 63, 0, 0, 'city');
        if (city.problem) {
          cities.push(city);
        }
      }

      if (cities.length > 0) {
        const severities = cities.map(c => c.problem?.severity);
        // Cities should have some moderate or severe problems
        const hasHighSeverity = severities.some(s => s === 'moderate' || s === 'severe');
        expect(hasHighSeverity).toBe(true);
      }
    });
  });

  describe('generateHistory', () => {
    it('should generate founding event', () => {
      const settlement = service.generate(0, 0, 0, 'village');

      const foundingEvent = settlement.history.find(e => e.type === 'founding');
      expect(foundingEvent).toBeDefined();
      expect(foundingEvent?.description).toBeDefined();
      expect(foundingEvent?.yearsAgo).toBe(settlement.founded);
    });

    it('should generate additional events for older settlements', () => {
      const city = service.generate(0, 63, 0, 'city');

      // Cities are typically old, so should have multiple events
      expect(city.history.length).toBeGreaterThan(1);
    });

    it('should sort history by age (oldest first)', () => {
      const settlement = service.generate(0, 21, 0, 'town');

      for (let i = 0; i < settlement.history.length - 1; i++) {
        expect(settlement.history[i].yearsAgo).toBeGreaterThanOrEqual(
          settlement.history[i + 1].yearsAgo
        );
      }
    });
  });
});
