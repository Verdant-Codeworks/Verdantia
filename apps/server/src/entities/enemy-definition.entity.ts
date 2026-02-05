import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

@Entity()
export class EnemyDefinition {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'json' })
  stats!: {
    maxHp: number;
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };

  @Property()
  xpReward!: number;

  @Property({ type: 'json' })
  lootTable!: Array<{
    itemId: string;
    chance: number;
  }>;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
