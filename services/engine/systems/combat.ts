import {
  KING_DAMAGE_TAKEN_MULTIPLIER,
  KING_DAMAGE_DEALT_MULTIPLIER,
  KILL_GROWTH_MULTIPLIER,
  EAT_THRESHOLD_RATIO,
  FOOD_GROWTH_MULTIPLIER
} from '../../../constants';
import { GameState, Player, Bot, Entity, Projectile, Food } from '../../../types';
// EIDOLON-V: Import hàm effect đã refactor (push event)
import { createDeathExplosion, createFloatingText, createExplosion } from '../effects';
import { createFood } from '../factories';
import { applyGrowth } from './mechanics';
import { TattooId } from '../../cjr/cjrTypes';
import { StatusFlag, TattooFlag } from '../statusFlags';
import { mixPigment, calcMatchPercent, pigmentToHex, getSnapAlpha } from '../../cjr/colorMath';
import { triggerEmotion } from '../../cjr/emotions';
import { trackDamage } from '../../cjr/contribution';
// EIDOLON-V FIX: Import VFX buffer for zero-allocation events
import { vfxBuffer, VFX_TYPES } from '../VFXRingBuffer';

// EIDOLON-V FIX: Import StatsStore & AudioEngine
import { StatsStore, TransformStore } from '../dod/ComponentStores';
import { audioEngine } from '../../audio/AudioEngine';

// EIDOLON-V FIX: Helper to read fresh position from DOD Store
const getPos = (e: Entity) => {
  if (e.physicsIndex !== undefined) {
    const idx = e.physicsIndex * 8;
    return { x: TransformStore.data[idx], y: TransformStore.data[idx + 1] };
  }
  return e.position;
};

export const applyProjectileEffect = (
  proj: Projectile,
  target: Player | Bot,
  state: GameState
) => {
  const shooter = (state.player.id === proj.ownerId) ? state.player : state.bots.find(b => b.id === proj.ownerId);
  reduceHealth(target, proj.damage, shooter, state);
  createExplosion(getPos(target), target.color, 10, state);
};

