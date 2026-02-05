export type NPCRole =
  | 'innkeeper' | 'blacksmith' | 'merchant' | 'guard' | 'mayor'
  | 'priest' | 'farmer' | 'miner' | 'hunter' | 'herbalist'
  | 'stable_master' | 'tavern_keeper' | 'baker' | 'butcher'
  | 'healer' | 'scholar' | 'beggar' | 'thief' | 'noble';

export type PersonalityTrait =
  | 'friendly' | 'gruff' | 'suspicious' | 'nervous' | 'cheerful'
  | 'melancholy' | 'boastful' | 'humble' | 'secretive' | 'talkative';

export type SecretType =
  | 'hidden_past' | 'forbidden_love' | 'debt' | 'crime_witness'
  | 'stolen_item' | 'double_identity' | 'cult_member' | 'treasure_map';

export interface NPCSecret {
  type: SecretType;
  details: string;
  revealCondition?: string;  // What might make them reveal it
}

export interface NPCRelationship {
  targetNpcId: string;
  type: 'family' | 'friend' | 'rival' | 'lover' | 'enemy' | 'business';
  description: string;
}

export interface NPCData {
  id: string;                        // "npc_settlement_7_0_0_0"
  settlementId: string;
  name: string;
  role: NPCRole;
  personality: PersonalityTrait[];
  secrets: NPCSecret[];
  relationships: NPCRelationship[];
  greeting: string;                  // Generated from templates
  dialogueTopics: string[];          // Things they can talk about
  buildingId?: string;               // Building they work at (set by building generator)
  wealth: number;                    // 1-10
  age: number;
}
