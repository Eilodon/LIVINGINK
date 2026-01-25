
import {
  FRICTION_BASE,
  MAP_RADIUS
} from '../../../constants';
import { Bot, GameState, Player, Food } from '../../../types';
import { getCurrentSpatialGrid } from '../context';
import { distance, normalize } from '../math';
import { calcMatchPercent } from '../../cjr/colorMath';
import { applySkill } from './skills';
import { updateBotPersonality, assignRandomPersonality } from '../../cjr/botPersonalities';

export const updateAI = (bot: Bot, state: GameState, dt: number) => {
  if (bot.isDead) return;

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

    const nearby = getCurrentSpatialGrid().getNearby(bot);

    let targetEntity: Player | Bot | null = null;
    let targetFood: Food | null = null;
    let threat: Player | Bot | null = null;

    let closestThreatDist = Infinity;
    let closestPreyDist = Infinity;
    let bestFoodScore = -Infinity;

    nearby.forEach(e => {
      if (e === bot) return;
      const dist = distance(bot.position, e.position);

      if ('score' in e) { // Agent
        const other = e as Player | Bot;
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
        const f = e as Food;
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
    });

    // Decision Tree
    if (threat && closestThreatDist < 300) {
      bot.aiState = 'flee';
      bot.targetEntityId = threat.id;

      // Panic Skill
      if (closestThreatDist < 150) {
        applySkill(bot, undefined, state);
      }
    } else if (targetEntity && closestPreyDist < 400) {
      bot.aiState = 'chase';
      bot.targetEntityId = targetEntity.id;

      // Attack Skill (if configured)
      if (closestPreyDist < 150) {
        applySkill(bot, undefined, state);
      }
    } else if (targetFood) {
      bot.aiState = 'forage';
      // Move to food
      // We don't store food ID in targetEntityId usually, just move logic below
    } else {
      bot.aiState = 'wander';
    }

    // Execute Movement
    const speed = bot.maxSpeed;
    let tx = 0, ty = 0;

    if (bot.aiState === 'flee' && threat) {
      const dir = normalize({ x: bot.position.x - threat.position.x, y: bot.position.y - threat.position.y });
      tx = dir.x * speed;
      ty = dir.y * speed;
    } else if (bot.aiState === 'chase' && targetEntity) {
      const dir = normalize({ x: targetEntity.position.x - bot.position.x, y: targetEntity.position.y - bot.position.y });
      tx = dir.x * speed;
      ty = dir.y * speed;
    } else if (bot.aiState === 'forage' && targetFood) {
      const dir = normalize({ x: targetFood.position.x - bot.position.x, y: targetFood.position.y - bot.position.y });
      tx = dir.x * speed;
      ty = dir.y * speed;
    } else {
      // Wander Center bias
      const distCenter = distance(bot.position, { x: 0, y: 0 });
      if (distCenter > MAP_RADIUS * 0.9) {
        const dir = normalize({ x: -bot.position.x, y: -bot.position.y });
        tx = dir.x * speed;
        ty = dir.y * speed;
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
