import { Injectable } from '@nestjs/common';
import { WorldLoaderService } from '../world/world-loader.service';
import { GameSession } from './game-state';
import { GATHER_FAILURE_CHANCE } from '@verdantia/shared';
import type { ResourceNodeDefinition, RecipeDefinition } from '@verdantia/shared';

@Injectable()
export class SkillSystem {
  constructor(private readonly worldLoader: WorldLoaderService) {}

  async gather(session: GameSession, nodeQuery: string): Promise<void> {
    const room = await this.worldLoader.getRoom(session.currentRoomId);
    if (!room || !room.resourceNodes || room.resourceNodes.length === 0) {
      session.addMessage('There is nothing to gather here.', 'system');
      return;
    }

    // Find matching resource node
    const gathered = session.getGatheredNodes(session.currentRoomId);
    const availableNodeIds = room.resourceNodes.filter((id) => !gathered.includes(id));

    if (availableNodeIds.length === 0) {
      session.addMessage('You have already gathered everything here.', 'system');
      return;
    }

    const nodeDef = this.findResourceNode(availableNodeIds, nodeQuery);
    if (!nodeDef) {
      session.addMessage(`You don't see "${nodeQuery}" to gather here.`, 'system');
      return;
    }

    // Check skill level
    const playerSkill = session.getSkill(nodeDef.skill);
    if (playerSkill.level < nodeDef.levelRequired) {
      const skillDef = this.worldLoader.getSkill(nodeDef.skill);
      const skillName = skillDef?.name || nodeDef.skill;
      session.addMessage(
        `You need ${skillName} level ${nodeDef.levelRequired} to gather ${nodeDef.name}. (Current: ${playerSkill.level})`,
        'system',
      );
      return;
    }

    // Check tool requirement
    if (nodeDef.toolRequired && !session.hasItem(nodeDef.toolRequired)) {
      const toolDef = this.worldLoader.getItem(nodeDef.toolRequired);
      const toolName = toolDef?.name || nodeDef.toolRequired;
      session.addMessage(`You need a ${toolName} to gather ${nodeDef.name}.`, 'system');
      return;
    }

    session.addMessage(nodeDef.gatherMessage, 'skill');

    // Apply failure chance
    const failed = Math.random() < GATHER_FAILURE_CHANCE;
    if (failed) {
      const halfXp = Math.floor(nodeDef.xpReward / 2);
      session.addMessage('Your attempt fails, but you learn from the experience.', 'skill');
      this.awardSkillXp(session, nodeDef.skill, halfXp);
      session.markNodeGathered(session.currentRoomId, nodeDef.id);
      return;
    }

    // Roll loot table
    for (const loot of nodeDef.lootTable) {
      if (Math.random() < loot.chance) {
        session.addToInventory(loot.itemId, loot.quantity);
        const itemDef = this.worldLoader.getItem(loot.itemId);
        const itemName = itemDef?.name || loot.itemId;
        const qty = loot.quantity > 1 ? ` x${loot.quantity}` : '';
        session.addMessage(`You obtain: ${itemName}${qty}`, 'loot');
      }
    }

    // Award XP and mark gathered
    this.awardSkillXp(session, nodeDef.skill, nodeDef.xpReward);
    session.markNodeGathered(session.currentRoomId, nodeDef.id);
  }

  async craft(session: GameSession, recipeQuery: string): Promise<void> {
    const recipe = this.findRecipe(recipeQuery);
    if (!recipe) {
      session.addMessage(`Unknown recipe: "${recipeQuery}". Type "recipes" to see available recipes.`, 'system');
      return;
    }

    // Check crafting station
    const room = await this.worldLoader.getRoom(session.currentRoomId);
    if (!room || !room.tags || !room.tags.includes(recipe.craftingStation)) {
      session.addMessage(`You need to be at a ${recipe.craftingStation} to craft ${recipe.name}.`, 'system');
      return;
    }

    // Check skill level
    const playerSkill = session.getSkill(recipe.skill);
    if (playerSkill.level < recipe.levelRequired) {
      const skillDef = this.worldLoader.getSkill(recipe.skill);
      const skillName = skillDef?.name || recipe.skill;
      session.addMessage(
        `You need ${skillName} level ${recipe.levelRequired} to craft ${recipe.name}. (Current: ${playerSkill.level})`,
        'system',
      );
      return;
    }

    // Check ingredients
    for (const ingredient of recipe.ingredients) {
      const have = session.getItemQuantity(ingredient.itemId);
      if (have < ingredient.quantity) {
        const itemDef = this.worldLoader.getItem(ingredient.itemId);
        const itemName = itemDef?.name || ingredient.itemId;
        session.addMessage(
          `Not enough ${itemName}: need ${ingredient.quantity}, have ${have}.`,
          'system',
        );
        return;
      }
    }

    // Consume ingredients
    for (const ingredient of recipe.ingredients) {
      session.removeFromInventory(ingredient.itemId, ingredient.quantity);
    }

    // Produce result
    session.addToInventory(recipe.resultItemId, recipe.resultQuantity);
    const resultDef = this.worldLoader.getItem(recipe.resultItemId);
    const resultName = resultDef?.name || recipe.resultItemId;
    const qty = recipe.resultQuantity > 1 ? ` x${recipe.resultQuantity}` : '';
    session.addMessage(`You craft: ${resultName}${qty}`, 'skill');

    // Award XP
    this.awardSkillXp(session, recipe.skill, recipe.xpReward);
  }

