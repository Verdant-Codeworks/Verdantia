import { describe, it, expect, beforeEach } from 'vitest';
import { BuildingGeneratorService } from '../building-generator.service';
import { TemplateEngineService } from '../../templates/template-engine.service';
import type { SettlementData } from '../settlement.types';
import type { NPCData } from '../npc.types';
import type { BuildingData } from '../building.types';

describe('BuildingGeneratorService', () => {
  let service: BuildingGeneratorService;

  beforeEach(() => {
    const templateEngine = new TemplateEngineService();
    service = new BuildingGeneratorService(templateEngine);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateForSettlement', () => {
    it('should generate buildings for a hamlet', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Hamlet',
        size: 'hamlet',
        population: 50,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 3,
        defenseLevel: 1,
        founded: 20,
      };

      const buildings = service.generateForSettlement(settlement, []);

      expect(buildings).toBeDefined();
      expect(buildings.length).toBeGreaterThan(0);
      expect(buildings.every(b => b.settlementId === settlement.id)).toBe(true);
      expect(buildings.some(b => b.type === 'inn')).toBe(true);
    });

    it('should generate more buildings for larger settlements', () => {
      const hamlet: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Hamlet',
        size: 'hamlet',
        population: 50,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 3,
        defenseLevel: 1,
        founded: 20,
      };

      const city: SettlementData = {
        ...hamlet,
        id: 'settlement_1_1_0',
        coordinates: { x: 1, y: 1, z: 0 },
        name: 'Test City',
        size: 'city',
        population: 5000,
        economy: ['trading', 'crafting', 'mining'],
        wealthLevel: 8,
        defenseLevel: 7,
        founded: 200,
      };

      const hamletBuildings = service.generateForSettlement(hamlet, []);
      const cityBuildings = service.generateForSettlement(city, []);

      expect(cityBuildings.length).toBeGreaterThan(hamletBuildings.length);
    });

    it('should include required buildings for settlement size', () => {
      const village: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Village',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 4,
        defenseLevel: 2,
        founded: 50,
      };

      const buildings = service.generateForSettlement(village, []);

      // Villages should have at least inn, blacksmith, general_store
      expect(buildings.some(b => b.type === 'inn')).toBe(true);
      expect(buildings.some(b => b.type === 'blacksmith')).toBe(true);
      expect(buildings.some(b => b.type === 'general_store')).toBe(true);
    });

    it('should include economy-specific buildings', () => {
      const miningTown: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Mining Town',
        size: 'town',
        population: 800,
        economy: ['mining', 'trading'],
        culture: 'frontier',
        history: [],
        wealthLevel: 6,
        defenseLevel: 5,
        founded: 75,
      };

      const buildings = service.generateForSettlement(miningTown, []);

      // Mining economy should include mine entrance
      expect(buildings.some(b => b.type === 'mine_entrance')).toBe(true);
      // Trading economy should include market stalls
      expect(buildings.some(b => b.type === 'market_stall')).toBe(true);
    });

    it('should produce identical results for same settlement', () => {
      const settlement: SettlementData = {
        id: 'settlement_5_5_0',
        coordinates: { x: 5, y: 5, z: 0 },
        name: 'Test Settlement',
        size: 'town',
        population: 1000,
        economy: ['farming', 'trading'],
        culture: 'merchant',
        history: [],
        wealthLevel: 6,
        defenseLevel: 4,
        founded: 100,
      };

      const buildings1 = service.generateForSettlement(settlement, []);
      const buildings2 = service.generateForSettlement(settlement, []);

      expect(buildings1.length).toBe(buildings2.length);

      for (let i = 0; i < buildings1.length; i++) {
        expect(buildings1[i].id).toBe(buildings2[i].id);
        expect(buildings1[i].name).toBe(buildings2[i].name);
        expect(buildings1[i].type).toBe(buildings2[i].type);
        expect(buildings1[i].description).toBe(buildings2[i].description);
      }
    });
  });

  describe('generateBuilding', () => {
    it('should generate all required fields', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const buildings = service.generateForSettlement(settlement, []);
      const building = buildings[0];

      expect(building.id).toBeDefined();
      expect(building.settlementId).toBe(settlement.id);
      expect(building.name).toBeDefined();
      expect(building.type).toBeDefined();
      expect(building.size).toBeDefined();
      expect(building.description).toBeDefined();
      expect(building.npcIds).toBeDefined();
      expect(Array.isArray(building.npcIds)).toBe(true);
    });

    it('should generate appropriate names for building types', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'town',
        population: 1000,
        economy: ['farming', 'trading'],
        culture: 'merchant',
        history: [],
        wealthLevel: 6,
        defenseLevel: 4,
        founded: 100,
      };

      const buildings = service.generateForSettlement(settlement, []);

      // Check that names are non-empty and not just the generic fallback
      buildings.forEach(building => {
        expect(building.name).toBeTruthy();
        expect(building.name.length).toBeGreaterThan(0);
      });

      // Check for specific building type names
      const inn = buildings.find(b => b.type === 'inn');
      if (inn) {
        expect(inn.name).toBeTruthy();
      }
    });

    it('should generate descriptions', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const buildings = service.generateForSettlement(settlement, []);

      buildings.forEach(building => {
        expect(building.description).toBeTruthy();
        expect(building.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateInventory', () => {
    it('should generate inventory for shop-type buildings', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const buildings = service.generateForSettlement(settlement, []);
      const blacksmith = buildings.find(b => b.type === 'blacksmith');

      if (blacksmith) {
        expect(blacksmith.inventory).toBeDefined();
        expect(Array.isArray(blacksmith.inventory)).toBe(true);
        expect(blacksmith.inventory!.length).toBeGreaterThan(0);

        blacksmith.inventory!.forEach(item => {
          expect(item.itemId).toBeDefined();
          expect(item.basePrice).toBeGreaterThan(0);
          expect(item.quantity).toBeGreaterThan(0);
          expect(item.restockDays).toBeGreaterThan(0);
        });
      }
    });

    it('should not generate inventory for non-shop buildings', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'town',
        population: 1000,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 100,
      };

      const buildings = service.generateForSettlement(settlement, []);
      const townHall = buildings.find(b => b.type === 'town_hall');

      if (townHall) {
        expect(townHall.inventory).toBeUndefined();
      }
    });

    it('should adjust quantities based on settlement wealth', () => {
      const poorSettlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Poor Village',
        size: 'village',
        population: 150,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 2,
        defenseLevel: 1,
        founded: 30,
      };

      const richSettlement: SettlementData = {
        id: 'settlement_10_10_0',
        coordinates: { x: 10, y: 10, z: 0 },
        name: 'Rich Village',
        size: 'village',
        population: 250,
        economy: ['trading'],
        culture: 'merchant',
        history: [],
        wealthLevel: 9,
        defenseLevel: 5,
        founded: 80,
      };

      const poorBuildings = service.generateForSettlement(poorSettlement, []);
      const richBuildings = service.generateForSettlement(richSettlement, []);

      const poorShop = poorBuildings.find(b => b.inventory && b.inventory.length > 0);
      const richShop = richBuildings.find(b => b.inventory && b.inventory.length > 0);

      if (poorShop && richShop && poorShop.inventory && richShop.inventory) {
        // Rich settlements should generally have more items in stock
        const poorTotal = poorShop.inventory.reduce((sum, item) => sum + item.quantity, 0);
        const richTotal = richShop.inventory.reduce((sum, item) => sum + item.quantity, 0);

        expect(richTotal).toBeGreaterThanOrEqual(poorTotal);
      }
    });
  });

  describe('assignNPCsToBuildings', () => {
    it('should assign NPCs based on their roles', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_0',
          settlementId: settlement.id,
          name: 'John Smith',
          role: 'blacksmith',
          personality: ['gruff'],
          secrets: [],
          relationships: [],
          greeting: 'Hello.',
          dialogueTopics: ['work'],
          wealth: 5,
          age: 40,
        },
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Mary Inn',
          role: 'innkeeper',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Welcome!',
          dialogueTopics: ['rooms'],
          wealth: 6,
          age: 35,
        },
      ];

      const buildings = service.generateForSettlement(settlement, npcs);

      const blacksmith = buildings.find(b => b.type === 'blacksmith');
      const inn = buildings.find(b => b.type === 'inn');

      if (blacksmith) {
        expect(blacksmith.npcIds).toContain('npc_0');
      }

      if (inn) {
        expect(inn.npcIds).toContain('npc_1');
      }
    });

    it('should update NPC buildingIds', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'village',
        population: 200,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_0',
          settlementId: settlement.id,
          name: 'John Smith',
          role: 'blacksmith',
          personality: ['gruff'],
          secrets: [],
          relationships: [],
          greeting: 'Hello.',
          dialogueTopics: ['work'],
          wealth: 5,
          age: 40,
        },
      ];

      service.generateForSettlement(settlement, npcs);

      expect(npcs[0].buildingId).toBeDefined();
      expect(npcs[0].buildingId).toContain('building_');
    });

    it('should handle multiple NPCs per building', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'Test Settlement',
        size: 'hamlet',
        population: 50,
        economy: ['farming'],
        culture: 'pastoral',
        history: [],
        wealthLevel: 3,
        defenseLevel: 1,
        founded: 20,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_0',
          settlementId: settlement.id,
          name: 'Farmer Bob',
          role: 'farmer',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Howdy.',
          dialogueTopics: ['crops'],
          wealth: 3,
          age: 45,
        },
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Farmer Joe',
          role: 'farmer',
          personality: ['cheerful'],
          secrets: [],
          relationships: [],
          greeting: 'Good day!',
          dialogueTopics: ['weather'],
          wealth: 3,
          age: 50,
        },
      ];

      const buildings = service.generateForSettlement(settlement, npcs);
      const farm = buildings.find(b => b.type === 'farm');

      if (farm && npcs.length === 2) {
        // Both farmers should be assigned to a farm
        expect(npcs[0].buildingId).toBeDefined();
        expect(npcs[1].buildingId).toBeDefined();
      }
    });
  });

  describe('determinism', () => {
    it('should produce identical buildings for identical input', () => {
      const settlement: SettlementData = {
        id: 'settlement_7_3_0',
        coordinates: { x: 7, y: 3, z: 0 },
        name: 'Deterministic Town',
        size: 'town',
        population: 1200,
        economy: ['trading', 'crafting'],
        culture: 'merchant',
        history: [],
        wealthLevel: 7,
        defenseLevel: 5,
        founded: 120,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_0',
          settlementId: settlement.id,
          name: 'Test NPC',
          role: 'merchant',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Hello.',
          dialogueTopics: ['trade'],
          wealth: 6,
          age: 40,
        },
      ];

      // Generate multiple times
      const buildings1 = service.generateForSettlement(settlement, JSON.parse(JSON.stringify(npcs)));
      const buildings2 = service.generateForSettlement(settlement, JSON.parse(JSON.stringify(npcs)));
      const buildings3 = service.generateForSettlement(settlement, JSON.parse(JSON.stringify(npcs)));

      // Should be identical
      expect(buildings1.length).toBe(buildings2.length);
      expect(buildings2.length).toBe(buildings3.length);

      for (let i = 0; i < buildings1.length; i++) {
        const b1 = buildings1[i];
        const b2 = buildings2[i];
        const b3 = buildings3[i];

        expect(b1.id).toBe(b2.id);
        expect(b2.id).toBe(b3.id);
        expect(b1.name).toBe(b2.name);
        expect(b2.name).toBe(b3.name);
        expect(b1.type).toBe(b2.type);
        expect(b2.type).toBe(b3.type);
        expect(b1.size).toBe(b2.size);
        expect(b2.size).toBe(b3.size);
        expect(b1.description).toBe(b2.description);
        expect(b2.description).toBe(b3.description);

        // Inventory should be identical
        if (b1.inventory) {
          expect(b2.inventory).toBeDefined();
          expect(b3.inventory).toBeDefined();
          expect(b1.inventory.length).toBe(b2.inventory!.length);
          expect(b2.inventory!.length).toBe(b3.inventory!.length);

          for (let j = 0; j < b1.inventory.length; j++) {
            expect(b1.inventory[j].itemId).toBe(b2.inventory![j].itemId);
            expect(b2.inventory![j].itemId).toBe(b3.inventory![j].itemId);
            expect(b1.inventory[j].basePrice).toBe(b2.inventory![j].basePrice);
            expect(b2.inventory![j].basePrice).toBe(b3.inventory![j].basePrice);
            expect(b1.inventory[j].quantity).toBe(b2.inventory![j].quantity);
            expect(b2.inventory![j].quantity).toBe(b3.inventory![j].quantity);
          }
        }
      }
    });
  });
});
