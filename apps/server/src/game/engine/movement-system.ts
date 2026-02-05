import { Injectable } from '@nestjs/common';
import { WorldLoaderService } from '../world/world-loader.service';
import { GameSession } from './game-state';
import { GamePhase, ENCOUNTER_CHANCE } from '@verdantia/shared';
import type { EnemyDefinition, RoomDefinition } from '@verdantia/shared';

@Injectable()
export class MovementSystem {
  constructor(private readonly worldLoader: WorldLoaderService) {}

  async move(session: GameSession, direction?: string, location?: string): Promise<boolean> {
    const currentRoom = await this.worldLoader.getRoom(session.currentRoomId);
    if (!currentRoom) {
      session.addMessage('Error: Current room not found.', 'error');
      return false;
    }

    // Handle location-based navigation
    if (location) {
      return await this.moveToLocation(session, currentRoom, location);
    }

    // Handle direction-based navigation
    if (!direction) {
      session.addMessage('Go where? Specify a direction or location.', 'system');
      return false;
    }

    const exit = currentRoom.exits.find(
      (e) => e.direction.toLowerCase() === direction.toLowerCase(),
    );

    if (!exit) {
      session.addMessage(`You can't go ${direction} from here.`, 'system');
      return false;
    }

    return await this.moveToRoom(session, exit.roomId);
  }

  private async moveToLocation(
    session: GameSession,
    currentRoom: RoomDefinition,
    location: string,
  ): Promise<boolean> {
    const query = location.toLowerCase();

    // Score each exit based on how well its destination name matches the query
    const scoredExits: Array<{
      exit: RoomDefinition['exits'][0];
      room: RoomDefinition;
      score: number;
    }> = [];

    for (const exit of currentRoom.exits) {
      const destRoom = await this.worldLoader.getRoom(exit.roomId);
      if (!destRoom) continue;

      const score = this.matchLocationScore(destRoom.name, query);
      if (score > 0) {
        scoredExits.push({ exit, room: destRoom, score });
      }
    }

    if (scoredExits.length === 0) {
      const destinationPromises = currentRoom.exits.map(async (e) => {
        const room = await this.worldLoader.getRoom(e.roomId);
        return room?.name;
      });
      const destinations = await Promise.all(destinationPromises);
      const availableDestinations = destinations
        .filter((name): name is string => !!name)
        .join(', ');
      session.addMessage(
        `You can't get to "${location}" from here. Available destinations: ${availableDestinations || 'none'}`,
        'system',
      );
      return false;
    }

    // Sort by score (highest first)
    scoredExits.sort((a, b) => b.score - a.score);

    // Check for ambiguous matches (multiple exits with the same top score)
    const topScore = scoredExits[0].score;
    const topMatches = scoredExits.filter((e) => e.score === topScore);

    if (topMatches.length > 1) {
      const matchList = topMatches
        .map((m) => `${m.room.name} (${m.exit.direction})`)
        .join(', ');
      session.addMessage(
        `Multiple matches for "${location}": ${matchList}. Please be more specific.`,
        'system',
      );
      return false;
    }

    return await this.moveToRoom(session, topMatches[0].exit.roomId);
  }

  private matchLocationScore(roomName: string, query: string): number {
    const name = roomName.toLowerCase();

    // Exact match
    if (name === query) return 100;

    // Starts with query
    if (name.startsWith(query)) return 80;

    // Contains query as substring
    if (name.includes(query)) return 60;

    // Word match: split on spaces and apostrophes
    const words = name.split(/[\s']+/);
    for (const word of words) {
      if (word === query) return 40;
      if (word.startsWith(query)) return 30;
    }

    return 0;
  }

  private async moveToRoom(session: GameSession, roomId: string): Promise<boolean> {
    const nextRoom = await this.worldLoader.getRoom(roomId);
    if (!nextRoom) {
      session.addMessage('Error: Destination room not found.', 'error');
      return false;
    }

    session.currentRoomId = nextRoom.id;
    session.clearGatheredNodesForRoom(nextRoom.id);
    await this.describeLook(session);

    // Check for random encounter
    if (nextRoom.enemies && nextRoom.enemies.length > 0) {
      if (Math.random() < ENCOUNTER_CHANCE) {
        return this.triggerEncounter(session, nextRoom.enemies);
      }
    }

    return true;
  }

  async look(session: GameSession): Promise<void> {
    await this.describeLook(session);
  }

  private async describeLook(session: GameSession): Promise<void> {
    const room = await this.worldLoader.getRoom(session.currentRoomId);
    if (!room) {
      session.addMessage('You are in an unknown place.', 'error');
      return;
    }

    // Mark room as visited with current items/enemies
    this.markRoomAsVisited(session, room);

    session.addMessage(`\n--- ${room.name} ---`, 'system');
    session.addMessage(room.description);

    // Show exits
    if (room.exits.length > 0) {
      session.addMessage(`\nExits:`, 'system');
      for (const exit of room.exits) {
        const desc = exit.description || exit.direction;
        session.addMessage(`  ${exit.direction}: ${desc}`, 'system');
      }
    }

    // Show items on ground (with prices if in a shop)
    const availableItems = session.getAvailableRoomItems(room);
    if (availableItems.length > 0) {
      const itemNames = availableItems
        .map((id) => {
          const item = this.worldLoader.getItem(id);
          if (!item) return id;
          if (room.isShop && item.value !== undefined) {
            return `${item.name} (${item.value}g)`;
          }
          return item.name;
        })
        .join(', ');
      session.addMessage(`\nYou see: ${itemNames}`, 'loot');
    }

    // Show resource nodes
    if (room.resourceNodes && room.resourceNodes.length > 0) {
      const gathered = session.getGatheredNodes(room.id);
      const availableNodes = room.resourceNodes.filter((id) => !gathered.includes(id));
      if (availableNodes.length > 0) {
        const nodeNames = availableNodes
          .map((id) => this.worldLoader.getResource(id)?.name || id)
          .join(', ');
        session.addMessage(`\nResource nodes: ${nodeNames}`, 'skill');
      }
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

  private markRoomAsVisited(session: GameSession, room: RoomDefinition): void {
    if (session.hasVisitedRoom(room.id)) {
      return;
    }

    // Get item names present in room
    const availableItems = session.getAvailableRoomItems(room);
    const itemNames = availableItems
      .map((id) => this.worldLoader.getItem(id)?.name || id)
      .filter((name) => name);

    // Get enemy names that can spawn in room
    const enemyNames = (room.enemies || [])
      .map((id) => this.worldLoader.getEnemy(id)?.name || id)
      .filter((name, index, arr) => name && arr.indexOf(name) === index); // dedupe

    session.markRoomVisited(room, itemNames, enemyNames);
  }
}
