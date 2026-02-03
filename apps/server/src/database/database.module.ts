import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import { Player } from '../entities/player.entity';
import { SaveGame } from '../entities/save-game.entity';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('DATABASE_URL');

        // Use DATABASE_URL if available (for cloud deployments like Railway/Supabase)
        if (databaseUrl) {
          return {
            entities: [Player, SaveGame],
            clientUrl: databaseUrl,
            driver: PostgreSqlDriver,
            allowGlobalContext: true,
            debug: false,
          };
        }

        // Fall back to individual vars for local development
        return {
          entities: [Player, SaveGame],
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
    MikroOrmModule.forFeature([Player, SaveGame]),
  ],
  exports: [MikroOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit() {
    const generator = this.orm.getSchemaGenerator();
    await generator.updateSchema();
    this.logger.log('Database schema updated');
  }
}
