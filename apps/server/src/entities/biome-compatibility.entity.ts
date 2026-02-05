import {
  Entity,
  ManyToOne,
  PrimaryKeyProp,
} from '@mikro-orm/core';
import { BiomeDefinition } from './biome-definition.entity';

@Entity()
export class BiomeCompatibility {
  @ManyToOne(() => BiomeDefinition, { primary: true })
  biome!: BiomeDefinition;

  @ManyToOne(() => BiomeDefinition, { primary: true })
  compatibleWith!: BiomeDefinition;

  [PrimaryKeyProp]?: ['biome', 'compatibleWith'];
}
