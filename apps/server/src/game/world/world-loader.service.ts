import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import type { RoomDefinition, ItemDefinition, EnemyDefinition } from '@verdantia/shared';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class WorldLoaderService implements OnModuleInit {
  private readonly logger = new Logger(WorldLoaderService.name);

  private rooms = new Map<string, RoomDefinition>();
  private items = new Map<string, ItemDefinition>();
  private enemies = new Map<string, EnemyDefinition>();

  onModuleInit() {
    this.loadData();
  }

  private loadData() {
    const dataDir = path.join(__dirname, 'data');

    const roomsData: RoomDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'rooms.json'), 'utf-8'),
    );
    for (const room of roomsData) {
      this.rooms.set(room.id, room);
    }
    this.logger.log(`Loaded ${this.rooms.size} rooms`);

    const itemsData: ItemDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'items.json'), 'utf-8'),
    );
    for (const item of itemsData) {
      this.items.set(item.id, item);
    }
    this.logger.log(`Loaded ${this.items.size} items`);

    const enemiesData: EnemyDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'enemies.json'), 'utf-8'),
    );
    for (const enemy of enemiesData) {
      this.enemies.set(enemy.id, enemy);
    }
    this.logger.log(`Loaded ${this.enemies.size} enemies`);
  }

  getRoom(id: string): RoomDefinition | undefined {
    return this.rooms.get(id);
  }

  getItem(id: string): ItemDefinition | undefined {
    return this.items.get(id);
  }

  getEnemy(id: string): EnemyDefinition | undefined {
    return this.enemies.get(id);
  }

  getAllRooms(): Map<string, RoomDefinition> {
    return this.rooms;
  }

  getAllItems(): Map<string, ItemDefinition> {
    return this.items;
  }

  getAllEnemies(): Map<string, EnemyDefinition> {
    return this.enemies;
  }
}
