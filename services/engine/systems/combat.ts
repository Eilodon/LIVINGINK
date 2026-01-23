import {
  BOT_RESPAWN_TIME,
  ELEMENTAL_ADVANTAGE,
  KING_BOUNTY_RADIUS,
  KING_BOUNTY_SCORE,
  KING_DAMAGE_DEALT_MULTIPLIER,
  KING_DAMAGE_TAKEN_MULTIPLIER,
  KILL_GROWTH_MULTIPLIER,
} from '../../../constants';
import { Bot, Faction, GameState, Player, Projectile, SizeTier } from '../../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { vfxManager } from '../../vfx/VFXManager';
import { triggerBloodlinePassive } from '../../bloodlines';
import { triggerHaptic } from '../../haptics';
import { applyMutation, getMutationChoices } from '../../mutations';
import { createParticle, createPowerUp } from '../factories';
import { applyDamageFlash, createDeathExplosion, createFloatingText, notifyPlayerDamage } from '../effects';
import { applyGrowth } from './physics';

export const tryRevive = (entity: Player | Bot, state: GameState) => {
  if (!entity.reviveAvailable || entity.currentHealth > 0) return false;
  entity.reviveAvailable = false;
  entity.currentHealth = 1;
  entity.isDead = false;
  state.floatingTexts.push(createFloatingText(entity.position, 'SURVIVE!', '#fef08a', 18));
  return true;
};

export const applyProjectileEffect = (proj: Projectile, target: Player | Bot, state: GameState) => {
  if (target.statusEffects.shielded) {
    state.floatingTexts.push(createFloatingText(target.position, 'BLOCK', '#fde047', 18));
    for (let k = 0; k < 5; k++) state.particles.push(createParticle(proj.position.x, proj.position.y, '#fff', 5));

    const owner = state.player.id === proj.ownerId ? state.player : state.bots.find((b) => b.id === proj.ownerId);
    if (target.faction === Faction.Earth && target.tier === SizeTier.AncientKing && owner) {
      owner.statusEffects.poisonTimer = Math.max(owner.statusEffects.poisonTimer, 3);
      state.floatingTexts.push(createFloatingText(owner.position, 'REFLECT POISON!', '#84cc16', 16));
    }
    return;
  }

  const owner = state.player.id === proj.ownerId ? state.player : state.bots.find((b) => b.id === proj.ownerId);
  const isTargetKing = target.id === state.kingId;
  const isOwnerKing = owner?.id === state.kingId;
  const armorPen = owner ? owner.armorPen : 0;
  const effectiveDefense = Math.max(0.1, target.defense * target.statusEffects.defenseBoost * (1 - armorPen));
  let damageDealt = proj.damage / effectiveDefense;
  if (owner) damageDealt *= owner.statusEffects.damageBoost;

  if (owner) {
    // Trigger bloodline passive on hit
    const bloodlineId = (owner as any).bloodline;
    if (bloodlineId) {
      const context = { target, damage: damageDealt };
      triggerBloodlinePassive(owner, bloodlineId, 'on_hit', context);
    }

    const critRoll = owner.statusEffects.critCharges > 0 || Math.random() < owner.critChance;
    if (critRoll) {
      damageDealt *= owner.critMultiplier;
      if (owner.statusEffects.critCharges > 0) owner.statusEffects.critCharges -= 1;
      state.floatingTexts.push(createFloatingText(target.position, 'CRIT!', '#facc15', 14));
      vfxManager.triggerHitConfirm(target.position, damageDealt, true);
    } else {
      vfxManager.triggerHitConfirm(target.position, damageDealt, false);
    }
  }
  if (isTargetKing) damageDealt *= KING_DAMAGE_TAKEN_MULTIPLIER;
  if (isOwnerKing) damageDealt *= KING_DAMAGE_DEALT_MULTIPLIER;
  target.currentHealth -= damageDealt;
  applyDamageFlash(target, damageDealt);
  if (target.id === 'player' && damageDealt > 0.5) {
    notifyPlayerDamage(state, target.position, damageDealt);
  }
  target.statusEffects.stealthed = false;
  target.statusEffects.stealthCharge = 0;

  state.floatingTexts.push(createFloatingText(target.position, `-${Math.floor(damageDealt)}`, '#93c5fd', 18));
  for (let k = 0; k < 5; k++) state.particles.push(createParticle(target.position.x, target.position.y, proj.color));

  if (owner && owner.lifesteal > 0) {
    owner.currentHealth = Math.min(owner.maxHealth, owner.currentHealth + damageDealt * owner.lifesteal);
  }
  if (owner && target.reflectDamage > 0) {
    owner.currentHealth -= damageDealt * target.reflectDamage;
  }

  if (owner && owner.poisonOnHit) {
    target.statusEffects.poisonTimer = Math.max(target.statusEffects.poisonTimer, 3);
  }

  if (proj.type === 'ice') {
    target.statusEffects.slowTimer = Math.max(target.statusEffects.slowTimer, 3);
    target.statusEffects.slowMultiplier = Math.min(target.statusEffects.slowMultiplier, 0.5);
    state.floatingTexts.push(createFloatingText(target.position, 'SLOW', '#bae6fd', 16));
  } else if (proj.type === 'web') {
    target.velocity.x *= 0.1;
    target.velocity.y *= 0.1;
    state.floatingTexts.push(createFloatingText(target.position, 'ROOT', '#4ade80', 16));

    if (owner) {
      const pullAngle = Math.atan2(owner.position.y - target.position.y, owner.position.x - target.position.x);
      target.velocity.x += Math.cos(pullAngle) * 35;
      target.velocity.y += Math.sin(pullAngle) * 35;

      owner.statusEffects.regen += 20;
      owner.currentHealth = Math.min(owner.maxHealth, owner.currentHealth + 10);
      state.floatingTexts.push(createFloatingText(owner.position, '+HP', '#4ade80', 14));

      target.statusEffects.poisonTimer = Math.max(target.statusEffects.poisonTimer, 3);
    }
  }
};

