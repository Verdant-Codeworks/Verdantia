import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { BiomeDefinition } from './biome-definition.entity';

@Entity()
export class ProceduralRoom {
  @PrimaryKey()
  id!: string; // format: "proc_x_y_z"

  @Property()
  x!: number;

  @Property()
  y!: number;

  @Property()
  z!: number;

  @ManyToOne(() => BiomeDefinition)
  biome!: BiomeDefinition;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property()
  difficulty!: number;

  @Property()
  seed!: number;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();
}
