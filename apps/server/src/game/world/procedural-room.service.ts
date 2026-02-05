import { Injectable, Logger, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { RoomDefinition, SettlementInfo, NPCInfo, BuildingInfo, QuestInfo, CurrentRoomData } from '@verdantia/shared';
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
import { WorldRegionService } from './generation/world-region.service';
import { SettlementGeneratorService } from './generation/settlement-generator.service';
import { NPCGeneratorService } from './generation/npc-generator.service';
import { BuildingGeneratorService } from './generation/building-generator.service';
import { QuestGeneratorService } from './generation/quest-generator.service';
import type { SettlementData } from './generation/settlement.types';
import type { NPCData } from './generation/npc.types';
import type { BuildingData } from './generation/building.types';
import type { QuestData } from './generation/quest.types';

interface AdjacentRoomData {
  x: number;
  y: number;
  z: number;
  biomeId: string;
}

@Injectable()
export class ProceduralRoomService {
  private readonly logger = new Logger(ProceduralRoomService.name);

  // In-memory cache for generated rooms when no database is available
  private roomCache = new Map<string, CurrentRoomData>();

  constructor(
    @Optional() private readonly em: EntityManager | null,
    private readonly definitionService: DefinitionService,
    private readonly wfcService: WFCService,
    private readonly worldRegionService: WorldRegionService,
    private readonly settlementGenerator: SettlementGeneratorService,
    private readonly npcGenerator: NPCGeneratorService,
    private readonly buildingGenerator: BuildingGeneratorService,
    private readonly questGenerator: QuestGeneratorService,
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
          this.roomCache.set(roomId, roomDef);
          return roomDef;
        }
      } catch (error) {
        this.logger.debug(`DB lookup failed for room ${roomId}, generating new room`);
      }
    }

    // Generate new room
    const newRoom = await this.generateRoom(x, y, z);
    if (newRoom) {
      this.roomCache.set(roomId, newRoom);
    }
    return newRoom;
  }

  /**
   * Pre-generates all 6 adjacent rooms (N, S, E, W, up, down) in parallel.
   * This populates the cache so exit descriptions can reference actual room names.
   */
  async preGenerateAdjacentRooms(x: number, y: number, z: number): Promise<void> {
    const directions = [
      { dx: 0, dy: -1, dz: 0 },  // north
      { dx: 0, dy: 1, dz: 0 },   // south
      { dx: 1, dy: 0, dz: 0 },   // east
      { dx: -1, dy: 0, dz: 0 },  // west
      { dx: 0, dy: 0, dz: 1 },   // up
      { dx: 0, dy: 0, dz: -1 },  // down
    ];

    await Promise.all(
      directions.map(({ dx, dy, dz }) =>
        this.getOrGenerateRoom(x + dx, y + dy, z + dz)
      )
    );
  }

  /**
   * Gets or generates a room with all adjacent rooms pre-generated.
   * This ensures exit descriptions have access to actual room names.
   *
   * Key ordering to avoid infinite recursion:
   * 1. Pre-generate adjacent rooms (calls getOrGenerateRoom, NOT this method)
   * 2. Generate/get current room - exit descriptions will find cached adjacent rooms
   * 3. If room was cached before step 1, update its exit descriptions
   */
  async getOrGenerateRoomWithAdjacent(x: number, y: number, z: number): Promise<CurrentRoomData | undefined> {
    const roomId = makeRoomId(x, y, z);

    // Check if room already exists in cache before pre-generation
    const wasAlreadyCached = this.roomCache.has(roomId);

    // 1. First, pre-generate adjacent rooms (but DON'T recurse)
    await this.preGenerateAdjacentRooms(x, y, z);

    // 2. Now generate/get current room - exit descriptions will find cached adjacent rooms
    const room = await this.getOrGenerateRoom(x, y, z);

    // 3. If room was already cached before step 1, update its exit descriptions
    if (room && wasAlreadyCached) {
      this.updateExitDescriptions(room, x, y, z);
    }

    return room;
  }

  /**
   * Refreshes exit descriptions with newly-cached adjacent room info.
   * Called when a room was already cached before its adjacent rooms were generated.
   */
  private updateExitDescriptions(room: CurrentRoomData, x: number, y: number, z: number): void {
    room.exits = room.exits.map(exit => ({
      ...exit,
      description: this.generateExitDescriptionForCached(x, y, z, exit.direction)
    }));
  }

  /**
   * Generates an exit description by looking up the adjacent room from cache.
   * This method assumes adjacent rooms have been pre-generated and cached.
   */
  private generateExitDescriptionForCached(
    fromX: number,
    fromY: number,
    fromZ: number,
    direction: string,
  ): string {
    const directionOffsets: Record<string, { dx: number; dy: number; dz: number }> = {
      north: { dx: 0, dy: -1, dz: 0 },
      south: { dx: 0, dy: 1, dz: 0 },
      east: { dx: 1, dy: 0, dz: 0 },
      west: { dx: -1, dy: 0, dz: 0 },
      up: { dx: 0, dy: 0, dz: 1 },
      down: { dx: 0, dy: 0, dz: -1 },
    };

    const offset = directionOffsets[direction];
    if (!offset) {
      return `A path leading ${direction}`;
    }

    const toX = fromX + offset.dx;
    const toY = fromY + offset.dy;
    const toZ = fromZ + offset.dz;

    // Generate seed for consistency (though not used for cached lookups)
    const seed = this.generateSeed(fromX, fromY, fromZ) + direction.length;

    // Reuse existing exit description logic
    return this.generateExitDescription(fromX, fromY, fromZ, toX, toY, toZ, direction, seed);
  }

  async generateRoom(x: number, y: number, z: number): Promise<CurrentRoomData> {
    const roomId = makeRoomId(x, y, z);

    // Check region type to determine what to generate
    const regionType = this.worldRegionService.getRegionType(x, y, z);

    if (regionType === 'settlement') {
      return await this.generateSettlementRoom(x, y, z);
    }

    // Generate wilderness room (existing logic)
    return await this.generateWildernessRoom(x, y, z);
  }

  private async generateWildernessRoom(x: number, y: number, z: number): Promise<CurrentRoomData> {
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
    let exits = this.wfcService.generateExits(x, y, z, biome, adjacentRooms, rng);

    // Ensure bidirectional exits: if an adjacent cached room has an exit to this room,
    // we must have a return exit to maintain consistency
    exits = this.ensureBidirectionalExits(x, y, z, exits);

    // Add contextual descriptions to exits
    exits = this.addExitDescriptions(x, y, z, exits, selectedBiomeId, seed);

    // Select room contents
    const items = await this.selectItems(selectedBiomeId, difficulty, seed);
    const enemies = await this.selectEnemies(selectedBiomeId, difficulty, seed);
    const resources = await this.selectResources(selectedBiomeId, seed);

    // Save to database (if available)
    if (this.em) {
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

  private async generateSettlementRoom(x: number, y: number, z: number): Promise<CurrentRoomData> {
    const roomId = makeRoomId(x, y, z);
    const seed = this.generateSeed(x, y, z);

    // Get settlement size from world region service
    const size = this.worldRegionService.getSettlementSize(x, y, z);
    if (!size) {
      this.logger.warn(`Settlement location at ${x},${y},${z} has no size, falling back to wilderness`);
      // Fallback - this should not happen
      return await this.generateWildernessRoom(x, y, z);
    }

    // Generate all settlement data
    const settlement = this.settlementGenerator.generate(x, y, z, size);
    const npcs = this.npcGenerator.generateForSettlement(settlement);
    const buildings = this.buildingGenerator.generateForSettlement(settlement, npcs);
    this.buildingGenerator.assignNPCsToBuildings(buildings, npcs);
    const quests = this.questGenerator.generateForSettlement(settlement, npcs, seed);

    // Generate exits (standard 4-directional + optional vertical)
    const exits = this.generateSettlementExits(x, y, z);

    // Generate settlement description
    const description = this.generateSettlementDescription(settlement, buildings, npcs);

    // Convert to client-safe Info types
    const settlementInfo = this.toSettlementInfo(settlement);
    const npcInfos = npcs.map(n => this.toNPCInfo(n, buildings));
    const buildingInfos = buildings.map(b => this.toBuildingInfo(b));
    const questInfos = quests.map(q => this.toQuestInfo(q, npcs));

    return {
      id: roomId,
      name: settlement.name,
      description,
      exits: exits.map(e => ({
        direction: e.direction,
        roomId: e.destinationRoomId || '',
        description: e.description,
      })),
      items: [],
      enemies: [],
      resourceNodes: [],
      settlement: settlementInfo,
      npcs: npcInfos,
      buildings: buildingInfos,
      availableQuests: questInfos,
    };
  }

  private generateSettlementExits(x: number, y: number, z: number) {
    const seed = this.generateSeed(x, y, z);
    const directions = [
      { dir: 'north', dx: 0, dy: -1 },
      { dir: 'south', dx: 0, dy: 1 },
      { dir: 'east', dx: 1, dy: 0 },
      { dir: 'west', dx: -1, dy: 0 },
    ];

    const exits = directions.map(({ dir, dx, dy }, index) => {
      const destX = x + dx;
      const destY = y + dy;
      const destRoomId = makeRoomId(destX, destY, z);
      const description = this.generateExitDescription(x, y, z, destX, destY, z, dir, seed + index);

      return {
        direction: dir,
        destinationRoomId: destRoomId,
        description,
      };
    });

    return exits;
  }

  /**
   * Generate a contextual exit description based on what's actually in that direction.
   */
  private generateExitDescription(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    direction: string,
    seed: number,
  ): string {
    // Check if destination is a settlement
    const destIsSettlement = this.worldRegionService.isSettlementLocation(toX, toY, toZ);
    const destSize = destIsSettlement ? this.worldRegionService.getSettlementSize(toX, toY, toZ) : null;

    // Check if destination room is already cached (we know what's there)
    const destRoomId = makeRoomId(toX, toY, toZ);
    const cachedRoom = this.roomCache.get(destRoomId);

    // Format direction phrase naturally (cardinal vs vertical)
    const directionPhrase = direction === 'up' ? 'above'
      : direction === 'down' ? 'below'
      : `to the ${direction}`;

    // Generate description based on what's actually there
    if (destIsSettlement && destSize) {
      // Generate the settlement name deterministically to preview it
      const settlementSeed = this.generateSeed(toX, toY, toZ);
      const settlementName = cachedRoom?.name || this.previewSettlementName(toX, toY, toZ, settlementSeed);
      return direction === 'up' || direction === 'down'
        ? `${settlementName}, a ${destSize}, lies ${directionPhrase}`
        : `${directionPhrase.charAt(0).toUpperCase() + directionPhrase.slice(1)} lies ${settlementName}, a ${destSize}`;
    }

    if (cachedRoom) {
      // We've been there - show its name
      return `${cachedRoom.name} lies ${directionPhrase}`;
    }

    // Unknown wilderness - give a hint about the terrain
    return `Unexplored wilderness ${directionPhrase}`;
  }

  /**
   * Preview a settlement name without fully generating the settlement.
   * Uses the same logic as SettlementGeneratorService for consistency.
   */
  private previewSettlementName(x: number, y: number, z: number, seed: number): string {
    // Simple name generation matching the settlement generator's approach
    const rng = this.seededRandom(seed);

    const prefixes = ['North', 'South', 'East', 'West', 'Old', 'New', 'Fort', 'High', 'Low'];
    const roots = ['haven', 'ford', 'bridge', 'dale', 'vale', 'brook', 'field', 'wood', 'stone', 'mill'];
    const suffixes = ['ton', 'ville', 'bury', 'ham', 'stead', ''];

    const usePrefix = rng() < 0.4;
    const useSuffix = rng() < 0.5;

    let name = '';
    if (usePrefix) {
      name = prefixes[Math.floor(rng() * prefixes.length)] + ' ';
    }

    const root = roots[Math.floor(rng() * roots.length)];
    name += root.charAt(0).toUpperCase() + root.slice(1);

    if (useSuffix) {
      name += suffixes[Math.floor(rng() * suffixes.length)];
    }

    return name;
  }

  /**
   * Add biome-aware descriptions to wilderness exits.
   */
  private addExitDescriptions(
    x: number,
    y: number,
    z: number,
    exits: Array<{ direction: string; destinationRoomId?: string; description?: string }>,
    currentBiomeId: string,
    seed: number,
  ): Array<{ direction: string; destinationRoomId?: string; description?: string }> {
    const directionOffsets: Record<string, { dx: number; dy: number; dz: number }> = {
      north: { dx: 0, dy: -1, dz: 0 },
      south: { dx: 0, dy: 1, dz: 0 },
      east: { dx: 1, dy: 0, dz: 0 },
      west: { dx: -1, dy: 0, dz: 0 },
      up: { dx: 0, dy: 0, dz: 1 },
      down: { dx: 0, dy: 0, dz: -1 },
    };

    return exits.map((exit, index) => {
      // If exit already has a good description, keep it
      if (exit.description && !exit.description.includes('A path leading')) {
        return exit;
      }

      const offset = directionOffsets[exit.direction];
      if (!offset) {
        return exit;
      }

      const destX = x + offset.dx;
      const destY = y + offset.dy;
      const destZ = z + offset.dz;

      // Generate contextual description
      const description = this.generateWildernessExitDescription(
        exit.direction,
        currentBiomeId,
        destX,
        destY,
        destZ,
        seed + index,
      );

      return { ...exit, description };
    });
  }

  /**
   * Generate a description for a wilderness exit based on biome and destination.
   */
  private generateWildernessExitDescription(
    direction: string,
    currentBiomeId: string,
    destX: number,
    destY: number,
    destZ: number,
    seed: number,
  ): string {
    // Check if destination is a settlement
    const destIsSettlement = this.worldRegionService.isSettlementLocation(destX, destY, destZ);
    const destSize = destIsSettlement ? this.worldRegionService.getSettlementSize(destX, destY, destZ) : null;

    // Check if destination room is already cached
    const destRoomId = makeRoomId(destX, destY, destZ);
    const cachedRoom = this.roomCache.get(destRoomId);

    // Format direction phrase naturally (cardinal vs vertical)
    const isVertical = direction === 'up' || direction === 'down';
    const directionPhrase = direction === 'up' ? 'above'
      : direction === 'down' ? 'below'
      : `to the ${direction}`;

    if (destIsSettlement && destSize) {
      const settlementSeed = this.generateSeed(destX, destY, destZ);
      const settlementName = cachedRoom?.name || this.previewSettlementName(destX, destY, destZ, settlementSeed);
      return isVertical
        ? `${settlementName} (${destSize}) lies ${directionPhrase}`
        : `${settlementName} (${destSize}) ${directionPhrase}`;
    }

    if (cachedRoom) {
      return isVertical
        ? `${cachedRoom.name} lies ${directionPhrase}`
        : `${cachedRoom.name} ${directionPhrase}`;
    }

    // Handle vertical exits specially for unknown destinations
    if (direction === 'up') {
      return 'A passage leads upward';
    }

    if (direction === 'down') {
      return 'A passage descends into darkness';
    }

    // Unknown wilderness - brief hint based on current biome
    const biomeHints: Record<string, string> = {
      wilderness: `Wilderness to the ${direction}`,
      caves: `Dark tunnels to the ${direction}`,
      ruins: `More ruins to the ${direction}`,
    };

    return biomeHints[currentBiomeId] || `Unexplored terrain to the ${direction}`;
  }

  private generateSettlementDescription(
    settlement: SettlementData,
    buildings: BuildingData[],
    npcs: NPCData[],
  ): string {
    let desc = `You ${this.getArrivalPhrase()} ${settlement.name}, `;

    // Add settlement size and culture
    const cultureDesc = this.getCultureDescription(settlement.culture);
    desc += `a ${settlement.size} ${cultureDesc}. `;

    // Add problem if exists
    if (settlement.problem) {
      desc += `The air is tense - ${settlement.problem.shortDesc}. `;
    } else {
      desc += `The settlement seems peaceful. `;
    }

    // List visible buildings (up to 4)
    if (buildings.length > 0) {
      desc += `\n\nYou can see: `;
      const visibleBuildings = buildings.slice(0, 4);
      const buildingNames = visibleBuildings.map(b => b.name);

      if (buildingNames.length === 1) {
        desc += buildingNames[0];
      } else if (buildingNames.length === 2) {
        desc += `${buildingNames[0]} and ${buildingNames[1]}`;
      } else {
        desc += buildingNames.slice(0, -1).join(', ') + `, and ${buildingNames[buildingNames.length - 1]}`;
      }

      if (buildings.length > 4) {
        desc += `, and more`;
      }
      desc += `.`;
    }

    return desc;
  }

  private getArrivalPhrase(): string {
    const phrases = ['arrive at', 'stand before', 'approach', 'enter'];
    // Use a simple deterministic selection (could be randomized with seed if desired)
    return phrases[0];
  }

  private getCultureDescription(culture: string): string {
    const descriptions: Record<string, string> = {
      frontier: 'on the edge of civilization',
      religious: 'of devout worshippers',
      merchant: 'bustling with trade',
      military: 'fortified and guarded',
      pastoral: 'of simple folk',
    };
    return descriptions[culture] || 'settlement';
  }

  // Conversion helpers to client-safe Info types
  private toSettlementInfo(settlement: SettlementData): SettlementInfo {
    return {
      id: settlement.id,
      name: settlement.name,
      size: settlement.size,
      population: settlement.population,
      culture: settlement.culture,
      problemSummary: settlement.problem?.shortDesc,
    };
  }

  private toNPCInfo(npc: NPCData, buildings: BuildingData[]): NPCInfo {
    // Find building this NPC is in
    const building = buildings.find(b => b.npcIds.includes(npc.id));

    return {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      greeting: npc.greeting,
      location: building?.name,
    };
  }

  private toBuildingInfo(building: BuildingData): BuildingInfo {
    return {
      id: building.id,
      name: building.name,
      type: building.type,
      description: building.description,
      hasShop: !!building.inventory && building.inventory.length > 0,
    };
  }

  private toQuestInfo(quest: QuestData, npcs: NPCData[]): QuestInfo {
    const giver = npcs.find(n => n.id === quest.giverNpcId);

    return {
      id: quest.id,
      name: quest.name,
      type: quest.type,
      description: quest.description,
      giverName: giver?.name || 'Unknown',
      difficulty: quest.difficulty,
      status: quest.status,
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

    // Check in-memory cache first
    for (const { dx, dy, dz } of offsets) {
      const adjX = x + dx;
      const adjY = y + dy;
      const adjZ = z + dz;
      const adjId = makeRoomId(adjX, adjY, adjZ);

      const cachedRoom = this.roomCache.get(adjId);
      if (cachedRoom) {
        // Extract biome from cached room - we need to infer it from the room
        // For now, we'll skip cached rooms in adjacency check since we don't store biome
        continue;
      }
    }

    // Check database if available
    if (!this.em) {
      return adjacentRooms;
    }

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

  /**
   * Ensure bidirectional exits by checking if adjacent cached rooms have exits pointing to this room.
   * If an adjacent room has an exit to us, we must have a return exit to maintain navigation consistency.
   */
  private ensureBidirectionalExits(
    x: number,
    y: number,
    z: number,
    exits: Array<{ direction: string; destinationRoomId?: string; description?: string }>,
  ): Array<{ direction: string; destinationRoomId?: string; description?: string }> {
    const directionOffsets: Record<string, { dx: number; dy: number; dz: number; opposite: string }> = {
      north: { dx: 0, dy: -1, dz: 0, opposite: 'south' },
      south: { dx: 0, dy: 1, dz: 0, opposite: 'north' },
      east: { dx: 1, dy: 0, dz: 0, opposite: 'west' },
      west: { dx: -1, dy: 0, dz: 0, opposite: 'east' },
      up: { dx: 0, dy: 0, dz: 1, opposite: 'down' },
      down: { dx: 0, dy: 0, dz: -1, opposite: 'up' },
    };

    const currentRoomId = makeRoomId(x, y, z);
    const resultExits = [...exits];

    // Check each direction for adjacent cached rooms
    for (const [direction, { dx, dy, dz, opposite }] of Object.entries(directionOffsets)) {
      const adjX = x + dx;
      const adjY = y + dy;
      const adjZ = z + dz;
      const adjRoomId = makeRoomId(adjX, adjY, adjZ);

      // Check if this adjacent room is in the cache
      const cachedRoom = this.roomCache.get(adjRoomId);
      if (!cachedRoom) {
        continue;
      }

      // Check if the cached room has an exit pointing to the current room
      const hasExitToUs = cachedRoom.exits.some(
        (exit) => exit.roomId === currentRoomId || exit.direction === opposite,
      );

      if (hasExitToUs) {
        // Check if we already have an exit in this direction
        const hasExitInDirection = resultExits.some((e) => e.direction === direction);

        if (!hasExitInDirection) {
          // Add the return exit with contextual description
          const exitSeed = this.generateSeed(x, y, z) + direction.length;
          const description = this.generateExitDescription(x, y, z, adjX, adjY, adjZ, direction, exitSeed);
          resultExits.push({
            direction,
            destinationRoomId: adjRoomId,
            description,
          });
        }
      }
    }

    return resultExits;
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
