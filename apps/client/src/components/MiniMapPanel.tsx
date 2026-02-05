import { useGameStore, isProcedural, parseCoords } from '../stores/game-store';

const CELL_SIZE = 24;
const PADDING = 12;
const PROCEDURAL_RADIUS = 3; // Show 3 rooms in each direction

export function MiniMapPanel() {
  const visitedRooms = useGameStore((s) => s.visitedRooms);
  const roomCoordinates = useGameStore((s) => s.roomCoordinates);
  const currentRoomId = useGameStore((s) => s.currentRoomId);
  const setMapModalOpen = useGameStore((s) => s.setMapModalOpen);

  // Check if we're in a procedural world
  const isInProceduralWorld = currentRoomId && isProcedural(currentRoomId);

  // Get visited room IDs with coordinates
  let visitedWithCoords = Object.keys(visitedRooms).filter(
    (roomId) => roomCoordinates[roomId]
  );

  if (visitedWithCoords.length === 0) {
    return null;
  }

  // Filter to nearby rooms if in procedural world
  if (isInProceduralWorld) {
    const currentCoords = parseCoords(currentRoomId);
    if (currentCoords) {
      visitedWithCoords = visitedWithCoords.filter((roomId) => {
        if (!isProcedural(roomId)) return false;
        const coords = parseCoords(roomId);
        if (!coords) return false;
        return (
          Math.abs(coords.x - currentCoords.x) <= PROCEDURAL_RADIUS &&
          Math.abs(coords.y - currentCoords.y) <= PROCEDURAL_RADIUS &&
          coords.z === currentCoords.z // Same floor
        );
      });
    }
  }

  if (visitedWithCoords.length === 0) {
    return null;
  }

  // Calculate bounds
  const coords = visitedWithCoords.map((id) => roomCoordinates[id]);
  const minX = Math.min(...coords.map((c) => c.x));
  const maxX = Math.max(...coords.map((c) => c.x));
  const minY = Math.min(...coords.map((c) => c.y));
  const maxY = Math.max(...coords.map((c) => c.y));

  const width = (maxX - minX + 1) * CELL_SIZE + PADDING * 2;
  const height = (maxY - minY + 1) * CELL_SIZE + PADDING * 2;

  // Transform coordinates to SVG space
  const toSvg = (x: number, y: number) => ({
    x: (x - minX) * CELL_SIZE + PADDING + CELL_SIZE / 2,
    y: (y - minY) * CELL_SIZE + PADDING + CELL_SIZE / 2,
  });

  // Build connections (lines between adjacent visited rooms)
  const connections: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const visitedSet = new Set(visitedWithCoords);

  for (const roomId of visitedWithCoords) {
    const room = visitedRooms[roomId];
    const coord = roomCoordinates[roomId];
    const from = toSvg(coord.x, coord.y);

    for (const exit of room.exits) {
      if (visitedSet.has(exit.roomId) && roomCoordinates[exit.roomId]) {
        const toCoord = roomCoordinates[exit.roomId];
        const to = toSvg(toCoord.x, toCoord.y);

        // Only add connection once (check if we haven't already added the reverse)
        const exists = connections.some(
          (c) =>
            (c.x1 === from.x && c.y1 === from.y && c.x2 === to.x && c.y2 === to.y) ||
            (c.x1 === to.x && c.y1 === to.y && c.x2 === from.x && c.y2 === from.y)
        );
        if (!exists) {
          connections.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
        }
      }
    }
  }

  return (
    <div className="p-3 border-b border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Map
        </h3>
        <button
          onClick={() => setMapModalOpen(true)}
          className="text-xs text-verdant-400 hover:text-verdant-300 transition-colors"
        >
          Expand
        </button>
      </div>
      <div
        className="bg-gray-900/50 rounded border border-gray-800 overflow-hidden cursor-pointer hover:border-verdant-600 transition-colors"
        onClick={() => setMapModalOpen(true)}
      >
        <svg
          width={Math.min(width, 240)}
          height={Math.min(height, 200)}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
        >
          {/* Connections */}
          {connections.map((conn, i) => (
            <line
              key={i}
              x1={conn.x1}
              y1={conn.y1}
              x2={conn.x2}
              y2={conn.y2}
              stroke="#4b5563"
              strokeWidth={2}
            />
          ))}

          {/* Rooms */}
          {visitedWithCoords.map((roomId) => {
            const coord = roomCoordinates[roomId];
            const pos = toSvg(coord.x, coord.y);
            const isCurrent = roomId === currentRoomId;

            return (
              <g key={roomId}>
                <rect
                  x={pos.x - CELL_SIZE / 2 + 2}
                  y={pos.y - CELL_SIZE / 2 + 2}
                  width={CELL_SIZE - 4}
                  height={CELL_SIZE - 4}
                  rx={3}
                  fill={isCurrent ? '#22c55e' : '#374151'}
                  stroke={isCurrent ? '#4ade80' : '#6b7280'}
                  strokeWidth={isCurrent ? 2 : 1}
                />
                {isCurrent && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={3}
                    fill="#ffffff"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-gray-500 mt-1 text-center">
        Click to expand or type "map"
      </p>
    </div>
  );
}
