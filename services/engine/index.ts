import {
  BOSS_RESPAWN_TIME,
  BOT_RESPAWN_TIME,
  CENTER_RADIUS,
  CREEPS_PER_ZONE,
  DUST_STORM_DURATION,
  DUST_STORM_INTERVAL,
  EJECT_MASS_COST,
  EJECT_SPEED,
  ELITE_RESPAWN_TIME,
  FOOD_COUNT,
  FOOD_GROWTH_MULTIPLIER,
  GEYSER_DAMAGE,
  GEYSER_INTERVAL,
  GEYSER_WARNING_TIME,
  ICICLE_DAMAGE,
  ICICLE_INTERVAL,
  ICICLE_WARNING_TIME,
  INITIAL_ZONE_RADIUS,
  LIGHTNING_DAMAGE_FINAL,
  LIGHTNING_DAMAGE_INSIDE,
  LIGHTNING_DAMAGE_OUTSIDE,
  LIGHTNING_INTERVAL_ROUND_2,
  LIGHTNING_INTERVAL_ROUND_3,
  LIGHTNING_INTERVAL_ROUND_4,
  LIGHTNING_RADIUS,
  LIGHTNING_WARNING_TIME,
  MUTATION_CHOICES,
  PLAYER_START_RADIUS,
  RELIC_GROWTH,
  RELIC_HEAL,
  RELIC_REGEN,
  RELIC_RESPAWN_TIME,
  RELIC_VALUE,
  SPEAR_COOLDOWN,
  SPEAR_DAMAGE,
  THIN_ICE_DURATION,
  THIN_ICE_SLOW_MULTIPLIER,
  VINES_DURATION,
  VINES_SLOW_MULTIPLIER,
  WIND_SPEED_MULTIPLIER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  SPAWN_PROTECTION_TIME,
  MUSHROOM_COOLDOWN,
  MAX_ENTITY_RADIUS,
} from '../../constants';
import {
  Bot,
  Faction,
  GameState,
  MutationId,
  Player,
  PowerUp,
} from '../../types';
import { audioEngine } from '../audio/AudioEngine';
import { vfxManager } from '../vfx/VFXManager';
import { getSizeInteraction } from '../combatRules';
import { applyMutation, getMutationChoices } from '../mutations';
import { checkForLegendaryEvolution, applyLegendaryEvolution } from '../legendaryEvolutions';
import { triggerBloodlinePassive } from '../bloodlines';
import { bindEngine, createGameEngine, GameEngine, getCurrentSpatialGrid } from './context';
import {
  createBoss,
  createBot,
  createCreep,
  createCreeps,
  createFood,
  createHazard,
  createLandmarks,
  createParticle,
  createPlayer,
  createPowerUp,
  createProjectile,
  createRelic,
  createZoneHazards,
} from './factories';
import { applyDamageFlash, createFloatingText, notifyPlayerDamage } from './effects';
import { distSq, getZoneFromPosition, normalize, randomPosInZone, randomRange } from './math';
import { updateBotAI, updateBossAI, updateCreepAI } from './systems/ai';
import { applyProjectileEffect, consume, resolveCombat, tryRevive } from './systems/combat';
import { applyGrowth, applyPhysics, updateTier } from './systems/physics';
import { applyPowerUpEffect } from './systems/powerups';
import { castSkill, executeDelayedAction } from './systems/skills';

export { createGameEngine, GameEngine } from './context';
export {
  createBoss,
  createBot,
  createCreep,
  createCreeps,
  createFood,
  createLandmarks,
  createParticle,
  createPlayer,
  createPowerUp,
  createProjectile,
  createRelic,
  createZoneHazards,
} from './factories';

const spawnEliteCreeps = (state: GameState) => {
  const eliteTypes: Array<{ faction: Faction; type: string }> = [
    { faction: Faction.Fire, type: 'salamander' },
    { faction: Faction.Wood, type: 'frog' },
    { faction: Faction.Water, type: 'slime' },
    { faction: Faction.Metal, type: 'hornet' },
    { faction: Faction.Earth, type: 'crab' },
  ];

  eliteTypes.forEach((entry) => {
    state.creeps.push(
      createCreep(`elite-${entry.type}-${Math.random().toString(36).slice(2, 6)}`, entry.faction, entry.type, true, state.gameTime)
    );
  });
};

const updateZoneRadius = (gameTime: number): number => {
  if (gameTime < 150) {
    return INITIAL_ZONE_RADIUS;
  } else if (gameTime < 300) {
    const progress = (gameTime - 150) / 150;
    return INITIAL_ZONE_RADIUS * (1 - progress * 0.4);
  } else if (gameTime < 450) {
    const progress = (gameTime - 300) / 150;
    return INITIAL_ZONE_RADIUS * 0.6 * (1 - progress * 0.5);
  } else {
    const progress = Math.min(1, (gameTime - 450) / 30);
    return Math.max(CENTER_RADIUS, INITIAL_ZONE_RADIUS * 0.3 * (1 - progress));
  }
};

