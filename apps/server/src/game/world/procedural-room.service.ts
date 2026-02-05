import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { RoomDefinition } from '@verdantia/shared';
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
import { DefinitionService } from './definition.service';
import { WFCService } from './wfc/wfc.service';

interface AdjacentRoomData {
  x: number;
  y: number;
  z: number;
  biomeId: string;
}

@Injectable()
export class ProceduralRoomService {
  private readonly logger = new Logger(ProceduralRoomService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly definitionService: DefinitionService,
    private readonly wfcService: WFCService,
  ) {}

  async getOrGenerateRoom(x: number, y: number, z: number): Promise<RoomDefinition | undefined> {
    const roomId = makeRoomId(x, y, z);

    try {
      // Check if room exists in database
      const existingRoom = await this.em.findOne(
        ProceduralRoom,
        { id: roomId },
        { populate: ['biome'] },
      );

      if (existingRoom) {
        return await this.buildRoomDefinition(existingRoom);
      }
    } catch (error) {
      this.logger.debug(`DB lookup failed for room ${roomId}, generating new room`);
    }

    // Generate new room
    return await this.generateRoom(x, y, z);
  }

  async generateRoom(x: number, y: number, z: number): Promise<RoomDefinition> {
    const roomId = makeRoomId(x, y, z);

    // Generate deterministic seed and RNG early so all generation is reproducible
    const seed = this.generateSeed(x, y, z);
    const rng = this.seededRandom(seed);

    // Get adjacent rooms
    const adjacentRooms = await this.getAdjacentRooms(x, y, z);

    // Run WFC algorithm with seeded RNG
    const validBiomes = await this.wfcService.getValidBiomes(x, y, z, adjacentRooms);
    const selectedBiomeId = this.wfcService.selectBiome(validBiomes, x, y, z, rng);
    const biome = await this.definitionService.getBiome(selectedBiomeId);

    if (!biome) {
      throw new Error(`Biome ${selectedBiomeId} not found`);
    }

    const difficulty = this.wfcService.calculateDifficulty(x, y, z);

    // Generate room name and description using seeded RNG
    const name = this.selectRandomSeeded(biome.nameTemplates, rng);
    const description = this.selectRandomSeeded(biome.descriptionTemplates, rng);

    // Generate exits using seeded RNG
    const exits = this.wfcService.generateExits(x, y, z, biome, adjacentRooms, rng);

    // Select room contents
    const items = await this.selectItems(selectedBiomeId, difficulty, seed);
    const enemies = await this.selectEnemies(selectedBiomeId, difficulty, seed);
    const resources = await this.selectResources(selectedBiomeId, seed);

    // Save to database
    try {
      const biomeEntity = await this.em.findOne(BiomeDefinition, { id: selectedBiomeId });

      if (biomeEntity) {
        const room = this.em.create(ProceduralRoom, {
          id: roomId,
          x,
          y,
          z,
          biome: biomeEntity,
          name,
          description,
          difficulty,
          seed,
          createdAt: new Date(),
        });

        await this.em.persistAndFlush(room);

        // Create exits
        for (const exit of exits) {
          const exitEntity = this.em.create(ProceduralRoomExit, {
            room,
            direction: exit.direction,
            destinationRoomId: exit.destinationRoomId,
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

    // Return room definition
    return {
      id: roomId,
      name,
      description,
      exits: exits.map(e => ({
        direction: e.direction,
        roomId: e.destinationRoomId || '',
        description: e.description,
      })),
      items,
      enemies,
      resourceNodes: resources,
    };
  }

  async getAdjacentRooms(x: number, y: number, z: number): Promise<AdjacentRoomData[]> {
    const offsets = [
      { dx: 0, dy: -1, dz: 0 }, // north
      { dx: 0, dy: 1, dz: 0 },  // south
      { dx: 1, dy: 0, dz: 0 },  // east
      { dx: -1, dy: 0, dz: 0 }, // west
      { dx: 0, dy: 0, dz: 1 },  // up
      { dx: 0, dy: 0, dz: -1 }, // down
    ];

    const adjacentRooms: AdjacentRoomData[] = [];

    for (const { dx, dy, dz } of offsets) {
      const adjX = x + dx;
      const adjY = y + dy;
      const adjZ = z + dz;
      const adjId = makeRoomId(adjX, adjY, adjZ);

      try {
        const adjRoom = await this.em.findOne(
          ProceduralRoom,
          { id: adjId },
          { populate: ['biome'] },
        );

        if (adjRoom) {
          const biomeId = typeof adjRoom.biome === 'string' ? adjRoom.biome : adjRoom.biome.id;
          adjacentRooms.push({
            x: adjX,
            y: adjY,
            z: adjZ,
            biomeId,
          });
        }
      } catch (error) {
        // Room doesn't exist, skip
      }
    }

    return adjacentRooms;
  }

  private async selectItems(biomeId: string, difficulty: number, seed: number): Promise<string[]> {
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

  private selectRandomSeeded<T>(array: T[], rng: () => number): T {
    return array[Math.floor(rng() * array.length)];
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

  private async buildRoomDefinition(room: ProceduralRoom): Promise<RoomDefinition> {
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
