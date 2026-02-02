import { useGameStore } from './stores/game-store';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { useSocket } from './hooks/useSocket';
import { GamePhase } from '@verdantia/shared';

export function App() {
  const phase = useGameStore((s) => s.phase);
  const socketRef = useSocket();

  if (phase === GamePhase.TITLE) {
    return <TitleScreen socketRef={socketRef} />;
  }

  return <GameScreen socketRef={socketRef} />;
}
