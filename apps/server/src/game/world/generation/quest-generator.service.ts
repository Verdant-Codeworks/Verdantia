import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TemplateEngineService } from '../templates/template-engine.service';
import type { TemplateContext } from '../templates/template.types';
import type { SettlementData, ProblemType } from './settlement.types';
import type { NPCData, SecretType } from './npc.types';
import type { QuestData, QuestType, QuestObjective, QuestReward } from './quest.types';

interface QuestTemplate {
  name: string[];
  type: QuestType;
  description: string[];
  objectives: Partial<QuestObjective>[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuestDataFile {
  questTemplates: Record<ProblemType, QuestTemplate>;
  secretQuests: Record<SecretType, QuestTemplate>;
  sideQuests: {
    fetch: QuestTemplate[];
    deliver: QuestTemplate[];
    gather: QuestTemplate[];
  };
  rewardScaling: {
    easy: { baseGold: number; baseXp: number };
    medium: { baseGold: number; baseXp: number };
    hard: { baseGold: number; baseXp: number };
  };
  wealthMultiplier: Record<string, number>;
}

/**
 * Quest Generator Service
 *
 * Generates deterministic quests for settlements based on:
 * - Settlement problems (main quests)
 * - NPC secrets (secret quests)
 * - Generic side quests (fetch, deliver, gather)
 *
 * All generation is seeded for determinism.
 */
@Injectable()
export class QuestGeneratorService {
  private readonly logger = new Logger(QuestGeneratorService.name);
  private questData: QuestDataFile;

  constructor(private readonly templateEngine: TemplateEngineService) {
    // Load quest data from JSON file
    const dataPath = join(__dirname, '../data/quest-data.json');

    try {
      this.questData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    } catch (error) {
      this.logger.error(`Failed to load quest data: ${error}`);
      throw error;
    }
  }

  /**
   * Generate all quests for a settlement.
   * Deterministic - same settlement + NPCs produces same quests.
   */
  generateForSettlement(
    settlement: SettlementData,
    npcs: NPCData[],
    seed: number,
  ): QuestData[] {
    const quests: QuestData[] = [];

    // Generate problem quest if settlement has a problem
    const problemQuest = this.generateProblemQuest(settlement, npcs, seed);
    if (problemQuest) {
      quests.push(problemQuest);
    }

    // Generate secret quests from NPCs
    const secretQuests = this.generateSecretQuests(settlement, npcs, seed);
    quests.push(...secretQuests);

    // Generate side quests
    const sideQuests = this.generateSideQuests(settlement, npcs, seed);
    quests.push(...sideQuests);

    return quests;
  }

  /**
   * Generate quest from settlement problem.
   */
  private generateProblemQuest(
    settlement: SettlementData,
    npcs: NPCData[],
    seed: number,
  ): QuestData | undefined {
    if (!settlement.problem) {
      return undefined;
    }

    const template = this.questData.questTemplates[settlement.problem.type];
    if (!template) {
      this.logger.warn(`No quest template for problem type: ${settlement.problem.type}`);
      return undefined;
    }

    // Select appropriate quest giver (prefer mayor, then guard, then any)
    const questGiver =
      npcs.find((npc) => npc.role === 'mayor') ||
      npcs.find((npc) => npc.role === 'guard') ||
      npcs[0];

    if (!questGiver) {
      return undefined;
    }

    // Adjust difficulty based on problem severity
    let difficulty = template.difficulty;
    if (settlement.problem.severity === 'severe') {
      difficulty = 'hard';
    } else if (settlement.problem.severity === 'minor') {
      difficulty = 'easy';
    }

    const questSeed = this.createSeed(
      settlement.coordinates.x,
      settlement.coordinates.y,
      settlement.coordinates.z,
      `quest_problem_${settlement.problem.type}`,
    );

    // Generate quest name
    const name = this.generateName(questSeed, template, settlement, questGiver);

    // Generate quest description
    const description = this.generateDescription(questSeed, template, settlement, questGiver);

    // Generate objectives
    const objectives = this.generateObjectives(template.type, template.objectives, questSeed);

    // Generate rewards
    const rewards = this.generateRewards(difficulty, template.type, settlement);

    const questId = `quest_${settlement.id}_problem`;

    return {
      id: questId,
      settlementId: settlement.id,
      name,
      type: template.type,
      description,
      giverNpcId: questGiver.id,
      objectives,
      rewards,
      generatedFrom: `problem:${settlement.problem.type}`,
      difficulty,
      status: 'available',
    };
  }

  /**
   * Generate quests from NPC secrets.
   */
  private generateSecretQuests(
    settlement: SettlementData,
    npcs: NPCData[],
    seed: number,
  ): QuestData[] {
    const quests: QuestData[] = [];
    const rng = this.seededRandom(seed);

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];

      for (let j = 0; j < npc.secrets.length; j++) {
        const secret = npc.secrets[j];

        // 30% chance to generate quest from secret
        if (rng() > 0.3) {
          continue;
        }

        const template = this.questData.secretQuests[secret.type];
        if (!template) {
          continue;
        }

        const questSeed = this.createSeed(
          settlement.coordinates.x,
          settlement.coordinates.y,
          settlement.coordinates.z,
          `quest_secret_${npc.id}_${j}`,
        );

        const name = this.generateName(questSeed, template, settlement, npc, { npc });
        const description = this.generateDescription(questSeed, template, settlement, npc, {
          npc,
        });
        const objectives = this.generateObjectives(template.type, template.objectives, questSeed);
        const rewards = this.generateRewards(template.difficulty, template.type, settlement);

        const questId = `quest_${settlement.id}_secret_${i}_${j}`;

        quests.push({
          id: questId,
          settlementId: settlement.id,
          name,
          type: template.type,
          description,
          giverNpcId: npc.id,
          objectives,
          rewards,
          generatedFrom: `secret:${npc.id}`,
          difficulty: template.difficulty,
          status: 'available',
        });
      }
    }

    return quests;
  }

