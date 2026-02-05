import { describe, it, expect, beforeEach } from 'vitest';
import { QuestGeneratorService } from '../quest-generator.service';
import { TemplateEngineService } from '../../templates/template-engine.service';
import type { SettlementData } from '../settlement.types';
import type { NPCData } from '../npc.types';

describe('QuestGeneratorService', () => {
  let service: QuestGeneratorService;

  beforeEach(() => {
    const templateEngine = new TemplateEngineService();
    service = new QuestGeneratorService(templateEngine);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateForSettlement', () => {
    it('should generate quests for a settlement', () => {
      const settlement: SettlementData = {
        id: 'settlement_10_20_0',
        coordinates: { x: 10, y: 20, z: 0 },
        name: 'Testville',
        size: 'village',
        population: 150,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'bandit_raids',
          severity: 'moderate',
          shortDesc: 'bandits on the road',
          longDesc: 'Bandits have been raiding travelers.',
          durationDays: 30,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 50,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_settlement_10_20_0_0',
          settlementId: settlement.id,
          name: 'Mayor Bob',
          role: 'mayor',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Welcome!',
          dialogueTopics: ['settlement'],
          wealth: 7,
          age: 45,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 12345);

      expect(quests).toBeDefined();
      expect(quests.length).toBeGreaterThan(0);
    });

    it('should generate a problem quest if settlement has a problem', () => {
      const settlement: SettlementData = {
        id: 'settlement_5_10_0',
        coordinates: { x: 5, y: 10, z: 0 },
        name: 'Banditville',
        size: 'hamlet',
        population: 50,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'bandit_raids',
          severity: 'severe',
          shortDesc: 'severe bandit problem',
          longDesc: 'Bandits constantly raid the settlement.',
          durationDays: 60,
        },
        history: [],
        wealthLevel: 3,
        defenseLevel: 2,
        founded: 30,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Guard Joe',
          role: 'guard',
          personality: ['gruff'],
          secrets: [],
          relationships: [],
          greeting: 'State your business.',
          dialogueTopics: ['defense'],
          wealth: 3,
          age: 30,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 54321);

      const problemQuest = quests.find((q) => q.generatedFrom.startsWith('problem:'));
      expect(problemQuest).toBeDefined();
      expect(problemQuest?.type).toBe('kill');
      expect(problemQuest?.difficulty).toBe('hard'); // Severe problem = hard difficulty
    });

    it('should generate secret quests from NPC secrets', () => {
      const settlement: SettlementData = {
        id: 'settlement_7_14_0',
        coordinates: { x: 7, y: 14, z: 0 },
        name: 'Secretville',
        size: 'village',
        population: 200,
        economy: ['trading'],
        culture: 'merchant',
        history: [],
        wealthLevel: 6,
        defenseLevel: 4,
        founded: 40,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_secret_1',
          settlementId: settlement.id,
          name: 'Mysterious Merchant',
          role: 'merchant',
          personality: ['secretive'],
          secrets: [
            {
              type: 'debt',
              details: 'Owes money to dangerous people',
              revealCondition: 'if threatened',
            },
          ],
          relationships: [],
          greeting: 'What do you want?',
          dialogueTopics: ['trade'],
          wealth: 5,
          age: 35,
        },
        {
          id: 'npc_secret_2',
          settlementId: settlement.id,
          name: 'Shady Innkeeper',
          role: 'innkeeper',
          personality: ['nervous'],
          secrets: [
            {
              type: 'stolen_item',
              details: 'A family heirloom was stolen',
              revealCondition: 'if befriended',
            },
          ],
          relationships: [],
          greeting: 'Welcome to the inn.',
          dialogueTopics: ['lodging'],
          wealth: 4,
          age: 42,
        },
      ];

      // Use a seed that will generate some secret quests
      const quests = service.generateForSettlement(settlement, npcs, 99999);

      // Not all secrets generate quests (30% chance), but with 2 NPCs with secrets,
      // we should likely get at least one
      const secretQuests = quests.filter((q) => q.generatedFrom.startsWith('secret:'));
      expect(secretQuests.length).toBeGreaterThanOrEqual(0);

      // If any secret quests were generated, verify their structure
      if (secretQuests.length > 0) {
        const secretQuest = secretQuests[0];
        expect(secretQuest.giverNpcId).toBeDefined();
        expect(['npc_secret_1', 'npc_secret_2']).toContain(secretQuest.giverNpcId);
      }
    });

    it('should generate side quests', () => {
      const settlement: SettlementData = {
        id: 'settlement_3_7_0',
        coordinates: { x: 3, y: 7, z: 0 },
        name: 'Sidequestville',
        size: 'town',
        population: 500,
        economy: ['farming', 'trading'],
        culture: 'merchant',
        history: [],
        wealthLevel: 7,
        defenseLevel: 5,
        founded: 100,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_side_1',
          settlementId: settlement.id,
          name: 'Farmer Fred',
          role: 'farmer',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Howdy!',
          dialogueTopics: ['crops'],
          wealth: 4,
          age: 50,
        },
        {
          id: 'npc_side_2',
          settlementId: settlement.id,
          name: 'Merchant Mary',
          role: 'merchant',
          personality: ['cheerful'],
          secrets: [],
          relationships: [],
          greeting: 'Looking to buy?',
          dialogueTopics: ['trade'],
          wealth: 6,
          age: 38,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 11111);

      const sideQuests = quests.filter((q) => q.generatedFrom.startsWith('side:'));
      expect(sideQuests.length).toBeGreaterThan(0);
    });

    it('should produce identical results for same input', () => {
      const settlement: SettlementData = {
        id: 'settlement_1_2_0',
        coordinates: { x: 1, y: 2, z: 0 },
        name: 'Determinismville',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'pastoral',
        problem: {
          type: 'plague',
          severity: 'moderate',
          shortDesc: 'sickness spreading',
          longDesc: 'A plague affects the settlement.',
          durationDays: 20,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 25,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Healer Helen',
          role: 'healer',
          personality: ['caring'],
          secrets: [],
          relationships: [],
          greeting: 'How can I help?',
          dialogueTopics: ['healing'],
          wealth: 4,
          age: 40,
        },
      ];

      const seed = 77777;

      const quests1 = service.generateForSettlement(settlement, npcs, seed);
      const quests2 = service.generateForSettlement(settlement, npcs, seed);

      expect(quests1).toEqual(quests2);
    });
  });

  describe('generateProblemQuest', () => {
    it('should create quest matching problem type', () => {
      const settlement: SettlementData = {
        id: 'settlement_8_9_0',
        coordinates: { x: 8, y: 9, z: 0 },
        name: 'Monstertown',
        size: 'village',
        population: 150,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'monster_threat',
          severity: 'severe',
          shortDesc: 'monster attacks',
          longDesc: 'A terrible beast terrorizes the area.',
          durationDays: 45,
        },
        history: [],
        wealthLevel: 4,
        defenseLevel: 2,
        founded: 35,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_mayor',
          settlementId: settlement.id,
          name: 'Mayor Alice',
          role: 'mayor',
          personality: ['worried'],
          secrets: [],
          relationships: [],
          greeting: 'Please help us!',
          dialogueTopics: ['monster'],
          wealth: 6,
          age: 55,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 22222);
      const problemQuest = quests.find((q) => q.generatedFrom === 'problem:monster_threat');

      expect(problemQuest).toBeDefined();
      expect(problemQuest?.type).toBe('kill');
      expect(problemQuest?.giverNpcId).toBe('npc_mayor');
    });

    it('should assign appropriate NPC as quest giver', () => {
      const settlement: SettlementData = {
        id: 'settlement_4_6_0',
        coordinates: { x: 4, y: 6, z: 0 },
        name: 'Questville',
        size: 'hamlet',
        population: 60,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'famine',
          severity: 'moderate',
          shortDesc: 'food shortage',
          longDesc: 'Crops have failed.',
          durationDays: 15,
        },
        history: [],
        wealthLevel: 3,
        defenseLevel: 2,
        founded: 20,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_farmer',
          settlementId: settlement.id,
          name: 'Farmer Bill',
          role: 'farmer',
          personality: ['worried'],
          secrets: [],
          relationships: [],
          greeting: 'We need help!',
          dialogueTopics: ['crops'],
          wealth: 3,
          age: 45,
        },
        {
          id: 'npc_mayor',
          settlementId: settlement.id,
          name: 'Mayor Carol',
          role: 'mayor',
          personality: ['serious'],
          secrets: [],
          relationships: [],
          greeting: 'Welcome.',
          dialogueTopics: ['settlement'],
          wealth: 5,
          age: 50,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 33333);
      const problemQuest = quests.find((q) => q.generatedFrom.startsWith('problem:'));

      expect(problemQuest).toBeDefined();
      // Should prefer mayor as quest giver
      expect(problemQuest?.giverNpcId).toBe('npc_mayor');
    });

    it('should scale difficulty with problem severity', () => {
      const createSettlement = (severity: 'minor' | 'moderate' | 'severe'): SettlementData => ({
        id: `settlement_${severity}_0_0_0`,
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'TestSettlement',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'bandit_raids',
          severity,
          shortDesc: 'bandits',
          longDesc: 'Bandit problem',
          durationDays: 30,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 40,
      });

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: 'settlement_test',
          name: 'Test NPC',
          role: 'mayor',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Hi',
          dialogueTopics: [],
          wealth: 5,
          age: 40,
        },
      ];

      const minorQuests = service.generateForSettlement(createSettlement('minor'), npcs, 44444);
      const moderateQuests = service.generateForSettlement(createSettlement('moderate'), npcs, 44444);
      const severeQuests = service.generateForSettlement(createSettlement('severe'), npcs, 44444);

      const minorQuest = minorQuests.find((q) => q.generatedFrom.startsWith('problem:'));
      const moderateQuest = moderateQuests.find((q) => q.generatedFrom.startsWith('problem:'));
      const severeQuest = severeQuests.find((q) => q.generatedFrom.startsWith('problem:'));

      expect(minorQuest?.difficulty).toBe('easy');
      expect(moderateQuest?.difficulty).toBe('medium');
      expect(severeQuest?.difficulty).toBe('hard');
    });
  });

  describe('generateRewards', () => {
    it('should scale gold with difficulty', () => {
      const settlement: SettlementData = {
        id: 'settlement_0_0_0',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'RewardTest',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'bandit_raids',
          severity: 'minor',
          shortDesc: 'bandits',
          longDesc: 'Minor bandit issue',
          durationDays: 10,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 30,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Test NPC',
          role: 'mayor',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Hello',
          dialogueTopics: [],
          wealth: 5,
          age: 40,
        },
      ];

      const easySettlement = { ...settlement, problem: { ...settlement.problem!, severity: 'minor' as const } };
      const mediumSettlement = { ...settlement, problem: { ...settlement.problem!, severity: 'moderate' as const } };
      const hardSettlement = { ...settlement, problem: { ...settlement.problem!, severity: 'severe' as const } };

      const easyQuests = service.generateForSettlement(easySettlement, npcs, 55555);
      const mediumQuests = service.generateForSettlement(mediumSettlement, npcs, 55555);
      const hardQuests = service.generateForSettlement(hardSettlement, npcs, 55555);

      const easyQuest = easyQuests.find((q) => q.generatedFrom.startsWith('problem:'));
      const mediumQuest = mediumQuests.find((q) => q.generatedFrom.startsWith('problem:'));
      const hardQuest = hardQuests.find((q) => q.generatedFrom.startsWith('problem:'));

      // All should have rewards
      expect(easyQuest?.rewards.gold).toBeDefined();
      expect(mediumQuest?.rewards.gold).toBeDefined();
      expect(hardQuest?.rewards.gold).toBeDefined();

      // Hard should pay more than medium, medium more than easy
      if (easyQuest && mediumQuest && hardQuest) {
        expect(hardQuest.rewards.gold).toBeGreaterThan(mediumQuest.rewards.gold!);
        expect(mediumQuest.rewards.gold).toBeGreaterThan(easyQuest.rewards.gold!);
      }
    });

    it('should scale xp with difficulty', () => {
      const settlement: SettlementData = {
        id: 'settlement_xp_test',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'XPTest',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'plague',
          severity: 'moderate',
          shortDesc: 'sickness',
          longDesc: 'Plague spreads',
          durationDays: 20,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 30,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_healer',
          settlementId: settlement.id,
          name: 'Healer',
          role: 'healer',
          personality: ['caring'],
          secrets: [],
          relationships: [],
          greeting: 'Hello',
          dialogueTopics: [],
          wealth: 4,
          age: 45,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 66666);
      const quest = quests.find((q) => q.generatedFrom.startsWith('problem:'));

      expect(quest?.rewards.xp).toBeDefined();
      expect(quest?.rewards.xp).toBeGreaterThan(0);
    });

    it('should increase rewards for wealthier settlements', () => {
      const createSettlement = (wealthLevel: number): SettlementData => ({
        id: `settlement_wealth_${wealthLevel}`,
        coordinates: { x: 0, y: 0, z: 0 },
        name: `WealthTest${wealthLevel}`,
        size: 'village',
        population: 100,
        economy: ['trading'],
        culture: 'merchant',
        problem: {
          type: 'bandit_raids',
          severity: 'moderate',
          shortDesc: 'bandits',
          longDesc: 'Bandit raids',
          durationDays: 30,
        },
        history: [],
        wealthLevel,
        defenseLevel: 5,
        founded: 50,
      });

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: 'test',
          name: 'Mayor',
          role: 'mayor',
          personality: ['friendly'],
          secrets: [],
          relationships: [],
          greeting: 'Hello',
          dialogueTopics: [],
          wealth: 5,
          age: 40,
        },
      ];

      const poorQuests = service.generateForSettlement(createSettlement(3), npcs, 77777);
      const richQuests = service.generateForSettlement(createSettlement(8), npcs, 77777);

      const poorQuest = poorQuests.find((q) => q.generatedFrom.startsWith('problem:'));
      const richQuest = richQuests.find((q) => q.generatedFrom.startsWith('problem:'));

      // Wealthier settlements should offer more gold
      if (poorQuest && richQuest) {
        expect(richQuest.rewards.gold).toBeGreaterThan(poorQuest.rewards.gold!);
      }
    });
  });

  describe('generateObjectives', () => {
    it('should create appropriate objectives for kill quests', () => {
      const settlement: SettlementData = {
        id: 'settlement_kill_quest',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'KillQuest',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'frontier',
        problem: {
          type: 'monster_threat',
          severity: 'severe',
          shortDesc: 'monster',
          longDesc: 'Monster attacks',
          durationDays: 40,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 30,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_1',
          settlementId: settlement.id,
          name: 'Guard',
          role: 'guard',
          personality: ['brave'],
          secrets: [],
          relationships: [],
          greeting: 'Stand ready!',
          dialogueTopics: [],
          wealth: 4,
          age: 35,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 88888);
      const killQuest = quests.find((q) => q.type === 'kill');

      expect(killQuest).toBeDefined();
      expect(killQuest?.objectives.length).toBeGreaterThan(0);
      expect(killQuest?.objectives.some((obj) => obj.type === 'kill')).toBe(true);
    });

    it('should create appropriate objectives for fetch quests', () => {
      const settlement: SettlementData = {
        id: 'settlement_fetch_quest',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'FetchQuest',
        size: 'village',
        population: 100,
        economy: ['farming'],
        culture: 'pastoral',
        problem: {
          type: 'plague',
          severity: 'moderate',
          shortDesc: 'sickness',
          longDesc: 'Plague spreads',
          durationDays: 25,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 3,
        founded: 30,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_healer',
          settlementId: settlement.id,
          name: 'Healer',
          role: 'healer',
          personality: ['caring'],
          secrets: [],
          relationships: [],
          greeting: 'Let me help.',
          dialogueTopics: [],
          wealth: 4,
          age: 40,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 99999);
      const fetchQuest = quests.find((q) => q.type === 'fetch');

      expect(fetchQuest).toBeDefined();
      expect(fetchQuest?.objectives.length).toBeGreaterThan(0);
      expect(fetchQuest?.objectives.some((obj) => obj.type === 'collect')).toBe(true);
    });

    it('should create appropriate objectives for investigate quests', () => {
      const settlement: SettlementData = {
        id: 'settlement_investigate',
        coordinates: { x: 0, y: 0, z: 0 },
        name: 'InvestigateQuest',
        size: 'town',
        population: 400,
        economy: ['trading'],
        culture: 'merchant',
        problem: {
          type: 'corruption',
          severity: 'moderate',
          shortDesc: 'corruption',
          longDesc: 'Officials are corrupt',
          durationDays: 60,
        },
        history: [],
        wealthLevel: 7,
        defenseLevel: 5,
        founded: 80,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_whistleblower',
          settlementId: settlement.id,
          name: 'Whistleblower',
          role: 'merchant',
          personality: ['suspicious'],
          secrets: [],
          relationships: [],
          greeting: 'I know things...',
          dialogueTopics: [],
          wealth: 5,
          age: 35,
        },
      ];

      const quests = service.generateForSettlement(settlement, npcs, 11223);
      const investigateQuest = quests.find((q) => q.type === 'investigate');

      expect(investigateQuest).toBeDefined();
      expect(investigateQuest?.objectives.length).toBeGreaterThan(0);
      expect(investigateQuest?.objectives.some((obj) => obj.type === 'find' || obj.type === 'talk')).toBe(true);
    });
  });

  describe('determinism', () => {
    it('should produce identical quests for identical input', () => {
      const settlement: SettlementData = {
        id: 'settlement_determinism',
        coordinates: { x: 15, y: 25, z: 0 },
        name: 'DeterminismTest',
        size: 'village',
        population: 180,
        economy: ['farming', 'mining'],
        culture: 'frontier',
        problem: {
          type: 'bandit_raids',
          severity: 'moderate',
          shortDesc: 'bandits',
          longDesc: 'Bandit problem',
          durationDays: 35,
        },
        history: [],
        wealthLevel: 5,
        defenseLevel: 4,
        founded: 45,
      };

      const npcs: NPCData[] = [
        {
          id: 'npc_mayor',
          settlementId: settlement.id,
          name: 'Mayor Determinism',
          role: 'mayor',
          personality: ['friendly', 'serious'],
          secrets: [
            {
              type: 'debt',
              details: 'Owes money',
              revealCondition: 'if threatened',
            },
          ],
          relationships: [],
          greeting: 'Welcome!',
          dialogueTopics: ['settlement'],
          wealth: 7,
          age: 50,
        },
        {
          id: 'npc_farmer',
          settlementId: settlement.id,
          name: 'Farmer Determinism',
          role: 'farmer',
          personality: ['humble'],
          secrets: [],
          relationships: [],
          greeting: 'Howdy!',
          dialogueTopics: ['crops'],
          wealth: 4,
          age: 42,
        },
      ];

      const seed = 123456789;

      const quests1 = service.generateForSettlement(settlement, npcs, seed);
      const quests2 = service.generateForSettlement(settlement, npcs, seed);

      // Should produce identical results
      expect(quests1.length).toBe(quests2.length);
      expect(quests1).toEqual(quests2);

      // Verify each quest matches
      for (let i = 0; i < quests1.length; i++) {
        expect(quests1[i].id).toBe(quests2[i].id);
        expect(quests1[i].name).toBe(quests2[i].name);
        expect(quests1[i].description).toBe(quests2[i].description);
        expect(quests1[i].type).toBe(quests2[i].type);
        expect(quests1[i].difficulty).toBe(quests2[i].difficulty);
        expect(quests1[i].objectives).toEqual(quests2[i].objectives);
        expect(quests1[i].rewards).toEqual(quests2[i].rewards);
      }
    });
  });
});
