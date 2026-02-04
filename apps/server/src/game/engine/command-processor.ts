import { Injectable } from '@nestjs/common';
import { GameSession } from './game-state';
import { MovementSystem } from './movement-system';
import { CombatSystem } from './combat-system';
import { InventorySystem } from './inventory-system';
import { SkillSystem } from './skill-system';
import { CommandType, GamePhase } from '@verdantia/shared';
import type { GameCommand } from '@verdantia/shared';

@Injectable()
export class CommandProcessor {
  constructor(
    private readonly movement: MovementSystem,
    private readonly combat: CombatSystem,
    private readonly inventory: InventorySystem,
    private readonly skills: SkillSystem,
  ) {}

  process(session: GameSession, command: GameCommand): void {
    // Commands available in any phase
    switch (command.type) {
      case CommandType.HELP:
        this.showHelp(session);
        return;
      case CommandType.INVENTORY:
        this.inventory.showInventory(session);
        return;
    }

    // Phase-specific commands
    switch (session.phase) {
      case GamePhase.EXPLORATION:
        this.processExploration(session, command);
        break;
      case GamePhase.COMBAT:
        this.processCombat(session, command);
        break;
      case GamePhase.GAME_OVER:
        session.addMessage('The game is over. Return to the title screen to start a new game.', 'system');
        break;
      default:
        session.addMessage('Unknown game state.', 'error');
    }
  }

  private processExploration(session: GameSession, command: GameCommand): void {
    switch (command.type) {
      case CommandType.MOVE: {
        const direction = (command.payload as { direction: string })?.direction;
        if (!direction) {
          session.addMessage('Go where? Specify a direction.', 'system');
          return;
        }
        this.movement.move(session, direction);
        break;
      }

      case CommandType.LOOK:
        this.movement.look(session);
        break;

      case CommandType.TAKE: {
        const itemId = (command.payload as { itemId: string })?.itemId;
        if (!itemId) {
          session.addMessage('Take what?', 'system');
          return;
        }
        this.inventory.take(session, itemId);
        break;
      }

      case CommandType.DROP: {
        const itemId = (command.payload as { itemId: string })?.itemId;
        if (!itemId) {
          session.addMessage('Drop what?', 'system');
          return;
        }
        this.inventory.drop(session, itemId);
        break;
      }

      case CommandType.USE: {
        const itemId = (command.payload as { itemId: string })?.itemId;
        if (!itemId) {
          session.addMessage('Use what?', 'system');
          return;
        }
        this.inventory.use(session, itemId);
        break;
      }

      case CommandType.EQUIP: {
        const itemId = (command.payload as { itemId: string })?.itemId;
        if (!itemId) {
          session.addMessage('Equip what?', 'system');
          return;
        }
        this.inventory.equip(session, itemId);
        break;
      }

      case CommandType.UNEQUIP: {
        const slot = (command.payload as { slot: string })?.slot;
        if (!slot) {
          session.addMessage('Unequip what? Specify "weapon" or "armor".', 'system');
          return;
        }
        this.inventory.unequip(session, slot);
        break;
      }

      case CommandType.GATHER: {
        const nodeId = (command.payload as { nodeId: string })?.nodeId;
        if (!nodeId) {
          session.addMessage('Gather what? Specify a resource node.', 'system');
          return;
        }
        this.skills.gather(session, nodeId);
        break;
      }

      case CommandType.CRAFT: {
        const recipeId = (command.payload as { recipeId: string })?.recipeId;
        if (!recipeId) {
          session.addMessage('Craft what? Specify a recipe name.', 'system');
          return;
        }
        this.skills.craft(session, recipeId);
        break;
      }

      case CommandType.RECIPES:
        this.skills.showRecipes(session);
        break;

      case CommandType.SKILLS:
        this.skills.showSkills(session);
        break;

      case CommandType.MAP:
        // Map command is handled client-side, just acknowledge
        session.addMessage('Opening map...', 'system');
        break;

      case CommandType.ATTACK:
      case CommandType.DEFEND:
      case CommandType.FLEE:
        session.addMessage('There is nothing to fight here.', 'system');
        break;

      default:
        session.addMessage('Unknown command. Type "help" for available commands.', 'system');
    }
  }

  private processCombat(session: GameSession, command: GameCommand): void {
    switch (command.type) {
      case CommandType.ATTACK:
        this.combat.attack(session);
        break;

      case CommandType.DEFEND:
        this.combat.defend(session);
        break;

      case CommandType.FLEE:
        this.combat.flee(session);
        break;

      case CommandType.USE: {
        const itemId = (command.payload as { itemId: string })?.itemId;
        if (!itemId) {
          session.addMessage('Use what?', 'system');
          return;
        }
        this.inventory.use(session, itemId);
        break;
      }

      case CommandType.MOVE:
      case CommandType.TAKE:
      case CommandType.DROP:
      case CommandType.EQUIP:
      case CommandType.UNEQUIP:
      case CommandType.GATHER:
      case CommandType.CRAFT:
      case CommandType.RECIPES:
      case CommandType.SKILLS:
      case CommandType.MAP:
        session.addMessage('You can\'t do that during combat!', 'system');
        break;

      default:
        session.addMessage('In combat: attack, defend, flee, or use [item].', 'system');
    }
  }

  private showHelp(session: GameSession): void {
    session.addMessage('\n--- Commands ---', 'system');
    session.addMessage('Movement: north/south/east/west (or n/s/e/w), look (l), go (l), move (l)', 'system');
    session.addMessage('Combat: attack (a), defend, flee', 'system');
    session.addMessage('Items: take [item], drop [item], use [item], equip [item], unequip [slot]', 'system');
    session.addMessage('Skills: mine [node], smith [recipe], recipes, skills', 'system');
    session.addMessage('Other: inventory (i), map (m), save, load, help (h)', 'system');
  }
}
