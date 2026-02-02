import { Injectable, Logger, Optional } from '@nestjs/common';
import { WorldLoaderService } from './world/world-loader.service';
import { CommandProcessor } from './engine/command-processor';
import { MovementSystem } from './engine/movement-system';
import { GameSession } from './engine/game-state';
import { SaveService } from '../save/save.service';
import { CommandType, GamePhase } from '@verdantia/shared';
import type { GameCommand, GameState, ItemDefinition } from '@verdantia/shared';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private sessions = new Map<string, GameSession>();

  constructor(
    private readonly worldLoader: WorldLoaderService,
    private readonly commandProcessor: CommandProcessor,
    private readonly movementSystem: MovementSystem,
    @Optional() private readonly saveService?: SaveService,
  ) {}

  createSession(socketId: string): void {
    // Session created on new_game command, not on connect
    this.logger.log(`Socket connected: ${socketId}`);
  }

  removeSession(socketId: string): void {
    this.sessions.delete(socketId);
    this.logger.log(`Session removed: ${socketId}`);
  }

  hasSession(socketId: string): boolean {
    return this.sessions.has(socketId);
  }

  async processCommand(socketId: string, command: GameCommand): Promise<GameState | null> {
    // Handle new game
    if (command.type === CommandType.NEW_GAME) {
      const playerName = (command.payload as { playerName: string })?.playerName || 'Adventurer';
      const session = new GameSession(playerName);
      this.sessions.set(socketId, session);

      session.addMessage(`Welcome to Verdantia, ${playerName}!`, 'system');
      session.addMessage('Type "help" to see available commands.\n', 'system');

      // Show initial room
      this.movementSystem.look(session);

      return this.buildGameState(session);
    }

    // Handle save
    if (command.type === CommandType.SAVE) {
      const session = this.sessions.get(socketId);
      if (!session) return null;
      const slotName = (command.payload as { slotName: string })?.slotName || 'auto';
      await this.handleSave(session, slotName);
      return this.buildGameState(session);
    }

    // Handle load
    if (command.type === CommandType.LOAD) {
      const slotName = (command.payload as { slotName: string })?.slotName || 'auto';
      const playerName = (command.payload as { playerName?: string })?.playerName;
      return this.handleLoad(socketId, slotName, playerName);
    }

    const session = this.sessions.get(socketId);
    if (!session) {
      this.logger.warn(`No session for socket: ${socketId}`);
      return null;
    }

    this.commandProcessor.process(session, command);
    return this.buildGameState(session);
  }

  private async handleSave(session: GameSession, slotName: string): Promise<void> {
    if (!this.saveService) {
      session.addMessage('Save system is not available (no database configured).', 'error');
      return;
    }

    const gameData = session.serialize();
    const success = await this.saveService.saveGame(session.playerName, slotName, gameData);
    if (success) {
      session.addMessage(`Game saved to slot "${slotName}".`, 'system');
    } else {
      session.addMessage('Failed to save game.', 'error');
    }
  }

  private async handleLoad(socketId: string, slotName: string, playerName?: string): Promise<GameState | null> {
    if (!this.saveService) {
      // Create a temporary session just to send error message
      const tempSession = this.sessions.get(socketId);
      if (tempSession) {
        tempSession.addMessage('Load system is not available (no database configured).', 'error');
        return this.buildGameState(tempSession);
      }
      return null;
    }

    // If we have an existing session, use that player name
    const existingSession = this.sessions.get(socketId);
    const name = playerName || existingSession?.playerName;
    if (!name) {
      return null;
    }

    const gameData = await this.saveService.loadGame(name, slotName);
    if (!gameData) {
      if (existingSession) {
        existingSession.addMessage(`No save found in slot "${slotName}".`, 'error');
        return this.buildGameState(existingSession);
      }
      return null;
    }

    const session = GameSession.deserialize(gameData);
    this.sessions.set(socketId, session);

    session.addMessage(`Game loaded from slot "${slotName}". Welcome back, ${session.playerName}!`, 'system');
    this.movementSystem.look(session);

    return this.buildGameState(session);
  }

  getState(socketId: string): GameState | null {
    const session = this.sessions.get(socketId);
    if (!session) return null;
    return this.buildGameState(session);
  }

  private buildGameState(session: GameSession): GameState {
    const room = this.worldLoader.getRoom(session.currentRoomId);
    if (!room) {
      throw new Error(`Room not found: ${session.currentRoomId}`);
    }

    // Collect item definitions the player needs to know about
    const itemDefs: Record<string, ItemDefinition> = {};
    for (const inv of session.inventory) {
      const def = this.worldLoader.getItem(inv.itemId);
      if (def) itemDefs[inv.itemId] = def;
    }
    if (session.equipment.weapon) {
      const def = this.worldLoader.getItem(session.equipment.weapon);
      if (def) itemDefs[session.equipment.weapon] = def;
    }
    if (session.equipment.armor) {
      const def = this.worldLoader.getItem(session.equipment.armor);
      if (def) itemDefs[session.equipment.armor] = def;
    }
    // Items in the current room
    const roomItems = session.getAvailableRoomItems(room);
    for (const id of roomItems) {
      const def = this.worldLoader.getItem(id);
      if (def) itemDefs[id] = def;
    }

    return session.toGameState(room, itemDefs);
  }
}
