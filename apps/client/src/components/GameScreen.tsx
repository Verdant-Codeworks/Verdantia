import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@verdantia/shared';
import { useGameCommands } from '../hooks/useGameCommands';
import { useGameStore } from '../stores/game-store';
import { NarrativeOutput } from './NarrativeOutput';
import { CommandInput } from './CommandInput';
import { StatsPanel } from './StatsPanel';
import { InventoryPanel } from './InventoryPanel';
import { CombatOverlay } from './CombatOverlay';
import { GamePhase } from '@verdantia/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface GameScreenProps {
  socketRef: RefObject<TypedSocket | null>;
}

export function GameScreen({ socketRef }: GameScreenProps) {
  const { parseAndSend, sendCommand, getHistory } = useGameCommands(socketRef);
  const phase = useGameStore((s) => s.phase);
  const combat = useGameStore((s) => s.combat);
  const isConnected = useGameStore((s) => s.isConnected);

  return (
    <div className="h-screen flex flex-col">
      {/* Connection status banner */}
      {!isConnected && (
        <div className="flex-shrink-0 bg-red-900/80 text-red-200 text-center text-xs py-1 animate-pulse">
          Disconnected from server. Reconnecting...
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/80 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-verdant-400 font-bold tracking-wider">VERDANTIA</h1>
          <StatsPanel />
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* Narrative + Input */}
        <div className="flex-1 flex flex-col min-w-0">
          <NarrativeOutput />
          <CommandInput
            onSubmit={parseAndSend}
            getHistory={getHistory}
            disabled={phase === GamePhase.GAME_OVER}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-l border-gray-800 overflow-y-auto hidden md:block">
          <InventoryPanel />
        </aside>
      </div>

      {/* Combat overlay */}
      {phase === GamePhase.COMBAT && combat && (
        <CombatOverlay combat={combat} sendCommand={sendCommand} />
      )}

      {/* Game over overlay */}
      {phase === GamePhase.GAME_OVER && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-800 rounded-lg p-8 text-center space-y-4 max-w-sm">
            <h2 className="text-2xl font-bold text-red-400">You Have Fallen</h2>
            <p className="text-gray-400">Your adventure ends here...</p>
            <button
              onClick={() => useGameStore.getState().resetToTitle()}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Return to Title
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
