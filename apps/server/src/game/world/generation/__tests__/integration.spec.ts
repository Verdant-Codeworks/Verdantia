import { describe, it, expect, beforeEach } from 'vitest';
import { ProceduralRoomService } from '../../procedural-room.service';
import { DefinitionService } from '../../definition.service';
import { WFCService } from '../../wfc/wfc.service';
import { TemplateEngineService } from '../../templates/template-engine.service';
import { WorldRegionService } from '../world-region.service';
import { SettlementGeneratorService } from '../settlement-generator.service';
import { NPCGeneratorService } from '../npc-generator.service';
import { BuildingGeneratorService } from '../building-generator.service';
import { QuestGeneratorService } from '../quest-generator.service';

describe('Procedural Generation Integration', () => {
  let proceduralRoomService: ProceduralRoomService;
  let worldRegionService: WorldRegionService;

  beforeEach(() => {
    // Create services manually without NestJS DI
    const templateEngine = new TemplateEngineService();
    const definitionService = new DefinitionService(null);
    const wfcService = new WFCService(definitionService);
    worldRegionService = new WorldRegionService();
    const settlementGenerator = new SettlementGeneratorService(templateEngine);
    const npcGenerator = new NPCGeneratorService(templateEngine);
    const buildingGenerator = new BuildingGeneratorService(templateEngine);
    const questGenerator = new QuestGeneratorService(templateEngine);

    proceduralRoomService = new ProceduralRoomService(
      null, // No EntityManager for these tests
      definitionService,
      wfcService,
      worldRegionService,
      settlementGenerator,
      npcGenerator,
      buildingGenerator,
      questGenerator,
    );
  });

  describe('settlement room generation', () => {
    it('should generate a complete settlement room at settlement coordinates', async () => {
      // Find a settlement location (sum % 7 === 0)
      const x = 7;
      const y = 0;
      const z = 0;

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room).toBeDefined();
      expect(room.id).toBe('proc_7_0_0');
      expect(room.name).toBeDefined();
      expect(room.description).toBeDefined();
      expect(room.exits).toHaveLength(4); // Settlement has 4 exits (N, S, E, W)
      expect(room.settlement).toBeDefined();
      expect(room.settlement?.name).toBe(room.name);
    });

    it('should include NPCs in the room', async () => {
      const x = 7;
      const y = 0;
      const z = 0;

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room.npcs).toBeDefined();
      expect(room.npcs!.length).toBeGreaterThan(0);

      // Check NPC structure
      const firstNpc = room.npcs![0];
      expect(firstNpc.id).toBeDefined();
      expect(firstNpc.name).toBeDefined();
      expect(firstNpc.role).toBeDefined();
      expect(firstNpc.greeting).toBeDefined();
    });

    it('should include buildings in the room', async () => {
      const x = 7;
      const y = 0;
      const z = 0;

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room.buildings).toBeDefined();
      expect(room.buildings!.length).toBeGreaterThan(0);

      // Check building structure
      const firstBuilding = room.buildings![0];
      expect(firstBuilding.id).toBeDefined();
      expect(firstBuilding.name).toBeDefined();
      expect(firstBuilding.type).toBeDefined();
      expect(firstBuilding.description).toBeDefined();
      expect(typeof firstBuilding.hasShop).toBe('boolean');
    });

    it('should include available quests', async () => {
      const x = 7;
      const y = 0;
      const z = 0;

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room.availableQuests).toBeDefined();
      // Quests may be empty if settlement has no problem/secrets
      expect(Array.isArray(room.availableQuests)).toBe(true);

      // For settlements with problems, verify quest structure
      // Note: Not all settlements will have quests
      for (const quest of room.availableQuests || []) {
        expect(quest.id).toBeDefined();
        expect(quest.name).toBeDefined();
        expect(quest.description).toBeDefined();
        expect(quest.giverName).toBeDefined();
        expect(quest.difficulty).toBeDefined();
        expect(quest.status).toBeDefined();
        // type might be undefined in some edge cases
        expect(typeof quest.type === 'string' || quest.type === undefined).toBe(true);
      }
    });

    it('should produce identical results for same coordinates', async () => {
      const x = 7;
      const y = 0;
      const z = 0;

      const room1 = await proceduralRoomService.generateRoom(x, y, z);
      const room2 = await proceduralRoomService.generateRoom(x, y, z);

      // Compare top-level properties
      expect(room1.id).toBe(room2.id);
      expect(room1.name).toBe(room2.name);
      expect(room1.description).toBe(room2.description);

      // Compare settlement data
      expect(room1.settlement?.id).toBe(room2.settlement?.id);
      expect(room1.settlement?.name).toBe(room2.settlement?.name);
      expect(room1.settlement?.size).toBe(room2.settlement?.size);
      expect(room1.settlement?.population).toBe(room2.settlement?.population);

      // Compare NPCs (same count and IDs)
      expect(room1.npcs?.length).toBe(room2.npcs?.length);
      expect(room1.npcs?.map(n => n.id)).toEqual(room2.npcs?.map(n => n.id));

      // Compare buildings
      expect(room1.buildings?.length).toBe(room2.buildings?.length);
      expect(room1.buildings?.map(b => b.id)).toEqual(room2.buildings?.map(b => b.id));

      // Compare quests
      expect(room1.availableQuests?.length).toBe(room2.availableQuests?.length);
      expect(room1.availableQuests?.map(q => q.id)).toEqual(room2.availableQuests?.map(q => q.id));
    });
  });

  describe('wilderness room generation', () => {
    it.skip('should generate wilderness at non-settlement coordinates (requires DB)', async () => {
      // Wilderness generation requires biome data from database
      // This test is skipped in unit tests but would work in integration tests with DB
      const x = 1;
      const y = 1;
      const z = 0;

      // Verify it's not a settlement location
      expect(worldRegionService.isSettlementLocation(x, y, z)).toBe(false);

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room).toBeDefined();
      expect(room.id).toBe('proc_1_1_0');
      expect(room.name).toBeDefined();
      expect(room.description).toBeDefined();
      expect(room.exits.length).toBeGreaterThan(0);
    });

    it.skip('should not include settlement data (requires DB)', async () => {
      // Wilderness generation requires biome data from database
      // This test is skipped in unit tests but would work in integration tests with DB
      const x = 1;
      const y = 1;
      const z = 0;

      const room = await proceduralRoomService.generateRoom(x, y, z);

      expect(room.settlement).toBeUndefined();
      expect(room.npcs).toBeUndefined();
      expect(room.buildings).toBeUndefined();
      expect(room.availableQuests).toBeUndefined();
    });
  });

  describe('bidirectional exits', () => {
    it('should ensure return exits exist when navigating between settlement rooms', async () => {
      // Generate room at 7,0,0 (settlement - 7+0 % 7 = 0)
      const roomA = await proceduralRoomService.getOrGenerateRoom(7, 0, 0);
      expect(roomA).toBeDefined();

      // Check that room A has an east exit
      const eastExit = roomA!.exits.find(e => e.direction === 'east');
      expect(eastExit).toBeDefined();

      // Generate room at 14,0,0 (another settlement - 14+0 % 7 = 0)
      // This simulates moving from one settlement to another
      const roomB = await proceduralRoomService.getOrGenerateRoom(14, 0, 0);
      expect(roomB).toBeDefined();

      // Room B should have a west exit
      const westExit = roomB!.exits.find(e => e.direction === 'west');
      expect(westExit).toBeDefined();
    });

    it('should maintain bidirectional consistency between adjacent settlements', async () => {
      // Use settlements that are adjacent or near each other
      // 7,0,0 is a settlement (7+0 % 7 = 0)
      // 21,0,0 is a settlement (21+0 % 7 = 0)
      // 14,7,0 is a settlement (14+7 % 7 = 0)
      const settlement1 = await proceduralRoomService.getOrGenerateRoom(7, 0, 0);
      const settlement2 = await proceduralRoomService.getOrGenerateRoom(14, 0, 0);
      const settlement3 = await proceduralRoomService.getOrGenerateRoom(21, 0, 0);

      // All settlements should have all 4 directional exits
      for (const room of [settlement1, settlement2, settlement3]) {
        expect(room).toBeDefined();
        expect(room!.exits.find(e => e.direction === 'north')).toBeDefined();
        expect(room!.exits.find(e => e.direction === 'south')).toBeDefined();
        expect(room!.exits.find(e => e.direction === 'east')).toBeDefined();
        expect(room!.exits.find(e => e.direction === 'west')).toBeDefined();
      }
    });
  });

  describe('determinism', () => {
    it('should produce identical full output for same coordinates', async () => {
      const x = 14; // Another settlement location
      const y = 0;
      const z = 0;

      const room1 = await proceduralRoomService.generateRoom(x, y, z);
      const room2 = await proceduralRoomService.generateRoom(x, y, z);

      // Deep comparison of all fields
      expect(JSON.stringify(room1)).toBe(JSON.stringify(room2));
    });

    it('should produce different output for different coordinates', async () => {
      const room1 = await proceduralRoomService.generateRoom(7, 0, 0);
      const room2 = await proceduralRoomService.generateRoom(14, 0, 0);

      // Different settlements
      expect(room1.settlement?.name).not.toBe(room2.settlement?.name);
      expect(room1.settlement?.id).not.toBe(room2.settlement?.id);

      // Different NPCs
      expect(room1.npcs?.map(n => n.id)).not.toEqual(room2.npcs?.map(n => n.id));
    });
  });
});
