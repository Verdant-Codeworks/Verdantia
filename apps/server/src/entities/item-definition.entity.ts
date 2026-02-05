import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

@Entity()
export class ItemDefinition {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property()
  type!: string;

  @Property({ nullable: true })
  equipSlot?: string;

  @Property({ type: 'json', nullable: true })
  effect?: Record<string, number>;

  @Property({ nullable: true })
  value?: number;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
