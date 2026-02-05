import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

@Entity()
export class ResourceNodeDefinition {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property({ nullable: true })
  requiredTool?: string;

  @Property({ type: 'json' })
  yields!: Array<{
    itemId: string;
    minAmount: number;
    maxAmount: number;
    chance: number;
  }>;

  @Property({ nullable: true })
  respawnTime?: number;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
