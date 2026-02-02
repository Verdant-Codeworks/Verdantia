import { Injectable } from '@nestjs/common';
import { WorldLoaderService } from '../world/world-loader.service';
import { GameSession } from './game-state';
import { MAX_INVENTORY_SIZE } from '@verdantia/shared';

@Injectable()
export class InventorySystem {
  constructor(private readonly worldLoader: WorldLoaderService) {}

  take(session: GameSession, itemQuery: string): boolean {
    const room = this.worldLoader.getRoom(session.currentRoomId);
    if (!room) return false;

    const availableItems = session.getAvailableRoomItems(room);

    // Find item by ID or name match
    const itemId = this.resolveItemId(itemQuery, availableItems);
    if (!itemId) {
      session.addMessage(`There's no "${itemQuery}" here to take.`, 'system');
      return false;
    }

    if (session.inventory.length >= MAX_INVENTORY_SIZE) {
      session.addMessage('Your inventory is full!', 'system');
      return false;
    }

    const itemDef = this.worldLoader.getItem(itemId);
    session.removeRoomItem(room.id, itemId);
    session.addToInventory(itemId);

    // If item is misc type with only value, convert to gold instead
    if (itemDef?.type === 'misc' && itemDef.value && !itemDef.effect) {
      session.removeFromInventory(itemId);
      session.gold += itemDef.value;
      session.addMessage(`You pick up the ${itemDef.name}. (+${itemDef.value} gold)`, 'loot');
    } else {
      session.addMessage(`You take the ${itemDef?.name || itemId}.`, 'system');
    }

    return true;
  }

  drop(session: GameSession, itemQuery: string): boolean {
    const itemId = this.resolveInventoryItemId(session, itemQuery);
    if (!itemId) {
      session.addMessage(`You don't have "${itemQuery}" in your inventory.`, 'system');
      return false;
    }

    // Unequip if equipped
    if (session.equipment.weapon === itemId) {
      session.equipment.weapon = undefined;
    }
    if (session.equipment.armor === itemId) {
      session.equipment.armor = undefined;
    }

    session.removeFromInventory(itemId);
    const itemDef = this.worldLoader.getItem(itemId);
    session.addMessage(`You drop the ${itemDef?.name || itemId}.`, 'system');
    return true;
  }

  use(session: GameSession, itemQuery: string): boolean {
    const itemId = this.resolveInventoryItemId(session, itemQuery);
    if (!itemId) {
      session.addMessage(`You don't have "${itemQuery}" in your inventory.`, 'system');
      return false;
    }

    const itemDef = this.worldLoader.getItem(itemId);
    if (!itemDef) {
      session.addMessage('That item doesn\'t seem to do anything.', 'system');
      return false;
    }

    if (itemDef.type !== 'consumable' || !itemDef.effect) {
      session.addMessage(`You can't use the ${itemDef.name} like that.`, 'system');
      return false;
    }

    // Apply effects
    if (itemDef.effect.healAmount) {
      const healAmount = Math.min(
        itemDef.effect.healAmount,
        session.stats.maxHp - session.stats.hp,
      );
      session.stats.hp += healAmount;
      session.addMessage(
        `You use the ${itemDef.name}. Restored ${healAmount} HP. (${session.stats.hp}/${session.stats.maxHp})`,
        'system',
      );
    }

    session.removeFromInventory(itemId);
    return true;
  }

