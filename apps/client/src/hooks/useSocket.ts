import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@verdantia/shared';
import { WS_EVENTS } from '@verdantia/shared';
import { useGameStore } from '../stores/game-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const setConnected = useGameStore((s) => s.setConnected);
  const setDisconnected = useGameStore((s) => s.setDisconnected);
  const applyStateUpdate = useGameStore((s) => s.applyStateUpdate);
  const setProcessing = useGameStore((s) => s.setProcessing);
  const setAuthError = useGameStore((s) => s.setAuthError);
  const inviteCode = useGameStore((s) => s.inviteCode);

  const connect = useCallback((code: string) => {
    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket: TypedSocket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { inviteCode: code },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    socket.on(WS_EVENTS.SERVER_CONNECTED, (payload) => {
      setConnected(payload.sessionId, payload.hasSavedGame);
    });

    socket.on(WS_EVENTS.SERVER_STATE_UPDATE, (payload) => {
      applyStateUpdate(payload.state);
    });

    socket.on(WS_EVENTS.SERVER_ERROR, (payload) => {
      console.error('[WS] Server error:', payload.code, payload.message);
      if (payload.code === 'INVALID_INVITE_CODE') {
        setAuthError(payload.message);
      }
      setProcessing(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      setDisconnected();
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[WS] Reconnection attempt ${attempt}`);
    });

    socket.io.on('reconnect', () => {
      console.log('[WS] Reconnected');
      // Request state on reconnect in case server still has our session
      socket.emit(WS_EVENTS.CLIENT_REQUEST_STATE, {});
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[WS] Reconnection failed after all attempts');
    });
  }, [setConnected, setDisconnected, applyStateUpdate, setProcessing, setAuthError]);

  // Auto-connect if we have a stored invite code
  useEffect(() => {
    if (inviteCode && !socketRef.current) {
      connect(inviteCode);
    }
  }, [inviteCode, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return { socketRef, connect };
}
