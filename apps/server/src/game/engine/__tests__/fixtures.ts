import { vi } from 'vitest';
import type {
  RoomDefinition,
  ItemDefinition,
  EnemyDefinition,
} from '@verdantia/shared';
import { GamePhase } from '@verdantia/shared';
import { GameSession } from '../game-state';

// ── Test Rooms ──────────────────────────────────────────────────────────

export const TEST_ROOMS: Record<string, RoomDefinition> = {
  forest_clearing: {
    id: 'forest_clearing',
    name: 'Forest Clearing',
    description: 'A sunlit clearing surrounded by ancient oak trees.',
    exits: [
      { direction: 'north', roomId: 'village_square', description: 'A worn path leads north.' },
      { direction: 'east', roomId: 'deep_forest', description: 'A narrow trail winds east.' },
    ],
    items: ['healing_herb'],
    enemies: [],
    coordinates: { x: 0, y: 0 },
  },
  village_square: {
    id: 'village_square',
    name: 'Village Square',
    description: 'The heart of a small woodland village.',
    exits: [
      { direction: 'south', roomId: 'forest_clearing' },
      { direction: 'west', roomId: 'blacksmith' },
    ],
    items: [],
    enemies: [],
    coordinates: { x: 0, y: -1 },
  },
  blacksmith: {
    id: 'blacksmith',
    name: "Blacksmith's Forge",
    description: 'Heat radiates from a roaring forge.',
    exits: [{ direction: 'east', roomId: 'village_square' }],
    items: ['iron_sword', 'leather_armor', 'pickaxe'],
    enemies: [],
    isShop: true,
    tags: ['forge'],
    coordinates: { x: -1, y: -1 },
  },
  deep_forest: {
    id: 'deep_forest',
    name: 'Deep Forest',
    description: 'Gnarled trees press close together here.',
    exits: [
      { direction: 'west', roomId: 'forest_clearing' },
      { direction: 'north', roomId: 'dark_hollow' },
    ],
    items: ['mushroom'],
    enemies: ['forest_spider', 'wild_wolf'],
    coordinates: { x: 1, y: 0 },
  },
};

// ── Test Items ──────────────────────────────────────────────────────────

export const TEST_ITEMS: Record<string, ItemDefinition> = {
  healing_herb: {
    id: 'healing_herb',
    name: 'Healing Herb',
    description: 'A fragrant green herb with restorative properties.',
    type: 'consumable',
    effect: { healAmount: 10 },
    value: 5,
  },
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'A small glass vial filled with glowing red liquid.',
    type: 'consumable',
    effect: { healAmount: 25 },
    value: 20,
  },
  mushroom: {
    id: 'mushroom',
    name: 'Glowing Mushroom',
    description: 'A bioluminescent fungus.',
    type: 'consumable',
    effect: { healAmount: 8 },
    value: 3,
  },
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron blade.',
    type: 'weapon',
    equipSlot: 'weapon',
    effect: { attackBonus: 3 },
    value: 30,
  },
  leather_armor: {
    id: 'leather_armor',
    name: 'Leather Armor',
    description: 'A set of hardened leather armor.',
    type: 'armor',
    equipSlot: 'armor',
    effect: { defenseBonus: 2 },
    value: 25,
  },
  enchanted_blade: {
    id: 'enchanted_blade',
    name: 'Enchanted Blade',
    description: 'A sword that glows with a faint green light.',
    type: 'weapon',
    equipSlot: 'weapon',
    effect: { attackBonus: 6, speedBonus: 1 },
    value: 100,
  },
  gold_ring: {
    id: 'gold_ring',
    name: 'Gold Ring',
    description: 'A simple gold ring, slightly tarnished.',
    type: 'misc',
    value: 40,
  },
  gold_pouch: {
    id: 'gold_pouch',
    name: 'Pouch of Gold',
    description: 'A small leather pouch jingling with gold coins.',
    type: 'misc',
    value: 50,
  },
  wolf_pelt: {
    id: 'wolf_pelt',
    name: 'Wolf Pelt',
    description: 'A thick gray wolf pelt.',
    type: 'misc',
    value: 20,
  },
  pickaxe: {
    id: 'pickaxe',
    name: 'Pickaxe',
    description: 'A sturdy iron pickaxe, essential for mining ore from rock veins.',
    type: 'tool',
    value: 15,
  },
};

// ── Test Enemies ────────────────────────────────────────────────────────

export const TEST_ENEMIES: Record<string, EnemyDefinition> = {
  forest_spider: {
    id: 'forest_spider',
    name: 'Forest Spider',
    description: 'A dog-sized spider with glistening fangs.',
    stats: { maxHp: 15, hp: 15, attack: 4, defense: 1, speed: 6 },
    xpReward: 25,
    lootTable: [{ itemId: 'healing_herb', chance: 0.3 }],
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    description: 'A small, wiry creature with green skin.',
    stats: { maxHp: 20, hp: 20, attack: 5, defense: 2, speed: 4 },
    xpReward: 30,
    lootTable: [
      { itemId: 'gold_pouch', chance: 0.2 },
      { itemId: 'healing_herb', chance: 0.4 },
    ],
  },
  wild_wolf: {
    id: 'wild_wolf',
    name: 'Wild Wolf',
    description: 'A lean gray wolf with bared fangs.',
    stats: { maxHp: 18, hp: 18, attack: 6, defense: 2, speed: 7 },
    xpReward: 35,
    lootTable: [{ itemId: 'healing_herb', chance: 0.3 }],
  },
};

// ── Mock Factories ──────────────────────────────────────────────────────

export function createMockWorldLoader() {
  return {
    getRoom: vi.fn(async (id: string) => TEST_ROOMS[id]),
    getItem: vi.fn((id: string) => TEST_ITEMS[id]),
    getEnemy: vi.fn((id: string) => TEST_ENEMIES[id]),
    getAllRooms: vi.fn(() => new Map(Object.entries(TEST_ROOMS))),
    getAllItems: vi.fn(() => new Map(Object.entries(TEST_ITEMS))),
    getAllEnemies: vi.fn(() => new Map(Object.entries(TEST_ENEMIES))),
    getSkill: vi.fn(),
    getResource: vi.fn(),
    getRecipe: vi.fn(),
    getAllSkills: vi.fn(() => new Map()),
    getAllResources: vi.fn(() => new Map()),
    getAllRecipes: vi.fn(() => new Map()),
    onModuleInit: vi.fn(),
  };
}

/**
 * Creates a GameSession already in COMBAT phase with combat state populated.
 * Defaults to fighting a forest_spider.
 */
export function createCombatSession(
  enemy: EnemyDefinition = TEST_ENEMIES.forest_spider,
): GameSession {
  const session = new GameSession('TestPlayer');
  session.phase = GamePhase.COMBAT;
  session.combat = {
    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyHp: enemy.stats.hp,
    enemyMaxHp: enemy.stats.maxHp,
    enemyAttack: enemy.stats.attack,
    enemyDefense: enemy.stats.defense,
    enemySpeed: enemy.stats.speed,
    isPlayerTurn: true,
    turnCount: 1,
  };
  return session;
}
