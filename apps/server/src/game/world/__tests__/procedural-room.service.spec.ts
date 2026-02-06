import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProceduralRoomService } from '../procedural-room.service';
import { DungeonFloorService } from '../dungeon/dungeon-floor.service';
import { makeRoomId } from '@verdantia/shared';
import type { FloorLayout, FloorCell } from '../dungeon/dungeon.types';

function createMockFloorLayout(depth = 0): FloorLayout {
  const cells = new Map<string, FloorCell>();

  // Create a simple 4-room layout: entrance at 0,0, rooms at 1,0 and 0,1 and 1,1
  cells.set('0,0', {
    x: 0,
    y: 0,
    exits: ['east', 'south'],
    roomTypeId: 'entrance',
    isEntrance: true,
    isStairsDown: false,
    distanceFromEntrance: 0,
  });
  cells.set('1,0', {
    x: 1,
    y: 0,
    exits: ['west', 'south'],
    roomTypeId: 'crystal_cavern',
    isEntrance: false,
    isStairsDown: false,
    distanceFromEntrance: 1,
  });
  cells.set('0,1', {
    x: 0,
    y: 1,
    exits: ['north', 'east'],
    roomTypeId: 'narrow_crevice',
    isEntrance: false,
    isStairsDown: false,
    distanceFromEntrance: 1,
  });
  cells.set('1,1', {
    x: 1,
    y: 1,
    exits: ['north', 'west'],
    roomTypeId: 'stairs',
    isEntrance: false,
    isStairsDown: true,
    distanceFromEntrance: 2,
  });

  return {
    depth,
    biomeId: 'caves',
    difficulty: 1 + Math.abs(depth),
    roomCount: 4,
    seed: 12345,
    cells,
    stairsDownCoord: { x: 1, y: 1 },
    stairsUpTarget: depth === 0 ? 'wilderness_portal' : `proc_1_1_${depth + 1}`,
  };
}

