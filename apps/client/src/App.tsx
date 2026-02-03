import { useGameStore } from './stores/game-store';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { InviteCodeScreen } from './components/InviteCodeScreen';
import { useSocket } from './hooks/useSocket';
import { GamePhase } from '@verdantia/shared';

export function App() {
  const phase = useGameStore((s) => s.phase);
  const isConnected = useGameStore((s) => s.isConnected);
  const inviteCode = useGameStore((s) => s.inviteCode);
  const setInviteCode = useGameStore((s) => s.setInviteCode);
  const { socketRef, connect } = useSocket();

  const handleInviteCodeSubmit = (code: string) => {
    setInviteCode(code);
    connect(code);
  };

  // Show invite code screen if not connected and no invite code set
  if (!isConnected && !inviteCode) {
    return <InviteCodeScreen onSubmit={handleInviteCodeSubmit} />;
  }

  if (phase === GamePhase.TITLE) {
    return <TitleScreen socketRef={socketRef} />;
  }

  return <GameScreen socketRef={socketRef} />;
}
