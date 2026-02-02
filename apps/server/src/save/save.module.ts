import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SaveService } from './save.service';
import { Player } from '../entities/player.entity';
import { SaveGame } from '../entities/save-game.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Player, SaveGame])],
  providers: [SaveService],
  exports: [SaveService],
})
export class SaveModule {}
