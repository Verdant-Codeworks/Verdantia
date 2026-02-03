import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Player } from './player.entity';

@Entity()
export class SaveGame {
  @PrimaryKey()
  id: string = v4();

  @OneToOne(() => Player, { unique: true })
  player!: Player;

  @Property({ type: 'json' })
  gameData!: string;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