export const consumePickup = (e: Player | Bot, food: Food, state: GameState) => {
  if (food.isDead) return;
  food.isDead = true;

  let growth = food.value * FOOD_GROWTH_MULTIPLIER;
  e.score += food.value;
  e.lastEatTime = 0;

  triggerEmotion(e, 'yum');

  // EIDOLON-V FIX: Spatial Audio Eat
  audioEngine.playEat(e.physicsIndex);

  // EIDOLON-V: Thay thế spawnPickupPop bằng Event
  // "pop:x:y:color"
  // EIDOLON-V FIX: Use VFX ring buffer with Packed Integers
  // Assuming e.color is already a hex or we compute from pigment.
  // Best practice: Compute from pigment directly to avoid string parsing entirely.
  const p = e.pigment;
  const packedColor = ((Math.round(p.r * 255) << 16) | (Math.round(p.g * 255) << 8) | Math.round(p.b * 255));

  const pos = getPos(e);
  vfxBuffer.push(pos.x, pos.y, packedColor, VFX_TYPES.EXPLODE, 6);

  switch (food.kind) {
    case 'pigment':
      if (food.pigment) {
        const baseRatio = Math.min(0.2, 0.1 * (15 / Math.max(15, e.radius)));
        const pigmentMatch = calcMatchPercent(food.pigment, e.targetPigment);
        let snappedRatio = pigmentMatch >= 0.8 ? getSnapAlpha(e.matchPercent, baseRatio) : baseRatio;
        if (e.tattoos?.includes(TattooId.FilterInk) && pigmentMatch < 0.6) {
          const reduction = e.statusScalars.wrongPigmentReduction || 0.6;
          snappedRatio *= reduction;
        }
        const boostMult = e.statusMultipliers.colorBoost || 1;
        const ratio = Math.min(0.35, snappedRatio * boostMult);
        e.pigment = mixPigment(e.pigment, food.pigment, ratio);
        e.color = pigmentToHex(e.pigment);
        e.matchPercent = calcMatchPercent(e.pigment, e.targetPigment);
      }
      break;

    case 'neutral':
      if (e.tattoos?.includes(TattooId.NeutralMastery)) {
        const bonus = e.statusMultipliers.neutralMass || 1.25;
        growth *= bonus;
      }
      createFloatingText(getPos(e), '+Mass', '#888888', 16, state);
      break;

    case 'solvent':
      const neutral = { r: 0.5, g: 0.5, b: 0.5 };
      const solventPower = e.statusMultipliers.solventPower || 1.0;
      const solventRatio = e.tattoos?.includes(TattooId.SolventExpert) ? 0.25 * solventPower : 0.15;
      e.pigment = mixPigment(e.pigment, neutral, solventRatio);
      e.color = pigmentToHex(e.pigment);
      e.matchPercent = calcMatchPercent(e.pigment, e.targetPigment);

      if (e.tattoos?.includes(TattooId.SolventExpert) && e.statusScalars.solventSpeedBoost) {
        e.statusMultipliers.speed = Math.max(e.statusMultipliers.speed || 1, e.statusScalars.solventSpeedBoost);
        e.statusTimers.tempSpeed = Math.max(e.statusTimers.tempSpeed || 0, 2.0);
      }
      createFloatingText(getPos(e), 'Cleanse', '#aaaaff', 16, state);
      break;

    case 'catalyst':
      e.statusMultipliers.colorBoost = Math.max(e.statusMultipliers.colorBoost || 1, 1.5);
      e.statusTimers.colorBoost = 4.0;
      e.statusMultipliers.pity = 4.0;
      if (e.tattoos?.includes(TattooId.CatalystEcho)) {
        const bonus = e.statusMultipliers.catalystEcho || 1.3;
        const duration = e.statusTimers.catalystEcho || 2.0;
        e.statusMultipliers.colorBoost = Math.max(e.statusMultipliers.colorBoost || 1, bonus);
        e.statusTimers.colorBoost = Math.max(e.statusTimers.colorBoost || 0, 4.0 + duration);
        growth *= bonus;
      }
      createFloatingText(getPos(e), 'Catalyst!', '#ff00ff', 18, state);
      break;

    case 'shield':
      e.statusFlags |= StatusFlag.SHIELDED;
      e.statusScalars.commitShield = 3.0;
      createFloatingText(getPos(e), 'Shield!', '#00ffff', 18, state);
      break;
  }

  applyGrowth(e, growth);

  if (e.tattoos?.includes(TattooId.PerfectMatch)) {
    const threshold = e.statusScalars.perfectMatchThreshold || 0.85;
    const bonus = e.statusMultipliers.perfectMatch || 1.5;
    if (e.matchPercent >= threshold) {
      growth *= bonus;
      e.score += Math.floor(5 * bonus);
      createFloatingText(getPos(e), 'PERFECT!', '#ffff00', 20, state);
    }
  }

  if (e.statusTimers.overdrive && e.statusTimers.overdrive > 0) {
    applyGrowth(e, 1.2);
  }

  // EIDOLON-V FIX: Sync Stats to DOD [Health, Max, Score, Match]
  if (e.physicsIndex !== undefined) {
    const idx = e.physicsIndex * 4;
    // Health unchanged here usually, just score/match
    StatsStore.data[idx + 2] = e.score;
    StatsStore.data[idx + 3] = e.matchPercent;
  }
};