export const consume = (predator: Player | Bot, prey: Player | Bot, state: GameState) => {
  if (prey.reviveAvailable) {
    prey.reviveAvailable = false;
    prey.currentHealth = 1;
    prey.isDead = false;
    state.floatingTexts.push(createFloatingText(prey.position, 'SURVIVE!', '#fef08a', 18));
    return;
  }
  prey.isDead = true;
  if ('aiState' in prey) {
    const bot = prey as Bot;
    if (!bot.isCreep && !bot.isBoss) {
      bot.respawnTimer = BOT_RESPAWN_TIME;
    }
  }
  createDeathExplosion(prey, state);
  let gain = prey.radius * KILL_GROWTH_MULTIPLIER * predator.killGrowthMultiplier;
  predator.kills++;
  predator.score += prey.radius * 10;
  predator.currentHealth = Math.min(predator.maxHealth, predator.currentHealth + 40);

  if (prey.id === state.kingId) {
    predator.score += KING_BOUNTY_SCORE;
    gain += KING_BOUNTY_RADIUS;
    state.floatingTexts.push(createFloatingText(predator.position, 'KING SLAYER!', '#f59e0b', 26));
  }
  applyGrowth(predator, gain);

  // Trigger bloodline passive on kill
  const bloodlineId = (predator as any).bloodline;
  if (bloodlineId) {
    const context = { victim: prey, gainedRadius: gain };
    triggerBloodlinePassive(predator, bloodlineId, 'on_kill', context);
  }

  if ((prey as Bot).isElite && !(predator as Bot).isCreep) {
    const allowed = state.unlockedMutations?.length ? new Set(state.unlockedMutations) : undefined;
    const choices = getMutationChoices(new Set(predator.mutations), predator.tier, 1, allowed);
    if (choices[0]) {
      applyMutation(predator, choices[0].id);
      state.floatingTexts.push(createFloatingText(predator.position, choices[0].name, '#60a5fa', 16));
    }
  }

  if ((prey as Bot).isBoss) {
    state.powerUps.push(createPowerUp('legendary_orb', { ...prey.position }));
  }

  state.floatingTexts.push(createFloatingText(predator.position, 'DEVOUR!', '#ef4444', 30));

  // VFX and Audio for kill
  vfxManager.triggerKillCelebration(prey.position, predator.faction, prey.radius);
  audioEngine.playKill(prey.position);

  if (predator.id === 'player') {
    state.shakeIntensity = 0.8;
    triggerHaptic('heavy');
  }
};

