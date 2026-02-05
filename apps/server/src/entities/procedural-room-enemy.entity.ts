import {
  Entity,
  PrimaryKey,
  ManyToOne,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { ProceduralRoom } from './procedural-room.entity';
import { EnemyDefinition } from './enemy-definition.entity';

@Entity()
export class ProceduralRoomEnemy {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => ProceduralRoom)
  room!: ProceduralRoom;

  @ManyToOne(() => EnemyDefinition)
  enemy!: EnemyDefinition;
}
