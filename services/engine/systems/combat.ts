import {
  FOOD_GROWTH_MULTIPLIER
} from '../../../constants';
import { GameState, Player, Bot, Entity, Projectile, Food } from '../../../types';
import { createDeathExplosion, createFloatingText, createExplosion } from '../effects';
import { createFood } from '../factories';
import { applyGrowth, applyGrowthDOD } from './mechanics';
import { TattooId } from '../../cjr/cjrTypes';
import { StatusFlag, TattooFlag } from '../statusFlags';
import { createDefaultStatusMultipliers, createDefaultStatusScalars, createDefaultStatusTimers } from '../../../types/status';
import { mixPigment, calcMatchPercentFast, pigmentToInt, getSnapAlpha } from '../../cjr/colorMath';
import { triggerEmotion } from '../../cjr/emotions';
import { vfxBuffer, VFX_TYPES, packHex, TEXT_IDS } from '../VFXRingBuffer';
import { StatsStore, TransformStore, PhysicsStore, StateStore, TattooStore, EntityLookup } from '../dod/ComponentStores';
import { EntityFlags } from '../dod/EntityFlags';
import { audioEngine } from '../../audio/AudioEngine';

// Pure DOD Logic for Consumption
export const consumePickupDOD = (entityId: number, foodId: number, state: GameState) => {
  // Safety checks
  const fFlags = StateStore.flags[foodId];
  if ((fFlags & EntityFlags.ACTIVE) === 0 || (fFlags & EntityFlags.DEAD)) return;

  // Mark Food Dead
  StateStore.clearFlag(foodId, EntityFlags.ACTIVE);
  StateStore.setFlag(foodId, EntityFlags.DEAD);

  // Read Stats
  // STATS STRIDE = 8: [curHP, maxHP, score, match, def, dmg, pad, pad]
  const eIdx = entityId * 8;
  const fIdx = foodId * 8;

  const foodValue = StatsStore.data[fIdx + 2]; // Score slot holds value for food

  // Growth Logic
  const growth = foodValue * FOOD_GROWTH_MULTIPLIER;
  StatsStore.data[eIdx + 2] += foodValue; // Add Score to Player

  // Apply Growth
  applyGrowthDOD(entityId, growth);

  // Play Sound (Fire & Forget)
  audioEngine.playEat(entityId);

  // VFX
  const tIdx = entityId * 8;
  // TODO: Get Color from somewhere. For now white explosion.
  vfxBuffer.push(TransformStore.data[tIdx], TransformStore.data[tIdx + 1], 0xFFFFFF, VFX_TYPES.EXPLODE, 6);

  // LOGIC HEAVY LIFTING (Complex Food Types)
  // Compromise: We lookup object for "Pigment" logic because porting Color Math to DOD is Phase 6.
  // This is acceptable because eating is a "Rare Event" (not every frame).
  const foodObj = EntityLookup[foodId] as Food;
  const entityObj = EntityLookup[entityId] as Player | Bot;

  if (foodObj && entityObj) {
    // Use legacy handler for Pigment mixing, Tattoos, etc.
    // We already handled Score/Growth/Death in DOD above.
    // We just need the "Effects" part.
    handleLegacyFoodEffects(entityObj, foodObj, state);
  }
};

