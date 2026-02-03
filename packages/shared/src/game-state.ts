import type {
  CharacterStats,
  Equipment,
  InventoryItem,
  ItemDefinition,
  RoomCoordinates,
  RoomDefinition,
  VisitedRoomSnapshot,
} from './entities.js';
import type {
  PlayerSkill,
  RoomResourceNode,
  SkillDefinition,
} from './skills.js';

export enum GamePhase {
  TITLE = 'title',
  EXPLORATION = 'exploration',
  COMBAT = 'combat',
  GAME_OVER = 'game_over',
  VICTORY = 'victory',
}

export interface CombatState {
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyDefense: number;
  enemySpeed: number;
  isPlayerTurn: boolean;
  turnCount: number;
}

export interface NarrativeMessage {
  id: string;
  text: string;
  type: 'narrative' | 'combat' | 'system' | 'error' | 'loot' | 'levelup' | 'skill';
  timestamp: number;
}

export interface GameState {
  phase: GamePhase;
  playerName: string;
  stats: CharacterStats;
  currentRoomId: string;
  currentRoom: RoomDefinition;
  inventory: InventoryItem[];
  equipment: Equipment;
  combat: CombatState | null;
  messages: NarrativeMessage[];
  gold: number;
  itemDefinitions: Record<string, ItemDefinition>; // items the player has seen
  skills: PlayerSkill[];
  skillDefinitions: Record<string, SkillDefinition>;
  currentRoomResources: RoomResourceNode[];
  visitedRooms: Record<string, VisitedRoomSnapshot>;
  roomCoordinates: Record<string, RoomCoordinates>;
}