export const consume = (
  predator: Player | Bot,
  prey: Player | Bot,
  state: GameState
) => {
  const massGain = prey.radius * KILL_GROWTH_MULTIPLIER * (predator.killGrowthMultiplier || 1);
  applyGrowth(predator, massGain);

  predator.currentHealth = Math.min(predator.maxHealth, predator.currentHealth + predator.maxHealth * 0.2);

  predator.score += 100 + prey.score * 0.5;
  predator.kills++;
  const ratio = 0.2;
  predator.pigment = mixPigment(predator.pigment, prey.pigment, ratio);
  predator.color = pigmentToHex(predator.pigment);
  predator.matchPercent = calcMatchPercent(predator.pigment, predator.targetPigment);
  predator.lastEatTime = 0;

  predator.killStreak = (predator.killStreak || 0) + 1;
  predator.streakTimer = 5.0;

  // ... (Streak Logic) ...
  if (predator.killStreak === 2) {
    createFloatingText(getPos(predator), 'DOUBLE TAP!', '#ff0', 24, state);
  } else if (predator.killStreak === 3) {
    createFloatingText(getPos(predator), 'RAMPAGE!', '#ff4500', 32, state);
  } else if (predator.killStreak >= 5) {
    createFloatingText(getPos(predator), 'UNSTOPPABLE!', '#f00', 40, state);
    state.shakeIntensity += 5;
  }

  // EIDOLON-V: Truyền state vào createDeathExplosion
  const preyPos = getPos(prey);
  createDeathExplosion(preyPos, prey.color, prey.radius, state);
  createFloatingText(preyPos, '+Mass', '#22c55e', 20, state);

  // ... (Grim Harvest Logic) ...
  if (predator.tattoos?.includes(TattooId.GrimHarvest)) {
    const dropCount = predator.statusScalars.grimHarvestDropCount || 2;
    for (let i = 0; i < dropCount; i++) {
      // ...
      const offsetX = (Math.random() - 0.5) * prey.radius * 0.6;
      const offsetY = (Math.random() - 0.5) * prey.radius * 0.6;
      const drop = createFood({ x: getPos(prey).x + offsetX, y: getPos(prey).y + offsetY });
      drop.kind = 'neutral';
      drop.color = '#9ca3af';
      drop.pigment = { r: 0.5, g: 0.5, b: 0.5 };
      state.food.push(drop);
    }
  }

  prey.isDead = true;

  // EIDOLON-V FIX: Sync Stats for Predator
  if (predator.physicsIndex !== undefined) {
    const idx = predator.physicsIndex * 4;
    StatsStore.data[idx] = predator.currentHealth; // Healed
    StatsStore.data[idx + 2] = predator.score;
    StatsStore.data[idx + 3] = predator.matchPercent;
  }
};

export const resolveCombat = (
  // ...
  e1: Player | Bot,
  e2: Player | Bot,
  dt: number,
  state: GameState,
  c1: boolean,
  c2: boolean
) => {
  // ... (logic)
  const r1 = e1.radius;
  const r2 = e2.radius;

  // EIDOLON-V FIX: Check consumption first, return early if consumed
  if (r1 > r2 * (1 / EAT_THRESHOLD_RATIO) && c1) {
    const p1 = getPos(e1);
    const p2 = getPos(e2);
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (dist < r1 - r2 * 0.5) {
      consume(e1, e2, state);
      return; // EIDOLON-V: Early return to prevent damage calculation on dead entity
    }
  }

  if (r2 > r1 * (1 / EAT_THRESHOLD_RATIO) && c2) {
    const p1 = getPos(e1);
    const p2 = getPos(e2);
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (dist < r2 - r1 * 0.5) {
      consume(e2, e1, state);
      return; // EIDOLON-V: Early return to prevent damage calculation on dead entity
    }
  }

  // Only apply damage if neither entity was consumed
  if (c1 && !e2.isDead) {
    const dmg = 10 * dt * e1.damageMultiplier;
    reduceHealth(e2, dmg, e1, state);
  }
  if (c2 && !e1.isDead) {
    const dmg = 10 * dt * e2.damageMultiplier;
    reduceHealth(e1, dmg, e2, state);
  }
};

