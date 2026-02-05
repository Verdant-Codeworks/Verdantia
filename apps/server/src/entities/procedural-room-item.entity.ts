import {
  Entity,
  PrimaryKey,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { ProceduralRoom } from './procedural-room.entity';
import { ItemDefinition } from './item-definition.entity';

@Entity()
export class ProceduralRoomItem {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => ProceduralRoom)
  room!: ProceduralRoom;

  @ManyToOne(() => ItemDefinition)
  item!: ItemDefinition;
}
