import {
  KING_DAMAGE_TAKEN_MULTIPLIER,
  KING_DAMAGE_DEALT_MULTIPLIER,
  KILL_GROWTH_MULTIPLIER,
  EAT_THRESHOLD_RATIO,
  FOOD_GROWTH_MULTIPLIER
} from '../../../constants';
import { GameState, Player, Bot, Entity, Projectile, Food } from '../../../types';
// EIDOLON-V: Import hàm effect đã refactor (push event)
import { createDeathExplosion, createFloatingText } from '../effects';
import { createFood } from '../factories';
import { applyGrowth } from './physics';
import { TattooId } from '../../cjr/cjrTypes';
import { mixPigment, calcMatchPercent, pigmentToHex, getSnapAlpha } from '../../cjr/colorMath';
import { triggerEmotion } from '../../cjr/emotions';
import { trackDamage } from '../../cjr/contribution';

export const applyProjectileEffect = (
  proj: Projectile,
  target: Player | Bot,
  state: GameState
) => {
  const shooter = (state.player.id === proj.ownerId) ? state.player : state.bots.find(b => b.id === proj.ownerId);
  reduceHealth(target, proj.damage, shooter, state);
};

export const consumePickup = (e: Player | Bot, food: Food, state: GameState) => {
  if (food.isDead) return;
  food.isDead = true;

  let growth = food.value * FOOD_GROWTH_MULTIPLIER;
  e.score += food.value;
  e.lastEatTime = 0;

  triggerEmotion(e, 'yum');

  // EIDOLON-V: Thay thế spawnPickupPop bằng Event
  // "pop:x:y:color"
  state.vfxEvents.push(`pop:${e.position.x}:${e.position.y}:${e.color}`);

  // ... (Giữ nguyên logic switch food.kind) ...
  switch (food.kind) {
    case 'pigment':
      if (food.pigment) {
        const baseRatio = Math.min(0.2, 0.1 * (15 / Math.max(15, e.radius)));
        const pigmentMatch = calcMatchPercent(food.pigment, e.targetPigment);
        let snappedRatio = pigmentMatch >= 0.8 ? getSnapAlpha(e.matchPercent, baseRatio) : baseRatio;
        if (e.tattoos?.includes(TattooId.FilterInk) && pigmentMatch < 0.6) {
          const reduction = e.statusEffects.wrongPigmentReduction || 0.6;
          snappedRatio *= reduction;
        }
        const boostMult = e.statusEffects.colorBoostMultiplier || 1;
        const ratio = Math.min(0.35, snappedRatio * boostMult);
        e.pigment = mixPigment(e.pigment, food.pigment, ratio);
        e.color = pigmentToHex(e.pigment);
        e.matchPercent = calcMatchPercent(e.pigment, e.targetPigment);
      }
      break;

    case 'neutral':
      if (e.tattoos?.includes(TattooId.NeutralMastery)) {
        const bonus = e.statusEffects.neutralMassBonus || 1.25;
        growth *= bonus;
      }
      createFloatingText(e.position, '+Mass', '#888888', 16, state);
      break;

    case 'solvent':
      const neutral = { r: 0.5, g: 0.5, b: 0.5 };
      const solventPower = e.statusEffects.solventPower || 1.0;
      const solventRatio = e.tattoos?.includes(TattooId.SolventExpert) ? 0.25 * solventPower : 0.15;
      e.pigment = mixPigment(e.pigment, neutral, solventRatio);
      e.color = pigmentToHex(e.pigment);
      e.matchPercent = calcMatchPercent(e.pigment, e.targetPigment);

      if (e.tattoos?.includes(TattooId.SolventExpert) && e.statusEffects.solventSpeedBoost) {
        e.statusEffects.tempSpeedBoost = Math.max(e.statusEffects.tempSpeedBoost || 1, e.statusEffects.solventSpeedBoost);
        e.statusEffects.tempSpeedTimer = Math.max(e.statusEffects.tempSpeedTimer || 0, 2.0);
      }
      createFloatingText(e.position, 'Cleanse', '#aaaaff', 16, state);
      break;

    case 'catalyst':
      e.statusEffects.colorBoostMultiplier = Math.max(e.statusEffects.colorBoostMultiplier || 1, 1.5);
      e.statusEffects.colorBoostTimer = 4.0;
      e.statusEffects.pityBoost = 4.0;
      if (e.tattoos?.includes(TattooId.CatalystEcho)) {
        const bonus = e.statusEffects.catalystEchoBonus || 1.3;
        const duration = e.statusEffects.catalystEchoDuration || 2.0;
        e.statusEffects.colorBoostMultiplier = Math.max(e.statusEffects.colorBoostMultiplier || 1, bonus);
        e.statusEffects.colorBoostTimer = Math.max(e.statusEffects.colorBoostTimer || 0, 4.0 + duration);
        growth *= bonus;
      }
      createFloatingText(e.position, 'Catalyst!', '#ff00ff', 18, state);
      break;

    case 'shield':
      e.statusEffects.shielded = true;
      e.statusEffects.commitShield = 3.0;
      createFloatingText(e.position, 'Shield!', '#00ffff', 18, state);
      break;
  }

  applyGrowth(e, growth);

  if (e.tattoos?.includes(TattooId.PerfectMatch)) {
    const threshold = e.statusEffects.perfectMatchThreshold || 0.85;
    const bonus = e.statusEffects.perfectMatchBonus || 1.5;
    if (e.matchPercent >= threshold) {
      growth *= bonus;
      e.score += Math.floor(5 * bonus);
      createFloatingText(e.position, 'PERFECT!', '#ffff00', 20, state);
    }
  }

  if (e.statusEffects.overdriveTimer && e.statusEffects.overdriveTimer > 0) {
    applyGrowth(e, 1.2);
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

  if (predator.killStreak === 2) {
    createFloatingText(predator.position, 'DOUBLE TAP!', '#ff0', 24, state);
  } else if (predator.killStreak === 3) {
    createFloatingText(predator.position, 'RAMPAGE!', '#ff4500', 32, state);
  } else if (predator.killStreak >= 5) {
    createFloatingText(predator.position, 'UNSTOPPABLE!', '#f00', 40, state);
    state.shakeIntensity += 5;
  }

  // EIDOLON-V: Truyền state vào createDeathExplosion
  createDeathExplosion(prey.position, prey.color, prey.radius, state);
  createFloatingText(prey.position, '+Mass', '#22c55e', 20, state);

  if (predator.tattoos?.includes(TattooId.GrimHarvest)) {
    const dropCount = predator.statusEffects.grimHarvestDropCount || 2;
    for (let i = 0; i < dropCount; i++) {
      const offsetX = (Math.random() - 0.5) * prey.radius * 0.6;
      const offsetY = (Math.random() - 0.5) * prey.radius * 0.6;
      const drop = createFood({ x: prey.position.x + offsetX, y: prey.position.y + offsetY });
      drop.kind = 'neutral';
      drop.color = '#9ca3af';
      drop.pigment = { r: 0.5, g: 0.5, b: 0.5 };
      state.food.push(drop);
    }
  }

  prey.isDead = true;
};

export const resolveCombat = (
  e1: Player | Bot,
  e2: Player | Bot,
  dt: number,
  state: GameState,
  c1: boolean,
  c2: boolean
) => {
  const r1 = e1.radius;
  const r2 = e2.radius;

  if (r1 > r2 * (1 / EAT_THRESHOLD_RATIO) && c1) {
    const dist = Math.hypot(e1.position.x - e2.position.x, e1.position.y - e2.position.y);
    if (dist < r1 - r2 * 0.5) {
      consume(e1, e2, state);
      return;
    }
  }

  if (r2 > r1 * (1 / EAT_THRESHOLD_RATIO) && c2) {
    const dist = Math.hypot(e1.position.x - e2.position.x, e1.position.y - e2.position.y);
    if (dist < r2 - r1 * 0.5) {
      consume(e2, e1, state);
      return;
    }
  }

  if (c1) {
    const dmg = 10 * dt * e1.damageMultiplier;
    reduceHealth(e2, dmg, e1, state);
  }
  if (c2) {
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
  if (victim.isDead || victim.isInvulnerable || (victim.statusEffects?.invulnerable ?? 0) > 0) return;
  if (victim.statusEffects?.shielded) return;

  let actualDamage = amount / victim.defense;
  if (victim.tattoos?.includes(TattooId.PrismGuard)) {
    const threshold = victim.statusEffects.prismGuardThreshold || 0.8;
    const reduction = victim.statusEffects.prismGuardReduction || 0.8;
    if (victim.matchPercent >= threshold) {
      actualDamage *= reduction;
    }
  }
  if (attacker && 'tattoos' in attacker) {
    const att = attacker as Player;
    if (victim.tattoos?.includes(TattooId.PigmentBomb)) {
      const chance = victim.statusEffects.pigmentBombChance || 0.3;
      if (Math.random() < chance) {
        att.pigment = mixPigment(att.pigment, victim.pigment, 0.15);
        att.color = pigmentToHex(att.pigment);
        att.matchPercent = calcMatchPercent(att.pigment, att.targetPigment);
        createFloatingText(att.position, 'INKED!', '#ff66cc', 18, state);
      }
    }
  }

  victim.currentHealth -= actualDamage;
  if (attacker && 'currentHealth' in attacker) {
    const leech = (attacker as Player | Bot).lifesteal || 0;
    if (leech > 0 && actualDamage > 0) {
      const healer = attacker as Player | Bot;
      healer.currentHealth = Math.min(healer.maxHealth, healer.currentHealth + actualDamage * leech);
    }
  }
  state.shakeIntensity += actualDamage * 0.05;

  if (victim.currentHealth / victim.maxHealth < 0.2 && victim.currentHealth > 0) {
    triggerEmotion(victim, 'panic');
  }

  victim.lastHitTime = 0;
  triggerEmotion(victim, 'panic');

  // EIDOLON-V: Thay thế spawnHitSplash bằng Event "hit:x:y:color"
  state.vfxEvents.push(`hit:${victim.position.x}:${victim.position.y}:${victim.color}`);

  if (attacker && 'score' in attacker && 'isBoss' in victim && (victim as Bot).isBoss) {
    trackDamage(attacker as Player | Bot, victim as Player | Bot, actualDamage, state);
  }

  if (victim.currentHealth <= 0) {
    victim.currentHealth = 0;
    victim.isDead = true;
    // EIDOLON-V: Pass state
    createDeathExplosion(victim.position, victim.color, victim.radius, state);

    if (attacker && 'score' in attacker) {
      const killer = attacker as Player;
      killer.kills++;
      killer.score += 50;
    }
  }
};
