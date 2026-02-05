export type SettlementSize = 'hamlet' | 'village' | 'town' | 'city';
export type EconomyType = 'farming' | 'mining' | 'trading' | 'fishing' | 'logging' | 'crafting';
export type CultureType = 'frontier' | 'religious' | 'merchant' | 'military' | 'pastoral';
export type ProblemType = 'bandit_raids' | 'monster_threat' | 'plague' | 'famine' | 'corruption' | 'missing_persons' | 'haunting' | 'drought';

export interface SettlementProblem {
  type: ProblemType;
  severity: 'minor' | 'moderate' | 'severe';
  shortDesc: string;      // e.g., "bandit raids on the northern road"
  longDesc: string;       // fuller description
  durationDays: number;   // how long this has been going on
}

export interface HistoricalEvent {
  type: 'founding' | 'disaster' | 'prosperity' | 'conflict' | 'discovery';
  yearsAgo: number;
  description: string;
}

export interface SettlementData {
  id: string;                    // "settlement_45_-12_0"
  coordinates: { x: number; y: number; z: number };
  name: string;                  // "Millbrook"
  size: SettlementSize;
  population: number;
  economy: EconomyType[];
  culture: CultureType;
  problem?: SettlementProblem;
  history: HistoricalEvent[];
  wealthLevel: number;           // 1-10
  defenseLevel: number;          // 1-10
  founded: number;               // years ago
}
