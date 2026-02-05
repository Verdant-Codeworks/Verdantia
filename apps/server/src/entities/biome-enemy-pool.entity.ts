import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { BiomeDefinition } from './biome-definition.entity';
import { EnemyDefinition } from './enemy-definition.entity';

@Entity()
export class BiomeEnemyPool {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => BiomeDefinition)
  biome!: BiomeDefinition;

  @ManyToOne(() => EnemyDefinition)
  enemy!: EnemyDefinition;

  @Property()
  minDifficulty!: number;

  @Property()
  maxDifficulty!: number;

  @Property()
  spawnWeight!: number;
}
