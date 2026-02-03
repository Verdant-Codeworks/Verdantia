import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/game-store';
import type { VisitedRoomSnapshot } from '@verdantia/shared';

const CELL_SIZE = 48;
const PADDING = 24;

export function MapModal() {
  const visitedRooms = useGameStore((s) => s.visitedRooms);
  const roomCoordinates = useGameStore((s) => s.roomCoordinates);
  const currentRoomId = useGameStore((s) => s.currentRoomId);
  const isMapModalOpen = useGameStore((s) => s.isMapModalOpen);
  const setMapModalOpen = useGameStore((s) => s.setMapModalOpen);

  const [selectedRoom, setSelectedRoom] = useState<VisitedRoomSnapshot | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapModalOpen) {
        setMapModalOpen(false);
        setSelectedRoom(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapModalOpen, setMapModalOpen]);

  // Reset selected room when modal closes
  useEffect(() => {
    if (!isMapModalOpen) {
      setSelectedRoom(null);
    }
  }, [isMapModalOpen]);

  if (!isMapModalOpen) {
    return null;
  }

  // Get visited room IDs with coordinates
  const visitedWithCoords = Object.keys(visitedRooms).filter(
    (roomId) => roomCoordinates[roomId]
  );

  if (visitedWithCoords.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-verdant-400 mb-4">Map</h2>
          <p className="text-gray-400">No rooms discovered yet. Explore to reveal the map!</p>
          <button
            onClick={() => setMapModalOpen(false)}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Calculate bounds
  const coords = visitedWithCoords.map((id) => roomCoordinates[id]);
  const minX = Math.min(...coords.map((c) => c.x));
  const maxX = Math.max(...coords.map((c) => c.x));
  const minY = Math.min(...coords.map((c) => c.y));
  const maxY = Math.max(...coords.map((c) => c.y));

  const mapWidth = (maxX - minX + 1) * CELL_SIZE + PADDING * 2;
  const mapHeight = (maxY - minY + 1) * CELL_SIZE + PADDING * 2;

  // Transform coordinates to SVG space
  const toSvg = (x: number, y: number) => ({
    x: (x - minX) * CELL_SIZE + PADDING + CELL_SIZE / 2,
    y: (y - minY) * CELL_SIZE + PADDING + CELL_SIZE / 2,
  });

  // Build connections
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

  const handleRoomClick = (roomId: string) => {
    setSelectedRoom(visitedRooms[roomId]);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={() => setMapModalOpen(false)}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Map section */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-verdant-400">World Map</h2>
            <button
              onClick={() => setMapModalOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="bg-gray-800/50 rounded border border-gray-700 overflow-auto">
            <svg
              width={Math.max(mapWidth, 300)}
              height={Math.max(mapHeight, 200)}
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
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
                  strokeWidth={3}
                />
              ))}

              {/* Rooms */}
              {visitedWithCoords.map((roomId) => {
                const coord = roomCoordinates[roomId];
                const room = visitedRooms[roomId];
                const pos = toSvg(coord.x, coord.y);
                const isCurrent = roomId === currentRoomId;
                const isSelected = selectedRoom?.roomId === roomId;

                return (
                  <g
                    key={roomId}
                    className="cursor-pointer"
                    onClick={() => handleRoomClick(roomId)}
                  >
                    <rect
                      x={pos.x - CELL_SIZE / 2 + 4}
                      y={pos.y - CELL_SIZE / 2 + 4}
                      width={CELL_SIZE - 8}
                      height={CELL_SIZE - 8}
                      rx={4}
                      fill={isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : '#374151'}
                      stroke={isCurrent ? '#4ade80' : isSelected ? '#60a5fa' : '#6b7280'}
                      strokeWidth={isCurrent || isSelected ? 2 : 1}
                      className="transition-all duration-150 hover:fill-gray-500"
                    />
                    {isCurrent && (
                      <circle cx={pos.x} cy={pos.y} r={4} fill="#ffffff" />
                    )}
                    {/* Room name tooltip on hover */}
                    <title>{room.name}</title>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Click a room to see details. Green = current location.
          </p>
        </div>

        {/* Details panel */}
        <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-gray-700 p-4 overflow-y-auto max-h-[40vh] md:max-h-none">
          {selectedRoom ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-verdant-400">
                  {selectedRoom.name}
                </h3>
                {selectedRoom.roomId === currentRoomId && (
                  <span className="text-xs bg-verdant-600 text-white px-2 py-0.5 rounded">
                    Current Location
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {selectedRoom.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Exits
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedRoom.exits.map((exit) => (
                    <span
                      key={exit.direction}
                      className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded capitalize"
                    >
                      {exit.direction}
                    </span>
                  ))}
                </div>
              </div>

              {selectedRoom.itemsSeen.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Items Seen
                  </h4>
                  <ul className="text-sm text-yellow-400 space-y-0.5">
                    {selectedRoom.itemsSeen.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRoom.enemiesSeen.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Enemies Seen
                  </h4>
                  <ul className="text-sm text-red-400 space-y-0.5">
                    {selectedRoom.enemiesSeen.map((enemy, i) => (
                      <li key={i}>{enemy}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">Select a room to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
