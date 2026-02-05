import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import { Player } from '../entities/player.entity';
import { SaveGame } from '../entities/save-game.entity';
import { ItemDefinition } from '../entities/item-definition.entity';
import { EnemyDefinition } from '../entities/enemy-definition.entity';
import { BiomeDefinition } from '../entities/biome-definition.entity';
import { BiomeCompatibility } from '../entities/biome-compatibility.entity';
import { BiomeEnemyPool } from '../entities/biome-enemy-pool.entity';
import { BiomeItemPool } from '../entities/biome-item-pool.entity';
import { ResourceNodeDefinition } from '../entities/resource-node-definition.entity';
import { BiomeResourcePool } from '../entities/biome-resource-pool.entity';
import { ProceduralRoom } from '../entities/procedural-room.entity';
import { ProceduralRoomExit } from '../entities/procedural-room-exit.entity';
import { ProceduralRoomItem } from '../entities/procedural-room-item.entity';
import { ProceduralRoomEnemy } from '../entities/procedural-room-enemy.entity';
import { ProceduralRoomResource } from '../entities/procedural-room-resource.entity';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('DATABASE_URL');

        const entities = [
          Player,
          SaveGame,
          ItemDefinition,
          EnemyDefinition,
          BiomeDefinition,
          BiomeCompatibility,
          BiomeEnemyPool,
          BiomeItemPool,
          ResourceNodeDefinition,
          BiomeResourcePool,
          ProceduralRoom,
          ProceduralRoomExit,
          ProceduralRoomItem,
          ProceduralRoomEnemy,
          ProceduralRoomResource,
        ];

        // Use DATABASE_URL if available (for cloud deployments like Railway/Supabase)
        if (databaseUrl) {
          return {
            entities,
            clientUrl: databaseUrl,
            driver: PostgreSqlDriver,
            schema: 'public',
            allowGlobalContext: true,
            debug: false,
          };
        }
        // Fall back to individual vars for local development
        return {
          entities,
          dbName: config.getOrThrow('DATABASE_NAME'),
          host: config.getOrThrow('DATABASE_HOST'),
          port: config.getOrThrow<number>('DATABASE_PORT'),
          user: config.getOrThrow('DATABASE_USER'),
          password: config.getOrThrow('DATABASE_PASSWORD'),
          driver: PostgreSqlDriver,
          allowGlobalContext: true,
          debug: false,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit() {
    const generator = this.orm.getSchemaGenerator();
    try {
      // Log the SQL that WOULD be executed (for diagnostics)
      const diff = await generator.getUpdateSchemaSQL({
        safe: false,
        dropTables: false,
      });
      if (diff.trim()) {
        this.logger.warn('Schema drift detected. Required migrations:');
        this.logger.warn(diff);
      }

      // Apply only safe changes
      await generator.updateSchema({ safe: true, dropTables: false });
      this.logger.log('Database schema updated');
    } catch (error) {
      this.logger.error(
        'Schema update failed',
        error instanceof Error ? error.stack : error,
      );
      this.logger.warn('Database may need manual migration.');
    }
  }
}
