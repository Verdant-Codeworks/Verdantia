import type {
  CharacterStats,
  CombatState,
  Equipment,
  GameState,
  InventoryItem,
  ItemDefinition,
  NarrativeMessage,
  RoomDefinition,
  PlayerSkill,
  SkillDefinition,
  RoomResourceNode,
} from '@verdantia/shared';
import {
  GamePhase,
  DEFAULT_PLAYER_STATS,
  DEFAULT_SKILL_LEVEL,
  STARTING_ROOM_ID,
} from '@verdantia/shared';
import { v4 as uuidv4 } from 'uuid';

export class GameSession {
  playerName: string;
  stats: CharacterStats;
  currentRoomId: string;
  inventory: InventoryItem[];
  equipment: Equipment;
  combat: CombatState | null;
  phase: GamePhase;
  gold: number;

  // Rooms that have had items taken from them (track removed items)
  roomItemsRemoved: Record<string, string[]>;

  // Skill state
  skills: PlayerSkill[];
  gatheredNodes: Record<string, string[]>;

  // Pending messages for the next state snapshot
  private pendingMessages: NarrativeMessage[] = [];

  constructor(playerName: string) {
    this.playerName = playerName;
    this.stats = { ...DEFAULT_PLAYER_STATS };
    this.currentRoomId = STARTING_ROOM_ID;
    this.inventory = [];
    this.equipment = {};
    this.combat = null;
    this.phase = GamePhase.EXPLORATION;
    this.gold = 0;
    this.roomItemsRemoved = {};
    this.skills = [];
    this.gatheredNodes = {};
  }

  addMessage(text: string, type: NarrativeMessage['type'] = 'narrative') {
    this.pendingMessages.push({
      id: uuidv4(),
      text,
      type,
      timestamp: Date.now(),
    });
  }

  toGameState(
    currentRoom: RoomDefinition,
    itemDefinitions: Record<string, ItemDefinition>,
    skillDefinitions: Record<string, SkillDefinition> = {},
    currentRoomResources: RoomResourceNode[] = [],
  ): GameState {
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];

    return {
      phase: this.phase,
      playerName: this.playerName,
      stats: { ...this.stats },
      currentRoomId: this.currentRoomId,
      currentRoom,
      inventory: [...this.inventory],
      equipment: { ...this.equipment },
      combat: this.combat ? { ...this.combat } : null,
      messages,
      gold: this.gold,
      itemDefinitions,
      skills: [...this.skills],
      skillDefinitions,
      currentRoomResources,
    };
  }

  getSkill(skillId: string): PlayerSkill {
    let skill = this.skills.find((s) => s.skillId === skillId);
    if (!skill) {
      skill = { skillId, xp: 0, level: DEFAULT_SKILL_LEVEL };
      this.skills.push(skill);
    }
    return skill;
  }

  setSkill(updated: PlayerSkill): void {
    const index = this.skills.findIndex((s) => s.skillId === updated.skillId);
    if (index >= 0) {
      this.skills[index] = updated;
    } else {
      this.skills.push(updated);
    }
  }

  markNodeGathered(roomId: string, nodeId: string): void {
    if (!this.gatheredNodes[roomId]) {
      this.gatheredNodes[roomId] = [];
    }
    this.gatheredNodes[roomId].push(nodeId);
  }

  getGatheredNodes(roomId: string): string[] {
    return this.gatheredNodes[roomId] || [];
  }

  clearGatheredNodesForRoom(roomId: string): void {
    delete this.gatheredNodes[roomId];
  }

  getAvailableRoomItems(room: RoomDefinition): string[] {
    const removed = this.roomItemsRemoved[room.id] || [];
    return (room.items || []).filter((id) => !removed.includes(id));
  }

  removeRoomItem(roomId: string, itemId: string) {
    if (!this.roomItemsRemoved[roomId]) {
      this.roomItemsRemoved[roomId] = [];
    }
    this.roomItemsRemoved[roomId].push(itemId);
  }

  addToInventory(itemId: string, quantity = 1) {
    const existing = this.inventory.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.inventory.push({ itemId, quantity });
    }
  }

  removeFromInventory(itemId: string, quantity = 1): boolean {
    const index = this.inventory.findIndex((i) => i.itemId === itemId);
    if (index === -1) return false;

    const item = this.inventory[index];
    if (item.quantity <= quantity) {
      this.inventory.splice(index, 1);
    } else {
      item.quantity -= quantity;
    }
    return true;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.some((i) => i.itemId === itemId);
  }

  getItemQuantity(itemId: string): number {
    const item = this.inventory.find((i) => i.itemId === itemId);
    return item ? item.quantity : 0;
  }

  serialize(): string {
    return JSON.stringify({
      playerName: this.playerName,
      stats: this.stats,
      currentRoomId: this.currentRoomId,
      inventory: this.inventory,
      equipment: this.equipment,
      phase: this.phase,
      gold: this.gold,
      roomItemsRemoved: this.roomItemsRemoved,
      skills: this.skills,
      gatheredNodes: this.gatheredNodes,
    });
  }

  static deserialize(data: string): GameSession {
    const parsed = JSON.parse(data);
    const session = new GameSession(parsed.playerName);
    session.stats = parsed.stats;
    session.currentRoomId = parsed.currentRoomId;
    session.inventory = parsed.inventory;
    session.equipment = parsed.equipment;
    session.phase = parsed.phase;
    session.gold = parsed.gold;
    session.roomItemsRemoved = parsed.roomItemsRemoved || {};
    session.skills = parsed.skills || [];
    session.gatheredNodes = parsed.gatheredNodes || {};
    return session;
  }
}