export const reduceHealth = (
  victim: Player | Bot,
  amount: number,
  attacker: Entity | undefined,
  state: GameState
) => {
  // ... (shield/invul checks)
  if (victim.isDead || victim.isInvulnerable || (victim.statusTimers.invulnerable > 0)) return;
  if ((victim.statusFlags & StatusFlag.SHIELDED) || (victim.statusFlags & StatusFlag.INVULNERABLE)) return;

  let actualDamage = amount / victim.defense;

  // ... (Tattoo reductions) ...
  if (victim.tattoos?.includes(TattooId.PrismGuard)) {
    const threshold = victim.statusScalars.prismGuardThreshold || 0.8;
    const reduction = victim.statusMultipliers.prismGuardReduction || 0.8;
    if (victim.matchPercent >= threshold) {
      actualDamage *= reduction;
    }
  }
  // ... (Pigment Bomb) ...
  if (attacker && 'tattoos' in attacker) {
    const att = attacker as Player;
    if (victim.tattoos?.includes(TattooId.PigmentBomb)) {
      const chance = victim.statusScalars.pigmentBombChance || 0.3;
      if (Math.random() < chance) {
        att.pigment = mixPigment(att.pigment, victim.pigment, 0.15);
        att.color = pigmentToHex(att.pigment);
        att.matchPercent = calcMatchPercent(att.pigment, att.targetPigment);
        createFloatingText(getPos(att), 'INKED!', '#ff66cc', 18, state);

        // SYNC ATTACKER STATS (MatchPercent changed)
        if (att.physicsIndex !== undefined) {
          const idx = att.physicsIndex * 4;
          StatsStore.data[idx + 3] = att.matchPercent;
        }
      }
    }
  }

  victim.currentHealth -= actualDamage;

  // ... (Lifesteal) ...
  if (attacker && 'currentHealth' in attacker) {
    const leech = (attacker as Player | Bot).lifesteal || 0;
    if (leech > 0 && actualDamage > 0) {
      const healer = attacker as Player | Bot;
      healer.currentHealth = Math.min(healer.maxHealth, healer.currentHealth + actualDamage * leech);

      // SYNC HEALER STATS
      if (healer.physicsIndex !== undefined) {
        StatsStore.data[healer.physicsIndex * 4] = healer.currentHealth;
      }
    }
  }

  // ... (Shake/Emotion) ...
  state.shakeIntensity += actualDamage * 0.05;

  if (victim.currentHealth / victim.maxHealth < 0.2 && victim.currentHealth > 0) {
    triggerEmotion(victim, 'panic');
  }

  victim.lastHitTime = 0;
  triggerEmotion(victim, 'panic');

  // EIDOLON-V: Thay thế spawnHitSplash bằng Event "hit:x:y:color"
  // EIDOLON-V FIX: Use VFX ring buffer with Packed Integers
  const p = victim.pigment;
  const packedColor = ((Math.round(p.r * 255) << 16) | (Math.round(p.g * 255) << 8) | Math.round(p.b * 255));

  const vp = getPos(victim);
  vfxBuffer.push(vp.x, vp.y, packedColor, VFX_TYPES.EXPLODE, 12);

  // ... (Boss Tracking) ...
  if (attacker && 'score' in attacker && 'isBoss' in victim && (victim as Bot).isBoss) {
    trackDamage(attacker as Player | Bot, victim as Player | Bot, actualDamage, state);
  }

  if (victim.currentHealth <= 0) {
    victim.currentHealth = 0;
    victim.isDead = true;
    // EIDOLON-V: Pass state
    createDeathExplosion(getPos(victim), victim.color, victim.radius, state);

    if (attacker && 'score' in attacker) {
      const killer = attacker as Player;
      killer.kills++;
      killer.score += 50;

      // SYNC KILLER SCORE
      if (killer.physicsIndex !== undefined) {
        StatsStore.data[killer.physicsIndex * 4 + 2] = killer.score;
      }
    }
  }

  // EIDOLON-V FIX: Sync Stats for Victim (Health)
  if (victim.physicsIndex !== undefined) {
    StatsStore.data[victim.physicsIndex * 4] = victim.currentHealth;
  }
};
