import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { WorldLoaderService } from './world/world-loader.service';
import { CommandProcessor } from './engine/command-processor';
import { MovementSystem } from './engine/movement-system';
import { CombatSystem } from './engine/combat-system';
import { InventorySystem } from './engine/inventory-system';
import { SkillSystem } from './engine/skill-system';
import { SaveModule } from '../save/save.module';

@Module({
  imports: [SaveModule],
  providers: [
    GameGateway,
    GameService,
    WorldLoaderService,
    CommandProcessor,
    MovementSystem,
    CombatSystem,
    InventorySystem,
    SkillSystem,
  ],
})
export class GameModule {}
