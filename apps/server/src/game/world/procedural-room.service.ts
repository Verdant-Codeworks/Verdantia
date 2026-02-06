import { Injectable, Logger, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { CurrentRoomData } from '@verdantia/shared';
import { makeRoomId } from '@verdantia/shared';
import { ProceduralRoom } from '../../entities/procedural-room.entity';
import { ProceduralRoomExit } from '../../entities/procedural-room-exit.entity';
import { ProceduralRoomItem } from '../../entities/procedural-room-item.entity';
import { ProceduralRoomEnemy } from '../../entities/procedural-room-enemy.entity';
import { ProceduralRoomResource } from '../../entities/procedural-room-resource.entity';
import { BiomeEnemyPool } from '../../entities/biome-enemy-pool.entity';
import { BiomeItemPool } from '../../entities/biome-item-pool.entity';
import { BiomeResourcePool } from '../../entities/biome-resource-pool.entity';
import { BiomeDefinition } from '../../entities/biome-definition.entity';
import { ItemDefinition } from '../../entities/item-definition.entity';
import { EnemyDefinition } from '../../entities/enemy-definition.entity';
import { ResourceNodeDefinition } from '../../entities/resource-node-definition.entity';
import { DungeonFloorService } from './dungeon/dungeon-floor.service';

@Injectable()
export class ProceduralRoomService {
  private readonly logger = new Logger(ProceduralRoomService.name);

  // In-memory cache for generated rooms when no database is available
  private roomCache = new Map<string, CurrentRoomData>();
  private biomeCache = new Map<string, string>();

  constructor(
    @Optional() private readonly em: EntityManager | null,
    private readonly dungeonFloorService: DungeonFloorService,
  ) {}

  async getOrGenerateRoom(x: number, y: number, z: number): Promise<CurrentRoomData | undefined> {
    const roomId = makeRoomId(x, y, z);

    // Check in-memory cache first
    const cachedRoom = this.roomCache.get(roomId);
    if (cachedRoom) {
      return cachedRoom;
    }

    // Check database if available
    if (this.em) {
      try {
        const existingRoom = await this.em.findOne(
          ProceduralRoom,
          { id: roomId },
          { populate: ['biome'] },
        );

        if (existingRoom) {
          const roomDef = await this.buildRoomDefinition(existingRoom);
          const biomeId = typeof existingRoom.biome === 'string'
            ? existingRoom.biome : existingRoom.biome.id;
          this.biomeCache.set(roomId, biomeId);
          this.roomCache.set(roomId, roomDef);
          return roomDef;
        }
      } catch (error) {
        this.logger.debug(`DB lookup failed for room ${roomId}, generating new room`);
      }
    }

    // Check if this is a valid dungeon room
    if (!this.dungeonFloorService.isValidRoom(z, x, y)) {
      return undefined;
    }

    // Generate new room
    const newRoom = await this.generateDungeonRoom(x, y, z);
    if (newRoom) {
      this.roomCache.set(roomId, newRoom);
    }
    return newRoom;
  }

  private async generateDungeonRoom(x: number, y: number, z: number): Promise<CurrentRoomData> {
    const roomId = makeRoomId(x, y, z);
    const floor = this.dungeonFloorService.getFloor(z);
    const cell = floor.cells.get(`${x},${y}`)!;

    // Get room type for name and description
    const roomType = this.dungeonFloorService.getRoomType(floor.biomeId, cell.roomTypeId);
    const name = roomType?.name ?? 'Unknown Chamber';
    const description = roomType?.description ?? 'A mysterious chamber.';

    // Build exits from floor cell data
    const exits: Array<{ direction: string; roomId: string; description?: string }> = [];

    // Cardinal exits from floor layout
    const directionOffsets: Record<string, { dx: number; dy: number }> = {
      north: { dx: 0, dy: -1 },
      south: { dx: 0, dy: 1 },
      east: { dx: 1, dy: 0 },
      west: { dx: -1, dy: 0 },
    };

    for (const dir of cell.exits) {
      const offset = directionOffsets[dir];
      const adjX = x + offset.dx;
      const adjY = y + offset.dy;
      const adjCell = floor.cells.get(`${adjX},${adjY}`);
      const adjRoomType = adjCell ? this.dungeonFloorService.getRoomType(floor.biomeId, adjCell.roomTypeId) : null;
      const adjName = adjRoomType?.name ?? 'an unknown passage';

      exits.push({
        direction: dir,
        roomId: makeRoomId(adjX, adjY, z),
        description: `${adjName} lies to the ${dir}`,
      });
    }

    // Stairs up (entrance room on every floor has stairs up)
    if (cell.isEntrance) {
      exits.push({
        direction: 'up',
        roomId: floor.stairsUpTarget,
        description: 'Stairs lead back to the upper level',
      });
    }

    // Stairs down (stairs room has stairs to next floor)
    if (cell.isStairsDown) {
      const nextDepth = z - 1;
      exits.push({
        direction: 'down',
        roomId: makeRoomId(0, 0, nextDepth), // entrance of next floor is always 0,0
        description: 'A stairway descends deeper into the dungeon',
      });
    }

    // Select room contents based on biome and difficulty
    const seed = this.generateSeed(x, y, z);
    const items = await this.selectItems(floor.biomeId, floor.difficulty, seed);
    const enemies = await this.selectEnemies(floor.biomeId, floor.difficulty, seed);
    const resources = await this.selectResources(floor.biomeId, seed);

    // Cache biome for this room
    this.biomeCache.set(roomId, floor.biomeId);

    // Save to database (if available)
    if (this.em) {
      try {
        const biomeEntity = await this.em.findOne(BiomeDefinition, { id: floor.biomeId });

        if (biomeEntity) {
          const room = this.em.create(ProceduralRoom, {
            id: roomId,
            x,
            y,
            z,
            biome: biomeEntity,
            name,
            description,
            difficulty: floor.difficulty,
            seed,
            createdAt: new Date(),
          });

          await this.em.persist(room).flush();

          // Create exits
          for (const exit of exits) {
            const exitEntity = this.em.create(ProceduralRoomExit, {
              room,
              direction: exit.direction,
              destinationRoomId: exit.roomId,
              description: exit.description,
            });
            this.em.persist(exitEntity);
          }

          // Batch load entities to avoid N+1 queries
          const [itemEntities, enemyEntities, resourceEntities] = await Promise.all([
            items.length > 0 ? this.em.find(ItemDefinition, { id: { $in: items } }) : [],
            enemies.length > 0 ? this.em.find(EnemyDefinition, { id: { $in: enemies } }) : [],
            resources.length > 0 ? this.em.find(ResourceNodeDefinition, { id: { $in: resources } }) : [],
          ]);

          // Create items
          const itemMap = new Map(itemEntities.map(e => [e.id, e]));
          for (const itemId of items) {
            const itemEntity = itemMap.get(itemId);
            if (itemEntity) {
              const roomItem = this.em.create(ProceduralRoomItem, {
                room,
                item: itemEntity,
              });
              this.em.persist(roomItem);
            }
          }

          // Create enemies
          const enemyMap = new Map(enemyEntities.map(e => [e.id, e]));
          for (const enemyId of enemies) {
            const enemyEntity = enemyMap.get(enemyId);
            if (enemyEntity) {
              const roomEnemy = this.em.create(ProceduralRoomEnemy, {
                room,
                enemy: enemyEntity,
              });
              this.em.persist(roomEnemy);
            }
          }

          // Create resources
          const resourceMap = new Map(resourceEntities.map(e => [e.id, e]));
          for (const resourceId of resources) {
            const resourceEntity = resourceMap.get(resourceId);
            if (resourceEntity) {
              const roomResource = this.em.create(ProceduralRoomResource, {
                room,
                resource: resourceEntity,
              });
              this.em.persist(roomResource);
            }
          }

          await this.em.flush();
        }
      } catch (error) {
        this.logger.warn(`Failed to save room ${roomId} to database: ${error}`);
      }
    }

    // Return room definition
    return {
      id: roomId,
      name,
      description,
      exits,
      items,
      enemies,
      resourceNodes: resources,
    };
  }

  private async selectItems(biomeId: string, difficulty: number, seed: number): Promise<string[]> {
    if (!this.em) {
      // No database - return empty for now
      return [];
    }

    try {
      const pool = await this.em.find(BiomeItemPool, {
        biome: { id: biomeId },
        minDifficulty: { $lte: difficulty },
        maxDifficulty: { $gte: difficulty },
      }, { populate: ['item'] });

      if (pool.length === 0) {
        return [];
      }

      // Determine number of items (0-3)
      const rng = this.seededRandom(seed);
      const numItems = rng() < 0.3 ? 0 : Math.floor(rng() * 3) + 1;

      return this.weightedRandomSelect(pool, numItems, 'spawnWeight', seed + 1).map(p => {
        const item = p.item;
        return typeof item === 'string' ? item : item.id;
      });
    } catch (error) {
      this.logger.debug(`Failed to load item pool for biome ${biomeId}`);
      return [];
    }
  }

  private async selectEnemies(biomeId: string, difficulty: number, seed: number): Promise<string[]> {
    if (!this.em) {
      // No database - return empty for now
      return [];
    }

    try {
      const pool = await this.em.find(BiomeEnemyPool, {
        biome: { id: biomeId },
        minDifficulty: { $lte: difficulty },
        maxDifficulty: { $gte: difficulty },
      }, { populate: ['enemy'] });

      if (pool.length === 0) {
        return [];
      }

      // Determine number of enemies (0-2)
      const rng = this.seededRandom(seed + 100);
      const numEnemies = rng() < 0.4 ? 0 : Math.floor(rng() * 2) + 1;

      return this.weightedRandomSelect(pool, numEnemies, 'spawnWeight', seed + 101).map(p => {
        const enemy = p.enemy;
        return typeof enemy === 'string' ? enemy : enemy.id;
      });
    } catch (error) {
      this.logger.debug(`Failed to load enemy pool for biome ${biomeId}`);
      return [];
    }
  }

  private async selectResources(biomeId: string, seed: number): Promise<string[]> {
    if (!this.em) {
      // No database - return empty for now
      return [];
    }

    try {
      const pool = await this.em.find(BiomeResourcePool, {
        biome: { id: biomeId },
      }, { populate: ['resource'] });

      if (pool.length === 0) {
        return [];
      }

      // Determine number of resources (0-2)
      const rng = this.seededRandom(seed + 200);
      const numResources = rng() < 0.6 ? 0 : Math.floor(rng() * 2) + 1;

      return this.weightedRandomSelect(pool, numResources, 'spawnWeight', seed + 201).map(p => {
        const resource = p.resource;
        return typeof resource === 'string' ? resource : resource.id;
      });
    } catch (error) {
      this.logger.debug(`Failed to load resource pool for biome ${biomeId}`);
      return [];
    }
  }

  private weightedRandomSelect<T extends { spawnWeight: number }>(
    pool: T[],
    count: number,
    weightKey: keyof T,
    seed: number,
  ): T[] {
    if (pool.length === 0 || count === 0) {
      return [];
    }

    const rng = this.seededRandom(seed);
    const selected: T[] = [];
    const available = [...pool];

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = available.reduce((sum, item) => sum + (item[weightKey] as number), 0);
      let random = rng() * totalWeight;

      for (let j = 0; j < available.length; j++) {
        random -= available[j][weightKey] as number;
        if (random <= 0) {
          selected.push(available[j]);
          available.splice(j, 1);
          break;
        }
      }
    }

    return selected;
  }

  private generateSeed(x: number, y: number, z: number): number {
    // Simple hash function to generate deterministic seed from coordinates
    let hash = 0;
    const str = `${x},${y},${z}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  private async buildRoomDefinition(room: ProceduralRoom): Promise<CurrentRoomData> {
    // This method is only called when em is available (from getOrGenerateRoom)
    if (!this.em) {
      throw new Error('EntityManager required to build room definition from database');
    }

    try {
      // Load exits
      const exits = await this.em.find(ProceduralRoomExit, { room: room.id });

      // Load items
      const roomItems = await this.em.find(ProceduralRoomItem, { room: room.id }, { populate: ['item'] });

      // Load enemies
      const roomEnemies = await this.em.find(ProceduralRoomEnemy, { room: room.id }, { populate: ['enemy'] });

      // Load resources
      const roomResources = await this.em.find(ProceduralRoomResource, { room: room.id }, { populate: ['resource'] });

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        exits: exits.map(e => ({
          direction: e.direction,
          roomId: e.destinationRoomId || '',
          description: e.description,
        })),
        items: roomItems.map(ri => {
          const item = ri.item;
          return typeof item === 'string' ? item : item.id;
        }),
        enemies: roomEnemies.map(re => {
          const enemy = re.enemy;
          return typeof enemy === 'string' ? enemy : enemy.id;
        }),
        resourceNodes: roomResources.map(rr => {
          const resource = rr.resource;
          return typeof resource === 'string' ? resource : resource.id;
        }),
      };
    } catch (error) {
      this.logger.error(`Failed to build room definition for ${room.id}: ${error}`);
      throw error;
    }
  }
}
