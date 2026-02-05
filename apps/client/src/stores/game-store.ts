import { create } from 'zustand';
import type {
  CharacterStats,
  CombatState,
  Equipment,
  GameState,
  InventoryItem,
  ItemDefinition,
  NarrativeMessage,
  RoomCoordinates,
  RoomDefinition,
  PlayerSkill,
  SkillDefinition,
  RoomResourceNode,
  VisitedRoomSnapshot,
} from '@verdantia/shared';
import {
  GamePhase,
  isProcedural,
  parseCoords,
} from '@verdantia/shared';

interface GameStore {
  // Connection
  sessionId: string | null;
  hasSavedGame: boolean;
  isConnected: boolean;
  isProcessingCommand: boolean;

  // Authentication
  inviteCode: string | null;
  authError: string | null;

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
  visitedRooms: Record<string, VisitedRoomSnapshot>;
  roomCoordinates: Record<string, RoomCoordinates>;

  // Map modal state
  isMapModalOpen: boolean;

  // Procedural world viewport
  proceduralViewport: {
    centerX: number;
    centerY: number;
    centerZ: number;
  } | null;

  // Client-side accumulated message history
  messageHistory: NarrativeMessage[];

  // Actions
  setConnected: (sessionId: string, hasSavedGame: boolean) => void;
  setDisconnected: () => void;
  applyStateUpdate: (state: GameState) => void;
  setProcessing: (processing: boolean) => void;
  resetToTitle: () => void;
  setInviteCode: (code: string | null) => void;
  setAuthError: (error: string | null) => void;
  setMapModalOpen: (open: boolean) => void;
  addCommandEcho: (commandText: string) => void;
}

// Re-export procedural helpers from shared package for convenience
export { isProcedural, parseCoords } from '@verdantia/shared';

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  hasSavedGame: false,
  isConnected: false,
  isProcessingCommand: false,

  inviteCode: null,
  authError: null,

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
  visitedRooms: {},
  roomCoordinates: {},

  isMapModalOpen: false,

  proceduralViewport: null,

  messageHistory: [],

  setConnected: (sessionId, hasSavedGame) =>
    set({ sessionId, hasSavedGame, isConnected: true }),

  setDisconnected: () =>
    set({ isConnected: false, sessionId: null }),

  applyStateUpdate: (state) =>
    set((prev) => {
      // Update procedural viewport if entering a procedural room
      let newViewport = prev.proceduralViewport;
      if (state.currentRoomId && isProcedural(state.currentRoomId)) {
        const coords = parseCoords(state.currentRoomId);
        if (coords) {
          newViewport = {
            centerX: coords.x,
            centerY: coords.y,
            centerZ: coords.z,
          };
        }
      }

      return {
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
        visitedRooms: { ...prev.visitedRooms, ...state.visitedRooms },
        roomCoordinates: state.roomCoordinates,
        proceduralViewport: newViewport,
        messageHistory: [...prev.messageHistory, ...state.messages],
        isProcessingCommand: false,
      };
    }),

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
      visitedRooms: {},
      roomCoordinates: {},
      isMapModalOpen: false,
      proceduralViewport: null,
    }),

  setInviteCode: (code) =>
    set({ inviteCode: code, authError: null }),

  setAuthError: (error) =>
    set({ authError: error }),

  setMapModalOpen: (open) =>
    set({ isMapModalOpen: open }),

  addCommandEcho: (commandText) =>
    set((prev) => ({
      messageHistory: [
        ...prev.messageHistory,
        {
          id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: `> ${commandText}`,
          type: 'command' as const,
          timestamp: Date.now(),
        },
      ],
    })),
}));
