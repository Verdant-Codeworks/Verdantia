import {
  Entity,
  PrimaryKey,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { ProceduralRoom } from './procedural-room.entity';
import { ResourceNodeDefinition } from './resource-node-definition.entity';

@Entity()
export class ProceduralRoomResource {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => ProceduralRoom)
  room!: ProceduralRoom;

  @ManyToOne(() => ResourceNodeDefinition)
  resource!: ResourceNodeDefinition;
}