  async showRecipes(session: GameSession): Promise<void> {
    const allRecipes = this.worldLoader.getAllRecipes();
    if (allRecipes.size === 0) {
      session.addMessage('No recipes available.', 'system');
      return;
    }

    const room = await this.worldLoader.getRoom(session.currentRoomId);
    const roomTags = room?.tags || [];

    session.addMessage('\n--- Recipes ---', 'skill');

    for (const [, recipe] of allRecipes) {
      const playerSkill = session.getSkill(recipe.skill);
      const skillDef = this.worldLoader.getSkill(recipe.skill);
      const skillName = skillDef?.name || recipe.skill;
      const hasLevel = playerSkill.level >= recipe.levelRequired;
      const atStation = roomTags.includes(recipe.craftingStation);

      const levelMark = hasLevel ? '\u2713' : '\u2717';
      const stationMark = atStation ? '\u2713' : '\u2717';

      // Build ingredients string
      const ingredientParts = recipe.ingredients.map((ing) => {
        const itemDef = this.worldLoader.getItem(ing.itemId);
        const itemName = itemDef?.name || ing.itemId;
        const have = session.getItemQuantity(ing.itemId);
        const mark = have >= ing.quantity ? '\u2713' : '\u2717';
        return `${mark} ${itemName} (${have}/${ing.quantity})`;
      });

      session.addMessage(
        `${recipe.name} [${skillName} ${recipe.levelRequired} ${levelMark}] [${recipe.craftingStation} ${stationMark}]`,
        'skill',
      );
      session.addMessage(`  ${ingredientParts.join(', ')}`, 'skill');
    }
  }

  showSkills(session: GameSession): void {
    const allSkills = this.worldLoader.getAllSkills();
    if (allSkills.size === 0) {
      session.addMessage('No skills available.', 'system');
      return;
    }

    session.addMessage('\n--- Skills ---', 'skill');

    for (const [, skillDef] of allSkills) {
      const playerSkill = session.getSkill(skillDef.id);
      const currentXp = playerSkill.xp;
      const nextLevelXp =
        playerSkill.level < skillDef.maxLevel
          ? skillDef.xpPerLevel[playerSkill.level]
          : null;
      const prevLevelXp =
        playerSkill.level > 1
          ? skillDef.xpPerLevel[playerSkill.level - 1]
          : 0;

      let progressStr: string;
      if (nextLevelXp !== null && nextLevelXp !== undefined) {
        const xpIntoLevel = currentXp - (prevLevelXp || 0);
        const xpNeeded = nextLevelXp - (prevLevelXp || 0);
        progressStr = `${xpIntoLevel}/${xpNeeded} XP to level ${playerSkill.level + 1}`;
      } else {
        progressStr = 'MAX LEVEL';
      }

      session.addMessage(
        `${skillDef.name}: Level ${playerSkill.level}/${skillDef.maxLevel} (${progressStr})`,
        'skill',
      );
    }
  }

  private awardSkillXp(session: GameSession, skillId: string, xp: number): void {
    const playerSkill = session.getSkill(skillId);
    playerSkill.xp += xp;
    const skillDef = this.worldLoader.getSkill(skillId);
    const skillName = skillDef?.name || skillId;
    session.addMessage(`+${xp} ${skillName} XP`, 'skill');
    session.setSkill(playerSkill);
    this.checkSkillLevelUp(session, skillId);
  }

  private checkSkillLevelUp(session: GameSession, skillId: string): void {
    const skillDef = this.worldLoader.getSkill(skillId);
    if (!skillDef) return;

    const playerSkill = session.getSkill(skillId);
    if (playerSkill.level >= skillDef.maxLevel) return;

    const nextLevelXp = skillDef.xpPerLevel[playerSkill.level];
    if (nextLevelXp === undefined) return;

    if (playerSkill.xp >= nextLevelXp) {
      playerSkill.level += 1;
      session.setSkill(playerSkill);
      session.addMessage(
        `${skillDef.name} leveled up to ${playerSkill.level}!`,
        'levelup',
      );
      // Recursive check for multiple level-ups
      this.checkSkillLevelUp(session, skillId);
    }
  }

  private findResourceNode(availableNodeIds: string[], query: string): ResourceNodeDefinition | undefined {
    const q = query.toLowerCase();

    // Try exact ID match first
    for (const nodeId of availableNodeIds) {
      if (nodeId === q) {
        return this.worldLoader.getResource(nodeId);
      }
    }

    // Try name/verb/partial match
    for (const nodeId of availableNodeIds) {
      const nodeDef = this.worldLoader.getResource(nodeId);
      if (!nodeDef) continue;

      if (
        nodeDef.name.toLowerCase().includes(q) ||
        nodeDef.gatherVerb.toLowerCase() === q ||
        nodeId.includes(q)
      ) {
        return nodeDef;
      }
    }

    // If query is just "mine" with no specific target, return first available
    if (q === 'mine' && availableNodeIds.length > 0) {
      return this.worldLoader.getResource(availableNodeIds[0]);
    }

    return undefined;
  }

  private findRecipe(query: string): RecipeDefinition | undefined {
    const q = query.toLowerCase();
    const allRecipes = this.worldLoader.getAllRecipes();

    // Exact ID match
    const exactMatch = this.worldLoader.getRecipe(q);
    if (exactMatch) return exactMatch;

    // Name/partial match
    for (const [, recipe] of allRecipes) {
      if (
        recipe.name.toLowerCase().includes(q) ||
        recipe.id.includes(q)
      ) {
        return recipe;
      }
    }

    return undefined;
  }
}
