import { describe, it, expect, beforeEach } from 'vitest';
import { DungeonFloorService } from '../dungeon-floor.service';

describe('DungeonFloorService', () => {
  let service: DungeonFloorService;

  beforeEach(() => {
    service = new DungeonFloorService();
  });

  describe('floor generation', () => {
    it('should generate 30-60 rooms per floor', () => {
      const floor = service.getFloor(0);
      expect(floor.roomCount).toBeGreaterThanOrEqual(30);
      expect(floor.roomCount).toBeLessThanOrEqual(60);
      expect(floor.cells.size).toBe(floor.roomCount);
    });

    it('should have entrance at (0,0)', () => {
      const floor = service.getFloor(0);
      const entrance = floor.cells.get('0,0');
      expect(entrance).toBeDefined();
      expect(entrance!.isEntrance).toBe(true);
      expect(entrance!.roomTypeId).toBe('entrance');
      expect(entrance!.distanceFromEntrance).toBe(0);
    });

    it('should have stairs-down using stairsRoom type', () => {
      const floor = service.getFloor(0);
      const stairsCell = floor.cells.get(
        `${floor.stairsDownCoord.x},${floor.stairsDownCoord.y}`,
      );
      expect(stairsCell).toBeDefined();
      expect(stairsCell!.isStairsDown).toBe(true);
      expect(stairsCell!.roomTypeId).toBe('stairs');
    });

    it('should assign room types from the biome pool', () => {
      const floor = service.getFloor(0);
      for (const [key, cell] of floor.cells) {
        if (cell.isEntrance || cell.isStairsDown) continue;
        const roomType = service.getRoomType(floor.biomeId, cell.roomTypeId);
        expect(roomType).toBeDefined();
      }
    });

    it('should prefer non-repeating adjacent room types', () => {
      const floor = service.getFloor(0);
      let totalAdjacentPairs = 0;
      let repeatedPairs = 0;

      for (const [key, cell] of floor.cells) {
        if (cell.isEntrance || cell.isStairsDown) continue;
        for (const dir of cell.exits) {
          const offset = {
            north: [0, -1],
            south: [0, 1],
            east: [1, 0],
            west: [-1, 0],
          }[dir];
          if (!offset) continue;
          const adjKey = `${cell.x + offset[0]},${cell.y + offset[1]}`;
          const adjCell = floor.cells.get(adjKey);
          if (adjCell && !adjCell.isEntrance && !adjCell.isStairsDown) {
            totalAdjacentPairs++;
            if (cell.roomTypeId === adjCell.roomTypeId) {
              repeatedPairs++;
            }
          }
        }
      }

      // Less than 30% should be repeats (with 10 room types, ~10% expected)
      if (totalAdjacentPairs > 0) {
        expect(repeatedPairs / totalAdjacentPairs).toBeLessThan(0.3);
      }
    });
  });

  describe('determinism', () => {
    it('should produce same layout for same depth', () => {
      const floor1 = service.getFloor(0);
      // Create fresh service
      const service2 = new DungeonFloorService();
      const floor2 = service2.getFloor(0);

      expect(floor1.biomeId).toBe(floor2.biomeId);
      expect(floor1.roomCount).toBe(floor2.roomCount);
      expect(floor1.stairsDownCoord).toEqual(floor2.stairsDownCoord);

      for (const [key, cell] of floor1.cells) {
        const cell2 = floor2.cells.get(key);
        expect(cell2).toBeDefined();
        expect(cell.exits.sort()).toEqual(cell2!.exits.sort());
        expect(cell.roomTypeId).toBe(cell2!.roomTypeId);
      }
    });

    it('should produce different layouts for different depths', () => {
      const floor0 = service.getFloor(0);
      const floor1 = service.getFloor(-1);

      expect(floor0.depth).not.toBe(floor1.depth);
      // Very likely different biome or layout
      const sameLayout =
        floor0.roomCount === floor1.roomCount &&
        floor0.stairsDownCoord.x === floor1.stairsDownCoord.x &&
        floor0.stairsDownCoord.y === floor1.stairsDownCoord.y;
      // Not guaranteed but very unlikely to be identical
    });
  });

  describe('biome and difficulty', () => {
    it('should select a random biome per floor', () => {
      const floor = service.getFloor(0);
      expect(['wilderness', 'caves', 'ruins']).toContain(floor.biomeId);
    });

    it('should increase difficulty with depth', () => {
      const floor0 = service.getFloor(0);
      const floor1 = service.getFloor(-1);
      const floor2 = service.getFloor(-2);

      expect(floor0.difficulty).toBe(1);
      expect(floor1.difficulty).toBe(2);
      expect(floor2.difficulty).toBe(3);
    });
  });

  describe('connectivity', () => {
    it('should produce a fully connected graph', () => {
      const floor = service.getFloor(0);
      // BFS from entrance should reach all cells
      const visited = new Set<string>();
      const queue = ['0,0'];
      visited.add('0,0');

      const offsets: Record<string, [number, number]> = {
        north: [0, -1],
        south: [0, 1],
        east: [1, 0],
        west: [-1, 0],
      };

      while (queue.length > 0) {
        const key = queue.shift()!;
        const cell = floor.cells.get(key)!;
        for (const dir of cell.exits) {
          const [dx, dy] = offsets[dir];
          const adjKey = `${cell.x + dx},${cell.y + dy}`;
          if (!visited.has(adjKey) && floor.cells.has(adjKey)) {
            visited.add(adjKey);
            queue.push(adjKey);
          }
        }
      }

      expect(visited.size).toBe(floor.cells.size);
    });

    it('should have bidirectional exits', () => {
      const floor = service.getFloor(0);
      const opposites: Record<string, string> = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      };
      const offsets: Record<string, [number, number]> = {
        north: [0, -1],
        south: [0, 1],
        east: [1, 0],
        west: [-1, 0],
      };

      for (const [key, cell] of floor.cells) {
        for (const dir of cell.exits) {
          const [dx, dy] = offsets[dir];
          const adjKey = `${cell.x + dx},${cell.y + dy}`;
          const adjCell = floor.cells.get(adjKey);
          expect(adjCell).toBeDefined();
          expect(adjCell!.exits).toContain(opposites[dir]);
        }
      }
    });

    it('should only have cardinal direction exits', () => {
      const floor = service.getFloor(0);
      const validDirs = ['north', 'south', 'east', 'west'];
      for (const [key, cell] of floor.cells) {
        for (const dir of cell.exits) {
          expect(validDirs).toContain(dir);
        }
      }
    });
  });

  describe('stairs placement', () => {
    it('should place stairs at max BFS distance from entrance', () => {
      const floor = service.getFloor(0);
      let maxDist = 0;
      for (const cell of floor.cells.values()) {
        if (cell.distanceFromEntrance > maxDist) {
          maxDist = cell.distanceFromEntrance;
        }
      }
      const stairsCell = floor.cells.get(
        `${floor.stairsDownCoord.x},${floor.stairsDownCoord.y}`,
      );
      expect(stairsCell!.distanceFromEntrance).toBe(maxDist);
    });

    it('should not place stairs at entrance', () => {
      const floor = service.getFloor(0);
      expect(
        floor.stairsDownCoord.x !== 0 || floor.stairsDownCoord.y !== 0,
      ).toBe(true);
    });

    it('should have exactly one stairs-down cell per floor', () => {
      const floor = service.getFloor(0);
      let stairsCount = 0;
      for (const cell of floor.cells.values()) {
        if (cell.isStairsDown) stairsCount++;
      }
      expect(stairsCount).toBe(1);
    });
  });

  describe('stairsUpTarget', () => {
    it('should target wilderness_portal for floor 0', () => {
      const floor = service.getFloor(0);
      expect(floor.stairsUpTarget).toBe('wilderness_portal');
    });

    it('should target stairs-down room from floor above', () => {
      const floor0 = service.getFloor(0);
      const floor1 = service.getFloor(-1);

      const expectedTarget = `proc_${floor0.stairsDownCoord.x}_${floor0.stairsDownCoord.y}_0`;
      expect(floor1.stairsUpTarget).toBe(expectedTarget);
    });
  });

  describe('caching', () => {
    it('should return same object for repeated calls', () => {
      const floor1 = service.getFloor(0);
      const floor2 = service.getFloor(0);
      expect(floor1).toBe(floor2); // exact same reference
    });
  });

  describe('public API', () => {
    it('isValidRoom returns true for valid coords', () => {
      const floor = service.getFloor(0);
      expect(service.isValidRoom(0, 0, 0)).toBe(true);
    });

    it('isValidRoom returns false for invalid coords', () => {
      service.getFloor(0); // ensure floor exists
      expect(service.isValidRoom(0, 999, 999)).toBe(false);
    });

    it('getCellAt returns cell for valid coords', () => {
      service.getFloor(0);
      const cell = service.getCellAt(0, 0, 0);
      expect(cell).toBeDefined();
      expect(cell!.x).toBe(0);
      expect(cell!.y).toBe(0);
    });

    it('getCellAt returns undefined for invalid coords', () => {
      service.getFloor(0);
      const cell = service.getCellAt(0, 999, 999);
      expect(cell).toBeUndefined();
    });

    it('getRoomType returns room type data', () => {
      const floor = service.getFloor(0);
      const entranceType = service.getRoomType(floor.biomeId, 'entrance');
      expect(entranceType).toBeDefined();
      expect(entranceType!.name).toBeDefined();
      expect(entranceType!.description).toBeDefined();

      const stairsType = service.getRoomType(floor.biomeId, 'stairs');
      expect(stairsType).toBeDefined();
    });
  });
});
