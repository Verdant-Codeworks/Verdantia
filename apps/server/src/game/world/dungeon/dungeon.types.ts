export interface DungeonRoomType {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface BiomeDungeonRooms {
  roomTypes: DungeonRoomType[];
  entranceRoom: { name: string; description: string };
  stairsRoom: { name: string; description: string };
}

export interface FloorCell {
  x: number;
  y: number;
  exits: string[];        // 'north' | 'south' | 'east' | 'west'
  roomTypeId: string;     // which room type from the biome's pool
  isEntrance: boolean;
  isStairsDown: boolean;
  distanceFromEntrance: number;
}

export interface FloorLayout {
  depth: number;          // z coordinate (0, -1, -2, ...)
  biomeId: string;        // 'wilderness' | 'caves' | 'ruins'
  difficulty: number;     // 1 + |depth|
  roomCount: number;
  seed: number;
  cells: Map<string, FloorCell>;  // key: "x,y"
  stairsDownCoord: { x: number; y: number };
  stairsUpTarget: string; // room ID for the "up" exit
}
