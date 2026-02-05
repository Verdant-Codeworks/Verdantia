import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TemplateEngineService } from '../templates/template-engine.service';
import type { TemplateContext } from '../templates/template.types';
import type { SettlementData, CultureType } from './settlement.types';
import type {
  NPCData,
  NPCRole,
  PersonalityTrait,
  NPCSecret,
  NPCRelationship,
  SecretType,
} from './npc.types';

interface NPCDataFile {
  greetings: Record<NPCRole, Record<string, string[]>>;
  dialogueTopics: Record<NPCRole, string[]>;
  secrets: Record<SecretType, string[]>;
  rolesByEconomy: Record<string, NPCRole[]>;
  minRoles: Record<string, NPCRole[]>;
  personalityByRole: Record<NPCRole, PersonalityTrait[]>;
}

interface NameData {
  firstNames: {
    male: Record<CultureType, string[]>;
    female: Record<CultureType, string[]>;
  };
  surnames: {
    occupational: string[];
    locational: string[];
    descriptive: string[];
  };
}

/**
 * NPC Generator Service
 *
 * Generates deterministic NPCs for settlements based on size, economy, and culture.
 * Same settlement always produces same NPCs with same names, roles, and personalities.
 */
@Injectable()
export class NPCGeneratorService {
  private readonly logger = new Logger(NPCGeneratorService.name);
  private npcData: NPCDataFile;
  private nameData: NameData;

  constructor(private readonly templateEngine: TemplateEngineService) {
    // Load NPC data from JSON files
    const dataPath = join(__dirname, '../data/npc-data.json');
    const namePath = join(__dirname, '../data/names/npc-names.json');

    try {
      this.npcData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      this.nameData = JSON.parse(readFileSync(namePath, 'utf-8'));
    } catch (error) {
      this.logger.error(`Failed to load NPC data: ${error}`);
      throw error;
    }
  }

  /**
   * Generate all NPCs for a settlement.
   * Deterministic - same settlement produces same NPCs.
   */
  generateForSettlement(settlement: SettlementData): NPCData[] {
    const requiredRoles = this.determineRequiredRoles(settlement);
    const npcs: NPCData[] = [];

    // Generate each NPC
    for (let i = 0; i < requiredRoles.length; i++) {
      const role = requiredRoles[i];
      const seed = this.createSeed(
        settlement.coordinates.x,
        settlement.coordinates.y,
        settlement.coordinates.z,
        `npc_${i}`,
      );

      const npc = this.generateNPC(settlement, role, i, seed);
      npcs.push(npc);
    }

    // Generate relationships between NPCs (after all NPCs exist)
    for (let i = 0; i < npcs.length; i++) {
      const seed = this.createSeed(
        settlement.coordinates.x,
        settlement.coordinates.y,
        settlement.coordinates.z,
        `relationships_${i}`,
      );

      npcs[i].relationships = this.generateRelationships(npcs[i], npcs, seed);
    }

    return npcs;
  }

  /**
   * Generate a single NPC.
   */
  private generateNPC(
    settlement: SettlementData,
    role: NPCRole,
    index: number,
    seed: number,
  ): NPCData {
    const rng = this.seededRandom(seed);
    const id = `npc_${settlement.id}_${index}`;

    // Generate gender (50/50 split)
    const gender = rng() < 0.5 ? 'male' : 'female';

    // Generate name
    const name = this.generateName(seed, settlement.culture, gender);

    // Generate personality traits (1-3 traits)
    const personality = this.generatePersonality(seed, role);

    // Generate secrets (some NPCs have none)
    const secrets = this.generateSecrets(seed, role);

    // Generate age (18-70)
    const age = 18 + Math.floor(rng() * 53);

    // Generate wealth based on role and settlement wealth
    const wealth = this.generateWealth(seed, role, settlement.wealthLevel);

    // Generate greeting
    const greeting = this.generateGreeting(
      { role, personality, name },
      settlement,
      seed,
    );

    // Get dialogue topics for role
    const dialogueTopics = this.npcData.dialogueTopics[role] || ['general'];

    return {
      id,
      settlementId: settlement.id,
      name,
      role,
      personality,
      secrets,
      relationships: [], // Will be populated later
      greeting,
      dialogueTopics,
      wealth,
      age,
    };
  }

