import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TemplateEngineService } from '../templates/template-engine.service';
import type { TemplateContext } from '../templates/template.types';
import type {
  SettlementData,
  SettlementSize,
  SettlementProblem,
  HistoricalEvent,
  EconomyType,
  CultureType,
  ProblemType,
} from './settlement.types';

interface SettlementDataFile {
  problems: Record<ProblemType, {
    shortDescTemplates: string[];
    longDescTemplates: string[];
  }>;
  history: Record<string, string[]>;
  populationRanges: Record<SettlementSize, [number, number]>;
}

interface NameData {
  prefixes: Record<CultureType, string[]>;
  roots: Record<CultureType, string[]>;
  suffixes: {
    common: string[];
  };
}

/**
 * Settlement Generator Service
 *
 * Generates deterministic settlement data based on coordinates.
 * Same coordinates always produce the same settlement.
 */
@Injectable()
export class SettlementGeneratorService {
  private readonly logger = new Logger(SettlementGeneratorService.name);
  private settlementData: SettlementDataFile;
  private nameData: NameData;

  constructor(private readonly templateEngine: TemplateEngineService) {
    // Load settlement data from JSON files
    const dataPath = join(__dirname, '../data/settlement-data.json');
    const namePath = join(__dirname, '../data/names/settlement-names.json');

    try {
      this.settlementData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      this.nameData = JSON.parse(readFileSync(namePath, 'utf-8'));
    } catch (error) {
      this.logger.error(`Failed to load settlement data: ${error}`);
      throw error;
    }
  }

  /**
   * Generate full settlement data for coordinates.
   * Deterministic - same coordinates produce same settlement.
   */
  generate(x: number, y: number, z: number, size: SettlementSize): SettlementData {
    const id = `settlement_${x}_${y}_${z}`;

    // Generate all deterministic properties using coordinate-based seeds
    const cultureSeed = this.createSeed(x, y, z, 'culture');
    const culture = this.generateCulture(cultureSeed);

    const nameSeed = this.createSeed(x, y, z, 'name');
    const name = this.generateName(nameSeed, culture);

    const economySeed = this.createSeed(x, y, z, 'economy');
    const economy = this.generateEconomy(economySeed, size);

    const populationSeed = this.createSeed(x, y, z, 'population');
    const population = this.generatePopulation(populationSeed, size);

    const wealthSeed = this.createSeed(x, y, z, 'wealth');
    const wealthLevel = this.generateWealthLevel(wealthSeed, size, economy);

    const defenseSeed = this.createSeed(x, y, z, 'defense');
    const defenseLevel = this.generateDefenseLevel(defenseSeed, size, culture);

    const foundedSeed = this.createSeed(x, y, z, 'founded');
    const founded = this.generateFoundedYear(foundedSeed, size);

    const historySeed = this.createSeed(x, y, z, 'history');
    const history = this.generateHistory(historySeed, founded);

    const problemSeed = this.createSeed(x, y, z, 'problem');
    const problem = this.generateProblem(problemSeed, size);

    return {
      id,
      coordinates: { x, y, z },
      name,
      size,
      population,
      economy,
      culture,
      problem,
      history,
      wealthLevel,
      defenseLevel,
      founded,
    };
  }

  /**
   * Generate settlement name based on culture and seed.
   */
  private generateName(seed: number, culture: CultureType): string {
    const rng = this.seededRandom(seed);

    // Get culture-specific parts
    const prefixes = this.nameData.prefixes[culture] || [];
    const roots = this.nameData.roots[culture] || [];
    const suffixes = this.nameData.suffixes.common;

    // 50% chance to use prefix
    const usePrefix = rng() < 0.5;

    let name = '';

    if (usePrefix && prefixes.length > 0) {
      const prefix = prefixes[Math.floor(rng() * prefixes.length)];
      name += prefix + ' ';
    }

    // Always use a root
    if (roots.length > 0) {
      const root = roots[Math.floor(rng() * roots.length)];
      name += root.charAt(0).toUpperCase() + root.slice(1);
    }

    // 60% chance to use suffix
    const useSuffix = rng() < 0.6;
    if (useSuffix && suffixes.length > 0) {
      const suffix = suffixes[Math.floor(rng() * suffixes.length)];
      name += suffix;
    }

    return name || 'Unnamed Settlement';
  }

  /**
   * Generate culture type based on seed.
   */
  private generateCulture(seed: number): CultureType {
    const cultures: CultureType[] = ['frontier', 'religious', 'merchant', 'military', 'pastoral'];
    const rng = this.seededRandom(seed);
    const index = Math.floor(rng() * cultures.length);
    return cultures[index];
  }

