export type BiomeType = 'wilderness' | 'caves' | 'ruins';

export interface ProceduralRoomCoords {
  x: number;
  y: number;
  z: number;
}

export const PROCEDURAL_ROOM_PREFIX = 'proc_';
export const PORTAL_ROOM_ID = 'wilderness_portal';
export const PORTAL_ENTRY_COORDS = { x: 0, y: 0, z: 0 };

export function isProcedural(roomId: string): boolean {
  return roomId.startsWith(PROCEDURAL_ROOM_PREFIX);
}

export function parseCoords(roomId: string): ProceduralRoomCoords | null {
  if (!isProcedural(roomId)) {
    return null;
  }

  const parts = roomId.slice(PROCEDURAL_ROOM_PREFIX.length).split('_');
  if (parts.length !== 3) {
    return null;
  }

  const x = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  const z = parseInt(parts[2], 10);

  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    return null;
  }

  return { x, y, z };
}

export function makeRoomId(x: number, y: number, z: number): string {
  return `${PROCEDURAL_ROOM_PREFIX}${x}_${y}_${z}`;
}
