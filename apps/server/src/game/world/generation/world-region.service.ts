import { Injectable } from '@nestjs/common';
import type { SettlementSize } from './settlement.types';

/**
 * World Region Service
 *
 * Determines what type of content exists at given coordinates.
 * Uses deterministic math to place settlements, dungeons, and wilderness.
 */
@Injectable()
export class WorldRegionService {
  /**
   * Determine what type of region exists at coordinates.
   * Priority: settlement > dungeon > wilderness
   */
  getRegionType(x: number, y: number, z: number): 'settlement' | 'dungeon' | 'wilderness' {
    // Underground has no settlements
    if (z < 0) {
      // TODO: Add dungeon detection logic in Phase 4
      return 'wilderness';
    }

    // Check if settlement location
    if (this.isSettlementLocation(x, y, z)) {
      return 'settlement';
    }

    // TODO: Add dungeon detection logic in Phase 4
    return 'wilderness';
  }

  /**
   * Check if settlement should exist at these coordinates.
   * Uses modulo math for deterministic placement.
   */
  isSettlementLocation(x: number, y: number, z: number): boolean {
    // Only surface level (z === 0)
    if (z !== 0) {
      return false;
    }

    const sum = x + y;

    // Check divisibility for cities (63), towns (21), or villages (7)
    return sum % 7 === 0;
  }

  /**
   * Get settlement size for a location (if it's a settlement).
   * Returns null if not a settlement location.
   */
  getSettlementSize(x: number, y: number, z: number): SettlementSize | null {
    if (!this.isSettlementLocation(x, y, z)) {
      return null;
    }

    const sum = x + y;

    // Priority: city > town > village
    if (sum % 63 === 0) {
      return 'city';
    } else if (sum % 21 === 0) {
      return 'town';
    } else if (sum % 7 === 0) {
      return 'village';
    }

    return null;
  }

}