  /**
   * Generate economy types based on coordinates (terrain hints) and size.
   */
  private generateEconomy(seed: number, size: SettlementSize): EconomyType[] {
    const rng = this.seededRandom(seed);
    const allEconomies: EconomyType[] = ['farming', 'mining', 'trading', 'fishing', 'logging', 'crafting'];

    // Larger settlements have more diverse economies
    const economyCount = size === 'hamlet' ? 1 :
                         size === 'village' ? 1 + Math.floor(rng() * 2) :
                         size === 'town' ? 2 + Math.floor(rng() * 2) :
                         3 + Math.floor(rng() * 2); // city

    // Shuffle and select
    const shuffled = [...allEconomies];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, economyCount);
  }

  /**
   * Generate population within the range for the settlement size.
   */
  private generatePopulation(seed: number, size: SettlementSize): number {
    const rng = this.seededRandom(seed);
    const [min, max] = this.settlementData.populationRanges[size];
    return min + Math.floor(rng() * (max - min));
  }

  /**
   * Generate wealth level (1-10) based on size and economy.
   */
  private generateWealthLevel(seed: number, size: SettlementSize, economy: EconomyType[]): number {
    const rng = this.seededRandom(seed);

    // Base wealth by size
    let baseWealth = size === 'hamlet' ? 2 :
                     size === 'village' ? 3 :
                     size === 'town' ? 5 :
                     7; // city

    // Trading and merchant economies boost wealth
    if (economy.includes('trading')) {
      baseWealth += 1;
    }
    if (economy.includes('mining')) {
      baseWealth += 1;
    }

    // Add some randomness (±2)
    const variance = Math.floor(rng() * 5) - 2;

    return Math.max(1, Math.min(10, baseWealth + variance));
  }

  /**
   * Generate defense level (1-10) based on size and culture.
   */
  private generateDefenseLevel(seed: number, size: SettlementSize, culture: CultureType): number {
    const rng = this.seededRandom(seed);

    // Base defense by size
    let baseDefense = size === 'hamlet' ? 1 :
                      size === 'village' ? 2 :
                      size === 'town' ? 4 :
                      6; // city

    // Military culture boosts defense
    if (culture === 'military') {
      baseDefense += 2;
    } else if (culture === 'frontier') {
      baseDefense += 1;
    }

    // Add some randomness (±2)
    const variance = Math.floor(rng() * 5) - 2;

    return Math.max(1, Math.min(10, baseDefense + variance));
  }

  /**
   * Generate when the settlement was founded (years ago).
   */
  private generateFoundedYear(seed: number, size: SettlementSize): number {
    const rng = this.seededRandom(seed);

    // Larger settlements tend to be older
    const baseYears = size === 'hamlet' ? 10 :
                      size === 'village' ? 50 :
                      size === 'town' ? 100 :
                      200; // city

    // Add variance (±50%)
    const variance = Math.floor(rng() * baseYears);
    return baseYears + variance;
  }

  /**
   * Generate a problem (or none) for the settlement.
   */
  private generateProblem(seed: number, size: SettlementSize): SettlementProblem | undefined {
    const rng = this.seededRandom(seed);

    // 40% chance of no problem
    if (rng() < 0.4) {
      return undefined;
    }

    const problemTypes: ProblemType[] = [
      'bandit_raids',
      'monster_threat',
      'plague',
      'famine',
      'corruption',
      'missing_persons',
      'haunting',
      'drought',
    ];

    const type = problemTypes[Math.floor(rng() * problemTypes.length)];
    const problemData = this.settlementData.problems[type];

    // Severity scales with settlement size
    const severities: ('minor' | 'moderate' | 'severe')[] = ['minor', 'moderate', 'severe'];
    const severityIndex = size === 'hamlet' ? 0 :
                          size === 'village' ? Math.floor(rng() * 2) :
                          size === 'town' ? Math.floor(rng() * 3) :
                          1 + Math.floor(rng() * 2); // city: moderate or severe

    const severity = severities[Math.min(severityIndex, 2)];

    // Duration: 1-30 days
    const durationDays = 1 + Math.floor(rng() * 30);

    // Render templates
    const shortTemplate = problemData.shortDescTemplates[Math.floor(rng() * problemData.shortDescTemplates.length)];
    const longTemplate = problemData.longDescTemplates[Math.floor(rng() * problemData.longDescTemplates.length)];

    const context: TemplateContext = { durationDays };
    const templateSeed = this.createSeed(seed, 0, 0, 'template');

    const shortDesc = this.templateEngine.render(shortTemplate, context, templateSeed);
    const longDesc = this.templateEngine.render(longTemplate, context, templateSeed);

    return {
      type,
      severity,
      shortDesc,
      longDesc,
      durationDays,
    };
  }

  /**
   * Generate historical events.
   */
  private generateHistory(seed: number, founded: number): HistoricalEvent[] {
    const rng = this.seededRandom(seed);
    const events: HistoricalEvent[] = [];

    // Always include founding event
    const foundingTemplates = this.settlementData.history.founding;
    const foundingTemplate = foundingTemplates[Math.floor(rng() * foundingTemplates.length)];
    const foundingContext: TemplateContext = { yearsAgo: founded };
    const foundingSeed = this.createSeed(seed, 0, 0, 'founding');

    events.push({
      type: 'founding',
      yearsAgo: founded,
      description: this.templateEngine.render(foundingTemplate, foundingContext, foundingSeed),
    });

    // Generate 1-3 additional events for older settlements
    const numEvents = founded > 100 ? 2 + Math.floor(rng() * 2) :
                      founded > 50 ? 1 + Math.floor(rng() * 2) :
                      Math.floor(rng() * 2);

    const eventTypes: ('disaster' | 'prosperity' | 'conflict' | 'discovery')[] = [
      'disaster',
      'prosperity',
      'conflict',
      'discovery',
    ];

    for (let i = 0; i < numEvents; i++) {
      const eventType = eventTypes[Math.floor(rng() * eventTypes.length)];
      const templates = this.settlementData.history[eventType];
      const template = templates[Math.floor(rng() * templates.length)];

      // Event happened sometime between founding and now
      const yearsAgo = Math.floor(rng() * founded);
      const context: TemplateContext = { yearsAgo };
      const eventSeed = this.createSeed(seed, i, 0, eventType);

      events.push({
        type: eventType,
        yearsAgo,
        description: this.templateEngine.render(template, context, eventSeed),
      });
    }

    // Sort by yearsAgo (oldest first)
    return events.sort((a, b) => b.yearsAgo - a.yearsAgo);
  }

  /**
   * Coordinate-based deterministic seed.
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
