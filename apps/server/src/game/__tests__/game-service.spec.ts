import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameService } from '../game.service';
import { CommandType, GamePhase, STARTING_ROOM_ID } from '@verdantia/shared';
import type { GameCommand } from '@verdantia/shared';
import { createMockWorldLoader } from '../engine/__tests__/fixtures';

function createMockCommandProcessor() {
  return {
    process: vi.fn(),
  };
}

function createMockMovementSystem() {
  return {
    move: vi.fn(),
    look: vi.fn(),
    startCombat: vi.fn(),
  };
}

describe('GameService', () => {
  let service: GameService;
  let mockWorldLoader: ReturnType<typeof createMockWorldLoader>;
  let mockCommandProcessor: ReturnType<typeof createMockCommandProcessor>;
  let mockMovement: ReturnType<typeof createMockMovementSystem>;

  beforeEach(() => {
    mockWorldLoader = createMockWorldLoader();
    mockCommandProcessor = createMockCommandProcessor();
    mockMovement = createMockMovementSystem();

    service = new GameService(
      mockWorldLoader as any,
      mockCommandProcessor as any,
      mockMovement as any,
      undefined, // no SaveService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Session Lifecycle ───────────────────────────────────────────────

  describe('session lifecycle', () => {
    it('hasSession returns false initially', () => {
      expect(service.hasSession('socket1')).toBe(false);
    });

    it('hasSession returns true after NEW_GAME', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } };
      await service.processCommand('socket1', cmd);
      expect(service.hasSession('socket1')).toBe(true);
    });

    it('removeSession removes the session', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } };
      await service.processCommand('socket1', cmd);
      service.removeSession('socket1');
      expect(service.hasSession('socket1')).toBe(false);
    });
  });

  // ── processCommand: NEW_GAME ────────────────────────────────────────

  describe('processCommand: NEW_GAME', () => {
    it('creates a new session and returns GameState', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: { playerName: 'Eldric' } };
      const state = await service.processCommand('socket1', cmd);

      expect(state).not.toBeNull();
      expect(state!.playerName).toBe('Eldric');
      expect(state!.phase).toBe(GamePhase.EXPLORATION);
      expect(state!.currentRoomId).toBe(STARTING_ROOM_ID);
    });

    it('adds welcome messages', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: { playerName: 'Eldric' } };
      const state = await service.processCommand('socket1', cmd);

      const texts = state!.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Welcome'))).toBe(true);
      expect(texts.some((t) => t.includes('Eldric'))).toBe(true);
    });

    it('calls movement.look for initial room description', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } };
      await service.processCommand('socket1', cmd);
      expect(mockMovement.look).toHaveBeenCalled();
    });

    it('defaults playerName to "Adventurer"', async () => {
      const cmd: GameCommand = { type: CommandType.NEW_GAME, payload: {} };
      const state = await service.processCommand('socket1', cmd);
      expect(state!.playerName).toBe('Adventurer');
    });
  });

  // ── processCommand: regular commands ────────────────────────────────

  describe('processCommand: regular commands', () => {
    it('delegates to commandProcessor.process', async () => {
      // First create a session
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      const cmd: GameCommand = { type: CommandType.LOOK };
      await service.processCommand('socket1', cmd);
      expect(mockCommandProcessor.process).toHaveBeenCalled();
    });

    it('returns null for unknown socket', async () => {
      const cmd: GameCommand = { type: CommandType.LOOK };
      const state = await service.processCommand('unknown_socket', cmd);
      expect(state).toBeNull();
    });

    it('returns GameState after processing', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      const state = await service.processCommand('socket1', { type: CommandType.LOOK });
      expect(state).not.toBeNull();
      expect(state!.currentRoom).toBeDefined();
    });
  });

  // ── processCommand: SAVE/LOAD without SaveService ───────────────────

  describe('processCommand: SAVE/LOAD without SaveService', () => {
    it('SAVE returns error message when no SaveService', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      const state = await service.processCommand('socket1', { type: CommandType.SAVE, payload: { slotName: 'slot1' } });
      expect(state).not.toBeNull();
      const texts = state!.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('not available'))).toBe(true);
    });

    it('LOAD returns error message when no SaveService and session exists', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      const state = await service.processCommand('socket1', { type: CommandType.LOAD, payload: { slotName: 'slot1' } });
      expect(state).not.toBeNull();
      const texts = state!.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('not available'))).toBe(true);
    });

    it('LOAD returns null when no SaveService and no session', async () => {
      const state = await service.processCommand('socket1', { type: CommandType.LOAD, payload: { slotName: 'slot1' } });
      expect(state).toBeNull();
    });
  });

  // ── getState ────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns GameState for known session', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      const state = service.getState('socket1');
      expect(state).not.toBeNull();
      expect(state!.playerName).toBe('Hero');
    });

    it('returns null for unknown session', () => {
      const state = service.getState('unknown');
      expect(state).toBeNull();
    });
  });

  // ── buildGameState ──────────────────────────────────────────────────

  describe('buildGameState (indirect via getState)', () => {
    it('includes item definitions for inventory items', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      // Manually add an inventory item by processing a command that adds one
      // We need to reach into the session — use processCommand with a command
      // that modifies inventory via the command processor mock
      mockCommandProcessor.process.mockImplementation((session: any) => {
        session.addToInventory('healing_herb');
      });
      await service.processCommand('socket1', { type: CommandType.TAKE, payload: { itemId: 'healing_herb' } });

      const state = service.getState('socket1');
      expect(state!.itemDefinitions).toHaveProperty('healing_herb');
    });

    it('includes item definitions for equipped items', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      mockCommandProcessor.process.mockImplementation((session: any) => {
        session.addToInventory('iron_sword');
        session.equipment.weapon = 'iron_sword';
      });
      await service.processCommand('socket1', { type: CommandType.EQUIP, payload: { itemId: 'iron_sword' } });

      const state = service.getState('socket1');
      expect(state!.itemDefinitions).toHaveProperty('iron_sword');
    });

    it('includes item definitions for room items', async () => {
      await service.processCommand('socket1', { type: CommandType.NEW_GAME, payload: { playerName: 'Hero' } });

      // forest_clearing has healing_herb
      const state = service.getState('socket1');
      expect(state!.itemDefinitions).toHaveProperty('healing_herb');
    });
  });
});
