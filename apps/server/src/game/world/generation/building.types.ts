export type BuildingType =
  | 'inn' | 'tavern' | 'blacksmith' | 'general_store' | 'temple'
  | 'barracks' | 'town_hall' | 'stable' | 'farm' | 'mine_entrance'
  | 'warehouse' | 'market_stall' | 'herbalist_shop' | 'bakery' | 'butcher'
  | 'residence' | 'manor' | 'guard_post' | 'well' | 'mill';

export type BuildingSize = 'small' | 'medium' | 'large';

export interface ShopInventory {
  itemId: string;
  basePrice: number;
  quantity: number;
  restockDays: number;
}

export interface BuildingData {
  id: string;                        // "building_settlement_7_0_0_0"
  settlementId: string;
  name: string;                      // "The Rusty Tankard"
  type: BuildingType;
  size: BuildingSize;
  description: string;
  npcIds: string[];                  // NPCs who work/live here
  inventory?: ShopInventory[];       // For shops
  services?: string[];               // e.g., ["rest", "food", "drink"]
  roomId?: string;                   // Link to room for entering
}
