import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventorySystem } from '../inventory-system';
import { GameSession } from '../game-state';
import { MAX_INVENTORY_SIZE } from '@verdantia/shared';
import { createMockWorldLoader, TEST_ROOMS } from './fixtures';

describe('InventorySystem', () => {
  let inventory: InventorySystem;
  let mockWorldLoader: ReturnType<typeof createMockWorldLoader>;
  let session: GameSession;

  beforeEach(() => {
    mockWorldLoader = createMockWorldLoader();
    inventory = new InventorySystem(mockWorldLoader as any);
    session = new GameSession('TestPlayer');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── take ────────────────────────────────────────────────────────────

  describe('take', () => {
    it('picks up item by exact ID', () => {
      const result = inventory.take(session, 'healing_herb');
      expect(result).toBe(true);
      expect(session.hasItem('healing_herb')).toBe(true);
    });

    it('picks up item by name (fuzzy match)', () => {
      const result = inventory.take(session, 'healing');
      expect(result).toBe(true);
      expect(session.hasItem('healing_herb')).toBe(true);
    });

    it('picks up item by partial ID match', () => {
      const result = inventory.take(session, 'herb');
      expect(result).toBe(true);
      expect(session.hasItem('healing_herb')).toBe(true);
    });

    it('marks item as removed from room', () => {
      inventory.take(session, 'healing_herb');
      const removed = session.roomItemsRemoved['forest_clearing'];
      expect(removed).toContain('healing_herb');
    });

    it('adds take message', () => {
      inventory.take(session, 'healing_herb');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('take the Healing Herb');
    });

    it('converts misc items with value and no effect to gold', () => {
      // Move to a room with gold_ring
      session.currentRoomId = 'spider_den';
      // Mock the spider_den room
      const spiderDen = {
        id: 'spider_den',
        name: 'Spider Den',
        description: 'A web-covered area.',
        exits: [],
        items: ['gold_ring'],
        enemies: [],
      };
      mockWorldLoader.getRoom.mockImplementation((id: string) => {
        if (id === 'spider_den') return spiderDen;
        return TEST_ROOMS[id];
      });

      inventory.take(session, 'gold_ring');
      expect(session.gold).toBe(40); // gold_ring value
      expect(session.hasItem('gold_ring')).toBe(false); // removed from inventory, converted to gold
    });

    it('shows gold message for misc conversion', () => {
      session.currentRoomId = 'spider_den';
      const spiderDen = {
        id: 'spider_den',
        name: 'Spider Den',
        description: 'A web-covered area.',
        exits: [],
        items: ['gold_ring'],
        enemies: [],
      };
      mockWorldLoader.getRoom.mockImplementation((id: string) => {
        if (id === 'spider_den') return spiderDen;
        return TEST_ROOMS[id];
      });

      inventory.take(session, 'gold_ring');
      const state = session.toGameState(spiderDen as any, {});
      expect(state.messages[0].text).toContain('+40 gold');
    });

    it('returns false when item not found in room', () => {
      const result = inventory.take(session, 'nonexistent_item');
      expect(result).toBe(false);
    });

    it('shows error message when item not found', () => {
      inventory.take(session, 'nonexistent_item');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('nonexistent_item');
    });

    it('returns false when room not found', () => {
      session.currentRoomId = 'nonexistent_room';
      const result = inventory.take(session, 'healing_herb');
      expect(result).toBe(false);
    });

    it('fails when inventory is full', () => {
      // Fill inventory to MAX_INVENTORY_SIZE
      for (let i = 0; i < MAX_INVENTORY_SIZE; i++) {
        session.inventory.push({ itemId: `item_${i}`, quantity: 1 });
      }
      const result = inventory.take(session, 'healing_herb');
      expect(result).toBe(false);
    });

    it('shows full inventory message', () => {
      for (let i = 0; i < MAX_INVENTORY_SIZE; i++) {
        session.inventory.push({ itemId: `item_${i}`, quantity: 1 });
      }
      inventory.take(session, 'healing_herb');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('inventory is full');
    });

    it('cannot take an already-removed item', () => {
      session.removeRoomItem('forest_clearing', 'healing_herb');
      const result = inventory.take(session, 'healing_herb');
      expect(result).toBe(false);
    });
  });

  // ── drop ────────────────────────────────────────────────────────────

  describe('drop', () => {
    it('removes item from inventory', () => {
      session.addToInventory('healing_herb');
      const result = inventory.drop(session, 'healing_herb');
      expect(result).toBe(true);
      expect(session.hasItem('healing_herb')).toBe(false);
    });

    it('unequips weapon when dropped', () => {
      session.addToInventory('iron_sword');
      session.equipment.weapon = 'iron_sword';
      inventory.drop(session, 'iron_sword');
      expect(session.equipment.weapon).toBeUndefined();
    });

    it('unequips armor when dropped', () => {
      session.addToInventory('leather_armor');
      session.equipment.armor = 'leather_armor';
      inventory.drop(session, 'leather_armor');
      expect(session.equipment.armor).toBeUndefined();
    });

    it('resolves by fuzzy name match', () => {
      session.addToInventory('iron_sword');
      const result = inventory.drop(session, 'iron');
      expect(result).toBe(true);
      expect(session.hasItem('iron_sword')).toBe(false);
    });

    it('returns false when item not in inventory', () => {
      const result = inventory.drop(session, 'nonexistent');
      expect(result).toBe(false);
    });

    it('adds drop message', () => {
      session.addToInventory('healing_herb');
      inventory.drop(session, 'healing_herb');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('drop the Healing Herb');
    });
  });

  // ── use ─────────────────────────────────────────────────────────────

  describe('use', () => {
    it('heals player when using consumable', () => {
      session.stats.hp = 20; // damaged from 30 max
      session.addToInventory('healing_herb');

      const result = inventory.use(session, 'healing_herb');
      expect(result).toBe(true);
      expect(session.stats.hp).toBe(30); // healed 10, capped at maxHp
    });

    it('heals only up to maxHp', () => {
      session.stats.hp = 25; // only 5 below max
      session.addToInventory('healing_herb'); // heals 10

      inventory.use(session, 'healing_herb');
      expect(session.stats.hp).toBe(30); // capped at maxHp, not 35
    });

    it('removes consumable from inventory after use', () => {
      session.addToInventory('healing_herb');
      inventory.use(session, 'healing_herb');
      expect(session.hasItem('healing_herb')).toBe(false);
    });

    it('adds heal message with HP values', () => {
      session.stats.hp = 20;
      session.addToInventory('healing_herb');
      inventory.use(session, 'healing_herb');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('Healing Herb');
      expect(state.messages[0].text).toContain('30/30');
    });

    it('fails for non-consumable item', () => {
      session.addToInventory('iron_sword');
      const result = inventory.use(session, 'iron_sword');
      expect(result).toBe(false);
    });

    it('shows error for non-consumable item', () => {
      session.addToInventory('iron_sword');
      inventory.use(session, 'iron_sword');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain("can't use");
    });

    it('returns false when item not found in inventory', () => {
      const result = inventory.use(session, 'nonexistent');
      expect(result).toBe(false);
    });

    it('handles item with no definition', () => {
      session.addToInventory('unknown_item');
      const result = inventory.use(session, 'unknown_item');
      expect(result).toBe(false);
    });
  });

  // ── equip ───────────────────────────────────────────────────────────

  describe('equip', () => {
    it('equips weapon to weapon slot', () => {
      session.addToInventory('iron_sword');
      const result = inventory.equip(session, 'iron_sword');
      expect(result).toBe(true);
      expect(session.equipment.weapon).toBe('iron_sword');
    });

    it('equips armor to armor slot', () => {
      session.addToInventory('leather_armor');
      const result = inventory.equip(session, 'leather_armor');
      expect(result).toBe(true);
      expect(session.equipment.armor).toBe('leather_armor');
    });

    it('shows stat bonuses in equip message', () => {
      session.addToInventory('iron_sword');
      inventory.equip(session, 'iron_sword');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('+3 ATK');
    });

    it('shows multiple stat bonuses', () => {
      session.addToInventory('enchanted_blade');
      inventory.equip(session, 'enchanted_blade');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const msg = state.messages[0].text;
      expect(msg).toContain('+6 ATK');
      expect(msg).toContain('+1 SPD');
    });

    it('swaps existing equipment', () => {
      session.addToInventory('iron_sword');
      session.addToInventory('enchanted_blade');
      session.equipment.weapon = 'iron_sword';

      inventory.equip(session, 'enchanted_blade');
      expect(session.equipment.weapon).toBe('enchanted_blade');
    });

    it('shows unequip message when swapping', () => {
      session.addToInventory('iron_sword');
      session.addToInventory('enchanted_blade');
      session.equipment.weapon = 'iron_sword';

      inventory.equip(session, 'enchanted_blade');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('unequip the Iron Sword'))).toBe(true);
    });

    it('fails for non-equippable item', () => {
      session.addToInventory('healing_herb');
      const result = inventory.equip(session, 'healing_herb');
      expect(result).toBe(false);
    });

    it('fails when item not in inventory', () => {
      const result = inventory.equip(session, 'iron_sword');
      expect(result).toBe(false);
    });
  });

  // ── unequip ─────────────────────────────────────────────────────────

  describe('unequip', () => {
    it('unequips weapon by slot name', () => {
      session.addToInventory('iron_sword');
      session.equipment.weapon = 'iron_sword';

      const result = inventory.unequip(session, 'weapon');
      expect(result).toBe(true);
      expect(session.equipment.weapon).toBeUndefined();
    });

    it('unequips armor by slot name', () => {
      session.addToInventory('leather_armor');
      session.equipment.armor = 'leather_armor';

      const result = inventory.unequip(session, 'armor');
      expect(result).toBe(true);
      expect(session.equipment.armor).toBeUndefined();
    });

    it('is case-insensitive', () => {
      session.addToInventory('iron_sword');
      session.equipment.weapon = 'iron_sword';

      const result = inventory.unequip(session, 'WEAPON');
      expect(result).toBe(true);
      expect(session.equipment.weapon).toBeUndefined();
    });

    it('fails when slot is empty', () => {
      const result = inventory.unequip(session, 'weapon');
      expect(result).toBe(false);
    });

    it('shows empty slot message', () => {
      inventory.unequip(session, 'weapon');
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('Nothing is equipped');
    });

    it('shows error for invalid slot name', () => {
      const result = inventory.unequip(session, 'head');
      expect(result).toBe(false);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      expect(state.messages[0].text).toContain('weapon');
      expect(state.messages[0].text).toContain('armor');
    });
  });

  // ── showInventory ───────────────────────────────────────────────────

  describe('showInventory', () => {
    it('shows empty inventory message when empty', () => {
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('empty'))).toBe(true);
    });

    it('lists items with names', () => {
      session.addToInventory('healing_herb');
      session.addToInventory('iron_sword');
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Healing Herb'))).toBe(true);
      expect(texts.some((t) => t.includes('Iron Sword'))).toBe(true);
    });

    it('shows quantities for stacked items', () => {
      session.addToInventory('healing_herb', 3);
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('x3'))).toBe(true);
    });

    it('shows equipped marker', () => {
      session.addToInventory('iron_sword');
      session.equipment.weapon = 'iron_sword';
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('[equipped]'))).toBe(true);
    });

    it('shows gold amount', () => {
      session.gold = 150;
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('150'))).toBe(true);
    });

    it('shows weapon and armor names', () => {
      session.addToInventory('iron_sword');
      session.addToInventory('leather_armor');
      session.equipment.weapon = 'iron_sword';
      session.equipment.armor = 'leather_armor';
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Weapon: Iron Sword'))).toBe(true);
      expect(texts.some((t) => t.includes('Armor: Leather Armor'))).toBe(true);
    });

    it('shows None when no equipment', () => {
      inventory.showInventory(session);
      const state = session.toGameState(TEST_ROOMS.forest_clearing, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('Weapon: None'))).toBe(true);
      expect(texts.some((t) => t.includes('Armor: None'))).toBe(true);
    });
  });
});
