/**
 * @cjr/engine - AISystem
 *
 * AI System for bot entities.
 * Migrates from legacy ai.ts to proper System architecture.
 *
 * ## Architecture
 * - Extends BaseSystem for lifecycle management
 * - Reads/Writes to DOD stores directly (zero allocation)
 * - Integrates with SpatialGrid for sensing
 *
 * ## Migration Notes
 * Phase 2: Extract from ai.ts -> AISystem class
 * Phase 5: Fully DOD (remove Bot object references)
 */

import type { GameState, Bot } from '../../../../types';
import { fastMath, PRNG } from '../../../math/FastMath';
import { MAP_RADIUS } from '../../../../constants';
import {
  TransformStore,
  PhysicsStore,
  StateStore,
  EntityLookup,
  InputStore,
  EntityFlags,
  CJRFoodFlags,
  WorldState,
} from '@cjr/engine';
import { SkillSystem } from './SkillSystem';
import { updateBotPersonality } from '../../../cjr/botPersonalities';
import type { SpatialGrid } from '../../context';

/**
 * AI System configuration
 */
export interface AISystemConfig {
  /** Vision radius for sensing */
  visionRadius: number;
  /** Threat distance threshold */
  threatDistance: number;
  /** Prey distance threshold */
  preyDistance: number;
  /** Reaction timer base */
  reactionTimeBase: number;
  /** Reaction timer variance */
  reactionTimeVariance: number;
  /** Steering factor for movement */
  steerFactor: number;
}

const DEFAULT_CONFIG: AISystemConfig = {
  visionRadius: 400,
  threatDistance: 300,
  preyDistance: 400,
  reactionTimeBase: 0.1,
  reactionTimeVariance: 0.15,
  steerFactor: 0.1,
};

/**
 * AISystem - AI logic for bot entities
 *
 * This system processes all BOT-flagged entities and applies AI behavior.
 * It reads from DOD stores and writes movement forces directly to PhysicsStore.
 */
export class AISystem {
  private config: AISystemConfig;
  private spatialGrid: SpatialGrid | null = null;

  // Reusable buffers (zero allocation)
  private sensingIndices: number[] = [];

