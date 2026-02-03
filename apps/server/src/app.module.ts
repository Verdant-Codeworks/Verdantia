import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameModule } from './game/game.module';
import { DatabaseModule } from './database/database.module';

const isDatabaseConfigured = !!(process.env.DATABASE_URL || process.env.DATABASE_HOST);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ...(isDatabaseConfigured ? [DatabaseModule] : []),
    GameModule,
  ],
})
export class AppModule {}
