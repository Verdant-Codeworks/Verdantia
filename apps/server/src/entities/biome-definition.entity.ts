import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

@Entity()
export class BiomeDefinition {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;

  @Property({ type: 'json' })
  nameTemplates!: string[];

  @Property({ type: 'json' })
  descriptionTemplates!: string[];

  @Property({ type: 'float' })
  baseEncounterChance!: number;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
