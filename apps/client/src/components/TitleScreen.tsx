import { useState } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@verdantia/shared';
import { useGameCommands } from '../hooks/useGameCommands';
import { useGameStore } from '../stores/game-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TitleScreenProps {
  socketRef: RefObject<TypedSocket | null>;
}

export function TitleScreen({ socketRef }: TitleScreenProps) {
  const [playerName, setPlayerName] = useState('');
  const [showNewGame, setShowNewGame] = useState(false);
  const isConnected = useGameStore((s) => s.isConnected);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const { newGame, loadGame } = useGameCommands(socketRef);

  const handleNewGame = () => {
    if (playerName.trim()) {
      newGame(playerName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNewGame();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-verdant-400 tracking-wider">VERDANTIA</h1>
          <p className="text-gray-400 text-sm">A Text-Based Adventure</p>
        </div>

        <div className="border border-verdant-800 rounded-lg p-6 bg-gray-900/50 space-y-4">
          {!isConnected ? (
            <p className="text-gray-500 animate-pulse">Connecting to server...</p>
          ) : !showNewGame ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowNewGame(true)}
                className="w-full py-3 px-6 bg-verdant-700 hover:bg-verdant-600 text-white rounded transition-colors"
              >
                New Game
              </button>
              {hasSavedGame && (
                <button
                  onClick={() => loadGame()}
                  className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Continue
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-verdant-300">What is your name, adventurer?</p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your name..."
                className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-verdant-500"
                autoFocus
                maxLength={20}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewGame(false)}
                  className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNewGame}
                  disabled={!playerName.trim()}
                  className="flex-1 py-2 px-4 bg-verdant-700 hover:bg-verdant-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
                >
                  Begin
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-gray-600 text-xs">
          Type commands like &quot;go north&quot;, &quot;look&quot;, &quot;attack&quot;, &quot;take
          sword&quot;
        </p>
      </div>
    </div>
  );
}
