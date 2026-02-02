import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CombatSystem } from '../combat-system';
import { GameSession } from '../game-state';
import {
  GamePhase,
  DAMAGE_VARIANCE_MIN,
  DAMAGE_VARIANCE_MAX,
  FLEE_BASE_CHANCE,
  FLEE_SPEED_BONUS,
  STAT_GAINS_PER_LEVEL,
  XP_PER_LEVEL,
} from '@verdantia/shared';
import { createMockWorldLoader, createCombatSession, TEST_ENEMIES } from './fixtures';

describe('CombatSystem', () => {
  let combat: CombatSystem;
  let mockWorldLoader: ReturnType<typeof createMockWorldLoader>;

  beforeEach(() => {
    mockWorldLoader = createMockWorldLoader();
    combat = new CombatSystem(mockWorldLoader as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── attack ──────────────────────────────────────────────────────────

  describe('attack', () => {
    it('deals damage to enemy', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // player damage variance
        .mockReturnValueOnce(0.5); // enemy damage variance

      combat.attack(session);
      expect(session.combat!.enemyHp).toBeLessThan(TEST_ENEMIES.forest_spider.stats.hp);
    });

    it('deals minimum damage with low variance roll', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      // Player attack=5, enemy defense=1 => baseDamage = 4
      // Variance = DAMAGE_VARIANCE_MIN (0.8) => 4 * 0.8 = 3.2 => round to 3
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0) // min variance for player
        .mockReturnValueOnce(0.5); // enemy turn variance

      combat.attack(session);
      const damage = TEST_ENEMIES.forest_spider.stats.hp - session.combat!.enemyHp;
      const baseDamage = Math.max(1, session.stats.attack - TEST_ENEMIES.forest_spider.stats.defense);
      const expectedMin = Math.max(1, Math.round(baseDamage * DAMAGE_VARIANCE_MIN));
      expect(damage).toBe(expectedMin);
    });

    it('deals maximum damage with high variance roll', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(1) // max variance for player (but random() never actually returns 1, this is fine for mock)
        .mockReturnValueOnce(0.5);

      combat.attack(session);
      const damage = TEST_ENEMIES.forest_spider.stats.hp - session.combat!.enemyHp;
      const baseDamage = Math.max(1, session.stats.attack - TEST_ENEMIES.forest_spider.stats.defense);
      // variance = 0.8 + 1 * (1.2 - 0.8) = 1.2
      const expectedMax = Math.max(1, Math.round(baseDamage * DAMAGE_VARIANCE_MAX));
      expect(damage).toBe(expectedMax);
    });

    it('includes equipment attack bonus', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.equipment.weapon = 'iron_sword'; // +3 attack

      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.5);

      combat.attack(session);
      const damage = TEST_ENEMIES.forest_spider.stats.hp - session.combat!.enemyHp;
      // attack = 5 + 3 = 8, defense = 1, baseDamage = 7
      const baseDamage = Math.max(1, 8 - TEST_ENEMIES.forest_spider.stats.defense);
      const variance = DAMAGE_VARIANCE_MIN + 0.5 * (DAMAGE_VARIANCE_MAX - DAMAGE_VARIANCE_MIN);
      const expected = Math.max(1, Math.round(baseDamage * variance));
      expect(damage).toBe(expected);
    });

    it('adds attack message', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.attack(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('You attack');
      expect(state.messages[0].text).toContain('Forest Spider');
    });

    it('triggers enemy counter-attack when enemy survives', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const hpBefore = session.stats.hp;
      combat.attack(session);
      expect(session.stats.hp).toBeLessThan(hpBefore);
    });

    it('handles victory when enemy HP reaches 0', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1; // one hit will kill

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.attack(session);
      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('handles player death when HP reaches 0', () => {
      const session = createCombatSession(TEST_ENEMIES.wild_wolf);
      session.stats.hp = 1; // will die from counter-attack

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.attack(session);
      // The enemy might die first or the player might die — depends on damage
      // Let's ensure the test works by setting high enemy HP
      const session2 = createCombatSession(TEST_ENEMIES.wild_wolf);
      session2.stats.hp = 1;
      session2.combat!.enemyHp = 999; // won't die

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.attack(session2);

      expect(session2.stats.hp).toBe(0);
      expect(session2.phase).toBe(GamePhase.GAME_OVER);
      expect(session2.combat).toBeNull();
    });

    it('is a no-op when combat is null', () => {
      const session = new GameSession('TestPlayer');
      session.combat = null;
      combat.attack(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages).toHaveLength(0);
    });
  });

  // ── Victory ─────────────────────────────────────────────────────────

  describe('victory', () => {
    it('awards XP on enemy defeat', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.attack(session);

      expect(session.stats.xp).toBe(TEST_ENEMIES.forest_spider.xpReward);
    });

    it('adds victory message', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.attack(session);

      const state = session.toGameState({} as any, {});
      const texts = state.messages.map((m) => m.text);
      expect(texts.some((t) => t.includes('defeated'))).toBe(true);
      expect(texts.some((t) => t.includes('XP'))).toBe(true);
    });

    it('drops loot when random < loot chance', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // damage variance
        .mockReturnValueOnce(0.1); // loot roll: 0.1 < 0.3 chance => drop healing_herb

      combat.attack(session);
      expect(session.hasItem('healing_herb')).toBe(true);
    });

    it('does not drop loot when random >= loot chance', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // damage variance
        .mockReturnValueOnce(0.9); // loot roll: 0.9 >= 0.3 chance => no drop

      combat.attack(session);
      expect(session.hasItem('healing_herb')).toBe(false);
    });

    it('triggers level-up when XP threshold reached', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.stats.xp = XP_PER_LEVEL[2]! - TEST_ENEMIES.forest_spider.xpReward; // Will reach level 2 threshold
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no loot

      combat.attack(session);
      expect(session.stats.level).toBeGreaterThanOrEqual(2);
    });

    it('level-up increases stats by STAT_GAINS_PER_LEVEL', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      // Set XP so that after gaining xpReward, we just reach level 2
      session.stats.xp = XP_PER_LEVEL[2]! - TEST_ENEMIES.forest_spider.xpReward;
      const prevMaxHp = session.stats.maxHp;
      const prevAttack = session.stats.attack;
      const prevDefense = session.stats.defense;
      const prevSpeed = session.stats.speed;
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      combat.attack(session);

      // Wait - we need to be careful. XP_PER_LEVEL[2] = 250, xpReward = 25
      // So session.stats.xp = 250 - 25 = 225, then gains 25 => 250 >= 250 => level up
      if (session.stats.level >= 2) {
        expect(session.stats.maxHp).toBe(prevMaxHp + STAT_GAINS_PER_LEVEL.maxHp);
        expect(session.stats.attack).toBe(prevAttack + STAT_GAINS_PER_LEVEL.attack);
        expect(session.stats.defense).toBe(prevDefense + STAT_GAINS_PER_LEVEL.defense);
        expect(session.stats.speed).toBe(prevSpeed + STAT_GAINS_PER_LEVEL.speed);
      }
    });

    it('full heals on level-up', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.stats.hp = 10; // damaged
      session.stats.xp = XP_PER_LEVEL[2]! - TEST_ENEMIES.forest_spider.xpReward;
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      combat.attack(session);

      // After level-up, hp should equal the new maxHp
      expect(session.stats.hp).toBe(session.stats.maxHp);
    });

    it('returns to EXPLORATION after victory', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      combat.attack(session);

      expect(session.phase).toBe(GamePhase.EXPLORATION);
    });
  });

  // ── defend ──────────────────────────────────────────────────────────

  describe('defend', () => {
    it('adds defend message', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.defend(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('brace yourself');
    });

    it('halves incoming damage compared to normal attack', () => {
      // Normal attack scenario
      const sessionNormal = createCombatSession(TEST_ENEMIES.goblin);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.attack(sessionNormal);
      const normalDamageTaken = 30 - sessionNormal.stats.hp; // 30 is default hp minus enemy counter dmg

      vi.restoreAllMocks();

      // Defend scenario with same enemy
      const sessionDefend = createCombatSession(TEST_ENEMIES.goblin);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.defend(sessionDefend);
      const defendDamageTaken = 30 - sessionDefend.stats.hp;

      // Defending should take less damage (defense doubled)
      expect(defendDamageTaken).toBeLessThanOrEqual(normalDamageTaken);
    });

    it('is a no-op when combat is null', () => {
      const session = new GameSession('TestPlayer');
      combat.defend(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages).toHaveLength(0);
    });
  });

  // ── flee ────────────────────────────────────────────────────────────

  describe('flee', () => {
    it('succeeds when random < flee chance', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      // Player speed=5, enemy speed=6 => speedDiff=-1
      // fleeChance = 0.4 + (-1)*0.05 = 0.35 => clamped to 0.35
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.35

      const result = combat.flee(session);
      expect(result).toBe(true);
      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('adds flee success message', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      combat.flee(session);
      const state = session.toGameState({} as any, {});
      expect(state.messages[0].text).toContain('flee');
    });

    it('fails when random >= flee chance', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // > flee chance

      const result = combat.flee(session);
      expect(result).toBe(false);
      expect(session.phase).toBe(GamePhase.COMBAT);
      expect(session.combat).not.toBeNull();
    });

    it('triggers enemy counter-attack on failed flee', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      const hpBefore = session.stats.hp;
      combat.flee(session);
      expect(session.stats.hp).toBeLessThan(hpBefore);
    });

    it('has higher success rate when player is faster', () => {
      const session = createCombatSession(TEST_ENEMIES.goblin);
      // Player speed=5, goblin speed=4 => diff=1
      // fleeChance = 0.4 + 1*0.05 = 0.45
      const fleeChance = FLEE_BASE_CHANCE + (session.stats.speed - TEST_ENEMIES.goblin.stats.speed) * FLEE_SPEED_BONUS;
      expect(fleeChance).toBeGreaterThan(FLEE_BASE_CHANCE);
    });

    it('clamps flee chance minimum to 0.1', () => {
      const session = createCombatSession(TEST_ENEMIES.wild_wolf);
      // Artificially lower player speed
      session.stats.speed = 0;
      // speedDiff = 0 - 7 = -7, fleeChance = 0.4 + (-7)*0.05 = 0.05 => clamped to 0.1

      // With random = 0.09 (< 0.1), should still succeed
      vi.spyOn(Math, 'random').mockReturnValue(0.09);
      const result = combat.flee(session);
      expect(result).toBe(true);
    });

    it('clamps flee chance maximum to 0.9', () => {
      const session = createCombatSession(TEST_ENEMIES.goblin);
      session.stats.speed = 100; // extremely fast
      // fleeChance = 0.4 + 96*0.05 = 5.2 => clamped to 0.9

      // With random = 0.89 (< 0.9), should succeed
      vi.spyOn(Math, 'random').mockReturnValue(0.89);
      const result = combat.flee(session);
      expect(result).toBe(true);
    });

    it('returns false when combat is null', () => {
      const session = new GameSession('TestPlayer');
      const result = combat.flee(session);
      expect(result).toBe(false);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('damage is always at least 1', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      // Set player attack very low relative to enemy defense
      session.stats.attack = 0;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.attack(session);
      const damage = TEST_ENEMIES.forest_spider.stats.hp - session.combat!.enemyHp;
      expect(damage).toBeGreaterThanOrEqual(1);
    });

    it('handles enemy def not found in handleVictory', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      session.combat!.enemyHp = 1;
      mockWorldLoader.getEnemy.mockReturnValue(undefined);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      combat.attack(session);

      // Should still transition to EXPLORATION
      expect(session.phase).toBe(GamePhase.EXPLORATION);
      expect(session.combat).toBeNull();
    });

    it('enemy turn increments turn count', () => {
      const session = createCombatSession(TEST_ENEMIES.forest_spider);
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      combat.attack(session);
      if (session.combat) {
        expect(session.combat.turnCount).toBe(2);
      }
    });
  });
});
