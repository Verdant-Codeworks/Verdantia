import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandProcessor } from '../command-processor';
import { GameSession } from '../game-state';
import { CommandType, GamePhase } from '@verdantia/shared';
import type { GameCommand } from '@verdantia/shared';

function createMockSystems() {
  return {
    movement: {
      move: vi.fn(),
      look: vi.fn(),
      startCombat: vi.fn(),
    },
    combat: {
      attack: vi.fn(),
      defend: vi.fn(),
      flee: vi.fn(),
    },
    inventory: {
      take: vi.fn(),
      drop: vi.fn(),
      use: vi.fn(),
      equip: vi.fn(),
      unequip: vi.fn(),
      showInventory: vi.fn(),
    },
    skills: {
      gather: vi.fn(),
      craft: vi.fn(),
      showRecipes: vi.fn(),
      showSkills: vi.fn(),
    },
  };
}

describe('CommandProcessor', () => {
  let processor: CommandProcessor;
  let mocks: ReturnType<typeof createMockSystems>;
  let session: GameSession;

  beforeEach(() => {
    mocks = createMockSystems();
    processor = new CommandProcessor(
      mocks.movement as any,
      mocks.combat as any,
      mocks.inventory as any,
      mocks.skills as any,
    );
    session = new GameSession('TestPlayer');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Universal Commands ──────────────────────────────────────────────

  describe('universal commands', () => {
    it('HELP works in EXPLORATION phase', () => {
      session.phase = GamePhase.EXPLORATION;
      processor.process(session, { type: CommandType.HELP });
      // showHelp adds multiple system messages
      const state = session.toGameState({} as any, {});
      expect(state.messages.length).toBeGreaterThan(0);
      expect(state.messages[0].text).toContain('Commands');
    });

    it('HELP mentions map command', () => {
      session.phase = GamePhase.EXPLORATION;
      processor.process(session, { type: CommandType.HELP });
      const state = session.toGameState({} as any, {});
      const allText = state.messages.map((m) => m.text).join(' ');
      expect(allText.toLowerCase()).toContain('map');
    });

    it('HELP works in COMBAT phase', () => {
      session.phase = GamePhase.COMBAT;
      processor.process(session, { type: CommandType.HELP });
      const state = session.toGameState({} as any, {});
      expect(state.messages.length).toBeGreaterThan(0);
    });

    it('HELP works in GAME_OVER phase', () => {
      session.phase = GamePhase.GAME_OVER;
      processor.process(session, { type: CommandType.HELP });
      const state = session.toGameState({} as any, {});
      // Should show help, not "game is over"
      expect(state.messages[0].text).toContain('Commands');
    });

    it('INVENTORY works in any phase', () => {
      session.phase = GamePhase.EXPLORATION;
      processor.process(session, { type: CommandType.INVENTORY });
      expect(mocks.inventory.showInventory).toHaveBeenCalledWith(session);
    });

    it('INVENTORY works in COMBAT phase', () => {
      session.phase = GamePhase.COMBAT;
      processor.process(session, { type: CommandType.INVENTORY });
      expect(mocks.inventory.showInventory).toHaveBeenCalledWith(session);
    });
  });

  // ── Exploration Phase ───────────────────────────────────────────────

  describe('EXPLORATION phase', () => {
    beforeEach(() => {
      session.phase = GamePhase.EXPLORATION;
    });

    it('MOVE dispatches to movement.move with direction', () => {
      const cmd: GameCommand = { type: CommandType.MOVE, payload: { direction: 'north' } };
      processor.process(session, cmd);
      expect(mocks.movement.move).toHaveBeenCalledWith(session, 'north');
    });

    it('MOVE without direction adds error message', () => {
      const cmd: GameCommand = { type: CommandType.MOVE, payload: {} };
      processor.process(session, cmd);
      expect(mocks.movement.move).not.toHaveBeenCalled();
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('Go where');
    });

    it('LOOK dispatches to movement.look', () => {
      processor.process(session, { type: CommandType.LOOK });
      expect(mocks.movement.look).toHaveBeenCalledWith(session);
    });

    it('TAKE dispatches to inventory.take with itemId', () => {
      const cmd: GameCommand = { type: CommandType.TAKE, payload: { itemId: 'healing_herb' } };
      processor.process(session, cmd);
      expect(mocks.inventory.take).toHaveBeenCalledWith(session, 'healing_herb');
    });

    it('TAKE without itemId adds error message', () => {
      const cmd: GameCommand = { type: CommandType.TAKE, payload: {} };
      processor.process(session, cmd);
      expect(mocks.inventory.take).not.toHaveBeenCalled();
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('Take what');
    });

    it('DROP dispatches to inventory.drop', () => {
      const cmd: GameCommand = { type: CommandType.DROP, payload: { itemId: 'healing_herb' } };
      processor.process(session, cmd);
      expect(mocks.inventory.drop).toHaveBeenCalledWith(session, 'healing_herb');
    });

    it('DROP without itemId adds error message', () => {
      processor.process(session, { type: CommandType.DROP, payload: {} });
      expect(mocks.inventory.drop).not.toHaveBeenCalled();
    });

    it('USE dispatches to inventory.use', () => {
      const cmd: GameCommand = { type: CommandType.USE, payload: { itemId: 'healing_herb' } };
      processor.process(session, cmd);
      expect(mocks.inventory.use).toHaveBeenCalledWith(session, 'healing_herb');
    });

    it('USE without itemId adds error message', () => {
      processor.process(session, { type: CommandType.USE, payload: {} });
      expect(mocks.inventory.use).not.toHaveBeenCalled();
    });

    it('EQUIP dispatches to inventory.equip', () => {
      const cmd: GameCommand = { type: CommandType.EQUIP, payload: { itemId: 'iron_sword' } };
      processor.process(session, cmd);
      expect(mocks.inventory.equip).toHaveBeenCalledWith(session, 'iron_sword');
    });

    it('EQUIP without itemId adds error message', () => {
      processor.process(session, { type: CommandType.EQUIP, payload: {} });
      expect(mocks.inventory.equip).not.toHaveBeenCalled();
    });

    it('UNEQUIP dispatches to inventory.unequip', () => {
      const cmd: GameCommand = { type: CommandType.UNEQUIP, payload: { slot: 'weapon' } };
      processor.process(session, cmd);
      expect(mocks.inventory.unequip).toHaveBeenCalledWith(session, 'weapon');
    });

    it('UNEQUIP without slot adds error message', () => {
      processor.process(session, { type: CommandType.UNEQUIP, payload: {} });
      expect(mocks.inventory.unequip).not.toHaveBeenCalled();
    });

    it('ATTACK says nothing to fight', () => {
      processor.process(session, { type: CommandType.ATTACK });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('nothing to fight');
    });

    it('DEFEND says nothing to fight', () => {
      processor.process(session, { type: CommandType.DEFEND });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('nothing to fight');
    });

    it('FLEE says nothing to fight', () => {
      processor.process(session, { type: CommandType.FLEE });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('nothing to fight');
    });

    it('unknown command shows help hint', () => {
      processor.process(session, { type: 'unknown_cmd' as CommandType });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('help');
    });

    it('MAP command adds acknowledgement message', () => {
      processor.process(session, { type: CommandType.MAP });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text.toLowerCase()).toContain('map');
    });
  });

  // ── Combat Phase ────────────────────────────────────────────────────

  describe('COMBAT phase', () => {
    beforeEach(() => {
      session.phase = GamePhase.COMBAT;
    });

    it('ATTACK dispatches to combat.attack', () => {
      processor.process(session, { type: CommandType.ATTACK });
      expect(mocks.combat.attack).toHaveBeenCalledWith(session);
    });

    it('DEFEND dispatches to combat.defend', () => {
      processor.process(session, { type: CommandType.DEFEND });
      expect(mocks.combat.defend).toHaveBeenCalledWith(session);
    });

    it('FLEE dispatches to combat.flee', () => {
      processor.process(session, { type: CommandType.FLEE });
      expect(mocks.combat.flee).toHaveBeenCalledWith(session);
    });

    it('USE dispatches to inventory.use in combat', () => {
      const cmd: GameCommand = { type: CommandType.USE, payload: { itemId: 'health_potion' } };
      processor.process(session, cmd);
      expect(mocks.inventory.use).toHaveBeenCalledWith(session, 'health_potion');
    });

    it('USE without itemId adds error message in combat', () => {
      processor.process(session, { type: CommandType.USE, payload: {} });
      expect(mocks.inventory.use).not.toHaveBeenCalled();
    });

    it('MOVE is blocked during combat', () => {
      processor.process(session, { type: CommandType.MOVE, payload: { direction: 'north' } });
      expect(mocks.movement.move).not.toHaveBeenCalled();
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain("can't do that during combat");
    });

    it('TAKE is blocked during combat', () => {
      processor.process(session, { type: CommandType.TAKE, payload: { itemId: 'herb' } });
      expect(mocks.inventory.take).not.toHaveBeenCalled();
    });

    it('DROP is blocked during combat', () => {
      processor.process(session, { type: CommandType.DROP, payload: { itemId: 'herb' } });
      expect(mocks.inventory.drop).not.toHaveBeenCalled();
    });

    it('EQUIP is blocked during combat', () => {
      processor.process(session, { type: CommandType.EQUIP, payload: { itemId: 'sword' } });
      expect(mocks.inventory.equip).not.toHaveBeenCalled();
    });

    it('UNEQUIP is blocked during combat', () => {
      processor.process(session, { type: CommandType.UNEQUIP, payload: { slot: 'weapon' } });
      expect(mocks.inventory.unequip).not.toHaveBeenCalled();
    });

    it('MAP is blocked during combat', () => {
      processor.process(session, { type: CommandType.MAP });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain("can't do that during combat");
    });

    it('unknown command shows combat hint', () => {
      processor.process(session, { type: 'unknown_cmd' as CommandType });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('attack, defend, flee');
    });
  });

  // ── Game Over Phase ─────────────────────────────────────────────────

  describe('GAME_OVER phase', () => {
    beforeEach(() => {
      session.phase = GamePhase.GAME_OVER;
    });

    it('any non-universal command says game is over', () => {
      processor.process(session, { type: CommandType.ATTACK });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('game is over');
    });

    it('MOVE says game is over', () => {
      processor.process(session, { type: CommandType.MOVE, payload: { direction: 'north' } });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('game is over');
    });

    it('LOOK says game is over', () => {
      processor.process(session, { type: CommandType.LOOK });
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('game is over');
    });
  });
});