const respawnBot = (bot: Bot, state: GameState) => {
  const baseId = bot.id.replace('bot-', '');
  const fresh = createBot(baseId, state.gameTime);
  const targetRadius = Math.min(MAX_ENTITY_RADIUS * 0.95, Math.max(PLAYER_START_RADIUS, state.player.radius * 0.9));
  const sizeScale = Math.max(1, targetRadius / PLAYER_START_RADIUS);
  const healthScale = Math.min(1.6, 0.9 + sizeScale * 0.2);

  Object.assign(bot, fresh, {
    radius: targetRadius,
    maxHealth: fresh.maxHealth * healthScale,
    currentHealth: fresh.maxHealth * healthScale,
    respawnTimer: 0,
  });
};

// --- Main Game Loop ---
export const updateGameState = (state: GameState, dt: number): GameState => {
  const newState = state; // MUTATING STATE DIRECTLY FOR PERFORMANCE (React is decoupled now)

  // Bind current engine for helper functions
  bindEngine(newState.engine as GameEngine);

  if (newState.isPaused) return newState;

  const allowedMutations = newState.unlockedMutations?.length ? new Set(newState.unlockedMutations) : undefined;

  newState.gameTime += dt;

  const clearSpawnInvuln = (entity: Player | Bot) => {
    if (entity.isInvulnerable && newState.gameTime - entity.spawnTime > SPAWN_PROTECTION_TIME) {
      entity.isInvulnerable = false;
    }
  };
  clearSpawnInvuln(newState.player);
  newState.bots.forEach(clearSpawnInvuln);

  // Decay Screen Shake
  if (newState.shakeIntensity > 0) newState.shakeIntensity *= 0.9;
  if (newState.shakeIntensity < 0.5) newState.shakeIntensity = 0;

  // --- Round Logic ---
  const previousRound = newState.currentRound;
  let newRound = 1;
  if (newState.gameTime >= 450) newRound = 4;
  else if (newState.gameTime >= 300) newRound = 3;
  else if (newState.gameTime >= 150) newRound = 2;

  newState.currentRound = newRound;

  if (newRound > previousRound) {
    audioEngine.playWarning();
    audioEngine.setBGMIntensity(newRound);
    vfxManager.triggerRoundChange(newRound);
    newState.shakeIntensity = 1.0;
    let roundText = '';
    if (newRound === 2) roundText = 'BO ROUND 1: TOXIC SPREADING!';
    if (newRound === 3) roundText = 'BO ROUND 2: MAP SHRINKING!';
    if (newRound === 4) roundText = 'SUDDEN DEATH: SURVIVE!';

    newState.floatingTexts.push({
      id: Math.random().toString(),
      position: { ...newState.player.position, y: newState.player.position.y - 100 },
      text: roundText,
      color: '#ef4444',
      size: 32,
      life: 4.0,
      velocity: { x: 0, y: -2 },
    });

    if (newRound >= 2) {
      spawnEliteCreeps(newState);
    }
  }

  newState.zoneRadius = updateZoneRadius(newState.gameTime);

  const hazardTimers = newState.hazardTimers;
  if (hazardTimers) {
    const lightningInterval =
      newState.currentRound >= 4
        ? LIGHTNING_INTERVAL_ROUND_4
        : newState.currentRound >= 3
          ? LIGHTNING_INTERVAL_ROUND_3
          : LIGHTNING_INTERVAL_ROUND_2;

    hazardTimers.lightning -= dt;
    if (hazardTimers.lightning <= 0) {
      const targetEntities = [newState.player, ...newState.bots].filter((e) => !e.isDead);
      if (targetEntities.length) {
        const totalWeight = targetEntities.reduce((sum, e) => sum + e.radius, 0);
        let roll = Math.random() * totalWeight;
        let target = targetEntities[0];
        for (const entity of targetEntities) {
          roll -= entity.radius;
          if (roll <= 0) {
            target = entity;
            break;
          }
        }
        const strikePos = { ...target.position };
        newState.hazards.push(createHazard('lightning', strikePos, LIGHTNING_RADIUS, LIGHTNING_WARNING_TIME, 0.4));
      }
      hazardTimers.lightning = lightningInterval;
    }

    hazardTimers.geyser -= dt;
    if (hazardTimers.geyser <= 0) {
      newState.hazards.push(createHazard('geyser', randomPosInZone(Faction.Fire), 60, GEYSER_WARNING_TIME, 0.4));
      hazardTimers.geyser = GEYSER_INTERVAL;
    }

    hazardTimers.icicle -= dt;
    if (hazardTimers.icicle <= 0) {
      newState.hazards.push(createHazard('icicle', randomPosInZone(Faction.Water), 60, ICICLE_WARNING_TIME, 0.4));
      hazardTimers.icicle = ICICLE_INTERVAL;
    }

    if (hazardTimers.dustStormActive) {
      hazardTimers.dustStorm -= dt;
      if (hazardTimers.dustStorm <= 0) {
        hazardTimers.dustStormActive = false;
        hazardTimers.dustStorm = DUST_STORM_INTERVAL;
      }
    } else {
      hazardTimers.dustStorm -= dt;
      if (hazardTimers.dustStorm <= 0) {
        hazardTimers.dustStormActive = true;
        hazardTimers.dustStorm = DUST_STORM_DURATION;
      }
    }

    hazardTimers.powerUpFire -= dt;
    if (hazardTimers.powerUpFire <= 0) {
      newState.powerUps.push(createPowerUp('fire_orb', randomPosInZone(Faction.Fire)));
      hazardTimers.powerUpFire = 30;
    }
    hazardTimers.powerUpWood -= dt;
    if (hazardTimers.powerUpWood <= 0) {
      newState.powerUps.push(createPowerUp('healing', randomPosInZone(Faction.Wood)));
      hazardTimers.powerUpWood = 28;
    }
    hazardTimers.powerUpWater -= dt;
    if (hazardTimers.powerUpWater <= 0) {
      newState.powerUps.push(createPowerUp('ice_heart', randomPosInZone(Faction.Water)));
      hazardTimers.powerUpWater = 32;
    }
    hazardTimers.powerUpMetal -= dt;
    if (hazardTimers.powerUpMetal <= 0) {
      newState.powerUps.push(createPowerUp('sword_aura', randomPosInZone(Faction.Metal)));
      hazardTimers.powerUpMetal = 30;
    }
    hazardTimers.powerUpEarth -= dt;
    if (hazardTimers.powerUpEarth <= 0) {
      newState.powerUps.push(createPowerUp('diamond_shield', randomPosInZone(Faction.Earth)));
      hazardTimers.powerUpEarth = 34;
    }

    if (!newState.boss || newState.boss.isDead) {
      hazardTimers.bossRespawn -= dt;
      if (hazardTimers.bossRespawn <= 0) {
        newState.boss = createBoss(newState.gameTime);
        hazardTimers.bossRespawn = BOSS_RESPAWN_TIME;
      }
    }

    hazardTimers.creepRespawn -= dt;
    if (hazardTimers.creepRespawn <= 0) {
      const creepTypes: Array<{ faction: Faction; type: string }> = [
        { faction: Faction.Fire, type: 'salamander' },
        { faction: Faction.Wood, type: 'frog' },
        { faction: Faction.Water, type: 'slime' },
        { faction: Faction.Metal, type: 'hornet' },
        { faction: Faction.Earth, type: 'crab' },
      ];
      if (newState.creeps.length < CREEPS_PER_ZONE * 6) {
        const pick = creepTypes[Math.floor(Math.random() * creepTypes.length)];
        newState.creeps.push(createCreep(`${pick.type}-${Math.random().toString(36).slice(2, 6)}`, pick.faction, pick.type, false, newState.gameTime));
      }
      hazardTimers.creepRespawn = ELITE_RESPAWN_TIME;
    }
  }

  newState.landmarks.forEach((landmark) => {
    if (landmark.type === 'wood_tree') {
      landmark.timer -= dt;
      if (landmark.timer <= 0) {
        newState.powerUps.push(createPowerUp('healing_fruit', { x: landmark.position.x + randomRange(-40, 40), y: landmark.position.y + randomRange(-40, 40) }));
        landmark.timer = 15;
      }
    }
  });

  // --- Relic Objective ---
  if (newState.relicId) {
    const relicExists = newState.food.some((f) => f.id === newState.relicId && !f.isDead);
    if (!relicExists) newState.relicId = null;
  }
  if (!newState.relicId) {
    newState.relicTimer -= dt;
    if (newState.relicTimer <= 0) {
      const relic = createRelic();
      newState.food.push(relic);
      newState.relicId = relic.id;
      newState.relicTimer = RELIC_RESPAWN_TIME;
      newState.floatingTexts.push(createFloatingText(relic.position, 'ANCIENT RELIC!', '#facc15', 24));
    }
  }

  // --- Process Delayed Actions (Skills) ---
  for (let i = newState.delayedActions.length - 1; i >= 0; i--) {
    const action = newState.delayedActions[i];
    action.timer -= dt;
    if (action.timer <= 0) {
      executeDelayedAction(action, newState);
      newState.delayedActions.splice(i, 1);
    }
  }

  // --- King Logic ---
  const allEntities = [newState.player, ...newState.bots].filter((e) => !e.isDead);
  let maxR = 0;
  let newKingId = null;
  allEntities.forEach((e) => {
    if (e.radius > maxR) {
      maxR = e.radius;
      newKingId = e.id;
    }
  });
  newState.kingId = newKingId;

  // --- 1. Player Abilities ---
  if (state.inputs.w && newState.player.radius > PLAYER_START_RADIUS + EJECT_MASS_COST) {
    newState.player.radius -= EJECT_MASS_COST * 0.5;
    const dir = normalize(newState.player.velocity);
    if (dir.x === 0 && dir.y === 0) dir.x = 1;

    const food = createFood(
      {
        x: newState.player.position.x + dir.x * (newState.player.radius + 15),
        y: newState.player.position.y + dir.y * (newState.player.radius + 15),
      },
      true
    );

    // Recoil
    newState.player.velocity.x -= dir.x * 2;
    newState.player.velocity.y -= dir.y * 2;

    food.velocity = { x: dir.x * EJECT_SPEED, y: dir.y * EJECT_SPEED };
    newState.food.push(food);
    audioEngine.playEject(newState.player.position);
    state.inputs.w = false;
  }

  if (state.inputs.space && newState.player.skillCooldown <= 0) {
    castSkill(newState.player, newState, dt);
    state.inputs.space = false;
  }

  // --- 2. Update Entities ---
  const entities = [newState.player, ...newState.bots, ...newState.creeps];
  if (newState.boss) entities.push(newState.boss);

  const spatialGrid = getCurrentSpatialGrid();
  spatialGrid.clear();
  newState.food.forEach((f) => spatialGrid.insert(f));
  newState.powerUps.forEach((p) => spatialGrid.insert(p));
  entities.forEach((e) => !e.isDead && spatialGrid.insert(e));

  // --- Hazards Update (Telegraphed Impacts) ---
  newState.hazards.forEach((hazard) => {
    if (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle') {
      if (hazard.timer > 0) {
        hazard.timer -= dt;
      } else if (hazard.active) {
        entities.forEach((target) => {
          if (target.isDead || target.statusEffects.airborne) return;
          const dSq = distSq(target.position, hazard.position);
          if (dSq <= hazard.radius * hazard.radius) {
            let damage = 0;
            if (hazard.type === 'lightning') {
              const outOfZone = distSq(target.position, { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }) > newState.zoneRadius * newState.zoneRadius;
              const dmgRatio =
                newState.currentRound >= 4
                  ? LIGHTNING_DAMAGE_FINAL
                  : outOfZone
                    ? LIGHTNING_DAMAGE_OUTSIDE
                    : LIGHTNING_DAMAGE_INSIDE;
              damage = target.maxHealth * dmgRatio;
            }
            if (hazard.type === 'geyser') {
              damage = GEYSER_DAMAGE;
              if (target.faction === Faction.Metal) damage *= 1.6;
            }
            if (hazard.type === 'icicle') damage = ICICLE_DAMAGE;

            if (!target.isInvulnerable && target.statusEffects.invulnerable <= 0) {
              target.currentHealth -= damage;
              target.statusEffects.invulnerable = 1.0;
              applyDamageFlash(target, damage);
              if (target.id === 'player' && damage >= 2) {
                notifyPlayerDamage(newState, target.position, damage);
              }
              if (hazard.type === 'icicle') {
                target.statusEffects.slowTimer = Math.max(target.statusEffects.slowTimer, THIN_ICE_DURATION);
                target.statusEffects.slowMultiplier = Math.min(target.statusEffects.slowMultiplier, THIN_ICE_SLOW_MULTIPLIER);
              }
            }
          }
        });
        hazard.active = false;
        hazard.duration = 0.4;
      } else if (hazard.duration > 0) {
        hazard.duration -= dt;
      }
    }

    if (hazard.type === 'spear' && hazard.timer > 0) {
      hazard.timer -= dt;
    }
  });

  newState.hazards = newState.hazards.filter((hazard) => {
    if (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle') {
      return hazard.active || hazard.timer > 0 || hazard.duration > 0;
    }
    return true;
  });

  entities.forEach((entity) => {
    if (entity.isDead) return;

    const currentZone = getZoneFromPosition(entity.position);

    // Status Effects Update
    if (entity.statusEffects.invulnerable > 0) entity.statusEffects.invulnerable -= dt;
    if (entity.statusEffects.invulnerable < 0) entity.statusEffects.invulnerable = 0;

    if (entity.statusEffects.damageFlash > 0) {
      entity.statusEffects.damageFlash = Math.max(0, entity.statusEffects.damageFlash - dt * 6);
    }

    if (entity.statusEffects.rooted > 0) entity.statusEffects.rooted -= dt;
    if (entity.statusEffects.rooted < 0) entity.statusEffects.rooted = 0;

    if (entity.statusEffects.speedSurge > 0) {
      entity.statusEffects.speedSurge -= dt;
      if (entity.statusEffects.speedSurge < 0) entity.statusEffects.speedSurge = 0;
    }

    if (entity.statusEffects.kingForm > 0) {
      entity.statusEffects.kingForm -= dt;
      if (entity.statusEffects.kingForm < 0) entity.statusEffects.kingForm = 0;
    }

    if (entity.statusEffects.damageBoostTimer > 0) {
      entity.statusEffects.damageBoostTimer -= dt;
      if (entity.statusEffects.damageBoostTimer <= 0) {
        entity.statusEffects.damageBoost = 1;
        entity.statusEffects.damageBoostTimer = 0;
      }
    }

    if (entity.statusEffects.defenseBoostTimer > 0) {
      entity.statusEffects.defenseBoostTimer -= dt;
      if (entity.statusEffects.defenseBoostTimer <= 0) {
        entity.statusEffects.defenseBoost = 1;
        entity.statusEffects.defenseBoostTimer = 0;
      }
    }

    if (entity.statusEffects.visionBoostTimer > 0) {
      entity.statusEffects.visionBoostTimer -= dt;
      if (entity.statusEffects.visionBoostTimer <= 0) {
        entity.statusEffects.visionBoost = 1;
        entity.statusEffects.visionBoostTimer = 0;
      }
    }

    if (entity.statusEffects.shieldTimer > 0) {
      entity.statusEffects.shielded = true;
      entity.statusEffects.shieldTimer -= dt;
      if (entity.statusEffects.shieldTimer <= 0) {
        entity.statusEffects.shielded = false;
        entity.statusEffects.shieldTimer = 0;
      }
    }

    if (entity.statusEffects.speedBoostTimer > 0) {
      entity.statusEffects.speedBoostTimer -= dt;
      if (entity.statusEffects.speedBoostTimer <= 0) {
        entity.statusEffects.speedBoost = 1;
        entity.statusEffects.speedBoostTimer = 0;
      }
    } else if (entity.statusEffects.speedBoost > 1) {
      entity.statusEffects.speedBoost -= dt * 2.0;
      if (entity.statusEffects.speedBoost < 1) entity.statusEffects.speedBoost = 1;
      if (entity.faction === Faction.Metal) {
        newState.particles.push(createParticle(entity.position.x, entity.position.y, '#94a3b8', 5));
      }
    } else if (entity.statusEffects.speedBoost < 1) {
      entity.statusEffects.speedBoost = 1;
    }

    if (entity.statusEffects.slowTimer > 0) {
      entity.statusEffects.slowed = true;
      entity.statusEffects.slowTimer -= dt;
      if (entity.statusEffects.slowTimer <= 0) {
        entity.statusEffects.slowed = false;
        entity.statusEffects.slowTimer = 0;
        entity.statusEffects.slowMultiplier = 1;
      }
    }

    if (entity.statusEffects.poisonTimer > 0) {
      entity.statusEffects.poisoned = true;
      entity.currentHealth -= 3 * dt;
      entity.statusEffects.poisonTimer -= dt;
      if (Math.random() < 0.1) newState.floatingTexts.push(createFloatingText(entity.position, '☠', '#84cc16', 12));
      if (entity.statusEffects.poisonTimer <= 0) {
        entity.statusEffects.poisoned = false;
        entity.statusEffects.poisonTimer = 0;
      }
    }

    if (entity.statusEffects.burnTimer > 0) {
      entity.statusEffects.burning = true;
      entity.currentHealth -= 5 * dt;
      entity.statusEffects.burnTimer -= dt;
      if (Math.random() < 0.1) newState.floatingTexts.push(createFloatingText(entity.position, '🔥', '#f97316', 12));
      if (entity.statusEffects.burnTimer <= 0) {
        entity.statusEffects.burning = false;
        entity.statusEffects.burnTimer = 0;
      }
    }

    if (entity.statusEffects.regen > 0) {
      entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + entity.statusEffects.regen * dt);
      entity.statusEffects.regen -= dt * 2;
      if (entity.statusEffects.regen < 0) entity.statusEffects.regen = 0;
    }

    const speedNow = Math.sqrt(entity.velocity.x * entity.velocity.x + entity.velocity.y * entity.velocity.y);
    if (speedNow < 0.2) entity.stationaryTime += dt;
    else entity.stationaryTime = 0;

    if (entity.skillCooldown > 0) {
      entity.skillCooldown -= dt;
      if (entity.skillCooldown < 0) entity.skillCooldown = 0;
    }
    if (entity.mutations.includes(MutationId.Stealth)) {
      if (speedNow < 0.2) {
        entity.statusEffects.stealthCharge += dt;
        if (entity.statusEffects.stealthCharge >= 3) entity.statusEffects.stealthed = true;
      } else {
        entity.statusEffects.stealthed = false;
        entity.statusEffects.stealthCharge = 0;
      }
    } else {
      entity.statusEffects.stealthed = false;
      entity.statusEffects.stealthCharge = 0;
    }

    if (entity.mutationCooldowns.speedSurge > 0) entity.mutationCooldowns.speedSurge -= dt;
    if (entity.mutationCooldowns.invulnerable > 0) entity.mutationCooldowns.invulnerable -= dt;
    if (entity.mutationCooldowns.rewind > 0) entity.mutationCooldowns.rewind -= dt;
    if (entity.mutationCooldowns.lightning > 0) entity.mutationCooldowns.lightning -= dt;
    if (entity.mutationCooldowns.chaos > 0) entity.mutationCooldowns.chaos -= dt;
    if (entity.mutationCooldowns.kingForm > 0) entity.mutationCooldowns.kingForm -= dt;

    if (entity.mutations.includes(MutationId.Rewind)) {
      entity.rewindHistory.push({ position: { ...entity.position }, health: entity.currentHealth, time: newState.gameTime });
      entity.rewindHistory = entity.rewindHistory.filter((entry) => newState.gameTime - entry.time <= 5);
      if (entity.currentHealth <= entity.maxHealth * 0.3 && entity.mutationCooldowns.rewind <= 0 && entity.rewindHistory.length) {
        const snapshot = entity.rewindHistory[0];
        entity.position = { ...snapshot.position };
        entity.currentHealth = Math.max(entity.currentHealth, snapshot.health);
        entity.statusEffects.invulnerable = 1.2;
        entity.mutationCooldowns.rewind = 30;
        newState.floatingTexts.push(createFloatingText(entity.position, 'REWIND!', '#a855f7', 18));
      }
    } else {
      entity.rewindHistory = [];
    }

    if (entity.id === 'player') {
      applyPhysics(entity, entity.targetPosition, dt, currentZone, newState);
    } else if ((entity as Bot).isBoss) {
      updateBossAI(entity as Bot, newState, dt, currentZone);
    } else if ((entity as Bot).isCreep) {
      updateCreepAI(entity as Bot, newState, dt, currentZone);
    } else {
      updateBotAI(entity as Bot, newState, dt, currentZone);
    }

    const tierUp = updateTier(entity as Player);
    if (tierUp && entity.id === 'player') {
      // Trigger evolution VFX and audio
      const fromTier = entity.tier === SizeTier.Juvenile ? SizeTier.Larva :
        entity.tier === SizeTier.Adult ? SizeTier.Juvenile :
          entity.tier === SizeTier.Elder ? SizeTier.Adult :
            SizeTier.Elder;
      vfxManager.triggerEvolutionTransform(entity.position, fromTier, entity.tier, entity.faction);
      audioEngine.playEvolution();

      if (!newState.mutationChoices) {
        const owned = new Set(entity.mutations);
        newState.mutationChoices = getMutationChoices(owned, entity.tier, MUTATION_CHOICES, allowedMutations);
        newState.isPaused = true;
      }
    } else if (tierUp && !(entity as Bot).isCreep && !(entity as Bot).isBoss) {
      const owned = new Set(entity.mutations);
      const choices = getMutationChoices(owned, entity.tier, 1, allowedMutations);
      if (choices[0]) applyMutation(entity, choices[0].id);
    }

    // Check for legendary evolution after tier up
    if (tierUp && entity.id === 'player') {
      const legendaryEvolution = checkForLegendaryEvolution(entity);
      if (legendaryEvolution) {
        applyLegendaryEvolution(entity, legendaryEvolution.id);
        // Legendary VFX is triggered inside applyLegendaryEvolution
      }
    }

    // Trigger passive bloodline abilities (continuous effects)
    const bloodlineId = (entity as any).bloodline;
    if (bloodlineId) {
      triggerBloodlinePassive(entity, bloodlineId, 'passive', {});

      // Check low HP passive
      if (entity.currentHealth / entity.maxHealth < 0.3) {
        triggerBloodlinePassive(entity, bloodlineId, 'on_low_hp', {});
      }
    }

    // --- ZONE HAZARDS & BUFFS ---
    if (currentZone === Faction.Fire) {
      if (entity.faction !== Faction.Fire) {
        if (!entity.isInvulnerable && !entity.statusEffects.airborne) {
          const fireDamage = entity.faction === Faction.Water ? 16 : 8;
          entity.currentHealth -= (fireDamage / entity.defense) * dt;
          if (Math.random() < 0.1) newState.particles.push(createParticle(entity.position.x, entity.position.y, '#f97316', 3));
        }
      } else {
        if (entity.currentHealth < entity.maxHealth) entity.currentHealth += 5 * dt;
      }
    }
    if (currentZone === Faction.Wood) {
      if (entity.faction === Faction.Wood && entity.currentHealth < entity.maxHealth) entity.currentHealth += 6 * dt;
      if (entity.faction === Faction.Wood && entity.stationaryTime > 1.5) entity.statusEffects.regen = Math.max(entity.statusEffects.regen, 4);
    }
    if (currentZone === Faction.Water && entity.faction === Faction.Water) {
      if (entity.currentHealth < entity.maxHealth) entity.currentHealth += 2 * dt;
    }

    if (currentZone === Faction.Earth && entity.faction !== Faction.Earth) {
      const crumbleThreshold = entity.faction === Faction.Wood ? 1.2 : 2;
      if (entity.stationaryTime > crumbleThreshold) {
        entity.currentHealth -= 10;
        entity.stationaryTime = 0;
        newState.floatingTexts.push(createFloatingText(entity.position, '-10', '#f97316', 14));
      }
    }

    if (entity.teleportCooldown > 0) entity.teleportCooldown -= dt;
    if (entity.landmarkCooldown > 0) entity.landmarkCooldown -= dt;

    newState.hazards.forEach((hazard) => {
      const dSq = distSq(entity.position, hazard.position);
      if (dSq > hazard.radius * hazard.radius) return;

      if (hazard.type === 'vines' && entity.faction !== Faction.Wood) {
        entity.statusEffects.slowTimer = Math.max(entity.statusEffects.slowTimer, VINES_DURATION);
        entity.statusEffects.slowMultiplier = Math.min(entity.statusEffects.slowMultiplier, VINES_SLOW_MULTIPLIER);
      }
      if (hazard.type === 'thin_ice' && entity.faction !== Faction.Water) {
        entity.statusEffects.slowTimer = Math.max(entity.statusEffects.slowTimer, THIN_ICE_DURATION);
        entity.statusEffects.slowMultiplier = Math.min(entity.statusEffects.slowMultiplier, THIN_ICE_SLOW_MULTIPLIER);
      }
      if (hazard.type === 'wind') {
        const windBoost = entity.faction === Faction.Metal ? Math.max(WIND_SPEED_MULTIPLIER, 2) : WIND_SPEED_MULTIPLIER;
        entity.statusEffects.speedBoost = Math.max(entity.statusEffects.speedBoost, windBoost);
        entity.statusEffects.speedBoostTimer = Math.max(entity.statusEffects.speedBoostTimer, 0.3);
        if (hazard.direction) {
          const push = 20 * dt;
          entity.velocity.x += hazard.direction.x * push;
          entity.velocity.y += hazard.direction.y * push;
        }
      }
      if (hazard.type === 'mushroom' && entity.teleportCooldown <= 0) {
        entity.position = randomPosInZone(Faction.Wood);
        entity.teleportCooldown = MUSHROOM_COOLDOWN;
        newState.floatingTexts.push(createFloatingText(entity.position, 'WARP!', '#a855f7', 16));
      }
      if (hazard.type === 'spear' && hazard.timer <= 0 && entity.faction !== Faction.Metal) {
        entity.currentHealth -= SPEAR_DAMAGE;
        hazard.timer = SPEAR_COOLDOWN;
        newState.floatingTexts.push(createFloatingText(entity.position, `-${SPEAR_DAMAGE}`, '#f97316', 14));
      }
    });

    newState.landmarks.forEach((landmark) => {
      const inLandmark = distSq(entity.position, landmark.position) <= landmark.radius * landmark.radius;
      if (!inLandmark) {
        if (entity.landmarkId === landmark.id) {
          entity.landmarkId = null;
          entity.landmarkCharge = 0;
        }
        return;
      }

      if (landmark.type === 'fire_furnace') {
        entity.statusEffects.damageBoost = Math.max(entity.statusEffects.damageBoost, 1.1);
        entity.statusEffects.damageBoostTimer = Math.max(entity.statusEffects.damageBoostTimer, 0.6);
      }

      if (landmark.type === 'wood_tree') {
        entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + 3 * dt);
      }

      if (landmark.type === 'water_statue') {
        if (entity.landmarkId !== landmark.id) {
          entity.landmarkId = landmark.id;
          entity.landmarkCharge = 0;
        }
        entity.landmarkCharge += dt;
        if (entity.landmarkCharge >= 3) {
          entity.statusEffects.shieldTimer = Math.max(entity.statusEffects.shieldTimer, 3);
          entity.landmarkCharge = 0;
        }
      }

      if (landmark.type === 'metal_altar' && entity.landmarkCooldown <= 0 && entity.stationaryTime > 2) {
        entity.statusEffects.damageBoost = Math.max(entity.statusEffects.damageBoost, 1.2);
        entity.statusEffects.damageBoostTimer = Math.max(entity.statusEffects.damageBoostTimer, 15);
        entity.statusEffects.rooted = Math.max(entity.statusEffects.rooted, 2);
        entity.landmarkCooldown = 10;
      }

      if (landmark.type === 'earth_pyramid' && entity.landmarkCooldown <= 0 && entity.stationaryTime > 2) {
        entity.statusEffects.visionBoost = Math.max(entity.statusEffects.visionBoost, 2);
        entity.statusEffects.visionBoostTimer = Math.max(entity.statusEffects.visionBoostTimer, 10);
        entity.statusEffects.speedBoost = Math.min(entity.statusEffects.speedBoost, 0.7);
        entity.statusEffects.speedBoostTimer = Math.max(entity.statusEffects.speedBoostTimer, 3);
        entity.landmarkCooldown = 12;
      }
    });

    if (entity.magneticFieldRadius > 0) {
      const neighbors = spatialGrid.getNearby(entity);
      neighbors.forEach((neighbor) => {
        if (!('faction' in neighbor) || neighbor.id === entity.id) return;
        const other = neighbor as Player | Bot;
        if (other.isDead) return;
        const dSq = distSq(entity.position, other.position);
        if (dSq < entity.magneticFieldRadius * entity.magneticFieldRadius && other.radius < entity.radius * 0.9) {
          const angle = Math.atan2(other.position.y - entity.position.y, other.position.x - entity.position.x);
          other.velocity.x += Math.cos(angle) * 8;
          other.velocity.y += Math.sin(angle) * 8;
        }
      });
    }

    const distCenterSq = Math.pow(entity.position.x - WORLD_WIDTH / 2, 2) + Math.pow(entity.position.y - WORLD_HEIGHT / 2, 2);
    if (distCenterSq > newState.zoneRadius * newState.zoneRadius) {
      const zoneDamage = newState.currentRound >= 4 ? 20 : newState.currentRound >= 3 ? 12 : newState.currentRound >= 2 ? 8 : 5;
      entity.currentHealth -= zoneDamage * dt;
      if (entity.currentHealth <= 0) entity.isDead = true;
    } else {
      if (entity.currentHealth < entity.maxHealth) {
        entity.currentHealth += 1 * dt;
      }
    }
  });

  // --- 2.5 Lava Zones ---
  if (!newState.lavaZones) newState.lavaZones = [];
  for (let i = newState.lavaZones.length - 1; i >= 0; i--) {
    const zone = newState.lavaZones[i];
    zone.life -= dt;

    // Lava Damage
    entities.forEach((e) => {
      if (!e.isDead && !e.statusEffects.airborne && e.id !== zone.ownerId && distSq(e.position, zone.position) < zone.radius * zone.radius) {
        e.currentHealth -= zone.damage * dt;
        if (!e.statusEffects.burning) e.statusEffects.burning = true;
      }
    });

    if (zone.life <= 0) newState.lavaZones.splice(i, 1);
  }

  // --- 3. Projectiles ---
  newState.projectiles.forEach((proj) => {
    proj.position.x += proj.velocity.x * dt * 10;
    proj.position.y += proj.velocity.y * dt * 10;
    proj.duration -= dt;
    if (proj.duration <= 0) proj.isDead = true;

    newState.particles.push(createParticle(proj.position.x, proj.position.y, proj.color, 2));

    entities.forEach((target) => {
      if (target.id === proj.ownerId || target.isDead || target.isInvulnerable || target.statusEffects.airborne || target.statusEffects.invulnerable > 0) return;
      const dSq = distSq(proj.position, target.position);
      if (dSq < target.radius * target.radius) {
        proj.isDead = true;
        applyProjectileEffect(proj, target, newState);
      }
    });
  });
  newState.projectiles = newState.projectiles.filter((p) => !p.isDead);

  // --- 4. Collision & Consumption (OPTIMIZED) ---
  entities.forEach((entity) => {
    if (entity.isDead || entity.statusEffects.airborne) return;
    const rSq = entity.radius * entity.radius;

    const neighbors = spatialGrid.getNearby(entity);

    for (const neighbor of neighbors) {
      if (neighbor.id === entity.id) continue;
      if (neighbor.isDead) continue;

      if ('value' in neighbor) {
        const f = neighbor as any;
        if (f.isDead) continue;

        if (f.isEjected) {
          f.position.x += f.velocity.x * dt * 10;
          f.position.y += f.velocity.y * dt * 10;
          f.velocity.x *= 0.9;
          f.velocity.y *= 0.9;
        }

        const dSq = distSq(entity.position, f.position);
        if (dSq < rSq) {
          f.isDead = true;
          if (f.kind === 'relic') {
            applyGrowth(entity, RELIC_GROWTH);
            entity.score += RELIC_VALUE * 2;
            entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + RELIC_HEAL);
            entity.statusEffects.regen += RELIC_REGEN;
            newState.floatingTexts.push(createFloatingText(entity.position, 'RELIC!', '#facc15', 24));
            newState.relicId = null;
          } else {
            const growth = f.value * FOOD_GROWTH_MULTIPLIER;
            applyGrowth(entity, growth);
            entity.score += f.value;
            if (entity.id === 'player') audioEngine.playEat(entity.position);
            if (f.value > 2) newState.floatingTexts.push(createFloatingText(entity.position, `+${f.value}`, '#4ade80', 16));
          }
        }
      } else if ('type' in neighbor && !('faction' in neighbor)) {
        const powerUp = neighbor as PowerUp;
        if (powerUp.isDead) continue;
        const dSq = distSq(entity.position, powerUp.position);
        if (dSq < rSq) {
          powerUp.isDead = true;
          applyPowerUpEffect(entity, powerUp, newState);
        }
      } else if ('faction' in neighbor) {
        const other = neighbor as Player | Bot;
        if (other.isDead || other.isInvulnerable || other.statusEffects.airborne || other.statusEffects.invulnerable > 0) continue;
        if (entity.isInvulnerable || entity.statusEffects.invulnerable > 0) continue;

        const dSq = distSq(entity.position, other.position);
        const minDist = entity.radius + other.radius;

        if (dSq < minDist * minDist * 0.9) {
          const ratio = entity.radius / other.radius;
          const charging = entity.faction === Faction.Metal && entity.statusEffects.speedBoost > 1.5;
          const otherCharging = other.faction === Faction.Metal && other.statusEffects.speedBoost > 1.5;

          const interaction = getSizeInteraction(ratio, entity.statusEffects.shielded, other.statusEffects.shielded, charging, otherCharging);

          if (interaction === 'consume') {
            consume(entity, other, newState);
          } else if (interaction === 'avoid') {
            // handled by other loop
          } else {
            resolveCombat(entity, other, dt, newState, charging, otherCharging);
          }
        }
      }
    }
  });

  entities.forEach((entity) => {
    if (!entity.isDead && entity.currentHealth <= 0) {
      if (!tryRevive(entity, newState)) entity.isDead = true;
    }
  });

  newState.bots.forEach((bot) => {
    if (!bot.isDead) return;
    if (bot.respawnTimer === undefined || bot.respawnTimer <= 0) {
      bot.respawnTimer = BOT_RESPAWN_TIME;
    }
    bot.respawnTimer -= dt;
    if (bot.respawnTimer <= 0) {
      respawnBot(bot, newState);
    }
  });

  // Cleanup dead food efficiently
  let writeIdx = 0;
  for (let i = 0; i < newState.food.length; i++) {
    if (!newState.food[i].isDead) {
      newState.food[writeIdx++] = newState.food[i];
    }
  }
  newState.food.length = writeIdx;

  while (newState.food.length < FOOD_COUNT) {
    newState.food.push(createFood());
  }

  newState.powerUps = newState.powerUps.filter((p) => !p.isDead);
  newState.creeps = newState.creeps.filter((c) => !c.isDead);
  if (newState.boss && newState.boss.isDead) newState.boss = null;

  // --- 5. Polish (Particles & Text) ---
  for (let i = newState.particles.length - 1; i >= 0; i--) {
    const p = newState.particles[i];
    p.position.x += p.velocity.x;
    p.position.y += p.velocity.y;
    p.life -= 0.05;
    if (p.life <= 0) {
      p.isDead = true;
      newState.engine.particlePool.release(p);
      newState.particles.splice(i, 1);
    }
  }

  newState.floatingTexts.forEach((t) => {
    t.position.x += t.velocity.x;
    t.position.y += t.velocity.y;
    t.life -= 0.02;
  });
  newState.floatingTexts = newState.floatingTexts.filter((t) => t.life > 0);

  // Camera Logic (Smoother & Faster Tracking)
  if (!newState.player.isDead) {
    const camSpeed = 0.1; // Slower camera for control
    const lookAheadX = newState.player.velocity.x * 18;
    const lookAheadY = newState.player.velocity.y * 18;

    const shakeX = (Math.random() - 0.5) * newState.shakeIntensity * 20;
    const shakeY = (Math.random() - 0.5) * newState.shakeIntensity * 20;

    const targetCamX = newState.player.position.x + lookAheadX;
    const targetCamY = newState.player.position.y + lookAheadY;

    newState.camera.x = newState.camera.x * (1 - camSpeed) + targetCamX * camSpeed + shakeX;
    newState.camera.y = newState.camera.y * (1 - camSpeed) + targetCamY * camSpeed + shakeY;
  }

  return newState;
};
