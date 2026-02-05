import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { ProceduralRoom } from './procedural-room.entity';

@Entity()
@Unique({ properties: ['room', 'direction'] })
export class ProceduralRoomExit {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => ProceduralRoom)
  room!: ProceduralRoom;

  @Property()
  direction!: string;

  @Property({ nullable: true })
  destinationRoomId?: string;

  @Property({ type: 'text', nullable: true })
  description?: string;
}
