import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, GameCommand } from '@verdantia/shared';
import { CommandType, WS_EVENTS } from '@verdantia/shared';
import { useGameStore } from '../stores/game-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DIRECTION_ALIASES: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
};

function parseRawInput(raw: string): GameCommand | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const verb = parts[0];
  const rest = parts.slice(1).join(' ');

  // Movement shortcuts
  if (DIRECTION_ALIASES[verb]) {
    return { type: CommandType.MOVE, payload: { direction: DIRECTION_ALIASES[verb] } };
  }

  switch (verb) {
    case 'go':
    case 'move':
    case 'walk': {
      const dir = DIRECTION_ALIASES[rest] || rest;
      return dir ? { type: CommandType.MOVE, payload: { direction: dir } } : null;
    }

    case 'north':
    case 'south':
    case 'east':
    case 'west':
    case 'up':
    case 'down':
      return { type: CommandType.MOVE, payload: { direction: verb } };

    case 'look':
    case 'l':
      return { type: CommandType.LOOK };

    case 'attack':
    case 'a':
    case 'hit':
    case 'fight':
      return { type: CommandType.ATTACK };

    case 'defend':
    case 'block':
      return { type: CommandType.DEFEND };

    case 'flee':
    case 'run':
    case 'escape':
      return { type: CommandType.FLEE };

    case 'take':
    case 'get':
    case 'grab':
    case 'pick':
      return rest ? { type: CommandType.TAKE, payload: { itemId: rest } } : null;

    case 'drop':
      return rest ? { type: CommandType.DROP, payload: { itemId: rest } } : null;

    case 'use':
      return rest ? { type: CommandType.USE, payload: { itemId: rest } } : null;

    case 'equip':
    case 'wear':
    case 'wield':
      return rest ? { type: CommandType.EQUIP, payload: { itemId: rest } } : null;

    case 'unequip':
    case 'remove':
      return rest ? { type: CommandType.UNEQUIP, payload: { slot: rest } } : null;

    case 'inventory':
    case 'inv':
    case 'i':
      return { type: CommandType.INVENTORY };

    case 'save':
      return { type: CommandType.SAVE };

    case 'load':
      return { type: CommandType.LOAD };

    case 'help':
    case 'h':
    case '?':
      return { type: CommandType.HELP };

    case 'mine': {
      const target = rest || 'mine';
      return { type: CommandType.GATHER, payload: { nodeId: target } };
    }

    case 'gather':
      return rest ? { type: CommandType.GATHER, payload: { nodeId: rest } } : null;

    case 'smith':
    case 'smelt':
    case 'forge':
    case 'craft':
      return rest ? { type: CommandType.CRAFT, payload: { recipeId: rest } } : null;

    case 'recipes':
    case 'recipe':
      return { type: CommandType.RECIPES };

    case 'skills':
    case 'skill':
      return { type: CommandType.SKILLS };

    case 'map':
    case 'm':
      return { type: CommandType.MAP };

    default:
      return null;
  }
}

export function useGameCommands(socketRef: React.RefObject<TypedSocket | null>) {
  const setProcessing = useGameStore((s) => s.setProcessing);
  const setMapModalOpen = useGameStore((s) => s.setMapModalOpen);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const sendCommand = useCallback(
    (command: GameCommand) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      setProcessing(true);
      socket.emit(WS_EVENTS.CLIENT_COMMAND, { command });
    },
    [socketRef, setProcessing],
  );

  const parseAndSend = useCallback(
    (rawText: string): boolean => {
      const command = parseRawInput(rawText);
      if (!command) return false;

      // Add to command history
      commandHistoryRef.current.unshift(rawText);
      if (commandHistoryRef.current.length > 50) {
        commandHistoryRef.current.pop();
      }
      historyIndexRef.current = -1;

      // Handle map command specially - open modal on client side
      if (command.type === CommandType.MAP) {
        setMapModalOpen(true);
      }

      sendCommand(command);
      return true;
    },
    [sendCommand, setMapModalOpen],
  );

  const newGame = useCallback(
    (playerName: string) => {
      sendCommand({ type: CommandType.NEW_GAME, payload: { playerName } });
    },
    [sendCommand],
  );

  const loadGame = useCallback(() => {
    sendCommand({ type: CommandType.LOAD });
  }, [sendCommand]);

  const getHistory = useCallback((direction: 'up' | 'down'): string | null => {
    const history = commandHistoryRef.current;
    if (history.length === 0) return null;

    if (direction === 'up') {
      historyIndexRef.current = Math.min(historyIndexRef.current + 1, history.length - 1);
    } else {
      historyIndexRef.current = Math.max(historyIndexRef.current - 1, -1);
    }

    if (historyIndexRef.current === -1) return '';
    return history[historyIndexRef.current] || null;
  }, []);

  return { parseAndSend, sendCommand, newGame, loadGame, getHistory };
}
