import { describe, it, expect } from 'vitest';
import { GameSession } from '../game-state';
import { GamePhase, DEFAULT_PLAYER_STATS, STARTING_ROOM_ID } from '@verdantia/shared';
import type { RoomDefinition, ItemDefinition } from '@verdantia/shared';

const mockRoom: RoomDefinition = {
  id: 'forest_clearing',
  name: 'Forest Clearing',
  description: 'A sunlit clearing.',
  exits: [{ direction: 'north', roomId: 'village_square' }],
  items: ['healing_herb', 'iron_sword'],
};

const mockItemDefs: Record<string, ItemDefinition> = {
  healing_herb: {
    id: 'healing_herb',
    name: 'Healing Herb',
    description: 'A herb.',
    type: 'consumable',
    effect: { healAmount: 10 },
    value: 5,
  },
};

describe('GameSession', () => {
  describe('constructor', () => {
    it('sets player name', () => {
      const session = new GameSession('Eldric');
      expect(session.playerName).toBe('Eldric');
    });

    it('initializes stats to DEFAULT_PLAYER_STATS', () => {
      const session = new GameSession('Hero');
      expect(session.stats).toEqual({ ...DEFAULT_PLAYER_STATS });
    });

    it('starts in forest_clearing (STARTING_ROOM_ID)', () => {
      const session = new GameSession('Hero');
      expect(session.currentRoomId).toBe(STARTING_ROOM_ID);
    });

    it('starts in EXPLORATION phase', () => {
      const session = new GameSession('Hero');
      expect(session.phase).toBe(GamePhase.EXPLORATION);
    });

    it('starts with empty inventory', () => {
      const session = new GameSession('Hero');
      expect(session.inventory).toEqual([]);
    });

    it('starts with empty equipment', () => {
      const session = new GameSession('Hero');
      expect(session.equipment).toEqual({});
    });

    it('starts with no combat', () => {
      const session = new GameSession('Hero');
      expect(session.combat).toBeNull();
    });

    it('starts with 0 gold', () => {
      const session = new GameSession('Hero');
      expect(session.gold).toBe(0);
    });

    it('starts with empty roomItemsRemoved', () => {
      const session = new GameSession('Hero');
      expect(session.roomItemsRemoved).toEqual({});
    });
  });

  describe('addMessage', () => {
    it('adds a narrative message by default', () => {
      const session = new GameSession('Hero');
      session.addMessage('Hello world');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('Hello world');
      expect(state.messages[0].type).toBe('narrative');
    });

    it('adds a message with specified type', () => {
      const session = new GameSession('Hero');
      session.addMessage('Combat begins!', 'combat');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.messages[0].type).toBe('combat');
    });

    it('accumulates multiple messages', () => {
      const session = new GameSession('Hero');
      session.addMessage('First');
      session.addMessage('Second');
      session.addMessage('Third');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.messages).toHaveLength(3);
      expect(state.messages.map((m) => m.text)).toEqual(['First', 'Second', 'Third']);
    });

    it('assigns unique IDs to each message', () => {
      const session = new GameSession('Hero');
      session.addMessage('A');
      session.addMessage('B');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.messages[0].id).not.toBe(state.messages[1].id);
    });

    it('assigns a timestamp to each message', () => {
      const session = new GameSession('Hero');
      session.addMessage('Test');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.messages[0].timestamp).toBeTypeOf('number');
      expect(state.messages[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe('toGameState', () => {
    it('returns a snapshot of the current state', () => {
      const session = new GameSession('Eldric');
      session.gold = 50;
      session.addMessage('Hello');

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.playerName).toBe('Eldric');
      expect(state.phase).toBe(GamePhase.EXPLORATION);
      expect(state.gold).toBe(50);
      expect(state.currentRoomId).toBe(STARTING_ROOM_ID);
      expect(state.currentRoom).toBe(mockRoom);
      expect(state.itemDefinitions).toBe(mockItemDefs);
    });

    it('drains pending messages after call', () => {
      const session = new GameSession('Hero');
      session.addMessage('First');

      const state1 = session.toGameState(mockRoom, mockItemDefs);
      expect(state1.messages).toHaveLength(1);

      const state2 = session.toGameState(mockRoom, mockItemDefs);
      expect(state2.messages).toHaveLength(0);
    });

    it('returns copies of stats, inventory, and equipment', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb');
      session.equipment.weapon = 'iron_sword';

      const state = session.toGameState(mockRoom, mockItemDefs);

      // Mutating the returned state should not affect the session
      state.stats.hp = 999;
      state.inventory.push({ itemId: 'fake', quantity: 1 });

      expect(session.stats.hp).toBe(DEFAULT_PLAYER_STATS.hp);
      expect(session.inventory).toHaveLength(1);
    });

    it('returns combat state copy when in combat', () => {
      const session = new GameSession('Hero');
      session.phase = GamePhase.COMBAT;
      session.combat = {
        enemyId: 'goblin',
        enemyName: 'Goblin',
        enemyHp: 20,
        enemyMaxHp: 20,
        enemyAttack: 5,
        enemyDefense: 2,
        enemySpeed: 4,
        isPlayerTurn: true,
        turnCount: 1,
      };

      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.combat).not.toBeNull();
      expect(state.combat!.enemyName).toBe('Goblin');

      // Mutating returned combat should not affect session
      state.combat!.enemyHp = 0;
      expect(session.combat!.enemyHp).toBe(20);
    });

    it('returns null combat when not in combat', () => {
      const session = new GameSession('Hero');
      const state = session.toGameState(mockRoom, mockItemDefs);
      expect(state.combat).toBeNull();
    });
  });

  describe('getAvailableRoomItems / removeRoomItem', () => {
    it('returns all room items when none removed', () => {
      const session = new GameSession('Hero');
      const items = session.getAvailableRoomItems(mockRoom);
      expect(items).toEqual(['healing_herb', 'iron_sword']);
    });

    it('filters out removed items', () => {
      const session = new GameSession('Hero');
      session.removeRoomItem('forest_clearing', 'healing_herb');
      const items = session.getAvailableRoomItems(mockRoom);
      expect(items).toEqual(['iron_sword']);
    });

    it('returns empty array when all items removed', () => {
      const session = new GameSession('Hero');
      session.removeRoomItem('forest_clearing', 'healing_herb');
      session.removeRoomItem('forest_clearing', 'iron_sword');
      const items = session.getAvailableRoomItems(mockRoom);
      expect(items).toEqual([]);
    });

    it('handles rooms with no items', () => {
      const session = new GameSession('Hero');
      const emptyRoom: RoomDefinition = {
        id: 'empty',
        name: 'Empty Room',
        description: 'Nothing here.',
        exits: [],
      };
      expect(session.getAvailableRoomItems(emptyRoom)).toEqual([]);
    });
  });

  describe('addToInventory', () => {
    it('adds a new item with default quantity 1', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb');
      expect(session.inventory).toEqual([{ itemId: 'healing_herb', quantity: 1 }]);
    });

    it('adds a new item with specified quantity', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb', 3);
      expect(session.inventory).toEqual([{ itemId: 'healing_herb', quantity: 3 }]);
    });

    it('increments quantity for existing item', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb');
      session.addToInventory('healing_herb', 2);
      expect(session.inventory).toEqual([{ itemId: 'healing_herb', quantity: 3 }]);
    });
  });

  describe('removeFromInventory', () => {
    it('decrements item quantity', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb', 3);
      const result = session.removeFromInventory('healing_herb');
      expect(result).toBe(true);
      expect(session.inventory[0].quantity).toBe(2);
    });

    it('removes item entirely when quantity reaches zero', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb', 1);
      session.removeFromInventory('healing_herb');
      expect(session.inventory).toHaveLength(0);
    });

    it('removes specified quantity', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb', 5);
      session.removeFromInventory('healing_herb', 3);
      expect(session.inventory[0].quantity).toBe(2);
    });

    it('returns false when item not found', () => {
      const session = new GameSession('Hero');
      expect(session.removeFromInventory('nonexistent')).toBe(false);
    });
  });

  describe('hasItem', () => {
    it('returns true when item is in inventory', () => {
      const session = new GameSession('Hero');
      session.addToInventory('healing_herb');
      expect(session.hasItem('healing_herb')).toBe(true);
    });

    it('returns false when item is not in inventory', () => {
      const session = new GameSession('Hero');
      expect(session.hasItem('healing_herb')).toBe(false);
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips all session fields', () => {
      const session = new GameSession('Eldric');
      session.stats.hp = 20;
      session.stats.level = 3;
      session.currentRoomId = 'blacksmith';
      session.addToInventory('iron_sword');
      session.addToInventory('healing_herb', 5);
      session.equipment.weapon = 'iron_sword';
      session.phase = GamePhase.EXPLORATION;
      session.gold = 150;
      session.roomItemsRemoved = { forest_clearing: ['healing_herb'] };

      const data = session.serialize();
      const restored = GameSession.deserialize(data);

      expect(restored.playerName).toBe('Eldric');
      expect(restored.stats.hp).toBe(20);
      expect(restored.stats.level).toBe(3);
      expect(restored.currentRoomId).toBe('blacksmith');
      expect(restored.inventory).toEqual([
        { itemId: 'iron_sword', quantity: 1 },
        { itemId: 'healing_herb', quantity: 5 },
      ]);
      expect(restored.equipment.weapon).toBe('iron_sword');
      expect(restored.phase).toBe(GamePhase.EXPLORATION);
      expect(restored.gold).toBe(150);
      expect(restored.roomItemsRemoved).toEqual({ forest_clearing: ['healing_herb'] });
    });

    it('handles empty roomItemsRemoved gracefully', () => {
      const session = new GameSession('Hero');
      const data = session.serialize();
      // Simulate old save data without roomItemsRemoved
      const parsed = JSON.parse(data);
      delete parsed.roomItemsRemoved;
      const restored = GameSession.deserialize(JSON.stringify(parsed));
      expect(restored.roomItemsRemoved).toEqual({});
    });
  });
});
