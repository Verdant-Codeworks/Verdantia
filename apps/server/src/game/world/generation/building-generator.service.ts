import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TemplateEngineService } from '../templates/template-engine.service';
import type { TemplateContext } from '../templates/template.types';
import type { BuildingData, BuildingType, BuildingSize, ShopInventory } from './building.types';
import type { SettlementData } from './settlement.types';
import type { NPCData } from './npc.types';

interface BuildingDataFile {
  nameTemplates: Record<BuildingType, {
    patterns: string[];
  }>;
  descriptions: Record<BuildingType, string[]>;
  inventories: Record<string, ShopInventory[]>;
  services: Record<string, string[]>;
  buildingsBySize: Record<string, BuildingType[]>;
  buildingsByEconomy: Record<string, BuildingType[]>;
  npcRoleToBuilding: Record<string, BuildingType>;
}

/**
 * Building Generator Service
 *
 * Generates deterministic building data for settlements.
 * Buildings are generated after NPCs so they can be assigned to buildings based on their roles.
 */
@Injectable()
export class BuildingGeneratorService {
  private readonly logger = new Logger(BuildingGeneratorService.name);
  private buildingData: BuildingDataFile;

  constructor(private readonly templateEngine: TemplateEngineService) {
    // Load building data from JSON file
    const dataPath = join(__dirname, '../data/building-data.json');

    try {
      this.buildingData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    } catch (error) {
      this.logger.error(`Failed to load building data: ${error}`);
      throw error;
    }
  }

  /**
   * Generate all buildings for a settlement.
   * Deterministic - same settlement and NPCs produce same buildings.
   */
  generateForSettlement(settlement: SettlementData, npcs: NPCData[]): BuildingData[] {
    const requiredBuildings = this.determineRequiredBuildings(settlement);
    const buildings: BuildingData[] = [];

    // Generate each building
    for (let i = 0; i < requiredBuildings.length; i++) {
      const type = requiredBuildings[i];
      const seed = this.createSeed(settlement.coordinates.x, settlement.coordinates.y, settlement.coordinates.z, i);
      const building = this.generateBuilding(settlement, type, i, seed);
      buildings.push(building);
    }

    // Assign NPCs to buildings after all buildings are created
    this.assignNPCsToBuildings(buildings, npcs);

    return buildings;
  }

  /**
   * Determine what buildings the settlement needs based on size and economy.
   */
  private determineRequiredBuildings(settlement: SettlementData): BuildingType[] {
    const buildings: BuildingType[] = [];

    // Add buildings based on settlement size
    const sizeBuildings = this.buildingData.buildingsBySize[settlement.size] || [];
    buildings.push(...sizeBuildings);

    // Add buildings based on economy types
    for (const economy of settlement.economy) {
      const economyBuildings = this.buildingData.buildingsByEconomy[economy] || [];
      buildings.push(...economyBuildings);
    }

    return buildings;
  }

  /**
   * Generate a single building with all its properties.
   */
  private generateBuilding(
    settlement: SettlementData,
    type: BuildingType,
    index: number,
    seed: number,
  ): BuildingData {
    const rng = this.seededRandom(seed);
    const id = `building_${settlement.id}_${index}`;

    // Generate building name
    const name = this.generateName(seed, type);

    // Generate description
    const descriptionTemplates = this.buildingData.descriptions[type] || [];
    const descTemplate = descriptionTemplates[Math.floor(rng() * descriptionTemplates.length)] || 'A building.';
    const description = this.templateEngine.render(descTemplate, {}, seed);

    // Determine building size based on settlement size and type
    const size = this.determineBuildingSize(settlement, type, rng);

    // Generate inventory for shop-type buildings
    const inventory = this.generateInventory(seed, type, settlement.wealthLevel, rng);

    // Get services for this building type
    const services = this.buildingData.services[type];

    return {
      id,
      settlementId: settlement.id,
      name,
      type,
      size,
      description,
      npcIds: [],  // Will be populated by assignNPCsToBuildings
      inventory,
      services,
    };
  }

  /**
   * Generate building name based on type and seed.
   */
  private generateName(seed: number, type: BuildingType): string {
    const rng = this.seededRandom(seed);
    const templates = this.buildingData.nameTemplates[type];

    if (!templates || templates.patterns.length === 0) {
      return `A ${type.replace(/_/g, ' ')}`;
    }

    // Select a random pattern
    const pattern = templates.patterns[Math.floor(rng() * templates.patterns.length)];

    // Generate owner name if pattern contains {owner}
    let context: TemplateContext = {};
    if (pattern.includes('{owner}')) {
      context.owner = this.generateOwnerName(seed + 1, rng);
    }

    return this.templateEngine.render(pattern, context, seed);
  }

