import { create } from 'zustand';
import type {
  CharacterStats,
  CombatState,
  Equipment,
  GameState,
  InventoryItem,
  ItemDefinition,
  NarrativeMessage,
  RoomDefinition,
  PlayerSkill,
  SkillDefinition,
  RoomResourceNode,
} from '@verdantia/shared';
import { GamePhase } from '@verdantia/shared';

interface GameStore {
  // Connection
  sessionId: string | null;
  hasSavedGame: boolean;
  isConnected: boolean;
  isProcessingCommand: boolean;

  // Game state (mirrors server GameState)
  phase: GamePhase;
  playerName: string;
  stats: CharacterStats;
  currentRoomId: string;
  currentRoom: RoomDefinition | null;
  inventory: InventoryItem[];
  equipment: Equipment;
  combat: CombatState | null;
  gold: number;
  itemDefinitions: Record<string, ItemDefinition>;
  skills: PlayerSkill[];
  skillDefinitions: Record<string, SkillDefinition>;
  currentRoomResources: RoomResourceNode[];

  // Client-side accumulated message history
  messageHistory: NarrativeMessage[];

  // Actions
  setConnected: (sessionId: string, hasSavedGame: boolean) => void;
  setDisconnected: () => void;
  applyStateUpdate: (state: GameState) => void;
  setProcessing: (processing: boolean) => void;
  resetToTitle: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  hasSavedGame: false,
  isConnected: false,
  isProcessingCommand: false,

  phase: GamePhase.TITLE,
  playerName: '',
  stats: { maxHp: 0, hp: 0, attack: 0, defense: 0, speed: 0, level: 0, xp: 0 },
  currentRoomId: '',
  currentRoom: null,
  inventory: [],
  equipment: {},
  combat: null,
  gold: 0,
  itemDefinitions: {},
  skills: [],
  skillDefinitions: {},
  currentRoomResources: [],

  messageHistory: [],

  setConnected: (sessionId, hasSavedGame) =>
    set({ sessionId, hasSavedGame, isConnected: true }),

  setDisconnected: () =>
    set({ isConnected: false, sessionId: null }),

  applyStateUpdate: (state) =>
    set((prev) => ({
      phase: state.phase,
      playerName: state.playerName,
      stats: state.stats,
      currentRoomId: state.currentRoomId,
      currentRoom: state.currentRoom,
      inventory: state.inventory,
      equipment: state.equipment,
      combat: state.combat,
      gold: state.gold,
      itemDefinitions: { ...prev.itemDefinitions, ...state.itemDefinitions },
      skills: state.skills,
      skillDefinitions: { ...prev.skillDefinitions, ...state.skillDefinitions },
      currentRoomResources: state.currentRoomResources,
      messageHistory: [...prev.messageHistory, ...state.messages],
      isProcessingCommand: false,
    })),

  setProcessing: (processing) =>
    set({ isProcessingCommand: processing }),

  resetToTitle: () =>
    set({
      phase: GamePhase.TITLE,
      playerName: '',
      stats: { maxHp: 0, hp: 0, attack: 0, defense: 0, speed: 0, level: 0, xp: 0 },
      currentRoomId: '',
      currentRoom: null,
      inventory: [],
      equipment: {},
      combat: null,
      gold: 0,
      messageHistory: [],
      itemDefinitions: {},
      skills: [],
      skillDefinitions: {},
      currentRoomResources: [],
    }),
}));