  constructor(config: Partial<AISystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set spatial grid for sensing
   */
  setSpatialGrid(grid: SpatialGrid | null): void {
    this.spatialGrid = grid;
  }

  /**
   * Update all AI entities
   * Called by CJRClientRunner.updateEntities() when legacy mode is disabled
   */
  update(state: GameState, world: WorldState, dt: number): void {
    if (!this.spatialGrid) return;

    const count = world.activeCount;
    const activeEntities = world.activeEntities;

    // Iterate all entities via Sparse Set (O(Active))
    for (let i = 0; i < count; i++) {
      const id = activeEntities[i];
      const flag = world.stateFlags[id]; // Direct access faster than Accessor inside loop

      if ((flag & EntityFlags.BOT) === 0) continue;
      if (flag & EntityFlags.DEAD) continue;

      const bot = EntityLookup[id] as Bot | null;
      if (!bot) continue;

      this.updateBot(bot, id, state, world, dt);
    }
  }

  /**
   * Update single bot AI
   */
  private updateBot(bot: Bot, botId: number, state: GameState, world: WorldState, dt: number): void {
    // Safety checks
    if (bot.isDead) return;

    // 1. READ POS FROM DOD (Cache Hot)
    const tData = world.transform;
    const tIdx = botId * 8;
    const botX = tData[tIdx];
    const botY = tData[tIdx + 1];

    // BOT PERSONALITIES: Delegate if complex
    if (bot.personality && bot.personality !== 'farmer') {
      updateBotPersonality(bot, state, dt);
      return;
    }

    // Fallback: Generic AI (Farmer)
    bot.aiReactionTimer -= dt;

    // DECISION TICK (Only run heavy logic occasionally)
    if (bot.aiReactionTimer <= 0) {
      bot.aiReactionTimer = this.config.reactionTimeBase + PRNG.next() * this.config.reactionTimeVariance;

      // 2. SENSING
      this.sensingIndices.length = 0;
      const rawGrid = this.spatialGrid?.getRawGrid();
      if (rawGrid) {
        rawGrid.queryRadiusInto(botX, botY, this.config.visionRadius, this.sensingIndices);
      }

      let targetEntityIndex = -1;
      let targetFoodIndex = -1;
      let threatIndex = -1;

      let closestThreatDistSq = Infinity;
      let closestPreyDistSq = Infinity;
      let bestFoodScore = -Infinity;

      // Read Bot Size from Physics (Mass/Radius)
      const pIdx = botId * 8;
      const botRadius = world.physics[pIdx + 4];
      const sFlags = world.stateFlags;

      // 3. ITERATE INDICES (FAST)
      const count = this.sensingIndices.length;
      for (let i = 0; i < count; i++) {
        const idx = this.sensingIndices[i];
        if (idx === botId) continue;

        const flags = sFlags[idx];
        if ((flags & EntityFlags.ACTIVE) === 0) continue;
        if (flags & EntityFlags.DEAD) continue;

        // Calc Distance Sq (No Sqrt yet)
        const oTIdx = idx * 8;
        const ox = tData[oTIdx];
        const oy = tData[oTIdx + 1];
        const dx = botX - ox;
        const dy = botY - oy;
        const distSq = dx * dx + dy * dy;

        // A. THREATS & PREY (Players/Bots)
        if (flags & (EntityFlags.PLAYER | EntityFlags.BOT)) {
          const oPIdx = idx * 8;
          const otherRadius = world.physics[oPIdx + 4];

          if (otherRadius > botRadius * 1.1) {
            // Threat
            if (distSq < closestThreatDistSq) {
              closestThreatDistSq = distSq;
              threatIndex = idx;
            }
          } else if (botRadius > otherRadius * 1.1) {
            // Prey
            if (distSq < closestPreyDistSq) {
              closestPreyDistSq = distSq;
              targetEntityIndex = idx;
            }
          }
        }
        // B. FOOD
        else if (flags & EntityFlags.FOOD) {
          let score = 10000 / (distSq + 100);

          // Check Food Type via Flags
          if (flags & CJRFoodFlags.FOOD_CATALYST) score *= 1.4;
          else if (flags & CJRFoodFlags.FOOD_SHIELD) score *= 1.2;

          if (score > bestFoodScore) {
            bestFoodScore = score;
            targetFoodIndex = idx;
          }
        }
      }

      // 4. DECISION TREE (State Transition)
      if (threatIndex !== -1 && closestThreatDistSq < this.config.threatDistance ** 2) {
        bot.aiState = 'flee';
        const threatObj = EntityLookup[threatIndex];
        bot.targetEntityId = threatObj ? threatObj.id : null;

        // Panic Skill
        if (closestThreatDistSq < 150 * 150) {
          SkillSystem.handleInput(botId, { space: true, target: bot.targetPosition || { x: 0, y: 0 } }, world);
        }
      } else if (targetEntityIndex !== -1 && closestPreyDistSq < this.config.preyDistance ** 2) {
        bot.aiState = 'chase';
        const targetObj = EntityLookup[targetEntityIndex];
        bot.targetEntityId = targetObj ? targetObj.id : null;
      } else if (targetFoodIndex !== -1) {
        bot.aiState = 'forage';
        // Write target directly to InputStore (ZERO allocation)
        const fTIdx = targetFoodIndex * 8;
        InputStore.setTarget(world, botId, tData[fTIdx], tData[fTIdx + 1]);
      } else {
        bot.aiState = 'wander';
      }
    }

    // 5. EXECUTE MOVEMENT (DOD Force)
    this.executeMovement(bot, botId, botX, botY, world, dt);
  }

  /**
   * Execute movement based on current AI state
   */
  private executeMovement(bot: Bot, botId: number, botX: number, botY: number, world: WorldState, _dt: number): void {
    const speed = bot.maxSpeed;
    let tx = 0, ty = 0;

    const tData = world.transform;
    const pIdx = botId * 8;

    switch (bot.aiState) {
      case 'flee': {
        // Find threat by targetEntityId
        if (bot.targetEntityId) {
          // Find threat index
          const threatIdx = this.findEntityIndex(world, bot.targetEntityId);
          if (threatIdx !== -1) {
            const tIdx = threatIdx * 8;
            const dx = botX - tData[tIdx];
            const dy = botY - tData[tIdx + 1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              tx = (dx / dist) * speed;
              ty = (dy / dist) * speed;
            }
          }
        }
        break;
      }

      case 'chase': {
        if (bot.targetEntityId) {
          const targetIdx = this.findEntityIndex(world, bot.targetEntityId);
          if (targetIdx !== -1) {
            const tIdx = targetIdx * 8;
            const dx = tData[tIdx] - botX;
            const dy = tData[tIdx + 1] - botY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              tx = (dx / dist) * speed;
              ty = (dy / dist) * speed;
            }
          }
        }
        break;
      }

      case 'forage': {
        // Read target directly from InputStore (ZERO allocation)
        const iIdx = botId * InputStore.STRIDE;
        const targetX = world.input[iIdx];
        const targetY = world.input[iIdx + 1];
        const dx = targetX - botX;
        const dy = targetY - botY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          tx = (dx / dist) * speed;
          ty = (dy / dist) * speed;
        }
        break;
      }

      case 'wander':
      default: {
        // Wander Center Bias
        const distCenterSq = botX * botX + botY * botY;
        if (distCenterSq > (MAP_RADIUS * 0.9) ** 2) {
          const dist = Math.sqrt(distCenterSq);
          tx = (-botX / dist) * speed;
          ty = (-botY / dist) * speed;
        } else {
          // Random wander
          tx = (PRNG.next() - 0.5) * speed;
          ty = (PRNG.next() - 0.5) * speed;
        }
        break;
      }
    }

    // Steering - Write directly to PhysicsStore
    world.physics[pIdx] += (tx - world.physics[pIdx]) * this.config.steerFactor;
    world.physics[pIdx + 1] += (ty - world.physics[pIdx + 1]) * this.config.steerFactor;
  }

  /**
   * Find entity index by ID (O(N) fallback - optimize later)
   */
  private findEntityIndex(world: WorldState, id: string): number {
    const flags = world.stateFlags;
    for (let i = 0; i < flags.length; i++) {
      if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;

      const entity = EntityLookup[i];
      if (entity && entity.id === id) {
        return i;
      }
    }
    return -1;
  }
}

/**
 * Singleton instance for convenience
 */
let globalAISystem: AISystem | null = null;

export function getAISystem(): AISystem {
  if (!globalAISystem) {
    globalAISystem = new AISystem();
  }
  return globalAISystem;
}

export function resetAISystem(): void {
  globalAISystem = null;
}