describe('ProceduralRoomService - Dungeon Floor Integration', () => {
  let service: ProceduralRoomService;
  let dungeonFloorService: DungeonFloorService;
  let mockFloor: FloorLayout;

  beforeEach(() => {
    mockFloor = createMockFloorLayout(0);

    // Mock DungeonFloorService
    dungeonFloorService = {
      getFloor: vi.fn().mockReturnValue(mockFloor),
      getCellAt: vi.fn().mockImplementation((_depth, x, y) => mockFloor.cells.get(`${x},${y}`)),
      isValidRoom: vi.fn().mockImplementation((_depth, x, y) => mockFloor.cells.has(`${x},${y}`)),
      getRoomType: vi.fn().mockImplementation((_biomeId, roomTypeId) => {
        if (roomTypeId === 'entrance') {
          return { name: 'Dungeon Entrance', description: 'The entrance to the dungeon.' };
        }
        if (roomTypeId === 'stairs') {
          return { name: 'Deep Stairwell', description: 'A stairwell descending deeper.' };
        }
        if (roomTypeId === 'crystal_cavern') {
          return {
            id: 'crystal_cavern',
            name: 'Crystal Cavern',
            description: 'A cavern filled with gleaming crystals.',
            weight: 2,
          };
        }
        if (roomTypeId === 'narrow_crevice') {
          return {
            id: 'narrow_crevice',
            name: 'Narrow Crevice',
            description: 'A tight passage between rock walls.',
            weight: 1,
          };
        }
        return { name: 'Unknown Chamber', description: 'A mysterious chamber.' };
      }),
    } as any;

    service = new ProceduralRoomService(
      null, // no EntityManager
      dungeonFloorService,
    );
  });

  describe('room generation respects floor boundaries', () => {
    it('should generate room for valid coordinates', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      expect(room?.id).toBe(makeRoomId(0, 0, 0));
      expect(room?.name).toBe('Dungeon Entrance');
    });

    it('should return undefined for out-of-bounds coordinates', async () => {
      const room = await service.getOrGenerateRoom(10, 10, 0);

      expect(room).toBeUndefined();
      expect(dungeonFloorService.isValidRoom).toHaveBeenCalledWith(0, 10, 10);
    });

    it('should handle negative coordinates that are valid', async () => {
      // Update mock to have a valid room at negative coords
      mockFloor.cells.set('-1,0', {
        x: -1,
        y: 0,
        exits: ['east'],
        roomTypeId: 'crystal_cavern',
        isEntrance: false,
        isStairsDown: false,
        distanceFromEntrance: 1,
      });

      const room = await service.getOrGenerateRoom(-1, 0, 0);

      expect(room).toBeDefined();
      expect(room?.id).toBe(makeRoomId(-1, 0, 0));
    });
  });

  describe('room exits match floor layout', () => {
    it('should create exits from floor cell exit list', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      const cardinalExits = room?.exits.filter(e => ['north', 'south', 'east', 'west'].includes(e.direction));
      expect(cardinalExits?.length).toBe(2); // east and south from mock
      expect(cardinalExits?.some(e => e.direction === 'east')).toBe(true);
      expect(cardinalExits?.some(e => e.direction === 'south')).toBe(true);
    });

    it('should include correct destination room IDs for cardinal exits', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      const eastExit = room?.exits.find(e => e.direction === 'east');
      expect(eastExit?.roomId).toBe(makeRoomId(1, 0, 0));

      const southExit = room?.exits.find(e => e.direction === 'south');
      expect(southExit?.roomId).toBe(makeRoomId(0, 1, 0));
    });

    it('should add exit descriptions referencing adjacent room names', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      const eastExit = room?.exits.find(e => e.direction === 'east');
      expect(eastExit?.description).toContain('Crystal Cavern');
      expect(eastExit?.description).toContain('east');
    });
  });

  describe('stair rooms', () => {
    it('should add up exit for entrance room', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      const upExit = room?.exits.find(e => e.direction === 'up');
      expect(upExit).toBeDefined();
      expect(upExit?.roomId).toBe('wilderness_portal');
      expect(upExit?.description).toContain('Stairs lead back to the upper level');
    });

    it('should add down exit for stairs room', async () => {
      const room = await service.getOrGenerateRoom(1, 1, 0);

      expect(room).toBeDefined();
      const downExit = room?.exits.find(e => e.direction === 'down');
      expect(downExit).toBeDefined();
      expect(downExit?.roomId).toBe(makeRoomId(0, 0, -1)); // entrance of next floor
      expect(downExit?.description).toContain('descends deeper');
    });

    it('should use correct stairsUpTarget for deeper floors', async () => {
      mockFloor = createMockFloorLayout(-1);
      dungeonFloorService.getFloor = vi.fn().mockReturnValue(mockFloor);

      const room = await service.getOrGenerateRoom(0, 0, -1);

      expect(room).toBeDefined();
      const upExit = room?.exits.find(e => e.direction === 'up');
      expect(upExit?.roomId).toBe('proc_1_1_0'); // stairs of floor above
    });

    it('should not have up exit for non-entrance rooms', async () => {
      const room = await service.getOrGenerateRoom(1, 0, 0);

      expect(room).toBeDefined();
      const upExit = room?.exits.find(e => e.direction === 'up');
      expect(upExit).toBeUndefined();
    });

    it('should not have down exit for non-stairs rooms', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      const downExit = room?.exits.find(e => e.direction === 'down');
      expect(downExit).toBeUndefined();
    });
  });

  describe('biome uniformity', () => {
    it('should use floor biome for all rooms', async () => {
      const room1 = await service.getOrGenerateRoom(0, 0, 0);
      const room2 = await service.getOrGenerateRoom(1, 0, 0);

      expect(room1).toBeDefined();
      expect(room2).toBeDefined();

      // Both rooms should use caves biome
      expect(dungeonFloorService.getRoomType).toHaveBeenCalledWith('caves', expect.any(String));
    });

    it('should cache biome for generated rooms', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room).toBeDefined();
      // Biome should be cached (can't directly test private cache, but second call won't regenerate)
      const room2 = await service.getOrGenerateRoom(0, 0, 0);
      expect(room2).toBe(room); // Same instance from cache
    });
  });

  describe('caching behavior', () => {
    it('should return cached room on subsequent requests', async () => {
      const room1 = await service.getOrGenerateRoom(0, 0, 0);
      const room2 = await service.getOrGenerateRoom(0, 0, 0);

      expect(room1).toBe(room2); // Exact same object
    });

    it('should use cache for multiple different rooms', async () => {
      const room1 = await service.getOrGenerateRoom(0, 0, 0);
      const room2 = await service.getOrGenerateRoom(1, 0, 0);
      const room3 = await service.getOrGenerateRoom(0, 1, 0);

      expect(room1).toBeDefined();
      expect(room2).toBeDefined();
      expect(room3).toBeDefined();
      expect(room1?.id).not.toBe(room2?.id);
      expect(room2?.id).not.toBe(room3?.id);

      // Second request should hit cache
      const room1Again = await service.getOrGenerateRoom(0, 0, 0);
      expect(room1Again).toBe(room1);
    });
  });

  describe('deterministic generation', () => {
    it('should produce identical rooms for same coordinates', async () => {
      const room1 = await service.getOrGenerateRoom(0, 0, 0);

      // Clear cache to force regeneration
      await (service as any).roomCache.clear();

      const room2 = await service.getOrGenerateRoom(0, 0, 0);

      expect(room1?.name).toBe(room2?.name);
      expect(room1?.description).toBe(room2?.description);
      expect(room1?.exits.length).toBe(room2?.exits.length);
    });

    it('should produce different seeds for different coordinates', async () => {
      const room1 = await service.getOrGenerateRoom(0, 0, 0);
      const room2 = await service.getOrGenerateRoom(1, 1, 0);

      expect(room1?.id).not.toBe(room2?.id);
      expect(room1?.name).not.toBe(room2?.name); // Different room types
    });
  });

  describe('multiple floors', () => {
    it('should handle different depths correctly', async () => {
      // Floor 0
      const room0 = await service.getOrGenerateRoom(0, 0, 0);
      expect(room0).toBeDefined();

      // Floor -1
      mockFloor = createMockFloorLayout(-1);
      dungeonFloorService.getFloor = vi.fn().mockReturnValue(mockFloor);
      dungeonFloorService.isValidRoom = vi.fn().mockImplementation((_depth, x, y) => mockFloor.cells.has(`${x},${y}`));

      const roomNeg1 = await service.getOrGenerateRoom(0, 0, -1);
      expect(roomNeg1).toBeDefined();
      expect(roomNeg1?.id).toBe(makeRoomId(0, 0, -1));
    });

    it('should calculate difficulty based on depth', async () => {
      // Floor 0 - difficulty 1
      mockFloor = createMockFloorLayout(0);
      dungeonFloorService.getFloor = vi.fn().mockReturnValue(mockFloor);

      await service.getOrGenerateRoom(0, 0, 0);
      expect(mockFloor.difficulty).toBe(1);

      // Floor -2 - difficulty 3
      mockFloor = createMockFloorLayout(-2);
      dungeonFloorService.getFloor = vi.fn().mockReturnValue(mockFloor);
      dungeonFloorService.isValidRoom = vi.fn().mockImplementation((_depth, x, y) => mockFloor.cells.has(`${x},${y}`));

      await service.getOrGenerateRoom(0, 0, -2);
      expect(mockFloor.difficulty).toBe(3);
    });
  });

  describe('room type assignment', () => {
    it('should use entrance room type for entrance cell', async () => {
      const room = await service.getOrGenerateRoom(0, 0, 0);

      expect(room?.name).toBe('Dungeon Entrance');
      expect(room?.description).toBe('The entrance to the dungeon.');
    });

    it('should use stairs room type for stairs cell', async () => {
      const room = await service.getOrGenerateRoom(1, 1, 0);

      expect(room?.name).toBe('Deep Stairwell');
      expect(room?.description).toBe('A stairwell descending deeper.');
    });

    it('should use biome room types for normal cells', async () => {
      const room = await service.getOrGenerateRoom(1, 0, 0);

      expect(room?.name).toBe('Crystal Cavern');
      expect(room?.description).toBe('A cavern filled with gleaming crystals.');
    });
  });

  describe('enemy selection', () => {
    const cavesEnemyIds = ['cave_bat', 'cave_spider', 'rock_beetle', 'giant_spider', 'crystal_drake', 'stone_golem', 'deep_wurm'];

    it('should populate some rooms with enemies', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 100);
      const withEnemies = rooms.filter(r => r.enemies.length > 0);
      expect(withEnemies.length).toBeGreaterThan(0);
    });

    it('should only include enemies from the biome pool', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 50);
      for (const room of rooms) {
        for (const enemyId of room.enemies) {
          expect(cavesEnemyIds).toContain(enemyId);
        }
      }
    });

    it('should have 0-2 enemies per room', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 50);
      for (const room of rooms) {
        expect(room.enemies.length).toBeLessThanOrEqual(2);
      }
    });

    it('should have approximately 50% of rooms with enemies', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 200);
      const withEnemies = rooms.filter(r => r.enemies.length > 0);
      // Allow wide statistical margin: 25%-75%
      expect(withEnemies.length).toBeGreaterThan(50);
      expect(withEnemies.length).toBeLessThan(150);
    });

    it('should respect difficulty ranges', async () => {
      // At difficulty 1, only T1 enemies should appear (cave_bat, cave_spider)
      const t1EnemyIds = ['cave_bat', 'cave_spider'];
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 100, 0);
      for (const room of rooms) {
        for (const enemyId of room.enemies) {
          expect(t1EnemyIds).toContain(enemyId);
        }
      }
    });
  });

  describe('item selection', () => {
    const cavesItemIds = [
      'mushroom', 'healing_herb', 'torch', 'spider_fang', 'crystal_shard',
      'health_potion', 'minor_mana_draught', 'greater_health_potion',
      'copper_ore', 'iron_ore', 'bone_shield', 'crystal_shard_blade', 'wurm_scale_armor',
    ];

    it('should populate some rooms with items', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 100);
      const withItems = rooms.filter(r => r.items.length > 0);
      expect(withItems.length).toBeGreaterThan(0);
    });

    it('should only include items from the biome pool', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 50);
      for (const room of rooms) {
        for (const itemId of room.items) {
          expect(cavesItemIds).toContain(itemId);
        }
      }
    });

    it('should have 0-3 items per room', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 50);
      for (const room of rooms) {
        expect(room.items.length).toBeLessThanOrEqual(3);
      }
    });

    it('should not include high-difficulty items on early floors', async () => {
      // crystal_shard_blade and wurm_scale_armor require minDifficulty 5
      const highTierItems = ['crystal_shard_blade', 'wurm_scale_armor'];
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 100, 0);
      for (const room of rooms) {
        for (const itemId of room.items) {
          expect(highTierItems).not.toContain(itemId);
        }
      }
    });
  });

  describe('resource selection', () => {
    const cavesResourceIds = ['copper_vein', 'coal_deposit', 'iron_vein', 'crystal_formation'];
    const wildernessResourceIds = ['herb_patch', 'rare_mushroom_cluster'];
    const ruinsResourceIds = ['ancient_rubble', 'forgotten_cache'];

    it('should populate some caves rooms with mining resources', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 100);
      const withResources = rooms.filter(r => r.resourceNodes!.length > 0);
      expect(withResources.length).toBeGreaterThan(0);
      for (const room of withResources) {
        for (const resourceId of room.resourceNodes!) {
          expect(cavesResourceIds).toContain(resourceId);
        }
      }
    });

    it('should populate wilderness rooms with herbalism resources', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'wilderness', 100);
      const withResources = rooms.filter(r => r.resourceNodes!.length > 0);
      expect(withResources.length).toBeGreaterThan(0);
      for (const room of withResources) {
        for (const resourceId of room.resourceNodes!) {
          expect(wildernessResourceIds).toContain(resourceId);
        }
      }
    });

    it('should populate ruins rooms with rubble and caches', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'ruins', 100);
      const withResources = rooms.filter(r => r.resourceNodes!.length > 0);
      expect(withResources.length).toBeGreaterThan(0);
      for (const room of withResources) {
        for (const resourceId of room.resourceNodes!) {
          expect(ruinsResourceIds).toContain(resourceId);
        }
      }
    });

    it('should have 0-2 resources per room', async () => {
      const rooms = await generateManyRooms(service, dungeonFloorService, 'caves', 50);
      for (const room of rooms) {
        expect(room.resourceNodes!.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('room content determinism', () => {
    it('should produce identical room contents after cache clear', async () => {
      const room1 = await service.getOrGenerateRoom(1, 0, 0);

      // Clear cache to force regeneration
      (service as any).roomCache.clear();

      const room2 = await service.getOrGenerateRoom(1, 0, 0);

      expect(room1?.enemies).toEqual(room2?.enemies);
      expect(room1?.items).toEqual(room2?.items);
      expect(room1?.resourceNodes).toEqual(room2?.resourceNodes);
    });
  });
});

/** Helper to generate many rooms across a large mock floor for statistical tests */
async function generateManyRooms(
  service: ProceduralRoomService,
  dungeonFloorService: DungeonFloorService,
  biomeId: string,
  count: number,
  depth = 0,
) {
  const gridSize = Math.ceil(Math.sqrt(count));
  const cells = new Map<string, FloorCell>();

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const exits: string[] = [];
      if (x > 0) exits.push('west');
      if (x < gridSize - 1) exits.push('east');
      if (y > 0) exits.push('north');
      if (y < gridSize - 1) exits.push('south');

      cells.set(`${x},${y}`, {
        x,
        y,
        exits,
        roomTypeId: 'generic_room',
        isEntrance: x === 0 && y === 0,
        isStairsDown: false,
        distanceFromEntrance: x + y,
      });
    }
  }

  const floor: FloorLayout = {
    depth,
    biomeId,
    difficulty: 1 + Math.abs(depth),
    roomCount: gridSize * gridSize,
    seed: 99999,
    cells,
    stairsDownCoord: { x: gridSize - 1, y: gridSize - 1 },
    stairsUpTarget: 'wilderness_portal',
  };

  (dungeonFloorService.getFloor as any).mockReturnValue(floor);
  (dungeonFloorService.isValidRoom as any).mockImplementation(
    (_d: number, x: number, y: number) => floor.cells.has(`${x},${y}`),
  );
  (dungeonFloorService.getRoomType as any).mockReturnValue({
    id: 'generic_room',
    name: 'Generic Room',
    description: 'A generic room.',
    weight: 1,
  });

  // Clear cache to generate fresh rooms
  (service as any).roomCache.clear();
  (service as any).biomeCache.clear();

  const rooms = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (rooms.length >= count) break;
      const room = await service.getOrGenerateRoom(x, y, depth);
      if (room) rooms.push(room);
    }
    if (rooms.length >= count) break;
  }

  return rooms;
}
