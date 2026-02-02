import { MAP_RADIUS } from '../../../constants';
import { Bot, Player } from '../../../types/player';
import { GameState } from '../../../types/state';
import { Food } from '../../../types/entity';
import { getCurrentSpatialGrid } from '../context';
import { Entity } from '../../../types';
import {
  TransformStore,
  PhysicsStore,
  StateStore,
  EntityLookup,
  StatsStore,
  InputStore,
} from '../dod/ComponentStores';
import { EntityFlags } from '../dod/EntityFlags';
import { SkillSystem } from '../dod/systems/SkillSystem';
import { updateBotPersonality } from '../../cjr/botPersonalities';

// EIDOLON-V: Reusable index buffer for sensing
const SENSING_INDICES: number[] = [];

export const updateAI = (bot: Bot, state: GameState, dt: number) => {
  // Safety checks
  if (bot.isDead) return;
  if (bot.physicsIndex === undefined) return;

  const botId = bot.physicsIndex;

  // 1. READ POS FROM DOD (Cache Hot)
  const tData = TransformStore.data;
  const tIdx = botId * 8;
  const botX = tData[tIdx];
  const botY = tData[tIdx + 1];

  // BOT PERSONALITIES: Delegate if complex
  // Note: Optimally, personalities should also be DOD, but for Phase 5 we keep logic high-level.
  if (bot.personality && bot.personality !== 'farmer') {
    updateBotPersonality(bot, state, dt);
    return;
  }

  // Fallback: Generic AI (Farmer)
  bot.aiReactionTimer -= dt;

  // DECISION TICK (Only run heavy logic occasionally)
  if (bot.aiReactionTimer <= 0) {
    bot.aiReactionTimer = 0.1 + Math.random() * 0.15; // EIDOLON-V: Faster reflexes (0.1-0.25s)

    // 2. SENSING (THE OPTIMIZED PART)
    const grid = getCurrentSpatialGrid();
    // Raw query for INDICES (Zero Allocation inside grid usually)
    // Use raw grid access directly - no need for legacy adapter
    const rawGrid = (grid as any).grid;
    SENSING_INDICES.length = 0;
    if (rawGrid) {
      rawGrid.queryRadiusInto(botX, botY, 400, SENSING_INDICES); // 400 vision range
    }

    let targetEntityIndex = -1;
    let targetFoodIndex = -1;
    let threatIndex = -1;

    let closestThreatDistSq = Infinity;
    let closestPreyDistSq = Infinity;
    let bestFoodScore = -Infinity;

    // Read Bot Size from Physics (Mass/Radius)
    const pIdx = botId * 8;
    const botRadius = PhysicsStore.data[pIdx + 4];
    const sFlags = StateStore.flags;

    // 3. ITERATE INDICES (FAST)
    const count = SENSING_INDICES.length;
    for (let i = 0; i < count; i++) {
      const idx = SENSING_INDICES[i];
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
        const otherRadius = PhysicsStore.data[oPIdx + 4];

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
        // Simple Food Score: 1.0 / dist
        // Advanced logic (Match Color) requires object lookup OR creating ColorStore.
        // For pure speed, we assume all food is equal or check flags for special food.
        let score = 10000 / (distSq + 100);

        // Check Food Type via Flags
        if (flags & EntityFlags.FOOD_CATALYST) score *= 1.4;
        else if (flags & EntityFlags.FOOD_SHIELD) score *= 1.2;

        // Pigment Match? (Expensive, requires Object lookup currently)
        // Compromise: Skip color matching in "Farmer" AI for extreme performance,
        // or perform lookup ONLY if score is already high.

        if (score > bestFoodScore) {
          bestFoodScore = score;
          targetFoodIndex = idx;
        }
      }
    }

    // 4. DECISION TREE (State Transition)
    // Convert Indices to State
    if (threatIndex !== -1 && closestThreatDistSq < 300 * 300) {
      bot.aiState = 'flee';
      // Lookup the ID just once for legacy systems
      const threatObj = EntityLookup[threatIndex];
      bot.targetEntityId = threatObj ? threatObj.id : null;

      // Panic Skill - Direct DOD call (removed wrapper)
      if (closestThreatDistSq < 150 * 150) {
        SkillSystem.handleInput(botId, { space: true, target: bot.targetPosition || { x: 0, y: 0 } }, state);
      }
    } else if (targetEntityIndex !== -1 && closestPreyDistSq < 400 * 400) {
      bot.aiState = 'chase';
      const targetObj = EntityLookup[targetEntityIndex];
      bot.targetEntityId = targetObj ? targetObj.id : null;
    } else if (targetFoodIndex !== -1) {
      bot.aiState = 'forage';
      // EIDOLON-V: Write target directly to InputStore (ZERO allocation)
      const fTIdx = targetFoodIndex * 8;
      InputStore.setTarget(botId, tData[fTIdx], tData[fTIdx + 1]);
    } else {
      bot.aiState = 'wander';
    }

    // 5. EXECUTE MOVEMENT (DOD Force)
    const speed = bot.maxSpeed; // Read from StatsStore optimally
    let tx = 0,
      ty = 0;

    if (bot.aiState === 'flee' && threatIndex !== -1) {
      const tIdx = threatIndex * 8;
      const dx = botX - tData[tIdx]; // Run away
      const dy = botY - tData[tIdx + 1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        tx = (dx / dist) * speed;
        ty = (dy / dist) * speed;
      }
    } else if (bot.aiState === 'chase' && targetEntityIndex !== -1) {
      const tIdx = targetEntityIndex * 8;
      const dx = tData[tIdx] - botX;
      const dy = tData[tIdx + 1] - botY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        tx = (dx / dist) * speed;
        ty = (dy / dist) * speed;
      }
    } else if (bot.aiState === 'forage') {
      // EIDOLON-V: Read target directly from InputStore (ZERO allocation)
      const iIdx = botId * InputStore.STRIDE;
      const targetX = InputStore.data[iIdx];
      const targetY = InputStore.data[iIdx + 1];
      const dx = targetX - botX;
      const dy = targetY - botY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        tx = (dx / dist) * speed;
        ty = (dy / dist) * speed;
      }
    } else {
      // Wander Center Bias
      const distCenterSq = botX * botX + botY * botY;
      if (distCenterSq > (MAP_RADIUS * 0.9) ** 2) {
        const dist = Math.sqrt(distCenterSq);
        tx = (-botX / dist) * speed;
        ty = (-botY / dist) * speed;
      } else {
        // Random wander
        tx = (Math.random() - 0.5) * speed;
        ty = (Math.random() - 0.5) * speed;
      }
    }

    // Steering
    const steerFactor = 0.1;
    // Write directly to PhysicsStore (Force/Accel)
    PhysicsStore.data[pIdx] += (tx - PhysicsStore.data[pIdx]) * steerFactor;
    PhysicsStore.data[pIdx + 1] += (ty - PhysicsStore.data[pIdx + 1]) * steerFactor;
  }
};
