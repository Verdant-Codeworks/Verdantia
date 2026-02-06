import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { WorldLoaderService } from './world/world-loader.service';
import { DefinitionService } from './world/definition.service';
import { ProceduralRoomService } from './world/procedural-room.service';
import { DungeonFloorService } from './world/dungeon/dungeon-floor.service';
import { CommandProcessor } from './engine/command-processor';
import { MovementSystem } from './engine/movement-system';
import { CombatSystem } from './engine/combat-system';
import { InventorySystem } from './engine/inventory-system';
import { SkillSystem } from './engine/skill-system';
import { SaveModule } from '../save/save.module';

const isDatabaseConfigured = !!(process.env.DATABASE_URL || process.env.DATABASE_HOST);

@Module({
  imports: [...(isDatabaseConfigured ? [SaveModule] : [])],
  providers: [
    GameGateway,
    GameService,
    WorldLoaderService,
    DefinitionService,
    ProceduralRoomService,
    DungeonFloorService,
    CommandProcessor,
    MovementSystem,
    CombatSystem,
    InventorySystem,
    SkillSystem,
  ],
})
export class GameModule {}
