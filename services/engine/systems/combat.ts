
import {
  KING_DAMAGE_TAKEN_MULTIPLIER,
  KING_DAMAGE_DEALT_MULTIPLIER,
  KILL_GROWTH_MULTIPLIER,
  EAT_THRESHOLD_RATIO,
  FOOD_GROWTH_MULTIPLIER
} from '../../../constants';
import { GameState, Player, Bot, Entity, Projectile, Food } from '../../../types';
import { createDeathExplosion, createFloatingText, notifyPlayerDamage } from '../effects';
import { createParticle } from '../factories';
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
  /* CJR: Handle lookup. Client state usually has 'player' and 'bots'. */
  const shooter = (state.player.id === proj.ownerId) ? state.player : state.bots.find(b => b.id === proj.ownerId);
  // Simple damage for now
  reduceHealth(target, proj.damage, shooter, state);
};

export const consumePickup = (e: Player | Bot, food: Food, state: GameState) => {
  if (food.isDead) return;
  food.isDead = true;

  // Growth (all pickups give mass)
  let growth = food.value * FOOD_GROWTH_MULTIPLIER;
  e.score += food.value;
  e.lastEatTime = 0;

  // Trigger eat emotion
  triggerEmotion(e, 'eat');
  spawnPickupPop(state, e.position.x, e.position.y, e.color);

  // Handle by pickup kind
  switch (food.kind) {
    case 'pigment':
      if (food.pigment) {
        // Mass-based mixing ratio - smaller jelly changes color faster
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
      // Pure mass, no pigment change
      if (e.tattoos?.includes(TattooId.NeutralMastery)) {
        const bonus = e.statusEffects.neutralMassBonus || 1.25;
        growth *= bonus;
      }
      createFloatingText(e.position, '+Mass', '#888888', 16, state);
      break;

    case 'solvent':
      // Pull pigment toward neutral (0.5, 0.5, 0.5)
      const neutral = { r: 0.5, g: 0.5, b: 0.5 };
      const solventPower = e.statusEffects.solventPower || 1.0;
      const solventRatio = e.tattoos?.includes(TattooId.SolventExpert) ? 0.25 * solventPower : 0.15;
      e.pigment = mixPigment(e.pigment, neutral, solventRatio);
      e.color = pigmentToHex(e.pigment);
      e.matchPercent = calcMatchPercent(e.pigment, e.targetPigment);
      
      // Solvent speed boost
      if (e.tattoos?.includes(TattooId.SolventExpert) && e.statusEffects.solventSpeedBoost) {
        e.statusEffects.tempSpeedBoost = Math.max(e.statusEffects.tempSpeedBoost || 1, e.statusEffects.solventSpeedBoost);
        e.statusEffects.tempSpeedTimer = Math.max(e.statusEffects.tempSpeedTimer || 0, 2.0);
      }
      
      createFloatingText(e.position, 'Cleanse', '#aaaaff', 16, state);
      break;

    case 'catalyst':
      // Buff: next pigment pickups have stronger mix (use pityBoost as temp tracker)
      e.statusEffects.colorBoostMultiplier = Math.max(e.statusEffects.colorBoostMultiplier || 1, 1.5);
      e.statusEffects.colorBoostTimer = 4.0;
      e.statusEffects.pityBoost = 4.0;
      createFloatingText(e.position, 'Catalyst!', '#ff00ff', 18, state);
      break;

    case 'shield':
      // Temporary shield
      e.statusEffects.shielded = true;
      e.statusEffects.commitShield = 3.0; // 3 seconds
      createFloatingText(e.position, 'Shield!', '#00ffff', 18, state);
      break;
  }

  applyGrowth(e, growth);

  // Perfect Match Bonus
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
  // 1. Absorb Mass
  const massGain = prey.radius * KILL_GROWTH_MULTIPLIER * (predator.killGrowthMultiplier || 1);
  applyGrowth(predator, massGain);

  // 2. Heal
  predator.currentHealth = Math.min(predator.maxHealth, predator.currentHealth + predator.maxHealth * 0.2);

  // 3. Score
  predator.score += 100 + prey.score * 0.5;
  predator.kills++;

  // 4. Pigment Mix (Predator takes some of Prey's color?)
  const ratio = 0.2; // Stronger mix for kills
  predator.pigment = mixPigment(predator.pigment, prey.pigment, ratio);
  predator.color = pigmentToHex(predator.pigment);
  predator.matchPercent = calcMatchPercent(predator.pigment, predator.targetPigment);
  predator.lastEatTime = 0;

  // 5. Effects
  createDeathExplosion(prey.position, prey.color, prey.radius);
  createFloatingText(prey.position, '+Mass', '#22c55e', 20, state);

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

  // EAT CHECK
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

  // BUMP COMBAT
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
  state.shakeIntensity += actualDamage * 0.05;
  victim.lastHitTime = 0;
  triggerEmotion(victim, 'hit');
  spawnHitSplash(state, victim.position.x, victim.position.y, victim.color);

  if (attacker && 'score' in attacker && 'isBoss' in victim && (victim as Bot).isBoss) {
    trackDamage(attacker as Player | Bot, victim as Player | Bot, actualDamage);
  }

  if (victim.currentHealth <= 0) {
    victim.currentHealth = 0;
    victim.isDead = true;
    createDeathExplosion(victim.position, victim.color, victim.radius);

    if (attacker && 'score' in attacker) {
      const killer = attacker as Player;
      killer.kills++;
      killer.score += 50;
    }
  }
};

const spawnPickupPop = (state: GameState, x: number, y: number, color: string) => {
  for (let i = 0; i < 6; i++) {
    const p = createParticle(x, y, color, 120);
    p.life = 0.4;
    state.particles.push(p);
  }
};

const spawnHitSplash = (state: GameState, x: number, y: number, color: string) => {
  for (let i = 0; i < 8; i++) {
    const p = createParticle(x, y, color, 160);
    p.life = 0.5;
    state.particles.push(p);
  }
};
