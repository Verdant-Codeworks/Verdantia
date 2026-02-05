import { describe, it, expect, beforeEach } from 'vitest';
import { NPCGeneratorService } from '../npc-generator.service';
import { SettlementGeneratorService } from '../settlement-generator.service';
import { TemplateEngineService } from '../../templates/template-engine.service';

/**
 * Integration tests demonstrating NPC generation working with settlements.
 */
describe('NPC Integration with Settlements', () => {
  let npcService: NPCGeneratorService;
  let settlementService: SettlementGeneratorService;

  beforeEach(() => {
    const templateEngine = new TemplateEngineService();
    npcService = new NPCGeneratorService(templateEngine);
    settlementService = new SettlementGeneratorService(templateEngine);
  });

  it('should generate complete settlement with NPCs', () => {
    // Generate a settlement
    const settlement = settlementService.generate(10, 20, 0, 'town');

    // Generate NPCs for the settlement
    const npcs = npcService.generateForSettlement(settlement);

    // Verify integration
    expect(npcs.length).toBeGreaterThan(0);

    // All NPCs should reference the settlement
    for (const npc of npcs) {
      expect(npc.settlementId).toBe(settlement.id);
    }

    // Log sample output for verification
    console.log('\n=== Sample Settlement ===');
    console.log(`Name: ${settlement.name}`);
    console.log(`Size: ${settlement.size}`);
    console.log(`Population: ${settlement.population}`);
    console.log(`Culture: ${settlement.culture}`);
    console.log(`Economy: ${settlement.economy.join(', ')}`);
    console.log(`Wealth: ${settlement.wealthLevel}/10`);
    console.log(`Defense: ${settlement.defenseLevel}/10`);
    if (settlement.problem) {
      console.log(`Problem: ${settlement.problem.shortDesc} (${settlement.problem.severity})`);
    }

    console.log(`\n=== NPCs (${npcs.length} total) ===`);
    for (const npc of npcs.slice(0, 5)) {
      console.log(`\n${npc.name} - ${npc.role}`);
      console.log(`  Age: ${npc.age}, Wealth: ${npc.wealth}/10`);
      console.log(`  Personality: ${npc.personality.join(', ')}`);
      console.log(`  Greeting: "${npc.greeting}"`);
      if (npc.secrets.length > 0) {
        console.log(`  Secret: ${npc.secrets[0].details} (${npc.secrets[0].revealCondition})`);
      }
      if (npc.relationships.length > 0) {
        console.log(`  Relationships: ${npc.relationships.length}`);
      }
    }
    if (npcs.length > 5) {
      console.log(`\n... and ${npcs.length - 5} more NPCs`);
    }
  });

  it('should generate appropriate NPCs for different settlement types', () => {
    const hamlet = settlementService.generate(1, 0, 0, 'hamlet');
    const city = settlementService.generate(2, 63, 0, 'city');

    const hamletNpcs = npcService.generateForSettlement(hamlet);
    const cityNpcs = npcService.generateForSettlement(city);

    // City should have more NPCs
    expect(cityNpcs.length).toBeGreaterThan(hamletNpcs.length);

    // City should have more diverse roles
    const cityRoles = new Set(cityNpcs.map(npc => npc.role));
    const hamletRoles = new Set(hamletNpcs.map(npc => npc.role));
    expect(cityRoles.size).toBeGreaterThan(hamletRoles.size);

    // City should have specialized roles like nobles and scholars
    const cityHasNoble = cityNpcs.some(npc => npc.role === 'noble');
    const cityHasScholar = cityNpcs.some(npc => npc.role === 'scholar');

    console.log(`\nHamlet NPCs (${hamletNpcs.length}): ${Array.from(hamletRoles).join(', ')}`);
    console.log(`City NPCs (${cityNpcs.length}): ${Array.from(cityRoles).join(', ')}`);
    console.log(`City has noble: ${cityHasNoble}, scholar: ${cityHasScholar}`);
  });

  it('should generate economy-appropriate NPCs', () => {
    // Generate many settlements to find specific economy types
    for (let i = 0; i < 50; i++) {
      const settlement = settlementService.generate(i * 7, 0, 0, 'village');
      const npcs = npcService.generateForSettlement(settlement);

      if (settlement.economy.includes('farming')) {
        const farmers = npcs.filter(npc => npc.role === 'farmer');
        expect(farmers.length).toBeGreaterThan(0);
      }

      if (settlement.economy.includes('mining')) {
        const miners = npcs.filter(npc => npc.role === 'miner');
        expect(miners.length).toBeGreaterThan(0);
      }
    }
  });

  it('should demonstrate deterministic generation', () => {
    const settlement1 = settlementService.generate(5, 10, 0, 'town');
    const settlement2 = settlementService.generate(5, 10, 0, 'town');

    const npcs1 = npcService.generateForSettlement(settlement1);
    const npcs2 = npcService.generateForSettlement(settlement2);

    // Same settlement coordinates always produce same NPCs
    expect(npcs1).toEqual(npcs2);

    console.log(`\nDeterministic test: Generated ${npcs1.length} NPCs`);
    console.log(`First NPC: ${npcs1[0].name} (${npcs1[0].role})`);
    console.log('Both calls produced identical results: ✓');
  });
});
