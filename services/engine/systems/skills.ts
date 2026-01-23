import {
  LIGHTNING_RADIUS,
  LIGHTNING_WARNING_TIME,
} from '../../../constants';
import { FACTION_CONFIG } from '../../../constants';
import { Bot, DelayedAction, Faction, GameState, MutationId, Player, SizeTier } from '../../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { triggerHaptic } from '../../haptics';
import { createHazard, createParticle, createProjectile } from '../factories';
import { applyDamageFlash, createFloatingText, createLineParticle, createRingParticle, notifyPlayerDamage } from '../effects';
import { distSq, randomRange } from '../math';
import { getCurrentSpatialGrid } from '../context';

const performDash = (caster: Player | Bot, state: GameState) => {
  const angle = Math.atan2(caster.velocity.y, caster.velocity.x);
  const dashPower = 30 * caster.skillDashMultiplier;
  caster.velocity.x += Math.cos(angle) * dashPower;
  caster.velocity.y += Math.sin(angle) * dashPower;
  caster.statusEffects.speedBoost = 2.5;

  for (let j = 0; j < 10; j++) {
    state.particles.push(createParticle(caster.position.x, caster.position.y, '#e2e8f0', 8));
  }

  const neighbors = getCurrentSpatialGrid().getNearby(caster);
  neighbors.forEach((e) => {
    if ('faction' in e && e.id !== caster.id && !e.isDead && distSq(caster.position, e.position) < (caster.radius * 2) ** 2) {
      const victim = e as Player | Bot;
      const damage = 10 * caster.skillPowerMultiplier;
      victim.currentHealth -= damage;
      applyDamageFlash(victim, damage);
      if (victim.id === 'player') notifyPlayerDamage(state, victim.position, damage);
      state.floatingTexts.push(createFloatingText(victim.position, `-${Math.floor(damage)}`, '#3b82f6', 16));
    }
  });
};

export const executeDelayedAction = (action: DelayedAction, state: GameState) => {
  const caster = action.ownerId === 'player' ? state.player : state.bots.find((b) => b.id === action.ownerId);
  if (!caster || caster.isDead) return;

  if (action.type === 'metal_dash') {
    performDash(caster, state);
    audioEngine.playSkill(caster.position);
  } else if (action.type === 'water_shot') {
    const { angleOffset } = action.data;
    const currentAngle = Math.atan2(caster.velocity.y, caster.velocity.x);
    const finalAngle = currentAngle + angleOffset;

    const iceProj = createProjectile(caster, 'ice');
    const speed = 20;
    iceProj.velocity = { x: Math.cos(finalAngle) * speed, y: Math.sin(finalAngle) * speed };
    state.projectiles.push(iceProj);
  } else if (action.type === 'fire_land') {
    caster.statusEffects.airborne = false;
    state.particles.push(createParticle(caster.position.x, caster.position.y, '#f97316', 15));

    const impactRadius = caster.radius * 3 * caster.skillDashMultiplier;

    const neighbors = getCurrentSpatialGrid().getNearby(caster);
    neighbors.forEach((e) => {
      if ('faction' in e && e.id !== caster.id && !e.isDead && distSq(caster.position, e.position) < impactRadius ** 2) {
        const victim = e as Player | Bot;
        const damage = (25 * caster.damageMultiplier * caster.skillPowerMultiplier) / victim.defense;
        victim.currentHealth -= damage;
        victim.statusEffects.burnTimer = Math.max(victim.statusEffects.burnTimer, 3);
        applyDamageFlash(victim, damage);
        if (victim.id === 'player') notifyPlayerDamage(state, victim.position, damage);

        const pushAngle = Math.atan2(victim.position.y - caster.position.y, victim.position.x - caster.position.x);
        victim.velocity.x += Math.cos(pushAngle) * 30;
        victim.velocity.y += Math.sin(pushAngle) * 30;

        state.floatingTexts.push(createFloatingText(victim.position, `-${Math.floor(damage)}`, '#ef4444', 20));
      }
    });

    if (!state.lavaZones) state.lavaZones = [];
    state.lavaZones.push({
      id: Math.random().toString(),
      position: { ...caster.position },
      radius: caster.radius * 2 * caster.skillDashMultiplier,
      damage: 20 * caster.damageMultiplier * caster.skillPowerMultiplier,
      ownerId: caster.id,
      life: 5.0,
    });

    if (caster.id === 'player') state.shakeIntensity = 1.0;
  } else if (action.type === 'double_cast') {
    castSkill(caster, state, 0, true);
  }
};