  /**
   * Generate a simple owner name for buildings.
   */
  private generateOwnerName(seed: number, rng: () => number): string {
    const firstNames = [
      'Alaric', 'Bram', 'Cedric', 'Darius', 'Edgar', 'Finn', 'Gareth', 'Harold',
      'Iris', 'Jana', 'Kara', 'Lydia', 'Mara', 'Nora', 'Olwen', 'Petra',
    ];
    const lastNames = [
      'Smith', 'Cooper', 'Fletcher', 'Mason', 'Baker', 'Miller', 'Carter', 'Wright',
    ];

    const firstName = firstNames[Math.floor(rng() * firstNames.length)];
    const lastName = lastNames[Math.floor(rng() * lastNames.length)];

    return `${firstName} ${lastName}`;
  }

  /**
   * Determine building size based on settlement and building type.
   */
  private determineBuildingSize(
    settlement: SettlementData,
    type: BuildingType,
    rng: () => number,
  ): BuildingSize {
    // Important buildings are larger
    if (type === 'town_hall' || type === 'manor' || type === 'temple') {
      return 'large';
    }

    // Small buildings
    if (type === 'market_stall' || type === 'well' || type === 'residence') {
      return 'small';
    }

    // Size scales with settlement
    if (settlement.size === 'hamlet') {
      return 'small';
    } else if (settlement.size === 'village') {
      return rng() < 0.7 ? 'small' : 'medium';
    } else if (settlement.size === 'town') {
      return rng() < 0.3 ? 'small' : rng() < 0.8 ? 'medium' : 'large';
    } else {
      // city
      return rng() < 0.2 ? 'small' : rng() < 0.7 ? 'medium' : 'large';
    }
  }

  /**
   * Generate shop inventory based on building type and settlement wealth.
   */
  private generateInventory(
    seed: number,
    type: BuildingType,
    wealthLevel: number,
    rng: () => number,
  ): ShopInventory[] | undefined {
    // Check if this building type has inventory templates
    const baseInventory = this.buildingData.inventories[type];
    if (!baseInventory || baseInventory.length === 0) {
      return undefined;
    }

    // Copy and adjust inventory based on wealth
    const inventory: ShopInventory[] = baseInventory.map(item => {
      // Wealthier settlements have more stock and slightly higher prices
      const wealthMultiplier = 0.5 + (wealthLevel / 10) * 1.5; // 0.5x to 2x
      const quantityBase = type === 'blacksmith' ? 2 : type === 'herbalist_shop' ? 5 : 10;
      const quantity = Math.max(1, Math.floor(quantityBase * wealthMultiplier * (0.5 + rng())));

      // Price variance: ±20% based on wealth
      const priceVariance = 1 + (wealthLevel - 5) * 0.04 + (rng() * 0.4 - 0.2);
      const basePrice = Math.max(1, Math.floor(item.basePrice * priceVariance));

      return {
        itemId: item.itemId,
        basePrice,
        quantity,
        restockDays: item.restockDays,
      };
    });

    // Wealthier settlements might have more variety (randomly include extra items)
    if (wealthLevel >= 7 && rng() < 0.3) {
      // Could add rare items, but for now just return what we have
    }

    return inventory;
  }

  /**
   * Assign NPCs to buildings based on their roles.
   * Modifies both buildings (adds NPC IDs) and NPCs (sets buildingId).
   */
  assignNPCsToBuildings(buildings: BuildingData[], npcs: NPCData[]): void {
    // Create a map of building types to building IDs for quick lookup
    const buildingTypeMap = new Map<BuildingType, string[]>();
    for (const building of buildings) {
      if (!buildingTypeMap.has(building.type)) {
        buildingTypeMap.set(building.type, []);
      }
      buildingTypeMap.get(building.type)!.push(building.id);
    }

    // Assign each NPC to an appropriate building
    for (const npc of npcs) {
      const buildingType = this.buildingData.npcRoleToBuilding[npc.role];
      if (!buildingType) {
        // NPC role doesn't have a specific building (e.g., 'beggar', 'thief')
        continue;
      }

      const buildingIds = buildingTypeMap.get(buildingType);
      if (!buildingIds || buildingIds.length === 0) {
        // No building of this type exists in the settlement
        this.logger.warn(`No ${buildingType} found for NPC ${npc.id} with role ${npc.role}`);
        continue;
      }

      // Assign to first available building of this type (could be improved to distribute evenly)
      const buildingId = buildingIds[0];
      const building = buildings.find(b => b.id === buildingId);

      if (building) {
        building.npcIds.push(npc.id);
        npc.buildingId = buildingId;
      }
    }
  }

  /**
   * Create a deterministic seed from coordinates and index.
   */
  private createSeed(x: number, y: number, z: number, index: number): number {
    let hash = 0;
    const str = `${x},${y},${z},building,${index}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Seeded random number generator.
   * Same seed always produces the same sequence.
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
