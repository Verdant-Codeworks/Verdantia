import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MovementSystem } from '../movement-system';
import { GameSession } from '../game-state';
import { GamePhase, ENCOUNTER_CHANCE } from '@verdantia/shared';
import { createMockWorldLoader, TEST_ROOMS, TEST_ENEMIES } from './fixtures';

describe('MovementSystem', () => {
  let movement: MovementSystem;
  let mockWorldLoader: ReturnType<typeof createMockWorldLoader>;
  let session: GameSession;

  beforeEach(() => {
    mockWorldLoader = createMockWorldLoader();
    movement = new MovementSystem(mockWorldLoader as any);
    session = new GameSession('TestPlayer');
    // Start in forest_clearing (the default)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── move ────────────────────────────────────────────────────────────

  describe('move', () => {
    it('moves to valid direction and updates currentRoomId', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no encounter
      const result = movement.move(session, 'north');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });

    it('adds room description messages after moving', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      movement.move(session, 'north');
      const state = session.toGameState(TEST_ROOMS.village_square, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Village Square'))).toBe(true);
    });

    it('returns false for invalid direction', () => {
      const result = movement.move(session, 'west');
      expect(result).toBe(false);
      expect(session.currentRoomId).toBe('forest_clearing');
    });

    it('adds error message for invalid direction', () => {
      movement.move(session, 'west');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain("can't go west");
    });

    it('returns false when current room not found', () => {
      session.currentRoomId = 'nonexistent_room';
      const result = movement.move(session, 'north');
      expect(result).toBe(false);
    });

    it('returns false when destination room not found', () => {
      // Make getRoom return undefined for the destination
      mockWorldLoader.getRoom.mockImplementation((id: string) => {
        if (id === 'forest_clearing') return TEST_ROOMS.forest_clearing;
        return undefined;
      });
      const result = movement.move(session, 'north');
      expect(result).toBe(false);
    });

    it('is case-insensitive for direction matching', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = movement.move(session, 'NORTH');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });
  });

  // ── Random Encounters ───────────────────────────────────────────────

  describe('random encounters', () => {
    it('triggers encounter when random < ENCOUNTER_CHANCE and room has enemies', () => {
      // Move to deep_forest (has enemies)
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(ENCOUNTER_CHANCE - 0.01) // triggers encounter
        .mockReturnValueOnce(0); // picks first enemy
      movement.move(session, 'east');

      expect(session.phase).toBe(GamePhase.COMBAT);
      expect(session.combat).not.toBeNull();
      expect(session.combat!.enemyId).toBe('forest_spider');
    });

    it('does not trigger encounter when random >= ENCOUNTER_CHANCE', () => {
      vi.spyOn(Math, 'random').mockReturnValue(ENCOUNTER_CHANCE + 0.01);
      movement.move(session, 'east');

      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('does not trigger encounter in rooms with no enemies', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // would trigger if enemies existed
      movement.move(session, 'north'); // village_square has no enemies

      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('selects a random enemy from the room enemy list', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // triggers encounter
        .mockReturnValueOnce(0.9); // picks second enemy (wild_wolf)
      movement.move(session, 'east');

      expect(session.combat).not.toBeNull();
      expect(session.combat!.enemyId).toBe('wild_wolf');
    });
  });

  // ── look ────────────────────────────────────────────────────────────

  describe('look', () => {
    it('shows room name and description', () => {
      movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Forest Clearing'))).toBe(true);
      expect(texts.some((t) => t.includes('sunlit clearing'))).toBe(true);
    });

    it('shows available exits', () => {
      movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('north'))).toBe(true);
      expect(texts.some((t) => t.includes('east'))).toBe(true);
    });

    it('shows items on the ground', () => {
      movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Healing Herb'))).toBe(true);
    });

    it('does not show removed items', () => {
      session.removeRoomItem('forest_clearing', 'healing_herb');
      movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      // Should not have any "You see:" message since the only item was removed
      expect(texts.some((t) => t.includes('You see:'))).toBe(false);
    });

    it('handles unknown room gracefully', () => {
      session.currentRoomId = 'nonexistent';
      movement.look(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('unknown place');
    });
  });

  // ── startCombat ─────────────────────────────────────────────────────

  describe('startCombat', () => {
    it('sets phase to COMBAT', () => {
      movement.startCombat(session, TEST_ENEMIES.forest_spider);
      expect(session.phase).toBe(GamePhase.COMBAT);
    });

    it('populates combat state from enemy definition', () => {
      movement.startCombat(session, TEST_ENEMIES.goblin);
      expect(session.combat).not.toBeNull();
      expect(session.combat!.enemyId).toBe('goblin');
      expect(session.combat!.enemyName).toBe('Goblin');
      expect(session.combat!.enemyHp).toBe(20);
      expect(session.combat!.enemyMaxHp).toBe(20);
      expect(session.combat!.enemyAttack).toBe(5);
      expect(session.combat!.enemyDefense).toBe(2);
      expect(session.combat!.enemySpeed).toBe(4);
      expect(session.combat!.isPlayerTurn).toBe(true);
      expect(session.combat!.turnCount).toBe(1);
    });

    it('adds appearance message', () => {
      movement.startCombat(session, TEST_ENEMIES.wild_wolf);
      const state = session.toGameState({} as any, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Wild Wolf appears'))).toBe(true);
    });

    it('returns true on success', () => {
      const result = movement.startCombat(session, TEST_ENEMIES.forest_spider);
      expect(result).toBe(true);
    });
  });
});