const spawnSkillTelegraph = (caster: Player | Bot, state: GameState) => {
  const config = FACTION_CONFIG[caster.faction];
  const baseRadius = caster.radius * 1.1;
  const x = caster.position.x;
  const y = caster.position.y;

  if (caster.faction === Faction.Metal) {
    const angle = Math.atan2(caster.velocity.y, caster.velocity.x);
    state.particles.push(createRingParticle(x, y, config.secondary, baseRadius * 0.9, 0.45, 2));
    for (let i = -1; i <= 1; i++) {
      state.particles.push(createLineParticle(x, y, '#e2e8f0', baseRadius * 1.8, angle + i * 0.25, 0.5, 2));
    }
    return;
  }

  if (caster.faction === Faction.Fire) {
    state.particles.push(createRingParticle(x, y, '#f97316', baseRadius * 1.2, 0.55, 3));
    for (let i = 0; i < 6; i++) {
      const p = createParticle(x + randomRange(-baseRadius * 0.3, baseRadius * 0.3), y + randomRange(-baseRadius * 0.3, baseRadius * 0.3), '#fdba74', 0);
      p.radius = Math.max(2, caster.radius * 0.1);
      p.life = 0.5;
      p.maxLife = p.life;
      state.particles.push(p);
    }
    return;
  }

  if (caster.faction === Faction.Wood) {
    state.particles.push(createRingParticle(x, y, config.secondary, baseRadius * 1.3, 0.6, 3));
    return;
  }

  if (caster.faction === Faction.Water) {
    state.particles.push(createRingParticle(x, y, '#bae6fd', baseRadius * 1.2, 0.6, 3));
    for (let i = 0; i < 5; i++) {
      const p = createParticle(x + randomRange(-baseRadius * 0.4, baseRadius * 0.4), y + randomRange(-baseRadius * 0.4, baseRadius * 0.4), '#e0f2fe', 0);
      p.radius = Math.max(2, caster.radius * 0.08);
      p.life = 0.5;
      p.maxLife = p.life;
      state.particles.push(p);
    }
    return;
  }

  if (caster.faction === Faction.Earth) {
    state.particles.push(createRingParticle(x, y, config.secondary, baseRadius * 1.25, 0.6, 4));
  }
};

