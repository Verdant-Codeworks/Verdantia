import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { ItemDefinition as SharedItemDefinition, EnemyDefinition as SharedEnemyDefinition, ResourceNodeDefinition as SharedResourceNodeDefinition } from '@verdantia/shared';
import { ItemDefinition } from '../../entities/item-definition.entity';
import { EnemyDefinition } from '../../entities/enemy-definition.entity';
import { BiomeDefinition } from '../../entities/biome-definition.entity';
import { ResourceNodeDefinition } from '../../entities/resource-node-definition.entity';
import * as path from 'path';
import * as fs from 'fs';

export interface BiomeData {
  id: string;
  name: string;
  nameTemplates: string[];
  descriptionTemplates: string[];
  baseEncounterChance: number;
}

@Injectable()
export class DefinitionService implements OnModuleInit {
  private readonly logger = new Logger(DefinitionService.name);

  // JSON fallback caches
  private itemCache = new Map<string, SharedItemDefinition>();
  private enemyCache = new Map<string, SharedEnemyDefinition>();
  private biomeCache = new Map<string, BiomeData>();
  private resourceCache = new Map<string, SharedResourceNodeDefinition>();

  constructor(@Optional() private readonly em: EntityManager | null) {}

  async onModuleInit() {
    await this.loadJsonFallbacks();
  }

  private async loadJsonFallbacks() {
    const dataDir = path.join(__dirname, 'data');

    // Load items
    const itemsData: SharedItemDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'items.json'), 'utf-8'),
    );
    for (const item of itemsData) {
      this.itemCache.set(item.id, item);
    }
    this.logger.log(`Loaded ${this.itemCache.size} items (JSON fallback)`);

    // Load enemies
    const enemiesData: SharedEnemyDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf-8'),
    );
    for (const enemy of enemiesData) {
      this.enemyCache.set(enemy.id, enemy);
    }
    this.logger.log(`Loaded ${this.enemyCache.size} enemies (JSON fallback)`);

    // Load resources
    const resourcesData: SharedResourceNodeDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'resources.json'), 'utf-8'),
    );
    for (const resource of resourcesData) {
      this.resourceCache.set(resource.id, resource);
    }
    this.logger.log(`Loaded ${this.resourceCache.size} resources (JSON fallback)`);

    // Load biome fallbacks
    const defaultBiomes: BiomeData[] = [
      {
        id: 'wilderness',
        name: 'Wilderness',
        nameTemplates: [
          'Windswept Clearing',
          'Grassy Meadow',
          'Overgrown Trail',
          'Forest Edge',
          'Rolling Hills',
          'Wild Grove',
        ],
        descriptionTemplates: [
          'Tall grasses sway in the breeze across an open expanse. Scattered wildflowers dot the landscape.',
          'A clearing surrounded by towering trees. Sunlight filters through the canopy.',
          'The trail here is barely visible, overgrown with vegetation.',
        ],
        baseEncounterChance: 0.3,
      },
      {
        id: 'caves',
        name: 'Caves',
        nameTemplates: [
          'Dark Tunnel',
          'Cave Passage',
          'Underground Chamber',
          'Stone Cavern',
          'Crystal Grotto',
        ],
        descriptionTemplates: [
          'The rough stone walls glisten with moisture. The air is cool and still.',
          'Jagged rock formations jut from the floor and ceiling. Your footsteps echo.',
          'A vast cavern opens before you, its ceiling lost in shadow.',
        ],
        baseEncounterChance: 0.4,
      },
      {
        id: 'ruins',
        name: 'Ruins',
        nameTemplates: [
          'Crumbling Courtyard',
          'Ancient Hall',
          'Ruined Temple',
          'Collapsed Tower',
          'Forgotten Plaza',
        ],
        descriptionTemplates: [
          'Weathered stone structures stand as silent monuments to a forgotten age.',
          'Marble columns lie broken across the ground. Whatever grandeur this place once held is now a distant memory.',
          'Faded murals on crumbling walls hint at the civilization that built this place.',
        ],
        baseEncounterChance: 0.35,
      },
    ];

    for (const biome of defaultBiomes) {
      this.biomeCache.set(biome.id, biome);
    }
    this.logger.log(`Loaded ${this.biomeCache.size} biomes (JSON fallback)`);
    this.logger.log('DefinitionService initialized');
  }

  async getItem(id: string): Promise<SharedItemDefinition | undefined> {
    if (this.em) {
      try {
        const entity = await this.em.findOne(ItemDefinition, { id });
        if (entity) {
          return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            type: entity.type as any,
            equipSlot: entity.equipSlot as any,
            effect: entity.effect,
            value: entity.value,
          };
        }
      } catch (error) {
        this.logger.debug(`DB lookup failed for item ${id}, using JSON fallback`);
      }
    }

    return this.itemCache.get(id);
  }

  async getEnemy(id: string): Promise<SharedEnemyDefinition | undefined> {
    if (this.em) {
      try {
        const entity = await this.em.findOne(EnemyDefinition, { id });
        if (entity) {
          return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            stats: entity.stats,
            xpReward: entity.xpReward,
            lootTable: entity.lootTable,
          };
        }
      } catch (error) {
        this.logger.debug(`DB lookup failed for enemy ${id}, using JSON fallback`);
      }
    }

    return this.enemyCache.get(id);
  }

  async getBiome(id: string): Promise<BiomeData | undefined> {
    if (this.em) {
      try {
        const entity = await this.em.findOne(BiomeDefinition, { id });
        if (entity) {
          return {
            id: entity.id,
            name: entity.name,
            nameTemplates: entity.nameTemplates,
            descriptionTemplates: entity.descriptionTemplates,
            baseEncounterChance: entity.baseEncounterChance,
          };
        }
      } catch (error) {
        this.logger.debug(`DB lookup failed for biome ${id}, using fallback`);
      }
    }

    return this.biomeCache.get(id);
  }

  async getResource(id: string): Promise<SharedResourceNodeDefinition | undefined> {
    // Resource definitions have complex fields not stored in the simple entity,
    // so we always use the JSON cache for complete definitions
    return this.resourceCache.get(id);
  }

  async getAllBiomes(): Promise<BiomeData[]> {
    if (this.em) {
      try {
        const entities = await this.em.find(BiomeDefinition, {});
        if (entities.length > 0) {
          return entities.map(e => ({
            id: e.id,
            name: e.name,
            nameTemplates: e.nameTemplates,
            descriptionTemplates: e.descriptionTemplates,
            baseEncounterChance: e.baseEncounterChance,
          }));
        }
      } catch (error) {
        this.logger.debug('DB lookup failed for biomes, using fallback');
      }
    }

    return Array.from(this.biomeCache.values());
  }
}