export const resolveCombat = (e1: Player | Bot, e2: Player | Bot, dt: number, state: GameState, c1: boolean, c2: boolean) => {
  const angle = Math.atan2(e2.position.y - e1.position.y, e2.position.x - e1.position.x);
  const pushForce = 12;
  e1.velocity.x -= Math.cos(angle) * pushForce;
  e1.velocity.y -= Math.sin(angle) * pushForce;
  e2.velocity.x += Math.cos(angle) * pushForce;
  e2.velocity.y += Math.sin(angle) * pushForce;

  const e1CountersE2 = ELEMENTAL_ADVANTAGE[e1.faction] === e2.faction;
  const e2CountersE1 = ELEMENTAL_ADVANTAGE[e2.faction] === e1.faction;
  const e1Shield = e1.statusEffects.shielded;
  const e2Shield = e2.statusEffects.shielded;

  const baseDmg = 5.0 * dt;
  const e1Defense = Math.max(0.1, e1.defense * e1.statusEffects.defenseBoost * (1 - e2.armorPen));
  const e2Defense = Math.max(0.1, e2.defense * e2.statusEffects.defenseBoost * (1 - e1.armorPen));
  const e1Attack = e1.damageMultiplier * e1.statusEffects.damageBoost;
  const e2Attack = e2.damageMultiplier * e2.statusEffects.damageBoost;

  let e1Dmg = baseDmg * (e2Attack / e1Defense);
  let e2Dmg = baseDmg * (e1Attack / e2Defense);

  if (e1.statusEffects.critCharges > 0 || Math.random() < e1.critChance) {
    e2Dmg *= e1.critMultiplier;
    if (e1.statusEffects.critCharges > 0) e1.statusEffects.critCharges -= 1;
    state.floatingTexts.push(createFloatingText(e2.position, 'CRIT!', '#facc15', 12));
    vfxManager.triggerHitConfirm(e2.position, e2Dmg, true);
  }
  if (e2.statusEffects.critCharges > 0 || Math.random() < e2.critChance) {
    e1Dmg *= e2.critMultiplier;
    if (e2.statusEffects.critCharges > 0) e2.statusEffects.critCharges -= 1;
    state.floatingTexts.push(createFloatingText(e1.position, 'CRIT!', '#facc15', 12));
    vfxManager.triggerHitConfirm(e1.position, e1Dmg, true);
  }

  if (e1CountersE2) e2Dmg *= 3;
  else if (e2CountersE1) e1Dmg *= 3;

  if (c1) e2Dmg += 20 * (1 / e2.defense);
  if (c2) e1Dmg += 20 * (1 / e1.defense);

  const e1IsKing = e1.id === state.kingId;
  const e2IsKing = e2.id === state.kingId;
  if (e1IsKing) {
    e1Dmg *= KING_DAMAGE_TAKEN_MULTIPLIER;
    e2Dmg *= KING_DAMAGE_DEALT_MULTIPLIER;
  }
  if (e2IsKing) {
    e2Dmg *= KING_DAMAGE_TAKEN_MULTIPLIER;
    e1Dmg *= KING_DAMAGE_DEALT_MULTIPLIER;
  }

  if (e1.statusEffects.invulnerable > 0) e1Dmg = 0;
  if (e2.statusEffects.invulnerable > 0) e2Dmg = 0;

  if (e1Shield) {
    e1Dmg = 0;
    if (e1.faction === Faction.Earth) {
      e2Dmg += 2 * e1.damageMultiplier;
      if (e1.tier === SizeTier.AncientKing && e2.statusEffects.poisonTimer <= 0) {
        e2.statusEffects.poisonTimer = 3;
        state.floatingTexts.push(createFloatingText(e2.position, 'POISONED!', '#84cc16', 16));
      }
    }
    if (Math.random() < 0.1) state.floatingTexts.push(createFloatingText(e1.position, 'BLOCK', '#fde047', 14));
  }
  if (e2Shield) {
    e2Dmg = 0;
    if (e2.faction === Faction.Earth) {
      e1Dmg += 2 * e2.damageMultiplier;
      if (e2.tier === SizeTier.AncientKing && e1.statusEffects.poisonTimer <= 0) {
        e1.statusEffects.poisonTimer = 3;
        state.floatingTexts.push(createFloatingText(e1.position, 'POISONED!', '#84cc16', 16));
      }
    }
    if (Math.random() < 0.1) state.floatingTexts.push(createFloatingText(e2.position, 'BLOCK', '#fde047', 14));
  }

  e1.currentHealth -= e1Dmg;
  e2.currentHealth -= e2Dmg;
  applyDamageFlash(e1, e1Dmg);
  applyDamageFlash(e2, e2Dmg);

  // Trigger bloodline passives on damage taken
  if (e1Dmg > 0) {
    const bloodlineId1 = (e1 as any).bloodline;
    if (bloodlineId1) {
      const context = { attacker: e2, damage: e1Dmg, isMelee: true };
      triggerBloodlinePassive(e1, bloodlineId1, 'on_damage_taken', context);
    }
  }
  if (e2Dmg > 0) {
    const bloodlineId2 = (e2 as any).bloodline;
    if (bloodlineId2) {
      const context = { attacker: e1, damage: e2Dmg, isMelee: true };
      triggerBloodlinePassive(e2, bloodlineId2, 'on_damage_taken', context);
    }
  }
  if (e1.id === 'player' && e1Dmg > 0.5) notifyPlayerDamage(state, e1.position, e1Dmg);
  if (e2.id === 'player' && e2Dmg > 0.5) notifyPlayerDamage(state, e2.position, e2Dmg);

  if (e1.faction === Faction.Fire) {
    e2.statusEffects.burnTimer = Math.max(e2.statusEffects.burnTimer, 3);
    e1.statusEffects.regen = Math.max(e1.statusEffects.regen, 2);
  }
  if (e2.faction === Faction.Fire) {
    e1.statusEffects.burnTimer = Math.max(e1.statusEffects.burnTimer, 3);
    e2.statusEffects.regen = Math.max(e2.statusEffects.regen, 2);
  }

  e1.statusEffects.stealthed = false;
  e2.statusEffects.stealthed = false;
  e1.statusEffects.stealthCharge = 0;
  e2.statusEffects.stealthCharge = 0;

  if (e1.lifesteal > 0) e1.currentHealth = Math.min(e1.maxHealth, e1.currentHealth + e2Dmg * e1.lifesteal);
  if (e2.lifesteal > 0) e2.currentHealth = Math.min(e2.maxHealth, e2.currentHealth + e1Dmg * e2.lifesteal);

  if (e2.reflectDamage > 0) e1.currentHealth -= e2Dmg * e2.reflectDamage;
  if (e1.reflectDamage > 0) e2.currentHealth -= e1Dmg * e1.reflectDamage;

  if (e1.poisonOnHit) e2.statusEffects.poisonTimer = Math.max(e2.statusEffects.poisonTimer, 3);
  if (e2.poisonOnHit) e1.statusEffects.poisonTimer = Math.max(e1.statusEffects.poisonTimer, 3);

  if (Math.random() < 0.1 && e1Dmg > 1) state.floatingTexts.push(createFloatingText(e1.position, Math.floor(e1Dmg).toString(), '#fff', 12));
  if (Math.random() < 0.1 && e2Dmg > 1) state.floatingTexts.push(createFloatingText(e2.position, Math.floor(e2Dmg).toString(), '#fff', 12));

  if (Math.random() > 0.3) state.particles.push(createParticle((e1.position.x + e2.position.x) / 2, (e1.position.y + e2.position.y) / 2, '#fff', 5));

  if (e1.currentHealth <= 0) consume(e2, e1, state);
  else if (e2.currentHealth <= 0) consume(e1, e2, state);
};
