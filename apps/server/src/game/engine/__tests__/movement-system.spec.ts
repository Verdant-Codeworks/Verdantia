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
    it('moves to valid direction and updates currentRoomId', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no encounter
      const result = await movement.move(session, 'north');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });

    it('adds room description messages after moving', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      await movement.move(session, 'north');
      const state = session.toGameState(TEST_ROOMS.village_square, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Village Square'))).toBe(true);
    });

    it('returns false for invalid direction', async () => {
      const result = await movement.move(session, 'west');
      expect(result).toBe(false);
      expect(session.currentRoomId).toBe('forest_clearing');
    });

    it('adds error message for invalid direction', async () => {
      await movement.move(session, 'west');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain("can't go west");
    });

    it('returns false when current room not found', async () => {
      session.currentRoomId = 'nonexistent_room';
      const result = await movement.move(session, 'north');
      expect(result).toBe(false);
    });

    it('returns false when destination room not found', async () => {
      // Make getRoom return undefined for the destination
      mockWorldLoader.getRoom.mockImplementation(async (id: string) => {
        if (id === 'forest_clearing') return TEST_ROOMS.forest_clearing;
        return undefined;
      });
      const result = await movement.move(session, 'north');
      expect(result).toBe(false);
    });

    it('is case-insensitive for direction matching', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = await movement.move(session, 'NORTH');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });
  });

  // ── Random Encounters ───────────────────────────────────────────────

  describe('random encounters', () => {
    it('triggers encounter when random < ENCOUNTER_CHANCE and room has enemies', async () => {
      // Move to deep_forest (has enemies)
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(ENCOUNTER_CHANCE - 0.01) // triggers encounter
        .mockReturnValueOnce(0); // picks first enemy
      await movement.move(session, 'east');

      expect(session.phase).toBe(GamePhase.COMBAT);
      expect(session.combat).not.toBeNull();
      expect(session.combat!.enemyId).toBe('forest_spider');
    });

    it('does not trigger encounter when random >= ENCOUNTER_CHANCE', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(ENCOUNTER_CHANCE + 0.01);
      await movement.move(session, 'east');

      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('does not trigger encounter in rooms with no enemies', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // would trigger if enemies existed
      await movement.move(session, 'north'); // village_square has no enemies

      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('selects a random enemy from the room enemy list', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // triggers encounter
        .mockReturnValueOnce(0.9); // picks second enemy (wild_wolf)
      await movement.move(session, 'east');

      expect(session.combat).not.toBeNull();
      expect(session.combat!.enemyId).toBe('wild_wolf');
    });
  });

  // ── look ────────────────────────────────────────────────────────────

  describe('look', () => {
    it('shows room name and description', async () => {
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Forest Clearing'))).toBe(true);
      expect(texts.some((t) => t.includes('sunlit clearing'))).toBe(true);
    });

    it('shows available exits', async () => {
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('north'))).toBe(true);
      expect(texts.some((t) => t.includes('east'))).toBe(true);
    });

    it('shows items on the ground', async () => {
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Healing Herb'))).toBe(true);
    });

    it('does not show removed items', async () => {
      session.removeRoomItem('forest_clearing', 'healing_herb');
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      // Should not have any "You see:" message since the only item was removed
      expect(texts.some((t) => t.includes('You see:'))).toBe(false);
    });

    it('handles unknown room gracefully', async () => {
      session.currentRoomId = 'nonexistent';
      await movement.look(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('unknown place');
    });

    it('shows item prices in shop rooms', async () => {
      session.currentRoomId = 'blacksmith';
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.blacksmith, {});
      const texts = state.messages.map((m) => m.text);
      const itemLine = texts.find((t) => t.includes('You see:'));
      expect(itemLine).toContain('Iron Sword (30g)');
      expect(itemLine).toContain('Leather Armor (25g)');
      expect(itemLine).toContain('Pickaxe (15g)');
    });

    it('does not show prices in non-shop rooms', async () => {
      await movement.look(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      const itemLine = texts.find((t) => t.includes('You see:'));
      expect(itemLine).toContain('Healing Herb');
      expect(itemLine).not.toContain('(5g)');
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

  // ── Room Visited Tracking (Map Feature) ────────────────────────────────

  describe('room visited tracking', () => {
    it('marks starting room as visited when look is called', async () => {
      expect(session.hasVisitedRoom('forest_clearing')).toBe(false);

      await movement.look(session);

      expect(session.hasVisitedRoom('forest_clearing')).toBe(true);
    });

    it('marks new room as visited when moving', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no encounter
      expect(session.hasVisitedRoom('village_square')).toBe(false);

      await movement.move(session, 'north');

      expect(session.hasVisitedRoom('village_square')).toBe(true);
    });

    it('captures room name and description in visited snapshot', async () => {
      await movement.look(session);

      const visited = session.visitedRooms['forest_clearing'];
      expect(visited.name).toBe('Forest Clearing');
      expect(visited.description).toContain('sunlit clearing');
    });

    it('captures exits in visited snapshot', async () => {
      await movement.look(session);

      const visited = session.visitedRooms['forest_clearing'];
      expect(visited.exits).toHaveLength(2);
      expect(visited.exits.some((e) => e.direction === 'north')).toBe(true);
      expect(visited.exits.some((e) => e.direction === 'east')).toBe(true);
    });

    it('captures item names seen in room', async () => {
      await movement.look(session);

      const visited = session.visitedRooms['forest_clearing'];
      expect(visited.itemsSeen).toContain('Healing Herb');
    });

    it('does not include items that were already taken', async () => {
      session.removeRoomItem('forest_clearing', 'healing_herb');
      await movement.look(session);

      const visited = session.visitedRooms['forest_clearing'];
      expect(visited.itemsSeen).toEqual([]);
    });

    it('captures enemy names that can spawn in room', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no encounter
      await movement.move(session, 'east'); // deep_forest has enemies

      const visited = session.visitedRooms['deep_forest'];
      expect(visited.enemiesSeen).toContain('Forest Spider');
      expect(visited.enemiesSeen).toContain('Wild Wolf');
    });

    it('does not duplicate enemy names', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      await movement.move(session, 'east');

      const visited = session.visitedRooms['deep_forest'];
      // Each enemy name should appear only once
      const uniqueNames = [...new Set(visited.enemiesSeen)];
      expect(visited.enemiesSeen.length).toBe(uniqueNames.length);
    });

    it('does not overwrite visited data on subsequent visits', async () => {
      await movement.look(session);
      const originalTimestamp = session.visitedRooms['forest_clearing'].firstVisited;

      // Remove an item and look again
      session.removeRoomItem('forest_clearing', 'healing_herb');
      await movement.look(session);

      // Should still have the original itemsSeen
      expect(session.visitedRooms['forest_clearing'].itemsSeen).toContain('Healing Herb');
      expect(session.visitedRooms['forest_clearing'].firstVisited).toBe(originalTimestamp);
    });

    it('records firstVisited timestamp', async () => {
      const beforeTime = Date.now();
      await movement.look(session);
      const afterTime = Date.now();

      const visited = session.visitedRooms['forest_clearing'];
      expect(visited.firstVisited).toBeGreaterThanOrEqual(beforeTime);
      expect(visited.firstVisited).toBeLessThanOrEqual(afterTime);
    });

    it('marks room as visited even when encounter triggers', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.01) // triggers encounter
        .mockReturnValueOnce(0); // picks first enemy
      await movement.move(session, 'east');

      expect(session.hasVisitedRoom('deep_forest')).toBe(true);
      expect(session.phase).toBe(GamePhase.COMBAT);
    });

    it('handles rooms with no items or enemies', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      await movement.move(session, 'north'); // village_square has no items/enemies

      const visited = session.visitedRooms['village_square'];
      expect(visited.itemsSeen).toEqual([]);
      expect(visited.enemiesSeen).toEqual([]);
    });
  });

  // ── Location-Based Navigation ────────────────────────────────────────

  describe('location-based navigation', () => {
    it('moves to exact name match', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // From forest_clearing, go to "Village Square"
      const result = await movement.move(session, undefined, 'Village Square');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });

    it('moves to partial match (case-insensitive)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // From forest_clearing, "village" should match "Village Square"
      const result = await movement.move(session, undefined, 'village');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });

    it('moves to word match ("blacksmith" matches "Blacksmith\'s Forge")', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // First move to village_square
      await movement.move(session, 'north');
      // From village_square, "blacksmith" should match "Blacksmith's Forge"
      const result = await movement.move(session, undefined, 'blacksmith');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('blacksmith');
    });

    it('shows error when location not reachable from current room', async () => {
      // From forest_clearing, can't reach blacksmith directly
      const result = await movement.move(session, undefined, 'blacksmith');
      expect(result).toBe(false);
      expect(session.currentRoomId).toBe('forest_clearing');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const messages = state.messages.map((m) => m.text);
      expect(messages.some((t) => t.includes("can't get to"))).toBe(true);
    });

    it('shows available destinations in error message', async () => {
      const result = await movement.move(session, undefined, 'nonexistent');
      expect(result).toBe(false);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const messages = state.messages.map((m) => m.text);
      expect(messages.some((t) => t.includes('Available destinations:'))).toBe(true);
      expect(messages.some((t) => t.includes('Village Square'))).toBe(true);
      expect(messages.some((t) => t.includes('Deep Forest'))).toBe(true);
    });

    it('direction-based movement still works when location not provided', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = await movement.move(session, 'north', undefined);
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('village_square');
    });

    it('prefers exact match over partial match', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // From forest_clearing, "deep forest" should match exactly
      const result = await movement.move(session, undefined, 'deep forest');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('deep_forest');
    });

    it('prefers starts-with match over contains match', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // "deep" starts with "Deep Forest"
      const result = await movement.move(session, undefined, 'deep');
      expect(result).toBe(true);
      expect(session.currentRoomId).toBe('deep_forest');
    });

    it('triggers encounters when moving by location', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(ENCOUNTER_CHANCE - 0.01) // triggers encounter
        .mockReturnValueOnce(0); // picks first enemy
      await movement.move(session, undefined, 'deep forest');

      expect(session.phase).toBe(GamePhase.COMBAT);
      expect(session.combat).not.toBeNull();
    });

    it('shows error when no direction or location provided', async () => {
      const result = await movement.move(session, undefined, undefined);
      expect(result).toBe(false);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('Go where?');
    });

    it('shows ambiguous match error when multiple exits have same score', async () => {
      // Create a room with two similarly-named destinations
      const ambiguousRoom = {
        id: 'test_hub',
        name: 'Test Hub',
        description: 'A hub with multiple forest exits.',
        exits: [
          { direction: 'north', roomId: 'forest_north' },
          { direction: 'south', roomId: 'forest_south' },
        ],
        items: [],
        enemies: [],
        coordinates: { x: 0, y: 0 },
      };
      const forestNorth = {
        id: 'forest_north',
        name: 'Forest Path North',
        description: 'A northern forest path.',
        exits: [],
        items: [],
        enemies: [],
        coordinates: { x: 0, y: -1 },
      };
      const forestSouth = {
        id: 'forest_south',
        name: 'Forest Path South',
        description: 'A southern forest path.',
        exits: [],
        items: [],
        enemies: [],
        coordinates: { x: 0, y: 1 },
      };

      mockWorldLoader.getRoom.mockImplementation(async (id: string) => {
        if (id === 'test_hub') return ambiguousRoom;
        if (id === 'forest_north') return forestNorth;
        if (id === 'forest_south') return forestSouth;
        return TEST_ROOMS[id];
      });

      session.currentRoomId = 'test_hub';
      const result = await movement.move(session, undefined, 'forest path');

      expect(result).toBe(false);
      const state = session.toGameState(ambiguousRoom as any, {});
      const messages = state.messages.map((m) => m.text);
      expect(messages.some((t) => t.includes('Multiple matches'))).toBe(true);
      expect(messages.some((t) => t.includes('Forest Path North (north)'))).toBe(true);
      expect(messages.some((t) => t.includes('Forest Path South (south)'))).toBe(true);
    });
  });
});
