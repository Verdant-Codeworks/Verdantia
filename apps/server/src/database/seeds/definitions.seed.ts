import { EntityManager } from '@mikro-orm/core';
import { ItemDefinition } from '../../entities/item-definition.entity';
import { EnemyDefinition } from '../../entities/enemy-definition.entity';
import { BiomeDefinition } from '../../entities/biome-definition.entity';
import { BiomeCompatibility } from '../../entities/biome-compatibility.entity';
import { BiomeEnemyPool } from '../../entities/biome-enemy-pool.entity';
import { BiomeItemPool } from '../../entities/biome-item-pool.entity';
import { ResourceNodeDefinition } from '../../entities/resource-node-definition.entity';
import { BiomeResourcePool } from '../../entities/biome-resource-pool.entity';
import * as path from 'path';
import * as fs from 'fs';

export async function seedDefinitions(em: EntityManager): Promise<void> {
  console.log('Seeding definitions...');

  // Load JSON data
  const dataDir = path.join(__dirname, '../../game/world/data');
  const itemsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'items.json'), 'utf-8'));
  const enemiesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf-8'));
  const resourcesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'resources.json'), 'utf-8'));

  // Seed items
  const now = new Date();
  for (const item of itemsData) {
    const existing = await em.findOne(ItemDefinition, { id: item.id });
    if (!existing) {
      em.create(ItemDefinition, {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        equipSlot: item.equipSlot,
        effect: item.effect,
        value: item.value,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await em.flush();
  console.log(`Seeded ${itemsData.length} items`);

  // Seed enemies
  for (const enemy of enemiesData) {
    const existing = await em.findOne(EnemyDefinition, { id: enemy.id });
    if (!existing) {
      em.create(EnemyDefinition, {
        id: enemy.id,
        name: enemy.name,
        description: enemy.description,
        stats: enemy.stats,
        xpReward: enemy.xpReward,
        lootTable: enemy.lootTable,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await em.flush();
  console.log(`Seeded ${enemiesData.length} enemies`);

  // Seed resources
  for (const resource of resourcesData) {
    const existing = await em.findOne(ResourceNodeDefinition, { id: resource.id });
    if (!existing) {
      em.create(ResourceNodeDefinition, {
        id: resource.id,
        name: resource.name,
        description: resource.description,
        requiredTool: resource.requiredTool,
        yields: resource.yields,
        respawnTime: resource.respawnTime,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await em.flush();
  console.log(`Seeded ${resourcesData.length} resources`);

  // Seed biomes
  const biomesData = [
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
        'Open Grassland',
        'Wooded Thicket',
      ],
      descriptionTemplates: [
        'Tall grasses sway in the breeze across an open expanse. Scattered wildflowers dot the landscape, and birds circle overhead.',
        'A clearing surrounded by towering trees. Sunlight filters through the canopy, dappling the ground with light and shadow.',
        'The trail here is barely visible, overgrown with vegetation. Nature has reclaimed this path long ago.',
        'You stand at the edge of a dense forest. The trees create a natural wall, but gaps between them suggest possible paths.',
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
        'Echoing Hall',
        'Mineral Vein',
        'Deep Cave',
      ],
      descriptionTemplates: [
        'The rough stone walls glisten with moisture. The air is cool and still, broken only by the occasional drip of water.',
        'Jagged rock formations jut from the floor and ceiling. Your footsteps echo in the darkness.',
        'A vast cavern opens before you, its ceiling lost in shadow. Strange rock formations create natural pillars.',
        'Crystals embedded in the walls catch what little light exists, casting prismatic patterns across the stone.',
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
        'Overgrown Ruins',
        'Broken Sanctuary',
        'Lost Archives',
      ],
      descriptionTemplates: [
        'Weathered stone structures stand as silent monuments to a forgotten age. Vines and moss cover ancient carvings.',
        'Marble columns lie broken across the ground. Whatever grandeur this place once held is now a distant memory.',
        'Faded murals on crumbling walls hint at the civilization that built this place. Time has not been kind.',
        'Archways lead to chambers choked with rubble. The architecture suggests this was once a place of great importance.',
      ],
      baseEncounterChance: 0.35,
    },
  ];

  for (const biomeData of biomesData) {
    const existing = await em.findOne(BiomeDefinition, { id: biomeData.id });
    if (!existing) {
      em.create(BiomeDefinition, {
        id: biomeData.id,
        name: biomeData.name,
        nameTemplates: biomeData.nameTemplates,
        descriptionTemplates: biomeData.descriptionTemplates,
        baseEncounterChance: biomeData.baseEncounterChance,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await em.flush();
  console.log(`Seeded ${biomesData.length} biomes`);

  // Seed biome compatibilities
  const compatibilityData = [
    // Wilderness is compatible with all biomes
    { biome: 'wilderness', compatibleWith: 'wilderness' },
    { biome: 'wilderness', compatibleWith: 'caves' },
    { biome: 'wilderness', compatibleWith: 'ruins' },
    // Caves are compatible with wilderness and caves
    { biome: 'caves', compatibleWith: 'wilderness' },
    { biome: 'caves', compatibleWith: 'caves' },
    // Ruins are compatible with wilderness and ruins
    { biome: 'ruins', compatibleWith: 'wilderness' },
    { biome: 'ruins', compatibleWith: 'ruins' },
  ];

  for (const compat of compatibilityData) {
    const biome = await em.findOne(BiomeDefinition, { id: compat.biome });
    const compatible = await em.findOne(BiomeDefinition, { id: compat.compatibleWith });

    if (biome && compatible) {
      const existing = await em.findOne(BiomeCompatibility, {
        biome: biome.id,
        compatibleWith: compatible.id,
      });

      if (!existing) {
        em.create(BiomeCompatibility, {
          biome,
          compatibleWith: compatible,
        });
      }
    }
  }
  await em.flush();
  console.log(`Seeded ${compatibilityData.length} biome compatibilities`);

  // Seed biome enemy pools
  const enemyPoolData = [
    // Wilderness enemies
    { biome: 'wilderness', enemy: 'forest_spider', minDifficulty: 1, maxDifficulty: 3, spawnWeight: 3 },
    { biome: 'wilderness', enemy: 'wild_wolf', minDifficulty: 1, maxDifficulty: 4, spawnWeight: 3 },
    { biome: 'wilderness', enemy: 'goblin', minDifficulty: 2, maxDifficulty: 5, spawnWeight: 2 },
    { biome: 'wilderness', enemy: 'bandit', minDifficulty: 3, maxDifficulty: 7, spawnWeight: 2 },
    // Cave enemies
    { biome: 'caves', enemy: 'cave_bat', minDifficulty: 1, maxDifficulty: 4, spawnWeight: 4 },
    { biome: 'caves', enemy: 'goblin', minDifficulty: 1, maxDifficulty: 6, spawnWeight: 3 },
    { biome: 'caves', enemy: 'giant_spider', minDifficulty: 3, maxDifficulty: 8, spawnWeight: 2 },
    { biome: 'caves', enemy: 'goblin_chief', minDifficulty: 5, maxDifficulty: 10, spawnWeight: 1 },
    // Ruins enemies
    { biome: 'ruins', enemy: 'goblin', minDifficulty: 2, maxDifficulty: 6, spawnWeight: 3 },
    { biome: 'ruins', enemy: 'bandit', minDifficulty: 3, maxDifficulty: 8, spawnWeight: 2 },
    { biome: 'ruins', enemy: 'stone_golem', minDifficulty: 6, maxDifficulty: 10, spawnWeight: 1 },
  ];

  for (const pool of enemyPoolData) {
    const biome = await em.findOne(BiomeDefinition, { id: pool.biome });
    const enemy = await em.findOne(EnemyDefinition, { id: pool.enemy });

    if (biome && enemy) {
      const existing = await em.findOne(BiomeEnemyPool, {
        biome: biome.id,
        enemy: enemy.id,
        minDifficulty: pool.minDifficulty,
        maxDifficulty: pool.maxDifficulty,
      });

      if (!existing) {
        em.create(BiomeEnemyPool, {
          biome,
          enemy,
          minDifficulty: pool.minDifficulty,
          maxDifficulty: pool.maxDifficulty,
          spawnWeight: pool.spawnWeight,
        });
      }
    }
  }
  await em.flush();
  console.log(`Seeded ${enemyPoolData.length} biome enemy pools`);

  // Seed biome item pools
  const itemPoolData = [
    // Wilderness items
    { biome: 'wilderness', item: 'healing_herb', minDifficulty: 1, maxDifficulty: 10, spawnWeight: 5 },
    { biome: 'wilderness', item: 'health_potion', minDifficulty: 2, maxDifficulty: 10, spawnWeight: 3 },
    { biome: 'wilderness', item: 'gold_pouch', minDifficulty: 1, maxDifficulty: 10, spawnWeight: 2 },
    // Cave items
    { biome: 'caves', item: 'mushroom', minDifficulty: 1, maxDifficulty: 10, spawnWeight: 4 },
    { biome: 'caves', item: 'torch', minDifficulty: 1, maxDifficulty: 10, spawnWeight: 3 },
    { biome: 'caves', item: 'health_potion', minDifficulty: 3, maxDifficulty: 10, spawnWeight: 2 },
    { biome: 'caves', item: 'gold_pouch', minDifficulty: 2, maxDifficulty: 10, spawnWeight: 2 },
    // Ruins items
    { biome: 'ruins', item: 'health_potion', minDifficulty: 2, maxDifficulty: 10, spawnWeight: 3 },
    { biome: 'ruins', item: 'greater_health_potion', minDifficulty: 5, maxDifficulty: 10, spawnWeight: 2 },
    { biome: 'ruins', item: 'gold_pouch', minDifficulty: 3, maxDifficulty: 10, spawnWeight: 3 },
    { biome: 'ruins', item: 'gold_pile', minDifficulty: 6, maxDifficulty: 10, spawnWeight: 1 },
  ];

  for (const pool of itemPoolData) {
    const biome = await em.findOne(BiomeDefinition, { id: pool.biome });
    const item = await em.findOne(ItemDefinition, { id: pool.item });

    if (biome && item) {
      const existing = await em.findOne(BiomeItemPool, {
        biome: biome.id,
        item: item.id,
        minDifficulty: pool.minDifficulty,
        maxDifficulty: pool.maxDifficulty,
      });

      if (!existing) {
        em.create(BiomeItemPool, {
          biome,
          item,
          minDifficulty: pool.minDifficulty,
          maxDifficulty: pool.maxDifficulty,
          spawnWeight: pool.spawnWeight,
        });
      }
    }
  }
  await em.flush();
  console.log(`Seeded ${itemPoolData.length} biome item pools`);

  // Seed biome resource pools
  const resourcePoolData = [
    // Wilderness resources
    { biome: 'wilderness', resource: 'oak_tree', spawnWeight: 3 },
    { biome: 'wilderness', resource: 'berry_bush', spawnWeight: 2 },
    // Cave resources
    { biome: 'caves', resource: 'copper_vein', spawnWeight: 3 },
    { biome: 'caves', resource: 'iron_vein', spawnWeight: 2 },
    { biome: 'caves', resource: 'coal_deposit', spawnWeight: 2 },
    // Ruins resources (fewer resources in ruins)
    { biome: 'ruins', resource: 'iron_vein', spawnWeight: 1 },
  ];

  for (const pool of resourcePoolData) {
    const biome = await em.findOne(BiomeDefinition, { id: pool.biome });
    const resource = await em.findOne(ResourceNodeDefinition, { id: pool.resource });

    if (biome && resource) {
      const existing = await em.findOne(BiomeResourcePool, {
        biome: biome.id,
        resource: resource.id,
      });

      if (!existing) {
        em.create(BiomeResourcePool, {
          biome,
          resource,
          spawnWeight: pool.spawnWeight,
        });
      }
    }
  }
  await em.flush();
  console.log(`Seeded ${resourcePoolData.length} biome resource pools`);

  console.log('Definitions seeding complete!');
}