// Extracted from legacy consumePickup to avoid double-counting
const handleLegacyFoodEffects = (e: Player | Bot, food: Food, state: GameState) => {
  triggerEmotion(e, 'yum');

  switch (food.kind) {
    case 'pigment':
      if (food.pigment) {
        const baseRatio = Math.min(0.2, 0.1 * (15 / Math.max(15, e.radius)));
        const pigmentMatch = calcMatchPercentFast(food.pigment, e.targetPigment);
        let snappedRatio = pigmentMatch >= 0.8 ? getSnapAlpha(e.matchPercent, baseRatio) : baseRatio;
        if (e.tattoos?.includes(TattooId.FilterInk) && pigmentMatch < 0.6) {
          if (!e.statusScalars) e.statusScalars = createDefaultStatusScalars();
          const reduction = e.statusScalars?.wrongPigmentReduction || 0.6;
          snappedRatio *= reduction;

          // EIDOLON-V: Trigger Chromatic Aberration (Juice)
          e.aberrationIntensity = 1.5;
        }
        if (!e.statusMultipliers) e.statusMultipliers = createDefaultStatusMultipliers();
        const boostMult = e.statusMultipliers?.colorBoost || 1;
        const ratio = Math.min(0.35, snappedRatio * boostMult);

        e.pigment = mixPigment(e.pigment, food.pigment, ratio);
        e.color = pigmentToInt(e.pigment);
        e.matchPercent = calcMatchPercentFast(e.pigment, e.targetPigment);

        // Sync MATCH back to StatsStore
        if (e.physicsIndex !== undefined) {
          StatsStore.data[e.physicsIndex * 8 + 3] = e.matchPercent;
        }
      }
      break;

    case 'catalyst':
      if (!e.statusMultipliers) e.statusMultipliers = createDefaultStatusMultipliers();
      if (!e.statusTimers) e.statusTimers = createDefaultStatusTimers();

      e.statusMultipliers.colorBoost = Math.max(e.statusMultipliers.colorBoost || 1, 1.5);
      e.statusTimers.colorBoost = 4.0;
      // Legacy: pity multiplier logic was here, assuming handled logic side

      // createFloatingText call replaced by Zero-GC VFX
      vfxBuffer.push(e.position.x, e.position.y, packHex('#ff00ff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.CATALYST);
      break;

    case 'shield':
      e.statusFlags |= StatusFlag.SHIELDED;
      if (!e.statusScalars) e.statusScalars = createDefaultStatusScalars();
      e.statusScalars.commitShield = 3.0;
      e.statusScalars.commitShield = 3.0;
      vfxBuffer.push(e.position.x, e.position.y, packHex('#00ffff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.SHIELD);
      break;

    case 'solvent':
      vfxBuffer.push(e.position.x, e.position.y, packHex('#aaaaff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.CLEANSE);
      // Simplified solvent logic without pigment mix for brevity if not strictly needed or could call mixPigment
      const neutral = { r: 0.5, g: 0.5, b: 0.5 };
      e.pigment = mixPigment(e.pigment, neutral, 0.15);
      e.color = pigmentToInt(e.pigment);
      e.matchPercent = calcMatchPercentFast(e.pigment, e.targetPigment);
      break;

    case 'neutral':
      vfxBuffer.push(e.position.x, e.position.y, packHex('#888888'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.MASS);
      break;
  }
};

// DOD Damage Logic
export const reduceHealthDOD = (
  victimId: number,
  amount: number,
  attackerId: number | -1,
  state: GameState
) => {
  const vFlags = StateStore.flags[victimId];
  if ((vFlags & EntityFlags.DEAD) || (vFlags & EntityFlags.ACTIVE) === 0) return;

  const vIdx = victimId * 8; // StatsStore.STRIDE
  const currentHealth = StatsStore.data[vIdx];
  const defense = StatsStore.data[vIdx + 4] || 1;

  // Simple Damage Calc
  let actualDamage = amount / defense;
  let newHealth = currentHealth - actualDamage;

  // Update Store
  StatsStore.data[vIdx] = newHealth;

  // Death Check
  if (newHealth <= 0) {
    StatsStore.data[vIdx] = 0;
    StateStore.setFlag(victimId, EntityFlags.DEAD);

    // Death VFX
    const tIdx = victimId * 8;
    vfxBuffer.push(
      TransformStore.data[tIdx],
      TransformStore.data[tIdx + 1],
      0xFF0000,
      VFX_TYPES.EXPLODE,
      15
    );

    // Score for Attacker
    if (attackerId !== -1) {
      StatsStore.data[(attackerId * 8) + 2] += 50;
    }
  } else {
    // Hit VFX
    const tIdx = victimId * 8;
    vfxBuffer.push(
      TransformStore.data[tIdx],
      TransformStore.data[tIdx + 1],
      0xFFFFFF,
      VFX_TYPES.EXPLODE,
      3
    );
  }
};

// Legacy Wrappers (Keep for compatibility if needed)
export const resolveCombat = (
  e1: Player | Bot, e2: Player | Bot, dt: number, state: GameState, c1: boolean, c2: boolean
) => {
  if (e1.physicsIndex === undefined || e2.physicsIndex === undefined) return;
  const id1 = e1.physicsIndex;
  const id2 = e2.physicsIndex;

  // Radius from Physics
  const r1 = PhysicsStore.data[id1 * 8 + 4];
  const r2 = PhysicsStore.data[id2 * 8 + 4];

  // Eat Logic
  if (r1 > r2 * 1.2 && c1) {
    reduceHealthDOD(id2, 9999, id1, state); // Instant Kill/Eat
    applyGrowthDOD(id1, r2 * 0.5); // Growth
    return;
  }
  if (r2 > r1 * 1.2 && c2) {
    reduceHealthDOD(id1, 9999, id2, state);
    applyGrowthDOD(id2, r1 * 0.5);
    return;
  }

  // Damage Logic
  const dmg = 10 * dt;
  if (c1) reduceHealthDOD(id2, dmg, id1, state);
  if (c2) reduceHealthDOD(id1, dmg, id2, state);
};

export const applyProjectileEffect = (proj: Projectile, target: Player | Bot, state: GameState) => {
  if (target.physicsIndex !== undefined) {
    // Projectile owner ID is string, finding int ID is hard if not stored.
    // Assume -1 for now or lookup.
    reduceHealthDOD(target.physicsIndex, proj.damage, -1, state);
  }
};
