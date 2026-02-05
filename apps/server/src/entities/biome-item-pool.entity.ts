import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { BiomeDefinition } from './biome-definition.entity';
import { ItemDefinition } from './item-definition.entity';

@Entity()
export class BiomeItemPool {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => BiomeDefinition)
  biome!: BiomeDefinition;

  @ManyToOne(() => ItemDefinition)
  item!: ItemDefinition;

  @Property()
  minDifficulty!: number;

  @Property()
  maxDifficulty!: number;

  @Property()
  spawnWeight!: number;
}
