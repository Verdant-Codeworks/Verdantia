import { useState } from 'react';
import { useGameStore } from '../stores/game-store';

interface InviteCodeScreenProps {
  onSubmit: (code: string) => void;
}

export function InviteCodeScreen({ onSubmit }: InviteCodeScreenProps) {
  const [code, setCode] = useState('');
  const authError = useGameStore((s) => s.authError);

  const handleSubmit = () => {
    if (code.trim()) {
      onSubmit(code.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
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
          <p className="text-verdant-300">Enter your invite code to continue</p>

          {authError && (
            <p className="text-red-400 text-sm">{authError}</p>
          )}

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter invite code..."
            className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-verdant-500"
            autoFocus
          />

          <button
            onClick={handleSubmit}
            disabled={!code.trim()}
            className="w-full py-3 px-6 bg-verdant-700 hover:bg-verdant-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