  equip(session: GameSession, itemQuery: string): boolean {
    const itemId = this.resolveInventoryItemId(session, itemQuery);
    if (!itemId) {
      session.addMessage(`You don't have "${itemQuery}" in your inventory.`, 'system');
      return false;
    }

    const itemDef = this.worldLoader.getItem(itemId);
    if (!itemDef || !itemDef.equipSlot) {
      session.addMessage(`You can't equip the ${itemDef?.name || itemId}.`, 'system');
      return false;
    }

    const slot = itemDef.equipSlot;
    const previousItem = session.equipment[slot];

    session.equipment[slot] = itemId;

    let msg = `You equip the ${itemDef.name}.`;
    if (itemDef.effect) {
      const bonuses: string[] = [];
      if (itemDef.effect.attackBonus) bonuses.push(`+${itemDef.effect.attackBonus} ATK`);
      if (itemDef.effect.defenseBonus) bonuses.push(`+${itemDef.effect.defenseBonus} DEF`);
      if (itemDef.effect.speedBonus) bonuses.push(`+${itemDef.effect.speedBonus} SPD`);
      if (bonuses.length > 0) msg += ` (${bonuses.join(', ')})`;
    }
    session.addMessage(msg, 'system');

    if (previousItem && previousItem !== itemId) {
      const prevDef = this.worldLoader.getItem(previousItem);
      session.addMessage(`You unequip the ${prevDef?.name || previousItem}.`, 'system');
    }

    return true;
  }

  unequip(session: GameSession, slotOrQuery: string): boolean {
    const slot = slotOrQuery.toLowerCase() as 'weapon' | 'armor';

    if (slot === 'weapon' || slot === 'armor') {
      const itemId = session.equipment[slot];
      if (!itemId) {
        session.addMessage(`Nothing is equipped in the ${slot} slot.`, 'system');
        return false;
      }

      session.equipment[slot] = undefined;
      const itemDef = this.worldLoader.getItem(itemId);
      session.addMessage(`You unequip the ${itemDef?.name || itemId}.`, 'system');
      return true;
    }

    session.addMessage('Specify "weapon" or "armor" to unequip.', 'system');
    return false;
  }

  showInventory(session: GameSession): void {
    if (session.inventory.length === 0) {
      session.addMessage('Your inventory is empty.', 'system');
    } else {
      session.addMessage('\n--- Inventory ---', 'system');
      for (const inv of session.inventory) {
        const def = this.worldLoader.getItem(inv.itemId);
        const name = def?.name || inv.itemId;
        const qty = inv.quantity > 1 ? ` x${inv.quantity}` : '';
        const equipped =
          session.equipment.weapon === inv.itemId || session.equipment.armor === inv.itemId
            ? ' [equipped]'
            : '';
        session.addMessage(`  ${name}${qty}${equipped}`, 'system');
      }
    }

    session.addMessage(`\nGold: ${session.gold}`, 'loot');

    // Show equipment
    const weaponName = session.equipment.weapon
      ? this.worldLoader.getItem(session.equipment.weapon)?.name || session.equipment.weapon
      : 'None';
    const armorName = session.equipment.armor
      ? this.worldLoader.getItem(session.equipment.armor)?.name || session.equipment.armor
      : 'None';
    session.addMessage(`\nWeapon: ${weaponName}`, 'system');
    session.addMessage(`Armor: ${armorName}`, 'system');
  }

  private resolveItemId(query: string, availableIds: string[]): string | null {
    const lowerQuery = query.toLowerCase();

    // Direct ID match
    if (availableIds.includes(lowerQuery)) return lowerQuery;

    // Name match
    for (const id of availableIds) {
      const def = this.worldLoader.getItem(id);
      if (def && def.name.toLowerCase().includes(lowerQuery)) {
        return id;
      }
    }

    // Partial ID match
    for (const id of availableIds) {
      if (id.includes(lowerQuery)) return id;
    }

    return null;
  }

  private resolveInventoryItemId(session: GameSession, query: string): string | null {
    const lowerQuery = query.toLowerCase();
    const inventoryIds = session.inventory.map((i) => i.itemId);

    // Direct ID match
    if (inventoryIds.includes(lowerQuery)) return lowerQuery;

    // Name match
    for (const id of inventoryIds) {
      const def = this.worldLoader.getItem(id);
      if (def && def.name.toLowerCase().includes(lowerQuery)) {
        return id;
      }
    }

    // Partial ID match
    for (const id of inventoryIds) {
      if (id.includes(lowerQuery)) return id;
    }

    return null;
  }
}
