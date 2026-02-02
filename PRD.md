# PRD: Skills System (Mining + Smithing)

Add a data-driven skill progression system with use-based XP (Runescape-style), room resource nodes for gathering, recipe-based crafting at workstations, and a skills UI panel. Initial skills: Mining and Smithing. The system is designed so adding future skills requires only new JSON data entries and a client command alias — no framework changes.

## Task 1: Add shared skill types

Create `packages/shared/src/skills.ts` with all skill-related TypeScript interfaces:
- `SkillDefinition` (id, name, description, maxLevel, xpPerLevel number array)
- `ResourceNodeDefinition` (id, name, description, skill, levelRequired, xpReward, gatherVerb, gatherMessage, lootTable of ResourceLootEntry[], respawnTime, optional toolRequired)
- `ResourceLootEntry` (itemId, quantity, chance)
- `RecipeDefinition` (id, name, description, skill, levelRequired, xpReward, craftVerb, craftingStation, ingredients of RecipeIngredient[], resultItemId, resultQuantity)
- `RecipeIngredient` (itemId, quantity)
- `PlayerSkill` (skillId, xp, level)
- `RoomResourceNode` (nodeId, name, available boolean)

Export the new module from `packages/shared/src/index.ts`.

## Task 2: Extend shared entities and game state

Modify `packages/shared/src/entities.ts`:
- Add `resourceNodes?: string[]` and `tags?: string[]` to `RoomDefinition`
- Add `'material'` to the `ItemType` union type

Modify `packages/shared/src/game-state.ts`:
- Add `skills: PlayerSkill[]`, `skillDefinitions: Record<string, SkillDefinition>`, and `currentRoomResources: RoomResourceNode[]` to the `GameState` interface
- Add `'skill'` to the `NarrativeMessage.type` union type

Modify `packages/shared/src/commands.ts`:
- Add `GATHER = 'gather'`, `CRAFT = 'craft'`, `RECIPES = 'recipes'`, `SKILLS = 'skills'` to `CommandType` enum
- Add `GatherPayload { nodeId: string }` and `CraftPayload { recipeId: string }` interfaces

Modify `packages/shared/src/constants.ts`:
- Add `DEFAULT_SKILL_LEVEL = 1` and `GATHER_FAILURE_CHANCE = 0.15`

Run `pnpm build:shared` to verify the shared package compiles.

## Task 3: Create skill, resource, and recipe JSON data

Create `apps/server/src/game/world/data/skills.json` with two skills:
- Mining: id "mining", maxLevel 15, xpPerLevel array [0, 50, 125, 225, 400, 625, 900, 1250, 1700, 2250, 2900, 3700, 4600, 5700, 7000]
- Smithing: id "smithing", same maxLevel and xpPerLevel structure

Create `apps/server/src/game/world/data/resources.json` with three resource nodes:
- copper_vein: mining skill, level 1 required, 20 XP, requires pickaxe, respawnTime 0, drops copper_ore
- coal_deposit: mining skill, level 3 required, 25 XP, requires pickaxe, respawnTime 0, drops coal
- iron_vein: mining skill, level 5 required, 40 XP, requires pickaxe, respawnTime 0, drops iron_ore

Create `apps/server/src/game/world/data/recipes.json` with five recipes (all require craftingStation "forge"):
- copper_bar: smithing 1, needs 2 copper_ore + 1 coal, 25 XP
- copper_dagger: smithing 2, needs 2 copper_bar, 40 XP
- iron_bar: smithing 5, needs 2 iron_ore + 2 coal, 50 XP
- iron_dagger: smithing 7, needs 2 iron_bar, 75 XP
- steel_plate: smithing 10, needs 5 iron_bar, 120 XP

## Task 4: Add new items to items.json

