import { FOOD_GROWTH_MULTIPLIER } from '@/constants';
import { GameState, Player, Bot, Entity, Projectile, Food } from '@/types';
import { createDeathExplosion, createFloatingText, createExplosion } from '../effects';
import { createFood } from '../factories';
import { applyGrowth, applyGrowthDOD } from './mechanics';
import { TattooId } from '@/game/cjr/cjrTypes';
import { StatusFlag, TattooFlag } from '../statusFlags';
import {
  createDefaultStatusMultipliers,
  createDefaultStatusScalars,
  createDefaultStatusTimers,
} from '@/types/status';
import { mixPigment, calcMatchPercentFast, pigmentToInt, getSnapAlpha } from '@/game/cjr/colorMath';
import { triggerEmotion } from '@/game/cjr/emotions';
import { vfxBuffer, VFX_TYPES, packHex, TEXT_IDS } from '../VFXRingBuffer';
import {
  StatsAccess,
  TransformAccess,
  PhysicsAccess,
  StateAccess,        // PHASE 4: Migrated from StateStore
  TattooAccess,
  EntityLookup,
  PigmentUtils,
  EntityFlags,
  STRIDES,
} from '@cjr/engine';
import { getWorld } from '../context';
import { audioEngine } from '@/game/audio/AudioEngine';

// EIDOLON-V: Instance-based WorldState via getWorld()

// EIDOLON-V PHASE 6: Pure DOD Logic for Consumption
// Uses PigmentStore instead of EntityLookup - Zero Object Access!
// NOTE: Internal function - exported for future collision system integration
export const consumePickupDOD = (entityId: number, foodId: number, _state: GameState) => {
  const w = getWorld();
  // Safety checks - AUDIT FIX: use world.stateFlags instead of deprecated StateStore.flags
  const fFlags = w.stateFlags[foodId];
  if ((fFlags & EntityFlags.ACTIVE) === 0 || fFlags & EntityFlags.DEAD) return;

  // Mark Food Dead
  StateAccess.clearFlag(w, foodId, EntityFlags.ACTIVE);
  StateAccess.setFlag(w, foodId, EntityFlags.DEAD);

  // Read Stats via world.stats (stride=8: [curHP, maxHP, score, match, def, dmg, pad, pad])
  const eIdx = entityId * 8;
  const fIdx = foodId * 8;

  const foodValue = w.stats[fIdx + 2]; // Score slot holds value for food

  // Growth Logic
  const growth = foodValue * FOOD_GROWTH_MULTIPLIER;
  w.stats[eIdx + 2] += foodValue; // Add Score to Player

  // Apply Growth
  applyGrowthDOD(entityId, growth);

  // Play Sound (Fire & Forget)
  audioEngine.playEat(entityId);

  // VFX - get color from PigmentStore instead of object
  const entityColor = PigmentUtils.getColorInt(w, entityId) || 0xffffff;
  vfxBuffer.push(
    w.transform[entityId * 8],
    w.transform[entityId * 8 + 1],
    entityColor,
    VFX_TYPES.EXPLODE,
    6
  );

  // PHASE 6: Pure DOD Pigment Mixing
  // Food pigment stored in PigmentStore at foodId index
  const fPigIdx = foodId * 8; // PIGMENT stride = 8
  const foodR = w.pigment[fPigIdx + 0];
  const foodG = w.pigment[fPigIdx + 1];
  const foodB = w.pigment[fPigIdx + 2];

  // Only mix if food has pigment data (non-zero)
  if (foodR !== 0 || foodG !== 0 || foodB !== 0) {
    // Base ratio calculation (simplified from legacy)
    const eRadius = w.physics[entityId * 8 + 4] || 15;
    const baseRatio = Math.min(0.2, 0.1 * (15 / Math.max(15, eRadius)));

    // Mix pigment directly in DOD store
    PigmentUtils.mix(w, entityId, foodR, foodG, foodB, baseRatio);

    // Sync match back to StatsStore for compatibility
    w.stats[eIdx + 3] = PigmentUtils.getMatch(w, entityId);
  }

  // Legacy fallback for complex food types (catalyst, shield, solvent)
  // These are rare events and acceptable to use EntityLookup
  const foodObj = EntityLookup[foodId] as Food | null;
  if (foodObj && foodObj.kind !== 'pigment' && foodObj.kind !== 'neutral') {
    const entityObj = EntityLookup[entityId] as Player | Bot | null;
    if (entityObj) {
      handleLegacyFoodEffects(entityObj, foodObj, _state);
    }
  }
};

