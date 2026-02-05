import { describe, it, expect, beforeEach } from 'vitest';
import { NPCGeneratorService } from '../npc-generator.service';
import { SettlementGeneratorService } from '../settlement-generator.service';
import { TemplateEngineService } from '../../templates/template-engine.service';
import type { SettlementData } from '../settlement.types';

describe('NPCGeneratorService', () => {
  let npcService: NPCGeneratorService;
  let settlementService: SettlementGeneratorService;
  let testSettlement: SettlementData;

  beforeEach(() => {
    const templateEngine = new TemplateEngineService();
    npcService = new NPCGeneratorService(templateEngine);
    settlementService = new SettlementGeneratorService(templateEngine);

    // Create a test village for most tests
    testSettlement = settlementService.generate(0, 0, 0, 'village');
  });

  describe('generateForSettlement', () => {
    it('should generate NPCs for a hamlet', () => {
      const hamlet = settlementService.generate(1, 0, 0, 'hamlet');
      const npcs = npcService.generateForSettlement(hamlet);

      expect(npcs).toBeDefined();
      expect(npcs.length).toBeGreaterThan(0);

      // Hamlet should have at least innkeeper
      const innkeeper = npcs.find(npc => npc.role === 'innkeeper');
      expect(innkeeper).toBeDefined();
    });

    it('should generate more NPCs for larger settlements', () => {
      const hamlet = settlementService.generate(1, 0, 0, 'hamlet');
      const village = settlementService.generate(2, 7, 0, 'village');
      const town = settlementService.generate(3, 21, 0, 'town');
      const city = settlementService.generate(4, 63, 0, 'city');

      const hamletNpcs = npcService.generateForSettlement(hamlet);
      const villageNpcs = npcService.generateForSettlement(village);
      const townNpcs = npcService.generateForSettlement(town);
      const cityNpcs = npcService.generateForSettlement(city);

      expect(hamletNpcs.length).toBeLessThan(villageNpcs.length);
      expect(villageNpcs.length).toBeLessThan(townNpcs.length);
      expect(townNpcs.length).toBeLessThan(cityNpcs.length);
    });

    it('should include required roles for settlement size', () => {
      const town = settlementService.generate(0, 21, 0, 'town');
      const npcs = npcService.generateForSettlement(town);

      const roles = npcs.map(npc => npc.role);

      // Town should have key roles
      expect(roles).toContain('innkeeper');
      expect(roles).toContain('blacksmith');
      expect(roles).toContain('merchant');
      expect(roles).toContain('guard');
      expect(roles).toContain('priest');
      expect(roles).toContain('healer');
    });

    it('should produce identical results for same settlement', () => {
      const npcs1 = npcService.generateForSettlement(testSettlement);
      const npcs2 = npcService.generateForSettlement(testSettlement);

      expect(npcs1).toEqual(npcs2);
    });

    it('should produce different results for different settlements', () => {
      const settlement1 = settlementService.generate(0, 0, 0, 'village');
      const settlement2 = settlementService.generate(7, 0, 0, 'village');

      const npcs1 = npcService.generateForSettlement(settlement1);
      const npcs2 = npcService.generateForSettlement(settlement2);

      // Names should differ
      expect(npcs1[0].name).not.toBe(npcs2[0].name);
    });

    it('should always include a mayor', () => {
      const npcs = npcService.generateForSettlement(testSettlement);
      const mayor = npcs.find(npc => npc.role === 'mayor');

      expect(mayor).toBeDefined();
    });
  });

  describe('generateNPC', () => {
    it('should generate all required fields', () => {
      const npcs = npcService.generateForSettlement(testSettlement);
      const npc = npcs[0];

      expect(npc.id).toBeDefined();
      expect(npc.id).toMatch(/^npc_settlement_/);
      expect(npc.settlementId).toBe(testSettlement.id);
      expect(npc.name).toBeDefined();
      expect(npc.name.length).toBeGreaterThan(0);
      expect(npc.role).toBeDefined();
      expect(npc.personality).toBeDefined();
      expect(Array.isArray(npc.personality)).toBe(true);
      expect(npc.personality.length).toBeGreaterThan(0);
      expect(npc.personality.length).toBeLessThanOrEqual(3);
      expect(npc.secrets).toBeDefined();
      expect(Array.isArray(npc.secrets)).toBe(true);
      expect(npc.relationships).toBeDefined();
      expect(Array.isArray(npc.relationships)).toBe(true);
      expect(npc.greeting).toBeDefined();
      expect(npc.greeting.length).toBeGreaterThan(0);
      expect(npc.dialogueTopics).toBeDefined();
      expect(Array.isArray(npc.dialogueTopics)).toBe(true);
      expect(npc.dialogueTopics.length).toBeGreaterThan(0);
      expect(npc.wealth).toBeGreaterThanOrEqual(1);
      expect(npc.wealth).toBeLessThanOrEqual(10);
      expect(npc.age).toBeGreaterThanOrEqual(18);
      expect(npc.age).toBeLessThanOrEqual(70);
    });

    it('should generate culturally-appropriate names', () => {
      // Generate NPCs for different cultures
      const settlements = [
        settlementService.generate(1, 0, 0, 'village'),
        settlementService.generate(2, 0, 0, 'village'),
        settlementService.generate(3, 0, 0, 'village'),
      ];

      for (const settlement of settlements) {
        const npcs = npcService.generateForSettlement(settlement);

        // All NPCs should have first and last names
        for (const npc of npcs) {
          expect(npc.name).toContain(' ');
          const parts = npc.name.split(' ');
          expect(parts.length).toBeGreaterThanOrEqual(2);
          expect(parts[0].length).toBeGreaterThan(0);
          expect(parts[1].length).toBeGreaterThan(0);
        }
      }
    });

    it('should assign 1-3 personality traits', () => {
      const npcs = npcService.generateForSettlement(testSettlement);

      for (const npc of npcs) {
        expect(npc.personality.length).toBeGreaterThanOrEqual(1);
        expect(npc.personality.length).toBeLessThanOrEqual(3);
      }
    });

    it('should sometimes generate secrets (not always)', () => {
      // Generate many NPCs to test probability
      const settlements = [];
      for (let i = 0; i < 10; i++) {
        settlements.push(settlementService.generate(i * 7, 0, 0, 'village'));
      }

      const allNpcs = settlements.flatMap(s => npcService.generateForSettlement(s));
      const withSecrets = allNpcs.filter(npc => npc.secrets.length > 0);
      const withoutSecrets = allNpcs.filter(npc => npc.secrets.length === 0);

      // Should have both cases
      expect(withSecrets.length).toBeGreaterThan(0);
      expect(withoutSecrets.length).toBeGreaterThan(0);
    });

    it('should generate valid secret structures', () => {
      // Generate many NPCs to find ones with secrets
      const settlements = [];
      for (let i = 0; i < 20; i++) {
        settlements.push(settlementService.generate(i * 7, 0, 0, 'village'));
      }

      const allNpcs = settlements.flatMap(s => npcService.generateForSettlement(s));
      const npcWithSecret = allNpcs.find(npc => npc.secrets.length > 0);

      if (npcWithSecret) {
        const secret = npcWithSecret.secrets[0];
        expect(secret.type).toBeDefined();
        expect(secret.details).toBeDefined();
        expect(secret.details.length).toBeGreaterThan(0);
        expect(secret.revealCondition).toBeDefined();
      }
    });

    it('should assign appropriate dialogue topics for role', () => {
      const npcs = npcService.generateForSettlement(testSettlement);

      const innkeeper = npcs.find(npc => npc.role === 'innkeeper');
      if (innkeeper) {
        expect(innkeeper.dialogueTopics).toContain('local_rumors');
      }

      const blacksmith = npcs.find(npc => npc.role === 'blacksmith');
      if (blacksmith) {
        expect(blacksmith.dialogueTopics).toContain('weapons');
      }

      const guard = npcs.find(npc => npc.role === 'guard');
      if (guard) {
        expect(guard.dialogueTopics).toContain('security');
      }
    });

    it('should generate wealth appropriate to role', () => {
      const settlements = [];
      for (let i = 0; i < 5; i++) {
        settlements.push(settlementService.generate(i * 7, 0, 0, 'city'));
      }

      const allNpcs = settlements.flatMap(s => npcService.generateForSettlement(s));

      // Nobles should generally be wealthier than beggars
      const noble = allNpcs.find(npc => npc.role === 'noble');
      const beggar = allNpcs.find(npc => npc.role === 'beggar');

      if (noble && beggar) {
        expect(noble.wealth).toBeGreaterThan(beggar.wealth);
      }
    });
  });

  describe('generateRelationships', () => {
    it('should create relationships between NPCs', () => {
      const npcs = npcService.generateForSettlement(testSettlement);

      // At least some NPCs should have relationships
      const withRelationships = npcs.filter(npc => npc.relationships.length > 0);
      expect(withRelationships.length).toBeGreaterThan(0);
    });

    it('should create valid relationship structures', () => {
      const npcs = npcService.generateForSettlement(testSettlement);
      const npcWithRelationship = npcs.find(npc => npc.relationships.length > 0);

      if (npcWithRelationship) {
        const relationship = npcWithRelationship.relationships[0];
        expect(relationship.targetNpcId).toBeDefined();
        expect(relationship.targetNpcId).toMatch(/^npc_/);
        expect(relationship.type).toBeDefined();
        expect(['family', 'friend', 'rival', 'lover', 'enemy', 'business']).toContain(relationship.type);
        expect(relationship.description).toBeDefined();
        expect(relationship.description.length).toBeGreaterThan(0);
      }
    });

    it('should give mayor more relationships than regular NPCs', () => {
      const town = settlementService.generate(0, 21, 0, 'town');
      const npcs = npcService.generateForSettlement(town);

      const mayor = npcs.find(npc => npc.role === 'mayor');
      const farmer = npcs.find(npc => npc.role === 'farmer');

      if (mayor && farmer) {
        // Mayor should typically have more relationships
        expect(mayor.relationships.length).toBeGreaterThanOrEqual(farmer.relationships.length);
      }
    });

    it('should reference valid NPC IDs in relationships', () => {
      const npcs = npcService.generateForSettlement(testSettlement);
      const npcIds = new Set(npcs.map(npc => npc.id));

      for (const npc of npcs) {
        for (const relationship of npc.relationships) {
          expect(npcIds.has(relationship.targetNpcId)).toBe(true);
        }
      }
    });

    it('should not create self-referential relationships', () => {
      const npcs = npcService.generateForSettlement(testSettlement);

      for (const npc of npcs) {
        for (const relationship of npc.relationships) {
          expect(relationship.targetNpcId).not.toBe(npc.id);
        }
      }
    });
  });

  describe('determinism', () => {
    it('should produce identical NPCs for identical input', () => {
      const settlement1 = settlementService.generate(5, 10, 0, 'town');
      const settlement2 = settlementService.generate(5, 10, 0, 'town');

      const npcs1 = npcService.generateForSettlement(settlement1);
      const npcs2 = npcService.generateForSettlement(settlement2);

      expect(npcs1.length).toBe(npcs2.length);

      for (let i = 0; i < npcs1.length; i++) {
        expect(npcs1[i].name).toBe(npcs2[i].name);
        expect(npcs1[i].role).toBe(npcs2[i].role);
        expect(npcs1[i].personality).toEqual(npcs2[i].personality);
        expect(npcs1[i].age).toBe(npcs2[i].age);
        expect(npcs1[i].wealth).toBe(npcs2[i].wealth);
        expect(npcs1[i].greeting).toBe(npcs2[i].greeting);
      }
    });

    it('should produce different NPCs for different coordinates', () => {
      const settlement1 = settlementService.generate(0, 0, 0, 'village');
      const settlement2 = settlementService.generate(10, 0, 0, 'village');

      const npcs1 = npcService.generateForSettlement(settlement1);
      const npcs2 = npcService.generateForSettlement(settlement2);

      // At least names should differ
      expect(npcs1[0].name).not.toBe(npcs2[0].name);
    });
  });

  describe('economy-based roles', () => {
    it('should generate farmers for farming economy', () => {
      // Generate settlements until we get one with farming economy
      let farmingSettlement;
      for (let i = 0; i < 50; i++) {
        const settlement = settlementService.generate(i * 7, 0, 0, 'village');
        if (settlement.economy.includes('farming')) {
          farmingSettlement = settlement;
          break;
        }
      }

      if (farmingSettlement) {
        const npcs = npcService.generateForSettlement(farmingSettlement);
        const farmers = npcs.filter(npc => npc.role === 'farmer');
        expect(farmers.length).toBeGreaterThan(0);
      }
    });

    it('should generate miners for mining economy', () => {
      // Generate settlements until we get one with mining economy
      let miningSettlement;
      for (let i = 0; i < 50; i++) {
        const settlement = settlementService.generate(i * 7, 0, 0, 'village');
        if (settlement.economy.includes('mining')) {
          miningSettlement = settlement;
          break;
        }
      }

      if (miningSettlement) {
        const npcs = npcService.generateForSettlement(miningSettlement);
        const miners = npcs.filter(npc => npc.role === 'miner');
        expect(miners.length).toBeGreaterThan(0);
      }
    });

    it('should generate merchants for trading economy', () => {
      // Generate settlements until we get one with trading economy
      let tradingSettlement;
      for (let i = 0; i < 50; i++) {
        const settlement = settlementService.generate(i * 7, 0, 0, 'village');
        if (settlement.economy.includes('trading')) {
          tradingSettlement = settlement;
          break;
        }
      }

      if (tradingSettlement) {
        const npcs = npcService.generateForSettlement(tradingSettlement);
        const merchants = npcs.filter(npc => npc.role === 'merchant');
        expect(merchants.length).toBeGreaterThan(0);
      }
    });
  });
});