Add 9 new items to `apps/server/src/game/world/data/items.json`:
- pickaxe: type "misc", value 15, description about mining ore
- copper_ore: type "material", value 5
- iron_ore: type "material", value 12
- coal: type "material", value 3
- copper_bar: type "material", value 15
- iron_bar: type "material", value 30
- copper_dagger: type "weapon", equipSlot "weapon", effect attackBonus 2, value 25
- iron_dagger: type "weapon", equipSlot "weapon", effect attackBonus 4 + speedBonus 1, value 45
- steel_plate: type "armor", equipSlot "armor", effect defenseBonus 6, value 120

## Task 5: Add resource nodes and tags to rooms.json

Modify `apps/server/src/game/world/data/rooms.json`:
- blacksmith room: add `"tags": ["forge"]` and add `"pickaxe"` to the items array
- cave_entrance room: add `"resourceNodes": ["copper_vein", "coal_deposit"]`
- goblin_lair room: add `"resourceNodes": ["iron_vein"]`
- mountain_path room: add `"resourceNodes": ["copper_vein"]`

## Task 6: Extend WorldLoaderService to load new data

Modify `apps/server/src/game/world/world-loader.service.ts`:
- Add private Maps for skills, resources, and recipes
- In `loadData()`, read and parse `skills.json`, `resources.json`, and `recipes.json` the same way rooms/items/enemies are loaded
- Add getter methods: `getSkill(id)`, `getResource(id)`, `getRecipe(id)`, `getAllSkills()`, `getAllResources()`, `getAllRecipes()`

## Task 7: Extend GameSession with skill state

Modify `apps/server/src/game/engine/game-state.ts` (GameSession class):
- Add fields: `skills: PlayerSkill[]` (init to []), `gatheredNodes: Record<string, string[]>` (init to {})
- Add methods: `getSkill(skillId)` that auto-creates a skill entry at level 1 if not found, `setSkill(updated)`, `markNodeGathered(roomId, nodeId)`, `getGatheredNodes(roomId)`, `clearGatheredNodesForRoom(roomId)`
- Update `serialize()` to include skills and gatheredNodes
- Update `deserialize()` to restore skills (default []) and gatheredNodes (default {})
- Update `toGameState()` to accept and include `skillDefinitions` and `currentRoomResources` parameters in the returned GameState

## Task 8: Create SkillSystem service

Create `apps/server/src/game/engine/skill-system.ts` as an `@Injectable()` NestJS service that takes WorldLoaderService:

- `gather(session, nodeQuery)`: Find resource node in current room by ID/name/verb fuzzy match. Check skill level requirement, check tool requirement (player must have item in inventory). Apply GATHER_FAILURE_CHANCE (15%) for failed attempts (still award half XP). Roll loot table on success. Award skill XP. Mark node as gathered.
- `craft(session, recipeQuery)`: Find recipe by ID/name fuzzy match. Check room has required craftingStation tag. Check skill level. Check player has all ingredients. Consume ingredients, produce result item, award skill XP.
- `showRecipes(session)`: List all recipes showing name, required skill level, ingredients with have/need counts (mark with checkmark/X), whether player is at correct station.
- `showSkills(session)`: List all skills with current level and XP progress toward next level.
- Private `awardSkillXp()`: Add XP and call recursive `checkSkillLevelUp()` (same pattern as combat level-up).

Register `SkillSystem` as a provider in `apps/server/src/game/game.module.ts`.

## Task 9: Wire up command routing

Modify `apps/server/src/game/engine/command-processor.ts`:
- Inject `SkillSystem` in the constructor alongside existing systems
- In `processExploration()`, add switch cases for `GATHER` (calls skills.gather), `CRAFT` (calls skills.craft), `RECIPES` (calls skills.showRecipes), `SKILLS` (calls skills.showSkills). Include missing-payload error messages for GATHER and CRAFT.
- In `processCombat()`, block GATHER/CRAFT/RECIPES/SKILLS with "can't do that during combat" message
- Update `showHelp()` to include: `'Skills: mine [node], smith [recipe], recipes, skills'`

