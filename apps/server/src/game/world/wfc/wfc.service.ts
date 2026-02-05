import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { BiomeCompatibility } from '../../../entities/biome-compatibility.entity';
import { BiomeDefinition } from '../../../entities/biome-definition.entity';
import type { BiomeData } from '../definition.service';

interface AdjacentRoom {
  x: number;
  y: number;
  z: number;
  biomeId: string;
}

interface BiomeExit {
  direction: string;
  destinationRoomId?: string;
  description?: string;
}

@Injectable()
export class WFCService {
  private readonly logger = new Logger(WFCService.name);

  constructor(private readonly em: EntityManager) {}

  async getValidBiomes(
    x: number,
    y: number,
    z: number,
    adjacentRooms: AdjacentRoom[],
  ): Promise<string[]> {
    if (adjacentRooms.length === 0) {
      // No constraints, return all biomes (should rarely happen)
      try {
        const allBiomes = await this.em.find(BiomeDefinition, {});
        return allBiomes.map(b => b.id);
      } catch (error) {
        this.logger.debug('DB lookup failed for biomes, returning defaults');
        return ['wilderness', 'caves', 'ruins'];
      }
    }

    // Get biomes that are compatible with all adjacent rooms
    const adjacentBiomeIds = adjacentRooms.map(r => r.biomeId);

    try {
      // Find biomes compatible with all adjacent biomes
      const compatibilities = await this.em.find(BiomeCompatibility, {
        biome: { id: { $in: adjacentBiomeIds } },
      }, { populate: ['compatibleWith'] });

      // Count how many adjacent biomes each candidate is compatible with
      const compatibilityCounts = new Map<string, number>();

      for (const compat of compatibilities) {
        const candidateId = typeof compat.compatibleWith === 'string'
          ? compat.compatibleWith
          : compat.compatibleWith.id;

        const currentCount = compatibilityCounts.get(candidateId) || 0;
        compatibilityCounts.set(candidateId, currentCount + 1);
      }

      // Filter candidates that are compatible with ALL adjacent biomes
      const validBiomes = Array.from(compatibilityCounts.entries())
        .filter(([_, count]) => count === adjacentBiomeIds.length)
        .map(([biomeId, _]) => biomeId);

      if (validBiomes.length === 0) {
        this.logger.warn(`No compatible biomes found for ${x},${y},${z}, using fallback`);
        // Fallback: use the most common adjacent biome
        return [adjacentBiomeIds[0]];
      }

      return validBiomes;
    } catch (error) {
      this.logger.debug('DB lookup failed for compatibility, using fallback');
      // Fallback: use the most common adjacent biome
      return [adjacentBiomeIds[0]];
    }
  }

  generateExits(
    x: number,
    y: number,
    z: number,
    biome: BiomeData,
    adjacentRooms: AdjacentRoom[],
    rng: () => number = Math.random,
  ): BiomeExit[] {
    const exits: BiomeExit[] = [];

    // Map of direction to coordinate changes
    const directions = {
      north: { dx: 0, dy: -1, dz: 0 },
      south: { dx: 0, dy: 1, dz: 0 },
      east: { dx: 1, dy: 0, dz: 0 },
      west: { dx: -1, dy: 0, dz: 0 },
      up: { dx: 0, dy: 0, dz: 1 },
      down: { dx: 0, dy: 0, dz: -1 },
    };

    // Create bidirectional exits to adjacent rooms
    for (const adj of adjacentRooms) {
      for (const [dir, delta] of Object.entries(directions)) {
        if (adj.x === x + delta.dx && adj.y === y + delta.dy && adj.z === z + delta.dz) {
          exits.push({
            direction: dir,
            destinationRoomId: `proc_${adj.x}_${adj.y}_${adj.z}`,
          });
        }
      }
    }

    // Add 1-3 additional exits to ungenerated rooms
    const availableDirections = Object.keys(directions).filter(
      dir => !exits.some(e => e.direction === dir)
    );

    const numNewExits = 1 + Math.floor(rng() * 3); // 1-3 new exits
    // Fisher-Yates shuffle using seeded RNG
    const shuffled = [...availableDirections];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < Math.min(numNewExits, shuffled.length); i++) {
      const dir = shuffled[i];
      const delta = directions[dir as keyof typeof directions];
      const destX = x + delta.dx;
      const destY = y + delta.dy;
      const destZ = z + delta.dz;

      exits.push({
        direction: dir,
        destinationRoomId: `proc_${destX}_${destY}_${destZ}`,
      });
    }

    return exits;
  }

  calculateDifficulty(x: number, y: number, z: number): number {
    const manhattanDistance = Math.abs(x) + Math.abs(y);
    const depthBonus = z < 0 ? Math.min(3, Math.abs(z)) : 0;

    return Math.min(10, Math.floor(manhattanDistance / 5) + 1 + depthBonus);
  }

  selectBiome(
    validBiomes: string[],
    x: number,
    y: number,
    z: number,
    rng: () => number = Math.random,
  ): string {
    if (validBiomes.length === 1) {
      return validBiomes[0];
    }

    // Weight biomes by distance and z-level
    const weights = validBiomes.map(biomeId => {
      let weight = 1.0;

      // Prefer wilderness near origin
      if (biomeId === 'wilderness') {
        const distance = Math.sqrt(x * x + y * y);
        weight *= Math.max(0.1, 1.0 - distance / 20);
      }

      // Prefer caves underground
      if (biomeId === 'caves' && z < 0) {
        weight *= 2.0 * Math.abs(z);
      }

      // Prefer ruins at medium distance
      if (biomeId === 'ruins') {
        const distance = Math.sqrt(x * x + y * y);
        if (distance > 10 && distance < 30) {
          weight *= 1.5;
        }
      }

      return weight;
    });

    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = rng() * totalWeight;

    for (let i = 0; i < validBiomes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return validBiomes[i];
      }
    }

    return validBiomes[0];
  }
}
