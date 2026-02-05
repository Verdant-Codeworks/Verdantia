import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import type { RoomDefinition, ItemDefinition, EnemyDefinition, SkillDefinition, ResourceNodeDefinition, RecipeDefinition } from '@verdantia/shared';
import { isProcedural, parseCoords } from '@verdantia/shared';
import * as path from 'path';
import * as fs from 'fs';
import { ProceduralRoomService } from './procedural-room.service';

@Injectable()
export class WorldLoaderService implements OnModuleInit {
  private readonly logger = new Logger(WorldLoaderService.name);

  private rooms = new Map<string, RoomDefinition>();
  private items = new Map<string, ItemDefinition>();
  private enemies = new Map<string, EnemyDefinition>();
  private skills = new Map<string, SkillDefinition>();
  private resources = new Map<string, ResourceNodeDefinition>();
  private recipes = new Map<string, RecipeDefinition>();

  constructor(
    @Optional() private readonly proceduralRoomService?: ProceduralRoomService,
  ) {}

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

    const skillsData: SkillDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'skills.json'), 'utf-8'),
    );
    for (const skill of skillsData) {
      this.skills.set(skill.id, skill);
    }
    this.logger.log(`Loaded ${this.skills.size} skills`);

    const resourcesData: ResourceNodeDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'resources.json'), 'utf-8'),
    );
    for (const resource of resourcesData) {
      this.resources.set(resource.id, resource);
    }
    this.logger.log(`Loaded ${this.resources.size} resources`);

    const recipesData: RecipeDefinition[] = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'recipes.json'), 'utf-8'),
    );
    for (const recipe of recipesData) {
      this.recipes.set(recipe.id, recipe);
    }
    this.logger.log(`Loaded ${this.recipes.size} recipes`);
  }

  async getRoom(id: string): Promise<RoomDefinition | undefined> {
    // Check if this is a procedural room
    if (isProcedural(id) && this.proceduralRoomService) {
      const coords = parseCoords(id);
      if (coords) {
        // Use new method that pre-generates adjacent rooms for better exit descriptions
        return await this.proceduralRoomService.getOrGenerateRoomWithAdjacent(coords.x, coords.y, coords.z);
      }
    }

    // Return static room
    return this.rooms.get(id);
  }

  getItem(id: string): ItemDefinition | undefined {
    return this.items.get(id);
  }

  getEnemy(id: string): EnemyDefinition | undefined {
    return this.enemies.get(id);
  }

  getSkill(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getResource(id: string): ResourceNodeDefinition | undefined {
    return this.resources.get(id);
  }

  getRecipe(id: string): RecipeDefinition | undefined {
    return this.recipes.get(id);
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

  getAllSkills(): Map<string, SkillDefinition> {
    return this.skills;
  }

  getAllResources(): Map<string, ResourceNodeDefinition> {
    return this.resources;
  }

  getAllRecipes(): Map<string, RecipeDefinition> {
    return this.recipes;
  }
}
