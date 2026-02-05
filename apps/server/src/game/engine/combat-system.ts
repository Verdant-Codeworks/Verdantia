import { Injectable } from '@nestjs/common';
import { WorldLoaderService } from '../world/world-loader.service';
import { GameSession } from './game-state';
import {
  GamePhase,
  DAMAGE_VARIANCE_MIN,
  DAMAGE_VARIANCE_MAX,
  FLEE_BASE_CHANCE,
  FLEE_SPEED_BONUS,
  getXpForLevel,
  getStatGains,
} from '@verdantia/shared';

@Injectable()
export class CombatSystem {
  constructor(private readonly worldLoader: WorldLoaderService) {}

  attack(session: GameSession): void {
    if (!session.combat) return;

    const playerDamage = this.calculateDamage(
      session.stats.attack + this.getEquipmentAttack(session),
      session.combat.enemyDefense,
    );

    session.combat.enemyHp = Math.max(0, session.combat.enemyHp - playerDamage);
    session.addMessage(
      `You attack the ${session.combat.enemyName} for ${playerDamage} damage!`,
      'combat',
    );

    if (session.combat.enemyHp <= 0) {
      this.handleVictory(session);
      return;
    }

    this.enemyTurn(session);
  }

  defend(session: GameSession): void {
    if (!session.combat) return;

    session.addMessage('You brace yourself and raise your guard.', 'combat');

    // Defending halves incoming damage for this turn
    this.enemyTurn(session, true);
  }

  flee(session: GameSession): boolean {
    if (!session.combat) return false;

    const speedDiff = session.stats.speed - session.combat.enemySpeed;
    const fleeChance = FLEE_BASE_CHANCE + speedDiff * FLEE_SPEED_BONUS;
    const success = Math.random() < Math.max(0.1, Math.min(0.9, fleeChance));

    if (success) {
      session.addMessage(`You flee from the ${session.combat.enemyName}!`, 'combat');
      session.combat = null;
      session.phase = GamePhase.EXPLORATION;
      return true;
    }

    session.addMessage(`You try to flee but the ${session.combat.enemyName} blocks your escape!`, 'combat');
    this.enemyTurn(session);
    return false;
  }

  private enemyTurn(session: GameSession, playerDefending = false): void {
    if (!session.combat || session.combat.enemyHp <= 0) return;

    const playerDefense =
      session.stats.defense + this.getEquipmentDefense(session);
    const totalDefense = playerDefending ? playerDefense * 2 : playerDefense;

    const enemyDamage = this.calculateDamage(session.combat.enemyAttack, totalDefense);

    session.stats.hp = Math.max(0, session.stats.hp - enemyDamage);
    session.addMessage(
      `The ${session.combat.enemyName} attacks you for ${enemyDamage} damage!${playerDefending ? ' (reduced by defending)' : ''}`,
      'combat',
    );

    if (session.stats.hp <= 0) {
      session.addMessage('\nYou have been defeated...', 'combat');
      session.phase = GamePhase.GAME_OVER;
      session.combat = null;
      return;
    }

    session.combat.turnCount++;
    session.combat.isPlayerTurn = true;
  }

  private handleVictory(session: GameSession): void {
    if (!session.combat) return;

    const enemyDef = this.worldLoader.getEnemy(session.combat.enemyId);
    if (!enemyDef) {
      session.combat = null;
      session.phase = GamePhase.EXPLORATION;
      return;
    }

    session.addMessage(`\nYou defeated the ${session.combat.enemyName}!`, 'combat');
    session.addMessage(`+${enemyDef.xpReward} XP`, 'levelup');

    session.stats.xp += enemyDef.xpReward;

    // Check for level up
    this.checkLevelUp(session);

    // Roll loot
    for (const loot of enemyDef.lootTable) {
      if (Math.random() < loot.chance) {
        const itemDef = this.worldLoader.getItem(loot.itemId);
        session.addToInventory(loot.itemId);
        session.addMessage(
          `The ${enemyDef.name} dropped: ${itemDef?.name || loot.itemId}`,
          'loot',
        );
      }
    }

    session.combat = null;
    session.phase = GamePhase.EXPLORATION;
  }

  private checkLevelUp(session: GameSession): void {
    const nextLevel = session.stats.level + 1;
    const xpNeeded = getXpForLevel(nextLevel);

    if (session.stats.xp >= xpNeeded) {
      const gains = getStatGains(nextLevel);

      session.stats.level = nextLevel;
      session.stats.maxHp += gains.maxHp;
      session.stats.hp = session.stats.maxHp; // Full heal on level up
      session.stats.attack += gains.attack;
      session.stats.defense += gains.defense;
      session.stats.speed += gains.speed;

      session.addMessage(
        `\nLevel Up! You are now level ${session.stats.level}!`,
        'levelup',
      );
      session.addMessage(
        `+${gains.maxHp} HP | +${gains.attack} ATK | +${gains.defense} DEF | +${gains.speed} SPD`,
        'levelup',
      );

      // Check for another level up (could skip levels with big XP rewards)
      this.checkLevelUp(session);
    }
  }

  private calculateDamage(attack: number, defense: number): number {
    const baseDamage = Math.max(1, attack - defense);
    const variance =
      DAMAGE_VARIANCE_MIN + Math.random() * (DAMAGE_VARIANCE_MAX - DAMAGE_VARIANCE_MIN);
    return Math.max(1, Math.round(baseDamage * variance));
  }

  private getEquipmentAttack(session: GameSession): number {
    let bonus = 0;
    if (session.equipment.weapon) {
      const item = this.worldLoader.getItem(session.equipment.weapon);
      bonus += item?.effect?.attackBonus || 0;
    }
    return bonus;
  }

  private getEquipmentDefense(session: GameSession): number {
    let bonus = 0;
    if (session.equipment.armor) {
      const item = this.worldLoader.getItem(session.equipment.armor);
      bonus += item?.effect?.defenseBonus || 0;
    }
    return bonus;
  }
}
