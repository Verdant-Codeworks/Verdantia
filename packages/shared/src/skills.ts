export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  xpPerLevel: number[];
}

export interface ResourceLootEntry {
  itemId: string;
  quantity: number;
  chance: number;
}

export interface ResourceNodeDefinition {
  id: string;
  name: string;
  description: string;
  skill: string;
  levelRequired: number;
  xpReward: number;
  gatherVerb: string;
  gatherMessage: string;
  lootTable: ResourceLootEntry[];
  respawnTime: number;
  toolRequired?: string;
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  description: string;
  skill: string;
  levelRequired: number;
  xpReward: number;
  craftVerb: string;
  craftingStation: string;
  ingredients: RecipeIngredient[];
  resultItemId: string;
  resultQuantity: number;
}

export interface PlayerSkill {
  skillId: string;
  xp: number;
  level: number;
}

export interface RoomResourceNode {
  nodeId: string;
  name: string;
  available: boolean;
}
