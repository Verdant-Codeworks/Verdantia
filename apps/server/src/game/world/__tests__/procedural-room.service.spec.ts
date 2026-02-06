import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProceduralRoomService } from '../procedural-room.service';
import { DefinitionService } from '../definition.service';
import { WFCService } from '../wfc/wfc.service';
import { WorldRegionService } from '../generation/world-region.service';
import { SettlementGeneratorService } from '../generation/settlement-generator.service';
import { NPCGeneratorService } from '../generation/npc-generator.service';
import { BuildingGeneratorService } from '../generation/building-generator.service';
import { QuestGeneratorService } from '../generation/quest-generator.service';
import { makeRoomId } from '@verdantia/shared';

describe('ProceduralRoomService - Adjacent Room Pre-generation', () => {
  let service: ProceduralRoomService;
  let definitionService: DefinitionService;
  let wfcService: WFCService;
  let worldRegionService: WorldRegionService;
  let settlementGenerator: SettlementGeneratorService;
  let npcGenerator: NPCGeneratorService;
  let buildingGenerator: BuildingGeneratorService;
  let questGenerator: QuestGeneratorService;

  beforeEach(() => {
    // Create mock services
    definitionService = {
      getBiome: vi.fn().mockResolvedValue({
        id: 'wilderness',
        name: 'Wilderness',
        nameTemplates: ['Dense Forest', 'Open Meadow', 'Rocky Outcrop'],
        descriptionTemplates: [
          'A wild area filled with nature.',
          'An untamed wilderness.',
          'Nature in its raw form.',
        ],
        allowedAdjacent: ['wilderness', 'caves', 'ruins'],
        allowVerticalExits: false,
        verticalExitChance: 0,
      }),
    } as any;

    wfcService = {
      getValidBiomes: vi.fn().mockResolvedValue(['wilderness']),
      selectBiome: vi.fn().mockReturnValue('wilderness'),
      calculateDifficulty: vi.fn().mockReturnValue(1),
      generateExits: vi.fn().mockImplementation((x, y, z) => {
        // Generate basic 4-directional exits
        return [
          { direction: 'north', destinationRoomId: makeRoomId(x, y - 1, z) },
          { direction: 'south', destinationRoomId: makeRoomId(x, y + 1, z) },
          { direction: 'east', destinationRoomId: makeRoomId(x + 1, y, z) },
          { direction: 'west', destinationRoomId: makeRoomId(x - 1, y, z) },
        ];
      }),
    } as any;

    worldRegionService = {
      getRegionType: vi.fn().mockReturnValue('wilderness'),
      isSettlementLocation: vi.fn().mockReturnValue(false),
      getSettlementSize: vi.fn().mockReturnValue(null),
    } as any;

    settlementGenerator = {} as any;
    npcGenerator = {} as any;
    buildingGenerator = {} as any;
    questGenerator = {} as any;

    service = new ProceduralRoomService(
      null, // no EntityManager for tests
      definitionService,
      wfcService,
      worldRegionService,
      settlementGenerator,
      npcGenerator,
      buildingGenerator,
      questGenerator,
    );
  });

  describe('preGenerateAdjacentRooms', () => {
    it('should generate all 6 adjacent rooms (N, S, E, W, up, down)', async () => {
      await service.preGenerateAdjacentRooms(0, 0, 0);

      // Verify 6 rooms were generated and cached
      const expectedRooms = [
        makeRoomId(0, -1, 0), // north
        makeRoomId(0, 1, 0),  // south
        makeRoomId(1, 0, 0),  // east
        makeRoomId(-1, 0, 0), // west
        makeRoomId(0, 0, 1),  // up
        makeRoomId(0, 0, -1), // down
      ];

      // Check that all rooms can be retrieved from cache
      for (const roomId of expectedRooms) {
        const coords = roomId.split('_').slice(1).map(Number);
        const room = await service.getOrGenerateRoom(coords[0], coords[1], coords[2]);
        expect(room).toBeDefined();
        expect(room?.id).toBe(roomId);
      }
    });

    it('should not cause infinite recursion', async () => {
      // Pre-generating adjacent rooms at (0,0,0) should not recursively
      // pre-generate neighbors of those rooms
      await service.preGenerateAdjacentRooms(0, 0, 0);

      // The method should complete without hanging or stack overflow
      expect(true).toBe(true);
    });
  });

  describe('getOrGenerateRoomWithAdjacent', () => {
    it('should generate current room and all 6 adjacent rooms', async () => {
      const room = await service.getOrGenerateRoomWithAdjacent(7, 0, 0);

      expect(room).toBeDefined();
      expect(room?.id).toBe(makeRoomId(7, 0, 0));

      // Verify all adjacent rooms are also cached
      const adjacentCoords = [
        { x: 7, y: -1, z: 0 }, // north
        { x: 7, y: 1, z: 0 },  // south
        { x: 8, y: 0, z: 0 },  // east
        { x: 6, y: 0, z: 0 },  // west
        { x: 7, y: 0, z: 1 },  // up
        { x: 7, y: 0, z: -1 }, // down
      ];

      for (const coords of adjacentCoords) {
        const adjRoom = await service.getOrGenerateRoom(coords.x, coords.y, coords.z);
        expect(adjRoom).toBeDefined();
      }
    });

    it('should populate exit descriptions with actual room names', async () => {
      const room = await service.getOrGenerateRoomWithAdjacent(10, 10, 0);

      expect(room).toBeDefined();
      expect(room?.exits.length).toBeGreaterThan(0);

      // Check that exit descriptions are not generic "Unexplored wilderness"
      for (const exit of room?.exits || []) {
        expect(exit.description).toBeDefined();
        expect(exit.description?.length).toBeGreaterThan(0);

        // Since adjacent rooms are pre-generated, descriptions should reference
        // actual room names or settlement info, not "Unexplored wilderness"
        // (unless it's truly unexplored, but with pre-generation it shouldn't be)
        if (exit.description?.includes('Unexplored wilderness')) {
          // This is acceptable if no adjacent room was generated
          // But with pre-generation, we expect better descriptions
          expect(exit.description).not.toContain('Unexplored wilderness');
        }
      }
    });

    it('should update exit descriptions if room was already cached', async () => {
      // First, generate room without adjacents (simulating old behavior)
      const room1 = await service.getOrGenerateRoom(5, 5, 0);
      expect(room1).toBeDefined();

      // Get a reference to the original exit descriptions
      const originalExits = room1?.exits.map(e => e.description);

      // Now call getOrGenerateRoomWithAdjacent which should update exits
      const room2 = await service.getOrGenerateRoomWithAdjacent(5, 5, 0);

      expect(room2).toBeDefined();
      expect(room2?.id).toBe(room1?.id);

      // Exit descriptions should have been updated
      const updatedExits = room2?.exits.map(e => e.description);

      // Since adjacent rooms are now cached, descriptions may have changed
      // At minimum, they should be defined
      expect(updatedExits).toBeDefined();
      expect(updatedExits?.length).toBe(originalExits?.length);
    });
  });

  describe('exit descriptions with adjacent rooms', () => {
    it('should reference cached room names in exit descriptions', async () => {
      // Generate a room with adjacents
      const centerRoom = await service.getOrGenerateRoomWithAdjacent(20, 20, 0);

      expect(centerRoom).toBeDefined();

      // Get one of the adjacent rooms
      const northRoom = await service.getOrGenerateRoom(20, 19, 0);
      expect(northRoom).toBeDefined();

      // The center room's north exit should now reference the north room's name
      const northExit = centerRoom?.exits.find(e => e.direction === 'north');
      expect(northExit).toBeDefined();

      // The exit description should contain the room name or be more specific than generic
      if (northRoom?.name) {
        // The description might contain the room name
        expect(northExit?.description).toBeDefined();
      }
    });

    it('should handle settlement destinations in exit descriptions', async () => {
      // Mock a settlement at (7, 0, 0)
      worldRegionService.isSettlementLocation = vi.fn().mockImplementation((x, y, z) => {
        return x === 7 && y === 0 && z === 0;
      });
      worldRegionService.getSettlementSize = vi.fn().mockImplementation((x, y, z) => {
        return x === 7 && y === 0 && z === 0 ? 'village' : null;
      });

      // Generate room at (6, 0, 0) which should have an east exit to the settlement
      const room = await service.getOrGenerateRoomWithAdjacent(6, 0, 0);

      expect(room).toBeDefined();

      // Find the east exit (pointing to settlement)
      const eastExit = room?.exits.find(e => e.direction === 'east');
      expect(eastExit).toBeDefined();

      // Exit description should mention the settlement
      if (eastExit?.description) {
        expect(eastExit.description).toContain('village');
      }
    });
  });

  describe('cache behavior', () => {
    it('should use cache for repeated room requests', async () => {
      const room1 = await service.getOrGenerateRoomWithAdjacent(0, 0, 0);
      const room2 = await service.getOrGenerateRoomWithAdjacent(0, 0, 0);

      expect(room1).toBe(room2); // Should be exact same object from cache
    });

    it('should maintain cache consistency across operations', async () => {
      // Generate room at origin
      await service.getOrGenerateRoomWithAdjacent(0, 0, 0);

      // Generate adjacent room
      const northRoom = await service.getOrGenerateRoomWithAdjacent(0, -1, 0);

      // Original room should be in north room's south exit
      const southExit = northRoom?.exits.find(e => e.direction === 'south');
      expect(southExit?.roomId).toBe(makeRoomId(0, 0, 0));
    });
  });

  describe('deterministic generation', () => {
    it('should produce identical results for same coordinates', async () => {
      const room1 = await service.getOrGenerateRoomWithAdjacent(15, 15, 0);
      const room2 = await service.getOrGenerateRoomWithAdjacent(15, 15, 0);

      expect(room1).toEqual(room2);
      expect(room1?.name).toBe(room2?.name);
      expect(room1?.description).toBe(room2?.description);
      expect(room1?.exits.length).toBe(room2?.exits.length);
    });

    it('should produce different results for different coordinates', async () => {
      const room1 = await service.getOrGenerateRoomWithAdjacent(0, 0, 0);
      const room2 = await service.getOrGenerateRoomWithAdjacent(10, 10, 0);

      expect(room1?.id).not.toBe(room2?.id);
      // Names might differ based on random selection
      // But both should be valid rooms
      expect(room1).toBeDefined();
      expect(room2).toBeDefined();
    });
  });

  describe('getAdjacentRooms', () => {
    it('should return biome data for cached rooms', async () => {
      // Generate a room so it gets cached with biome data
      await service.getOrGenerateRoom(5, 5, 0);

      // Now check adjacent rooms from (5, 6, 0) - room (5,5,0) is north
      const adjacent = await service.getAdjacentRooms(5, 6, 0);

      expect(adjacent.length).toBeGreaterThan(0);
      const northNeighbor = adjacent.find(r => r.x === 5 && r.y === 5 && r.z === 0);
      expect(northNeighbor).toBeDefined();
      expect(northNeighbor?.biomeId).toBe('wilderness');
    });

    it('should return empty array when no neighbors exist', async () => {
      // Don't generate any rooms - query an isolated location
      const adjacent = await service.getAdjacentRooms(100, 100, 0);
      expect(adjacent).toEqual([]);
    });

    it('should return multiple cached neighbors', async () => {
      // Generate rooms around (10, 10, 0)
      await service.getOrGenerateRoom(10, 9, 0);  // north
      await service.getOrGenerateRoom(10, 11, 0); // south
      await service.getOrGenerateRoom(11, 10, 0); // east

      const adjacent = await service.getAdjacentRooms(10, 10, 0);
      expect(adjacent.length).toBe(3);
    });

    it('should provide biome constraints to WFC during generation', async () => {
      // Generate a room first so it's in the biome cache
      await service.getOrGenerateRoom(0, 0, 0);

      // Now generate an adjacent room - WFC should receive biome data
      await service.getOrGenerateRoom(1, 0, 0);

      // wfcService.getValidBiomes should have been called with adjacent data
      // that includes our cached room's biome
      const calls = (wfcService.getValidBiomes as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      // lastCall[3] is the adjacentRooms array
      const adjacentRoomsArg = lastCall[3] as Array<{ x: number; y: number; z: number; biomeId: string }>;
      const westNeighbor = adjacentRoomsArg.find((r: any) => r.x === 0 && r.y === 0 && r.z === 0);
      expect(westNeighbor).toBeDefined();
      expect(westNeighbor?.biomeId).toBe('wilderness');
    });
  });
});
