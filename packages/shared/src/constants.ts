export const STARTING_ROOM_ID = 'forest_clearing';

export const DEFAULT_PLAYER_STATS = {
  maxHp: 30,
  hp: 30,
  attack: 5,
  defense: 3,
  speed: 5,
  level: 1,
  xp: 0,
} as const;

export const XP_PER_LEVEL = [
  0, // Level 1 (starting)
  100, // Level 2
  250, // Level 3
  500, // Level 4
  800, // Level 5
  1200, // Level 6
  1700, // Level 7
  2300, // Level 8
  3000, // Level 9
  4000, // Level 10
];

export const STAT_GAINS_PER_LEVEL = {
  maxHp: 5,
  attack: 2,
  defense: 1,
  speed: 1,
} as const;

export const DAMAGE_VARIANCE_MIN = 0.8;
export const DAMAGE_VARIANCE_MAX = 1.2;

export const FLEE_BASE_CHANCE = 0.4;
export const FLEE_SPEED_BONUS = 0.05; // per point of speed advantage

export const ENCOUNTER_CHANCE = 0.25; // chance per room move

export const MAX_INVENTORY_SIZE = 20;

export const DEFAULT_SKILL_LEVEL = 1;
export const GATHER_FAILURE_CHANCE = 0.15;

export const WS_EVENTS = {
  CLIENT_COMMAND: 'client:command',
  CLIENT_REQUEST_STATE: 'client:request_state',
  SERVER_CONNECTED: 'server:connected',
  SERVER_STATE_UPDATE: 'server:state_update',
  SERVER_ERROR: 'server:error',
} as const;