export const castSkill = (caster: Player | Bot, state: GameState, dt: number, triggeredByDouble: boolean = false) => {
  if (!triggeredByDouble) {
    caster.skillCooldown = Math.max(0.5, caster.maxSkillCooldown * caster.skillCooldownMultiplier);
    audioEngine.playSkill(caster.position);
    if (caster.id === 'player') triggerHaptic('medium');
    state.floatingTexts.push(createFloatingText(caster.position, 'SKILL!', '#fbbf24', 24));
    spawnSkillTelegraph(caster, state);
  }

  if (!state.delayedActions) state.delayedActions = [];

  if (!triggeredByDouble && caster.doubleCast) {
    state.delayedActions.push({ id: Math.random().toString(), type: 'double_cast', timer: 0.25, ownerId: caster.id });
  }

  if (!triggeredByDouble && caster.mutations.includes(MutationId.SpeedSurge) && caster.mutationCooldowns.speedSurge <= 0) {
    caster.statusEffects.speedSurge = 5;
    caster.mutationCooldowns.speedSurge = 30;
  }

  if (!triggeredByDouble && caster.mutations.includes(MutationId.Invulnerable) && caster.mutationCooldowns.invulnerable <= 0) {
    caster.statusEffects.invulnerable = 3;
    caster.mutationCooldowns.invulnerable = 30;
  }

  if (!triggeredByDouble && caster.mutations.includes(MutationId.KingForm) && caster.mutationCooldowns.kingForm <= 0) {
    caster.statusEffects.kingForm = 15;
    caster.statusEffects.damageBoost = Math.max(caster.statusEffects.damageBoost, 1.3);
    caster.statusEffects.defenseBoost = Math.max(caster.statusEffects.defenseBoost, 1.2);
    caster.statusEffects.damageBoostTimer = Math.max(caster.statusEffects.damageBoostTimer, 15);
    caster.statusEffects.defenseBoostTimer = Math.max(caster.statusEffects.defenseBoostTimer, 15);
    caster.mutationCooldowns.kingForm = 40;
  }

  if (!triggeredByDouble && caster.mutations.includes(MutationId.ChaosSwap) && caster.mutationCooldowns.chaos <= 0) {
    const targets = [state.player, ...state.bots].filter((t) => t.id !== caster.id && !t.isDead);
    if (targets.length) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const tmp = caster.radius;
      caster.radius = target.radius;
      target.radius = tmp;
      state.floatingTexts.push(createFloatingText(caster.position, 'SWAP!', '#f59e0b', 18));
    }
    caster.mutationCooldowns.chaos = 25;
  }

  if (!triggeredByDouble && caster.mutations.includes(MutationId.ThunderCall) && caster.mutationCooldowns.lightning <= 0) {
    const targets = [state.player, ...state.bots].filter((t) => t.id !== caster.id && !t.isDead);
    const nearest = targets.sort((a, b) => distSq(a.position, caster.position) - distSq(b.position, caster.position)).slice(0, 3);
    nearest.forEach((target) => {
      state.hazards.push(createHazard('lightning', { ...target.position }, LIGHTNING_RADIUS, LIGHTNING_WARNING_TIME, 0.4));
    });
    caster.mutationCooldowns.lightning = 25;
  }

  switch (caster.faction) {
    case Faction.Metal:
      performDash(caster, state);
      if (caster.tier === SizeTier.AncientKing) {
        state.delayedActions.push({ id: Math.random().toString(), type: 'metal_dash', timer: 0.2, ownerId: caster.id });
        state.delayedActions.push({ id: Math.random().toString(), type: 'metal_dash', timer: 0.4, ownerId: caster.id });
      }
      break;

    case Faction.Wood: {
      const web = createProjectile(caster, 'web');
      state.projectiles.push(web);
      break;
    }

    case Faction.Water:
      state.projectiles.push(createProjectile(caster, 'ice'));
      state.delayedActions.push({ id: Math.random().toString(), type: 'water_shot', timer: 0.1, ownerId: caster.id, data: { angleOffset: -0.3 } });
      state.delayedActions.push({ id: Math.random().toString(), type: 'water_shot', timer: 0.2, ownerId: caster.id, data: { angleOffset: 0.3 } });
      break;

    case Faction.Earth:
      caster.statusEffects.shieldTimer = Math.max(caster.statusEffects.shieldTimer, 3);
      for (let i = 0; i < 15; i++) state.particles.push(createParticle(caster.position.x, caster.position.y, '#fde047', 10));
      break;

    case Faction.Fire:
      caster.statusEffects.airborne = true;
      state.floatingTexts.push(createFloatingText(caster.position, 'JUMP!', '#ea580c', 20));
      state.delayedActions.push({ id: Math.random().toString(), type: 'fire_land', timer: 0.6, ownerId: caster.id });
      break;
  }
};