// Extracted from legacy consumePickup to avoid double-counting
const handleLegacyFoodEffects = (e: Player | Bot, food: Food, state: GameState) => {
  const w = getWorld();
  triggerEmotion(e, 'yum');

  let ex = e.position.x;
  let ey = e.position.y;
  if (e.physicsIndex !== undefined) {
    ex = w.transform[e.physicsIndex * 8];
    ey = w.transform[e.physicsIndex * 8 + 1];
  }

  switch (food.kind) {
    case 'pigment':
      if (food.pigment) {
        const baseRatio = Math.min(0.2, 0.1 * (15 / Math.max(15, e.radius)));
        const pigmentMatch = calcMatchPercentFast(food.pigment, e.targetPigment);
        let snappedRatio =
          pigmentMatch >= 0.8 ? getSnapAlpha(e.matchPercent, baseRatio) : baseRatio;
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

        // EIDOLON-V FIX: No Allocation Mix + Sync to Store
        const mixed = mixPigment(e.pigment, food.pigment, ratio);
        e.pigment.r = mixed.r;
        e.pigment.g = mixed.g;
        e.pigment.b = mixed.b;

        // Sync to Store (SSOT)
        if (e.physicsIndex !== undefined) {
          PigmentUtils.set(w, e.physicsIndex, mixed.r, mixed.g, mixed.b);
        }

        e.color = pigmentToInt(e.pigment);
        e.matchPercent = calcMatchPercentFast(e.pigment, e.targetPigment);

        // Sync MATCH back to StatsStore
        if (e.physicsIndex !== undefined) {
          w.stats[e.physicsIndex * 8 + 3] = e.matchPercent;
        }
      }
      break;

    case 'catalyst':
      if (!e.statusMultipliers) e.statusMultipliers = createDefaultStatusMultipliers();
      if (!e.statusTimers) e.statusTimers = createDefaultStatusTimers();

      e.statusMultipliers.colorBoost = Math.max(e.statusMultipliers.colorBoost || 1, 1.5);
      e.statusTimers.colorBoost = 4.0;

      // createFloatingText call replaced by Zero-GC VFX
      vfxBuffer.push(ex, ey, packHex('#ff00ff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.CATALYST);
      break;

    case 'shield':
      e.statusFlags |= StatusFlag.SHIELDED;
      if (!e.statusScalars) e.statusScalars = createDefaultStatusScalars();
      e.statusScalars.commitShield = 3.0;
      e.statusScalars.commitShield = 3.0;
      vfxBuffer.push(ex, ey, packHex('#00ffff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.SHIELD);
      break;

    case 'solvent':
      vfxBuffer.push(ex, ey, packHex('#aaaaff'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.CLEANSE);
      // Simplified solvent logic without pigment mix for brevity if not strictly needed or could call mixPigment
      const neutral = { r: 0.5, g: 0.5, b: 0.5 };

      const mixedSolvent = mixPigment(e.pigment, neutral, 0.15);
      e.pigment.r = mixedSolvent.r;
      e.pigment.g = mixedSolvent.g;
      e.pigment.b = mixedSolvent.b;

      // Sync to Store (SSOT)
      if (e.physicsIndex !== undefined) {
        PigmentUtils.set(w, e.physicsIndex, mixedSolvent.r, mixedSolvent.g, mixedSolvent.b);
      }

      e.color = pigmentToInt(e.pigment);
      e.matchPercent = calcMatchPercentFast(e.pigment, e.targetPigment);
      break;

    case 'neutral':
      vfxBuffer.push(ex, ey, packHex('#888888'), VFX_TYPES.FLOATING_TEXT, TEXT_IDS.MASS);
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
  const w = getWorld();
  const vFlags = w.stateFlags[victimId];
  if (vFlags & EntityFlags.DEAD || (vFlags & EntityFlags.ACTIVE) === 0) return;

  const vIdx = victimId * 8; // StatsStore.STRIDE
  const currentHealth = w.stats[vIdx];
  const defense = w.stats[vIdx + 4] || 1;

  // Simple Damage Calc
  const actualDamage = amount / defense;
  const newHealth = currentHealth - actualDamage;

  // Update Store
  w.stats[vIdx] = newHealth;

  // Death Check
  if (newHealth <= 0) {
    w.stats[vIdx] = 0;
    StateAccess.setFlag(w, victimId, EntityFlags.DEAD);

    // Death VFX
    vfxBuffer.push(
      w.transform[victimId * 8],
      w.transform[victimId * 8 + 1],
      0xff0000,
      VFX_TYPES.EXPLODE,
      15
    );

    // Score for Attacker
    if (attackerId !== -1) {
      w.stats[attackerId * 8 + 2] += 50;
    }
  } else {
    // Hit VFX
    vfxBuffer.push(
      w.transform[victimId * 8],
      w.transform[victimId * 8 + 1],
      0xffffff,
      VFX_TYPES.EXPLODE,
      3
    );
  }
};

// Legacy Wrappers (Keep for compatibility if needed)
export const resolveCombat = (
  e1: Player | Bot,
  e2: Player | Bot,
  dt: number,
  state: GameState,
  c1: boolean,
  c2: boolean
) => {
  const w = getWorld();
  if (e1.physicsIndex === undefined || e2.physicsIndex === undefined) return;
  const id1 = e1.physicsIndex;
  const id2 = e2.physicsIndex;

  // Radius from Physics
  const r1 = w.physics[id1 * 8 + 4];
  const r2 = w.physics[id2 * 8 + 4];

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
