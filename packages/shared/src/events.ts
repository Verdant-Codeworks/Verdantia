import type { GameCommand } from './commands.js';
import type { GameState } from './game-state.js';

// Client → Server events
export interface ClientCommandPayload {
  command: GameCommand;
}

export type ClientRequestStatePayload = Record<string, never>;

// Server → Client events
export interface ServerConnectedPayload {
  sessionId: string;
  hasSavedGame: boolean;
}

export interface ServerStateUpdatePayload {
  state: GameState;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
}

// Event map for type-safe socket handling
export interface ClientToServerEvents {
  'client:command': (payload: ClientCommandPayload) => void;
  'client:request_state': (payload: ClientRequestStatePayload) => void;
}

export interface ServerToClientEvents {
  'server:connected': (payload: ServerConnectedPayload) => void;
  'server:state_update': (payload: ServerStateUpdatePayload) => void;
  'server:error': (payload: ServerErrorPayload) => void;
}