  /**
   * Determine what roles the settlement needs based on size and economy.
   */
  private determineRequiredRoles(settlement: SettlementData): NPCRole[] {
    const roles: NPCRole[] = [];

    // Start with minimum roles for settlement size
    const minRoles = this.npcData.minRoles[settlement.size] || [];
    roles.push(...minRoles);

    // Add mayor if not already present
    if (!roles.includes('mayor')) {
      roles.push('mayor');
    }

    // Add economy-specific roles
    for (const economy of settlement.economy) {
      const economyRoles = this.npcData.rolesByEconomy[economy] || [];
      roles.push(...economyRoles);
    }

    // Add additional generic NPCs for larger settlements
    const seed = this.createSeed(
      settlement.coordinates.x,
      settlement.coordinates.y,
      settlement.coordinates.z,
      'extra_npcs',
    );
    const rng = this.seededRandom(seed);

    const extraNpcs = settlement.size === 'city' ? 5 + Math.floor(rng() * 5) :
                     settlement.size === 'town' ? 2 + Math.floor(rng() * 3) :
                     settlement.size === 'village' ? Math.floor(rng() * 2) :
                     0;

    const genericRoles: NPCRole[] = ['farmer', 'hunter', 'beggar', 'merchant'];
    for (let i = 0; i < extraNpcs; i++) {
      const role = genericRoles[Math.floor(rng() * genericRoles.length)];
      roles.push(role);
    }

    return roles;
  }

  /**
   * Generate name based on culture and gender.
   */
  private generateName(seed: number, culture: CultureType, gender: 'male' | 'female'): string {
    const rng = this.seededRandom(seed);

    // Get culture-specific first names
    const firstNames = this.nameData.firstNames[gender][culture] || [];

    // Get surname categories
    const occupational = this.nameData.surnames.occupational;
    const locational = this.nameData.surnames.locational;
    const descriptive = this.nameData.surnames.descriptive;

    // Select first name
    const firstName = firstNames.length > 0
      ? firstNames[Math.floor(rng() * firstNames.length)]
      : 'Unknown';

    // Select surname type (equal chance for each category)
    const surnameType = Math.floor(rng() * 3);
    let surname: string;

    if (surnameType === 0 && occupational.length > 0) {
      surname = occupational[Math.floor(rng() * occupational.length)];
    } else if (surnameType === 1 && locational.length > 0) {
      surname = locational[Math.floor(rng() * locational.length)];
    } else if (descriptive.length > 0) {
      surname = descriptive[Math.floor(rng() * descriptive.length)];
    } else {
      surname = 'Unknown';
    }

    return `${firstName} ${surname}`;
  }

