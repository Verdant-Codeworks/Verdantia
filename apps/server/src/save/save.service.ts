import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Player } from '../entities/player.entity';
import { SaveGame } from '../entities/save-game.entity';

@Injectable()
export class SaveService {
  private readonly logger = new Logger(SaveService.name);

  constructor(private readonly em: EntityManager) {}

  async saveGame(playerName: string, slotName: string, gameData: string): Promise<boolean> {
    try {
      const fork = this.em.fork();

      // Find or create player
      let player = await fork.findOne(Player, { name: playerName });
      if (!player) {
        player = new Player();
        player.name = playerName;
        fork.persist(player);
        await fork.flush();
      }

      // Find or create save
      let save = await fork.findOne(SaveGame, { player, slotName });
      if (save) {
        save.gameData = gameData;
      } else {
        save = new SaveGame();
        save.player = player;
        save.slotName = slotName;
        save.gameData = gameData;
        fork.persist(save);
      }

      await fork.flush();
      this.logger.log(`Game saved for ${playerName} in slot "${slotName}"`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to save game: ${error}`);
      return false;
    }
  }

  async loadGame(playerName: string, slotName: string): Promise<string | null> {
    try {
      const fork = this.em.fork();
      const player = await fork.findOne(Player, { name: playerName });
      if (!player) return null;

      const save = await fork.findOne(SaveGame, { player, slotName });
      if (!save) return null;

      return save.gameData;
    } catch (error) {
      this.logger.error(`Failed to load game: ${error}`);
      return null;
    }
  }

  async hasSavedGame(playerName: string): Promise<boolean> {
    try {
      const fork = this.em.fork();
      const player = await fork.findOne(Player, { name: playerName });
      if (!player) return false;

      const count = await fork.count(SaveGame, { player });
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  async listSaves(playerName: string): Promise<{ slotName: string; updatedAt: Date }[]> {
    try {
      const fork = this.em.fork();
      const player = await fork.findOne(Player, { name: playerName });
      if (!player) return [];

      const saves = await fork.find(SaveGame, { player }, { orderBy: { updatedAt: 'desc' } });
      return saves.map((s) => ({ slotName: s.slotName, updatedAt: s.updatedAt }));
    } catch (error) {
      return [];
    }
  }
}
