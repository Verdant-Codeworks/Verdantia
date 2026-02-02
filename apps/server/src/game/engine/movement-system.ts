import { Injectable } from '@nestjs/common';
import { WorldLoaderService } from '../world/world-loader.service';
import { GameSession } from './game-state';
import { GamePhase, ENCOUNTER_CHANCE } from '@verdantia/shared';
import type { EnemyDefinition } from '@verdantia/shared';

@Injectable()
export class MovementSystem {
  constructor(private readonly worldLoader: WorldLoaderService) {}

  move(session: GameSession, direction: string): boolean {
    const currentRoom = this.worldLoader.getRoom(session.currentRoomId);
    if (!currentRoom) {
      session.addMessage('Error: Current room not found.', 'error');
      return false;
    }

    const exit = currentRoom.exits.find(
      (e) => e.direction.toLowerCase() === direction.toLowerCase(),
    );

    if (!exit) {
      session.addMessage(`You can't go ${direction} from here.`, 'system');
      return false;
    }

    const nextRoom = this.worldLoader.getRoom(exit.roomId);
    if (!nextRoom) {
      session.addMessage('Error: Destination room not found.', 'error');
      return false;
    }

    session.currentRoomId = nextRoom.id;
    this.describeLook(session);

    // Check for random encounter
    if (nextRoom.enemies && nextRoom.enemies.length > 0) {
      if (Math.random() < ENCOUNTER_CHANCE) {
        return this.triggerEncounter(session, nextRoom.enemies);
      }
    }

    return true;
  }

  look(session: GameSession): void {
    this.describeLook(session);
  }

  private describeLook(session: GameSession): void {
    const room = this.worldLoader.getRoom(session.currentRoomId);
    if (!room) {
      session.addMessage('You are in an unknown place.', 'error');
      return;
    }

    session.addMessage(`\n--- ${room.name} ---`, 'system');
    session.addMessage(room.description);

    // Show exits
    if (room.exits.length > 0) {
      const exitDescriptions = room.exits
        .map((e) => e.description || `${e.direction}`)
        .join(' ');
      session.addMessage(`\nExits: ${room.exits.map((e) => e.direction).join(', ')}`, 'system');
      if (room.exits.some((e) => e.description)) {
        session.addMessage(exitDescriptions);
      }
    }

    // Show items on ground
    const availableItems = session.getAvailableRoomItems(room);
    if (availableItems.length > 0) {
      const itemNames = availableItems
        .map((id) => this.worldLoader.getItem(id)?.name || id)
        .join(', ');
      session.addMessage(`\nYou see: ${itemNames}`, 'loot');
    }
  }

  private triggerEncounter(session: GameSession, enemyIds: string[]): boolean {
    const enemyId = enemyIds[Math.floor(Math.random() * enemyIds.length)];
    const enemyDef = this.worldLoader.getEnemy(enemyId);
    if (!enemyDef) return false;

    return this.startCombat(session, enemyDef);
  }

  startCombat(session: GameSession, enemyDef: EnemyDefinition): boolean {
    session.phase = GamePhase.COMBAT;
    session.combat = {
      enemyId: enemyDef.id,
      enemyName: enemyDef.name,
      enemyHp: enemyDef.stats.hp,
      enemyMaxHp: enemyDef.stats.maxHp,
      enemyAttack: enemyDef.stats.attack,
      enemyDefense: enemyDef.stats.defense,
      enemySpeed: enemyDef.stats.speed,
      isPlayerTurn: true,
      turnCount: 1,
    };

    session.addMessage(`\nA ${enemyDef.name} appears!`, 'combat');
    session.addMessage(enemyDef.description, 'combat');

    return true;
  }
}
