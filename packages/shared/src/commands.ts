export enum CommandType {
  // Movement
  MOVE = 'move',
  LOOK = 'look',

  // Combat
  ATTACK = 'attack',
  DEFEND = 'defend',
  FLEE = 'flee',

  // Inventory
  TAKE = 'take',
  DROP = 'drop',
  USE = 'use',
  EQUIP = 'equip',
  UNEQUIP = 'unequip',
  INVENTORY = 'inventory',

  // Skills
  GATHER = 'gather',
  CRAFT = 'craft',
  RECIPES = 'recipes',
  SKILLS = 'skills',

  // Game
  NEW_GAME = 'new_game',
  SAVE = 'save',
  LOAD = 'load',
  HELP = 'help',
}

export interface GameCommand {
  type: CommandType;
  payload?: Record<string, unknown>;
}

export interface MovePayload {
  direction: string;
}

export interface TakePayload {
  itemId: string;
}

export interface DropPayload {
  itemId: string;
}

export interface UsePayload {
  itemId: string;
}

export interface EquipPayload {
  itemId: string;
}

export interface UnequipPayload {
  slot: string;
}

export interface NewGamePayload {
  playerName: string;
}

export interface SavePayload {
  slotName: string;
}

export interface LoadPayload {
  slotName: string;
}

export interface GatherPayload {
  nodeId: string;
}

export interface CraftPayload {
  recipeId: string;
}
