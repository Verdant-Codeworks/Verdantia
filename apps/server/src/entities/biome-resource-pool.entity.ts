import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { BiomeDefinition } from './biome-definition.entity';
import { ResourceNodeDefinition } from './resource-node-definition.entity';

@Entity()
export class BiomeResourcePool {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => BiomeDefinition)
  biome!: BiomeDefinition;

  @ManyToOne(() => ResourceNodeDefinition)
  resource!: ResourceNodeDefinition;

  @Property()
  spawnWeight!: number;
}