  /**
   * Generate personality traits based on role.
   */
  private generatePersonality(seed: number, role: NPCRole): PersonalityTrait[] {
    const rng = this.seededRandom(seed);
    const possibleTraits = this.npcData.personalityByRole[role] || [
      'friendly',
      'gruff',
      'talkative',
    ];

    // Generate 1-3 traits
    const numTraits = 1 + Math.floor(rng() * 3);
    const traits: PersonalityTrait[] = [];

    // Shuffle and select
    const shuffled = [...possibleTraits];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(numTraits, shuffled.length));
  }

  /**
   * Generate secrets for an NPC (some have none).
   */
  private generateSecrets(seed: number, role: NPCRole): NPCSecret[] {
    const rng = this.seededRandom(seed);

    // Most NPCs don't have secrets
    // 30% chance for regular NPCs, 50% for suspicious/secretive roles
    const secretChance = role === 'thief' || role === 'beggar' ? 0.5 : 0.3;

    if (rng() >= secretChance) {
      return [];
    }

    const secrets: NPCSecret[] = [];
    const secretTypes = Object.keys(this.npcData.secrets) as SecretType[];

    // Generate 1 secret (rarely 2)
    const numSecrets = rng() < 0.8 ? 1 : 2;

    for (let i = 0; i < numSecrets; i++) {
      const type = secretTypes[Math.floor(rng() * secretTypes.length)];
      const templates = this.npcData.secrets[type];
      const template = templates[Math.floor(rng() * templates.length)];

      // Render template
      const context: TemplateContext = {};
      const details = this.templateEngine.render(template, context, seed + i);

      // Generate reveal condition
      const revealConditions = [
        'if offered gold',
        'if threatened',
        'if befriended',
        'after several drinks',
        'if you help them first',
        'in a moment of weakness',
      ];
      const revealCondition = revealConditions[Math.floor(rng() * revealConditions.length)];

      secrets.push({ type, details, revealCondition });
    }

    return secrets;
  }

  /**
   * Generate relationships between NPCs.
   */
  private generateRelationships(
    npc: NPCData,
    allNpcs: NPCData[],
    seed: number,
  ): NPCRelationship[] {
    const rng = this.seededRandom(seed);
    const relationships: NPCRelationship[] = [];

    // Mayor has relationships with many NPCs
    const maxRelationships = npc.role === 'mayor' ? 5 :
                            npc.role === 'innkeeper' ? 4 :
                            npc.role === 'guard' ? 3 :
                            2;

    // Filter out self and randomly select other NPCs
    const others = allNpcs.filter(other => other.id !== npc.id);

    // Shuffle others
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    // Generate relationships with first N NPCs
    const numRelationships = Math.min(maxRelationships, others.length);

    for (let i = 0; i < numRelationships; i++) {
      const other = others[i];

      // Determine relationship type
      const types: NPCRelationship['type'][] = ['friend', 'business', 'rival'];

      // Family relationships more likely if similar roles or both in same settlement
      if (rng() < 0.2) {
        types.push('family');
      }

      const type = types[Math.floor(rng() * types.length)];

      // Pre-compute random choices for determinism (avoid RNG calls inside object literal)
      const familyRelation1 = rng() < 0.5 ? 'sibling' : 'cousin';
      const familyRelation2 = rng() < 0.5 ? 'parent' : 'child';

      // Generate description
      const descriptions: Record<NPCRelationship['type'], string[]> = {
        family: [
          `${other.name} is their ${familyRelation1}`,
          `${other.name}'s ${familyRelation2}`,
        ],
        friend: [
          `good friends with ${other.name}`,
          `has known ${other.name} for years`,
        ],
        rival: [
          `competes with ${other.name} for business`,
          `has a long-standing rivalry with ${other.name}`,
        ],
        business: [
          `does business with ${other.name}`,
          `trades regularly with ${other.name}`,
        ],
        lover: [
          `secretly involved with ${other.name}`,
          `courting ${other.name}`,
        ],
        enemy: [
          `despises ${other.name}`,
          `has a feud with ${other.name}`,
        ],
      };

      const descOptions = descriptions[type];
      const description = descOptions[Math.floor(rng() * descOptions.length)];

      relationships.push({
        targetNpcId: other.id,
        type,
        description,
      });
    }

    return relationships;
  }

  /**
   * Generate greeting based on personality and role.
   */
  private generateGreeting(
    npc: Partial<NPCData>,
    settlement: SettlementData,
    seed: number,
  ): string {
    const role = npc.role as NPCRole;
    const personality = npc.personality || [];

    // Get greetings for this role
    const roleGreetings = this.npcData.greetings[role] || {};

    // Try to find greeting matching personality
    let templates: string[] = [];
    for (const trait of personality) {
      if (roleGreetings[trait]) {
        templates = roleGreetings[trait];
        break;
      }
    }

    // Fallback to any greeting for this role
    if (templates.length === 0) {
      const allTemplates = Object.values(roleGreetings).flat();
      templates = allTemplates.length > 0 ? allTemplates : ['Hello.'];
    }

    // Select and render template
    const rng = this.seededRandom(seed);
    const template = templates[Math.floor(rng() * templates.length)];

    const context: TemplateContext = {
      settlement: {
        name: settlement.name,
      },
    };

    return this.templateEngine.render(template, context, seed);
  }

  /**
   * Generate wealth level for NPC based on role and settlement wealth.
   */
  private generateWealth(seed: number, role: NPCRole, settlementWealth: number): number {
    const rng = this.seededRandom(seed);

    // Base wealth by role
    const roleWealth: Record<NPCRole, number> = {
      noble: 9,
      mayor: 7,
      merchant: 6,
      scholar: 5,
      priest: 5,
      blacksmith: 5,
      innkeeper: 5,
      stable_master: 5,
      tavern_keeper: 4,
      healer: 4,
      baker: 4,
      butcher: 4,
      guard: 3,
      farmer: 3,
      miner: 3,
      hunter: 3,
      herbalist: 3,
      beggar: 1,
      thief: 2,
    };

    let baseWealth = roleWealth[role] || 3;

    // Adjust for settlement wealth (±2)
    const settlementAdjustment = Math.floor((settlementWealth - 5) / 2);
    baseWealth += settlementAdjustment;

    // Add randomness (±1)
    const variance = Math.floor(rng() * 3) - 1;

    return Math.max(1, Math.min(10, baseWealth + variance));
  }

  /**
   * Create seed from coordinates and salt.
   */
  private createSeed(x: number, y: number, z: number, salt: string): number {
    let hash = 0;
    const str = `${x},${y},${z},${salt}`;
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
