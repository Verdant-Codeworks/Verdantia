# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Verdantia is a text-based RPG built as a monorepo with a React client and NestJS server communicating over WebSocket. The game features exploration, turn-based combat, inventory management, and persistence via PostgreSQL.

## Architecture

```
verdantia/
├── eslint.config.ts            # ESLint v9 flat config (typescript-eslint)
├── packages/shared/            # @verdantia/shared — types, enums, constants (tsup → ESM + CJS)
├── apps/client/                # @verdantia/client — React + Vite + Tailwind + Zustand
└── apps/server/                # @verdantia/server — NestJS + Socket.IO + MikroORM + PostgreSQL
```

- **All config files are TypeScript** — ESLint (`eslint.config.ts`), Vite (`vite.config.ts`), Tailwind (`tailwind.config.ts`), and tsup (`tsup.config.ts`). PostCSS is configured inline in `vite.config.ts` under `css.postcss`. No `.js` or `.cjs` config files should exist outside `node_modules`/`dist`.

- **Shared package must be built before apps** (`pnpm build:shared` or `pnpm build` handles this automatically)
- **Server-authoritative**: Client sends commands via WebSocket, server processes them and pushes full `GameState` snapshots back
- **Game engine** is in `apps/server/src/game/engine/` — pure game logic (CommandProcessor, CombatSystem, MovementSystem, InventorySystem, GameSession)
- **World data** is loaded from JSON files in `apps/server/src/game/world/data/`
- **Client state** managed by Zustand store (`apps/client/src/stores/game-store.ts`)

### WebSocket Protocol

| Direction | Event | Payload |
|-----------|-------|---------|
| C→S | `client:command` | `{ command: GameCommand }` |
| C→S | `client:request_state` | `{}` |
| S→C | `server:connected` | `{ sessionId, hasSavedGame }` |
| S→C | `server:state_update` | `{ state: GameState }` |
| S→C | `server:error` | `{ code, message }` |

## Commands

### Development

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # Start client (localhost:5173) and server (localhost:3001) concurrently
pnpm dev:client       # Start client only
pnpm dev:server       # Start server only
pnpm build            # Build shared → client + server
pnpm build:shared     # Build shared package only
pnpm lint             # Lint all workspaces
pnpm clean            # Remove dist directories
```

### Database (requires PostgreSQL)

The server runs without a database (save/load commands won't work, but everything else will). To enable persistence:

1. Start PostgreSQL
2. Copy `.env.example` to `.env` and configure database credentials
3. MikroORM will auto-create tables on first run

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- PostgreSQL (optional, for save/load)
- Copy `.env.example` → `.env` and configure if using database

## How to Add Content

### New Rooms
Edit `apps/server/src/game/world/data/rooms.json`. Each room needs:
- `id` (unique string), `name`, `description`
- `exits` array with `{ direction, roomId, description? }`
- `items` array of item IDs present in the room
- `enemies` array of enemy IDs that can spawn there

### New Items
Edit `apps/server/src/game/world/data/items.json`. Types: `consumable`, `weapon`, `armor`, `key`, `misc`. Equipment needs `equipSlot` and `effect` with stat bonuses.

### New Enemies
Edit `apps/server/src/game/world/data/enemies.json`. Each enemy needs `stats`, `xpReward`, and `lootTable` with `{ itemId, chance }` entries.

### New Commands
1. Add to `CommandType` enum in `packages/shared/src/commands.ts`
2. Handle in `apps/server/src/game/engine/command-processor.ts`
3. Add client parsing in `apps/client/src/hooks/useGameCommands.ts`

## Key Files

- `eslint.config.ts` — Root ESLint v9 flat config using `typescript-eslint`
- `packages/shared/src/` — All shared types (GameState, GameCommand, entities, constants)
- `apps/server/src/game/engine/game-state.ts` — GameSession class (server-side mutable state)
- `apps/server/src/game/engine/command-processor.ts` — Command routing by game phase
- `apps/server/src/game/game.gateway.ts` — WebSocket gateway (entry point for client messages)
- `apps/server/src/game/game.service.ts` — Session management, state building, save/load
- `apps/client/src/stores/game-store.ts` — Zustand store mirroring server GameState
- `apps/client/src/hooks/useSocket.ts` — Socket.IO connection lifecycle
- `apps/client/src/hooks/useGameCommands.ts` — Text parsing → GameCommand payloads
- `apps/client/vite.config.ts` — Vite config (includes inline PostCSS/Tailwind/Autoprefixer setup)
