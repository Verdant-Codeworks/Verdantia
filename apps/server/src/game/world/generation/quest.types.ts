export type QuestType = 'kill' | 'fetch' | 'investigate' | 'escort' | 'rescue' | 'deliver' | 'gather';

export type QuestStatus = 'available' | 'active' | 'completed' | 'failed';

export interface QuestObjective {
  type: 'kill' | 'collect' | 'reach' | 'talk' | 'find' | 'protect';
  target: string;           // e.g., "bandit_leader", "healing_herbs", "npc_12"
  quantity?: number;
  description: string;
  completed: boolean;
}

export interface QuestReward {
  gold?: number;
  xp?: number;
  itemIds?: string[];
  reputation?: { faction: string; amount: number };
}

export interface QuestData {
  id: string;                        // "quest_settlement_7_0_0_0"
  settlementId: string;
  name: string;
  type: QuestType;
  description: string;
  giverNpcId: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  generatedFrom: string;             // "problem:bandit_raids" or "secret:npc_3"
  difficulty: 'easy' | 'medium' | 'hard';
  status: QuestStatus;
}