## Task 10: Update movement system for resource nodes

Modify `apps/server/src/game/engine/movement-system.ts`:
- In `move()`, after updating `session.currentRoomId`, call `session.clearGatheredNodesForRoom(nextRoom.id)` so resource nodes respawn when re-entering a room
- In `describeLook()`, after showing items on ground, show available resource nodes: get room's resourceNodes array, filter out gathered ones, display names with a "Resource nodes:" label using message type 'skill'

## Task 11: Update GameService.buildGameState

Modify `apps/server/src/game/game.service.ts`:
- In `buildGameState()`, collect all skill definitions into a `Record<string, SkillDefinition>`
- Build `RoomResourceNode[]` from the current room's resourceNodes field, checking against session's gatheredNodes for availability
- Pass skillDefinitions and currentRoomResources to `session.toGameState()`

## Task 12: Update client Zustand store

Modify `apps/client/src/stores/game-store.ts`:
- Add `skills: PlayerSkill[]`, `skillDefinitions: Record<string, SkillDefinition>`, `currentRoomResources: RoomResourceNode[]` to the GameStore interface and initial state
- In `applyStateUpdate`: merge `skills`, `skillDefinitions` (spread like itemDefinitions), and `currentRoomResources`
- In `resetToTitle`: reset skills to [], skillDefinitions to {}, currentRoomResources to []

## Task 13: Add client command parsing

Modify `apps/client/src/hooks/useGameCommands.ts` — in `parseRawInput()` add cases:
- `mine` with optional target → `{ type: GATHER, payload: { nodeId: target || 'mine' } }`
- `gather` with target → `{ type: GATHER, payload: { nodeId: target } }`
- `smith`, `smelt`, `forge`, `craft` with target → `{ type: CRAFT, payload: { recipeId: target } }`
- `recipes`, `recipe` → `{ type: RECIPES }`
- `skills`, `skill` → `{ type: SKILLS }`

## Task 14: Add skill message color to NarrativeOutput

Modify `apps/client/src/components/NarrativeOutput.tsx`:
- Add `skill: 'text-cyan-300'` to the `messageColors` record

## Task 15: Create SkillsPanel component

Create `apps/client/src/components/SkillsPanel.tsx`:
- Compact sidebar section showing each skill with name, level badge, and XP progress bar (bg-verdant-600 on bg-gray-800)
- "Resources Here" sub-section showing resource nodes in the current room (available in verdant-300, depleted in gray-600 with line-through)
- "Details" button that opens a full-screen overlay modal (fixed inset-0, z-50, bg-black/80) with expanded skill cards showing description, level/maxLevel, exact XP numbers, and a close button
- Follow existing styling patterns: gray-900 backgrounds, verdant color accents, uppercase tracking-wider section headers, JetBrains Mono font

## Task 16: Integrate SkillsPanel into GameScreen

Modify `apps/client/src/components/GameScreen.tsx`:
- Import `SkillsPanel`
- Add it in the sidebar `<aside>` after `<InventoryPanel />`, wrapped in `<div className="border-t border-gray-800">`

## Task 17: Update existing tests

Update existing unit tests that call `session.toGameState()` to pass the new `skillDefinitions` and `currentRoomResources` parameters. The tests are in `apps/server/src/game/engine/__tests__/` and `apps/server/src/game/__tests__/`. Run `pnpm test` to confirm all 187+ tests pass.

## Task 18: Build, lint, and verify

Run `pnpm build` to verify full monorepo build (shared → client + server). Run `pnpm lint` to verify no lint errors. Manual play-through test: start new game, go to blacksmith, take pickaxe, go to cave_entrance, type "mine", get copper ore + mining XP, return to blacksmith, type "recipes" to see recipe list, type "smith copper_bar" to craft, type "skills" to see levels. Save and load to verify skills persist.
