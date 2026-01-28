
import {
  FRICTION_BASE,
  MAP_RADIUS
} from '../../../constants';
import { Bot, Player } from '../../../types/player';
import { GameState } from '../../../types/state';
import { Food } from '../../../types/entity';
import { getCurrentSpatialGrid } from '../context';
import { distance, normalize } from '../math';
import { calcMatchPercent } from '../../cjr/colorMath';
import { applySkill } from './skills';
import { updateBotPersonality, assignRandomPersonality } from '../../cjr/botPersonalities';
import { Entity } from '../../../types';
import { TransformStore } from '../dod/ComponentStores';

// EIDOLON-V: Singleton scratchpad to avoid array allocations per bot per frame
// This is safe because updateAI is synchronous and single-threaded in JS
const AI_QUERY_BUFFER: Entity[] = [];

export const updateAI = (bot: Bot, state: GameState, dt: number) => {
  if (bot.isDead) return;

  // EIDOLON-V FIX: Read Bot Position Directly from DOD Store
  // "Lobotomy Fix": Bypass stale object sync
  let botX = bot.position.x;
  let botY = bot.position.y;

  if (bot.physicsIndex !== undefined) {
    const idx = bot.physicsIndex * 8; // TransformStore.STRIDE
    botX = TransformStore.data[idx];
    botY = TransformStore.data[idx + 1];
  }

  // BOT PERSONALITIES: Use personality-based AI if set
  if (bot.personality && bot.personality !== 'farmer') {
    // Delegate to personality system for hunter/bully/greedy
    // (Farmer uses fallback generic AI below which is similar)
    updateBotPersonality(bot, state, dt);
    return;
  }

  // Fallback: Generic AI (similar to farmer behavior)
  bot.aiReactionTimer -= dt;

  // Decide State occasionally
  if (bot.aiReactionTimer <= 0) {
    bot.aiReactionTimer = 0.2 + Math.random() * 0.3; // Re-think every ~0.3s

    // EIDOLON-V FIX: Zero allocation query
    const grid = getCurrentSpatialGrid();
    grid.getNearbyInto(bot, AI_QUERY_BUFFER);
    const count = AI_QUERY_BUFFER.length;

    let targetEntity: Player | Bot | null = null;
    let targetFood: Food | null = null;
    let threat: Player | Bot | null = null;

    let closestThreatDist = Infinity;
    let closestPreyDist = Infinity;
    let bestFoodScore = -Infinity;

    const tData = TransformStore.data;

    for (let i = 0; i < count; i++) {
      const e = AI_QUERY_BUFFER[i];
      if (e === bot) return;

      // EIDOLON-V FIX: Read Target Position Directly from DOD Store
      let ex = e.position.x;
      let ey = e.position.y;
      if (e.physicsIndex !== undefined) {
        const idx = e.physicsIndex * 8;
        ex = tData[idx];
        ey = tData[idx + 1];
      }

      const dx = botX - ex;
      const dy = botY - ey;
      const dist = Math.sqrt(dx * dx + dy * dy); // Inline distance

      if ('score' in e) { // Agent
        const other = e as unknown as (Player | Bot);
        if (other.isDead) return;

        if (other.radius > bot.radius * 1.1) {
          if (dist < closestThreatDist) {
            closestThreatDist = dist;
            threat = other;
          }
        } else if (bot.radius > other.radius * 1.1) {
          if (dist < closestPreyDist) {
            closestPreyDist = dist;
            targetEntity = other;
          }
        }
      } else if ('value' in e) { // Food
        const f = e as unknown as Food;
        if (f.isDead) return;
        // Score based on distance and COLOR MATCH
        // If pigment matches target, high score.
        let score = 100 / (dist + 10);
        if (f.kind === 'pigment' && f.pigment) {
          // Calculate hypothetical match improvement?
          // Simple heuristic: match % of food vs target.
          const match = calcMatchPercent(f.pigment, bot.targetPigment);
          score *= (1 + match * 2); // Prefer matching colors
        } else if (f.kind === 'catalyst' || f.kind === 'solvent') {
          score *= 1.4;
        } else if (f.kind === 'shield') {
          score *= 1.2;
        }

        if (score > bestFoodScore) {
          bestFoodScore = score;
          targetFood = f;
        }
      }
    }

    // Clear buffer (optional but good for GC reference release)
    AI_QUERY_BUFFER.length = 0;

    // Decision Tree
    if (threat && closestThreatDist < 300) {
      (bot as any).aiState = 'flee';
      (bot as any).targetEntityId = (threat as any).id;

      // Panic Skill
      if (closestThreatDist < 150) {
        applySkill(bot, undefined, state);
      }
    } else if (targetEntity && closestPreyDist < 400) {
      (bot as any).aiState = 'chase';
      (bot as any).targetEntityId = (targetEntity as any).id;

      // Attack Skill (if configured)
      if (closestPreyDist < 150) {
        applySkill(bot, undefined, state);
      }
    } else if (targetFood) {
      (bot as any).aiState = 'forage';
      // Move to food
      // We don't store food ID in targetEntityId usually, just move logic below
    } else {
      (bot as any).aiState = 'wander';
    }

    // Execute Movement - EIDOLON-V FIX: Zero allocation vector math
    const speed = bot.maxSpeed;
    let tx = 0, ty = 0;

    // Helper to get target pos safely
    const getTargetPos = (t: Entity) => {
      if (t.physicsIndex !== undefined) {
        const idx = t.physicsIndex * 8;
        return { x: tData[idx], y: tData[idx + 1] };
      }
      return t.position;
    };

    if (bot.aiState === 'flee' && threat) {
      const tPos = getTargetPos(threat);
      const dx = botX - tPos.x;
      const dy = botY - tPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.001) {
        const invDist = 1.0 / Math.sqrt(distSq);
        tx = dx * invDist * speed;
        ty = dy * invDist * speed;
      }
    } else if (bot.aiState === 'chase' && targetEntity) {
      const tPos = getTargetPos(targetEntity);
      const dx = tPos.x - botX;
      const dy = tPos.y - botY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.001) {
        const invDist = 1.0 / Math.sqrt(distSq);
        tx = dx * invDist * speed;
        ty = dy * invDist * speed;
      }
    } else if (bot.aiState === 'forage' && targetFood) {
      const tPos = getTargetPos(targetFood);
      const dx = tPos.x - botX;
      const dy = tPos.y - botY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.001) {
        const invDist = 1.0 / Math.sqrt(distSq);
        tx = dx * invDist * speed;
        ty = dy * invDist * speed;
      }
    } else {
      // Wander Center bias
      const distCenterSq = botX * botX + botY * botY;

      if (distCenterSq > (MAP_RADIUS * 0.9) * (MAP_RADIUS * 0.9)) {
        // EIDOLON-V FIX: Direct math for center bias
        const dist = Math.sqrt(distCenterSq);
        const invDist = 1.0 / dist;
        tx = -botX * invDist * speed;
        ty = -botY * invDist * speed;
      } else {
        tx = (Math.random() - 0.5) * speed;
        ty = (Math.random() - 0.5) * speed;
      }
    }

    // In Physics 2.0 we set Acceleration (Force), not Velocity directly, theoretically.
    // But physics.ts currently clamps velocity and applies drag.
    // So setting velocity here acts as "Self-Propulsion".
    // To respect inertia, we should ADD to velocity, not set it.

    // Steering Behavior (Seek)
    const desiredX = tx;
    const desiredY = ty;

    const steerX = desiredX - bot.velocity.x;
    const steerY = desiredY - bot.velocity.y;

    // Apply steering force
    const steerFactor = 0.1; // Turn speed
    bot.velocity.x += steerX * steerFactor;
    bot.velocity.y += steerY * steerFactor;
  }
};
