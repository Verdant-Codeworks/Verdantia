import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  Unique,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { SaveGame } from './save-game.entity';

@Entity()
export class Player {
  @PrimaryKey()
  id: string = v4();

  @Property()
  @Unique()
  name!: string;

  @OneToOne(() => SaveGame, { mappedBy: 'player' })
  save?: SaveGame;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