  /**
   * Generate generic side quests.
   */
  private generateSideQuests(
    settlement: SettlementData,
    npcs: NPCData[],
    seed: number,
  ): QuestData[] {
    const quests: QuestData[] = [];
    const rng = this.seededRandom(seed);

    // Number of side quests scales with settlement size
    const numSideQuests =
      settlement.size === 'city'
        ? 2 + Math.floor(rng() * 2)
        : settlement.size === 'town'
          ? 1 + Math.floor(rng() * 2)
          : settlement.size === 'village'
            ? Math.floor(rng() * 2)
            : Math.floor(rng() < 0.5 ? 1 : 0);

    const sideQuestTypes: Array<'fetch' | 'deliver' | 'gather'> = ['fetch', 'deliver', 'gather'];

    for (let i = 0; i < numSideQuests; i++) {
      // Pick random quest type
      const typeIndex = Math.floor(rng() * sideQuestTypes.length);
      const questType = sideQuestTypes[typeIndex];
      const templates = this.questData.sideQuests[questType];

      if (!templates || templates.length === 0) {
        continue;
      }

      // Pick random template
      const template = templates[Math.floor(rng() * templates.length)];

      // Pick random NPC as quest giver
      const questGiver = npcs[Math.floor(rng() * npcs.length)];

      const questSeed = this.createSeed(
        settlement.coordinates.x,
        settlement.coordinates.y,
        settlement.coordinates.z,
        `quest_side_${i}`,
      );

      const context = {
        item: { name: this.pickRandomItem(questSeed) },
        destination: { name: this.pickRandomDestination(questSeed) },
      };

      const name = this.generateName(questSeed, template, settlement, questGiver, context);
      const description = this.generateDescription(
        questSeed,
        template,
        settlement,
        questGiver,
        context,
      );
      const objectives = this.generateObjectives(template.type, template.objectives, questSeed);
      const rewards = this.generateRewards(template.difficulty, template.type, settlement);

      const questId = `quest_${settlement.id}_side_${i}`;

      quests.push({
        id: questId,
        settlementId: settlement.id,
        name,
        type: template.type,
        description,
        giverNpcId: questGiver.id,
        objectives,
        rewards,
        generatedFrom: `side:${questType}`,
        difficulty: template.difficulty,
        status: 'available',
      });
    }

    return quests;
  }

  /**
   * Generate quest name from template.
   */
  private generateName(
    seed: number,
    template: QuestTemplate,
    settlement: SettlementData,
    questGiver: NPCData,
    extraContext: Record<string, any> = {},
  ): string {
    const rng = this.seededRandom(seed);
    const nameTemplate = template.name[Math.floor(rng() * template.name.length)];

    const context: TemplateContext = {
      settlement: { name: settlement.name },
      giverNpc: { name: questGiver.name },
      npc: { name: questGiver.name },
      ...extraContext,
    };

    return this.templateEngine.render(nameTemplate, context, seed);
  }

  /**
   * Generate quest description from template.
   */
  private generateDescription(
    seed: number,
    template: QuestTemplate,
    settlement: SettlementData,
    questGiver: NPCData,
    extraContext: Record<string, any> = {},
  ): string {
    const rng = this.seededRandom(seed);
    const descTemplate = template.description[Math.floor(rng() * template.description.length)];

    const context: TemplateContext = {
      settlement: { name: settlement.name },
      giverNpc: { name: questGiver.name },
      npc: { name: questGiver.name },
      ...extraContext,
    };

    return this.templateEngine.render(descTemplate, context, seed);
  }

  /**
   * Generate quest objectives from template.
   */
  private generateObjectives(
    type: QuestType,
    templateObjectives: Partial<QuestObjective>[],
    seed: number,
  ): QuestObjective[] {
    return templateObjectives.map((obj) => ({
      type: obj.type || 'reach',
      target: obj.target || 'unknown',
      quantity: obj.quantity,
      description: obj.description || 'Complete objective',
      completed: false,
    }));
  }

  /**
   * Generate quest rewards based on difficulty and settlement wealth.
   */
  private generateRewards(
    difficulty: 'easy' | 'medium' | 'hard',
    type: QuestType,
    settlement: SettlementData,
  ): QuestReward {
    const baseRewards = this.questData.rewardScaling[difficulty];
    const wealthMultiplier = this.questData.wealthMultiplier[settlement.wealthLevel.toString()] || 1.0;

    const gold = Math.floor(baseRewards.baseGold * wealthMultiplier);
    const xp = baseRewards.baseXp;

    return {
      gold,
      xp,
    };
  }

  /**
   * Pick a random item name for fetch/gather quests.
   */
  private pickRandomItem(seed: number): string {
    const items = ['herbs', 'mushrooms', 'firewood', 'ore', 'pelts', 'fish', 'berries', 'crystals'];
    const rng = this.seededRandom(seed);
    return items[Math.floor(rng() * items.length)];
  }

  /**
   * Pick a random destination name for delivery quests.
   */
  private pickRandomDestination(seed: number): string {
    const destinations = [
      'Millbrook',
      'Oakridge',
      'Riverdale',
      'Stonehaven',
      'Greenfield',
      'Ashford',
      'the nearby settlement',
      'the next town',
    ];
    const rng = this.seededRandom(seed);
    return destinations[Math.floor(rng() * destinations.length)];
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
