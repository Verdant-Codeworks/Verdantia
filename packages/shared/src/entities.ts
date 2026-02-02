export interface CharacterStats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  xp: number;
}

export interface RoomExit {
  direction: string;
  roomId: string;
  description?: string;
}

export interface RoomDefinition {
  id: string;
  name: string;
  description: string;
  exits: RoomExit[];
  items?: string[]; // item IDs present in the room
  enemies?: string[]; // enemy IDs that can spawn here
  isShop?: boolean;
}

export type ItemType = 'consumable' | 'weapon' | 'armor' | 'key' | 'misc';

export type EquipmentSlot = 'weapon' | 'armor';

export interface ItemEffect {
  healAmount?: number;
  attackBonus?: number;
  defenseBonus?: number;
  speedBonus?: number;
  maxHpBonus?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  equipSlot?: EquipmentSlot;
  effect?: ItemEffect;
  value?: number; // gold value
}

export interface EnemyDefinition {
  id: string;
  name: string;
  description: string;
  stats: Omit<CharacterStats, 'level' | 'xp'>;
  xpReward: number;
  lootTable: LootEntry[];
}

export interface LootEntry {
  itemId: string;
  chance: number; // 0-1
}

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface Equipment {
  weapon?: string; // item ID
  armor?: string; // item ID
}
