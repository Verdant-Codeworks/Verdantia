import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Player } from './player.entity';

@Entity()
@Unique({ properties: ['player', 'slotName'] })
export class SaveGame {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => Player)
  player!: Player;

  @Property()
  slotName!: string;

  @Property({ type: 'json' })
  gameData!: string;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
