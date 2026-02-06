import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  BiomeDungeonRooms,
  DungeonRoomType,
  FloorCell,
  FloorLayout,
} from './dungeon.types';

@Injectable()
export class DungeonFloorService {
  private readonly dungeonRoomsData: Record<string, BiomeDungeonRooms>;
  private readonly floorCache = new Map<number, FloorLayout>();

  private readonly DIRECTION_OFFSETS: Record<
    string,
    { dx: number; dy: number; opposite: string }
  > = {
    north: { dx: 0, dy: -1, opposite: 'south' },
    south: { dx: 0, dy: 1, opposite: 'north' },
    east: { dx: 1, dy: 0, opposite: 'west' },
    west: { dx: -1, dy: 0, opposite: 'east' },
  };

  constructor() {
    // Load dungeon rooms data
    const dataPath = path.join(__dirname, '../data/dungeon-rooms.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    this.dungeonRoomsData = JSON.parse(rawData);
  }

  /**
   * Get or generate a floor layout for the given depth
   */
  getFloor(depth: number): FloorLayout {
    if (this.floorCache.has(depth)) {
      return this.floorCache.get(depth)!;
    }

    const floor = this.generateFloor(depth);
    this.floorCache.set(depth, floor);
    return floor;
  }

  /**
   * Get a specific cell at coordinates on a floor
   */
  getCellAt(depth: number, x: number, y: number): FloorCell | undefined {
    const floor = this.getFloor(depth);
    return floor.cells.get(`${x},${y}`);
  }

  /**
   * Check if a room exists at the given coordinates
   */
  isValidRoom(depth: number, x: number, y: number): boolean {
    const floor = this.getFloor(depth);
    return floor.cells.has(`${x},${y}`);
  }

  /**
   * Get room type data by biome and room type ID
   */
  getRoomType(
    biomeId: string,
    roomTypeId: string,
  ): DungeonRoomType | { name: string; description: string } | undefined {
    const biomeData = this.dungeonRoomsData[biomeId];
    if (!biomeData) return undefined;

    if (roomTypeId === 'entrance') {
      return biomeData.entranceRoom;
    }

    if (roomTypeId === 'stairs') {
      return biomeData.stairsRoom;
    }

    return biomeData.roomTypes.find((rt) => rt.id === roomTypeId);
  }

  /**
   * Generate a new floor layout using the growing tree maze algorithm
   */
  private generateFloor(depth: number): FloorLayout {
    const seed = this.generateSeed(depth);
    const rng = this.seededRandom(seed);

    // Pick a random biome
    const biomes = ['wilderness', 'caves', 'ruins'];
    const biomeId = biomes[Math.floor(rng() * biomes.length)];

    // Calculate room count (30-60 rooms)
    const roomCount = 30 + Math.floor(rng() * 31);

    // Calculate difficulty
    const difficulty = 1 + Math.abs(depth);

    // Generate maze using growing tree algorithm
    const cells = new Map<string, FloorCell>();

    // Start at origin
    const startCell: FloorCell = {
      x: 0,
      y: 0,
      exits: [],
      roomTypeId: 'entrance', // Will be assigned later
      isEntrance: true,
      isStairsDown: false,
      distanceFromEntrance: 0,
    };
    cells.set('0,0', startCell);

    const frontier: FloorCell[] = [startCell];

    // Grow the maze
    while (cells.size < roomCount && frontier.length > 0) {
      // 70% chance to pick most recent (creates corridors)
      // 30% chance to pick random (creates branches)
      const pickRecent = rng() < 0.7;
      const currentIndex = pickRecent
        ? frontier.length - 1
        : Math.floor(rng() * frontier.length);
      const current = frontier[currentIndex];

      // Get available neighbors (cardinal directions only)
      const availableNeighbors = this.getAvailableNeighbors(current, cells);

      if (availableNeighbors.length === 0) {
        // No available neighbors, remove from frontier
        frontier.splice(currentIndex, 1);
        continue;
      }

      // Pick a random available neighbor
      const neighborDir =
        availableNeighbors[Math.floor(rng() * availableNeighbors.length)];
      const offset = this.DIRECTION_OFFSETS[neighborDir];
      const newX = current.x + offset.dx;
      const newY = current.y + offset.dy;

      // Create new cell
      const newCell: FloorCell = {
        x: newX,
        y: newY,
        exits: [offset.opposite], // Exit back to parent
        roomTypeId: '', // Will be assigned later
        isEntrance: false,
        isStairsDown: false,
        distanceFromEntrance: 0, // Will be calculated later
      };

      cells.set(`${newX},${newY}`, newCell);

      // Add bidirectional exit
      current.exits.push(neighborDir);

      // Add to frontier
      frontier.push(newCell);
    }

    // Calculate distances from entrance using BFS
    this.calculateDistances(cells);

    // Find furthest cell for stairs down
    let maxDistance = 0;
    let stairsCoord = { x: 0, y: 0 };

    for (const [key, cell] of cells) {
      if (cell.distanceFromEntrance > maxDistance) {
        maxDistance = cell.distanceFromEntrance;
        stairsCoord = { x: cell.x, y: cell.y };
      }
    }

    // Mark stairs cell
    const stairsCell = cells.get(`${stairsCoord.x},${stairsCoord.y}`)!;
    stairsCell.isStairsDown = true;
    stairsCell.roomTypeId = 'stairs';

    // Assign room types to all other cells
    this.assignRoomTypes(cells, biomeId, rng);

    // Calculate stairsUpTarget
    let stairsUpTarget: string;
    if (depth === 0) {
      stairsUpTarget = 'wilderness_portal';
    } else {
      // Get the floor above
      const floorAbove = this.getFloor(depth + 1);
      const { x, y } = floorAbove.stairsDownCoord;
      stairsUpTarget = `proc_${x}_${y}_${depth + 1}`;
    }

    return {
      depth,
      biomeId,
      difficulty,
      roomCount,
      seed,
      cells,
      stairsDownCoord: stairsCoord,
      stairsUpTarget,
    };
  }

  /**
   * Get available cardinal neighbors that are not yet in the cells map
   */
  private getAvailableNeighbors(
    cell: FloorCell,
    cells: Map<string, FloorCell>,
  ): string[] {
    const available: string[] = [];

    for (const [dir, offset] of Object.entries(this.DIRECTION_OFFSETS)) {
      const newX = cell.x + offset.dx;
      const newY = cell.y + offset.dy;
      const key = `${newX},${newY}`;

      if (!cells.has(key)) {
        available.push(dir);
      }
    }

    return available;
  }

  /**
   * Calculate distance from entrance for all cells using BFS
   */
  private calculateDistances(cells: Map<string, FloorCell>): void {
    const queue: FloorCell[] = [];
    const visited = new Set<string>();

    // Start from entrance
    const entrance = cells.get('0,0')!;
    entrance.distanceFromEntrance = 0;
    queue.push(entrance);
    visited.add('0,0');

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const dir of current.exits) {
        const offset = this.DIRECTION_OFFSETS[dir];
        const adjX = current.x + offset.dx;
        const adjY = current.y + offset.dy;
        const adjKey = `${adjX},${adjY}`;

        if (!visited.has(adjKey)) {
          const adjCell = cells.get(adjKey);
          if (adjCell) {
            adjCell.distanceFromEntrance = current.distanceFromEntrance + 1;
            visited.add(adjKey);
            queue.push(adjCell);
          }
        }
      }
    }
  }

  /**
   * Assign room types to all cells (except entrance and stairs)
   */
  private assignRoomTypes(
    cells: Map<string, FloorCell>,
    biomeId: string,
    rng: () => number,
  ): void {
    const biomeData = this.dungeonRoomsData[biomeId];
    const roomTypes = biomeData.roomTypes;

    // Calculate total weight
    const totalWeight = roomTypes.reduce((sum, rt) => sum + rt.weight, 0);

    for (const [key, cell] of cells) {
      // Skip entrance and stairs (already assigned)
      if (cell.isEntrance || cell.isStairsDown) {
        continue;
      }

      // Try up to 3 times to avoid repeating adjacent room types
      let selectedType: DungeonRoomType | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const candidateType = this.weightedRandomRoomType(
          roomTypes,
          totalWeight,
          rng,
        );

        // Check if this type is used by any adjacent cell
        const hasAdjacentWithSameType = this.hasAdjacentWithType(
          cell,
          cells,
          candidateType.id,
        );

        if (!hasAdjacentWithSameType || attempt === 2) {
          selectedType = candidateType;
          break;
        }
      }

      cell.roomTypeId = selectedType!.id;
    }
  }

  /**
   * Select a room type using weighted random selection
   */
  private weightedRandomRoomType(
    roomTypes: DungeonRoomType[],
    totalWeight: number,
    rng: () => number,
  ): DungeonRoomType {
    let random = rng() * totalWeight;

    for (const roomType of roomTypes) {
      random -= roomType.weight;
      if (random <= 0) {
        return roomType;
      }
    }

    // Fallback (should never happen)
    return roomTypes[0];
  }

  /**
   * Check if any adjacent cell has the given room type ID
   */
  private hasAdjacentWithType(
    cell: FloorCell,
    cells: Map<string, FloorCell>,
    roomTypeId: string,
  ): boolean {
    for (const dir of cell.exits) {
      const offset = this.DIRECTION_OFFSETS[dir];
      const adjKey = `${cell.x + offset.dx},${cell.y + offset.dy}`;
      const adjCell = cells.get(adjKey);

      if (adjCell && adjCell.roomTypeId === roomTypeId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a deterministic seed from depth
   */
  private generateSeed(depth: number): number {
    let hash = 0;
    const str = `dungeon_floor_${depth}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Create a seeded random number generator using LCG
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
