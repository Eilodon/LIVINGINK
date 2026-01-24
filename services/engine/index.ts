
import {
  BOT_COUNT,
  BOT_RESPAWN_TIME,
  CENTER_RADIUS,
  FOOD_COUNT,
  GAME_DURATION,
  GRID_CELL_SIZE,
  MAP_RADIUS,
  RELIC_RADIUS,
  RELIC_RESPAWN_TIME,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MUTATION_CHOICES,
} from '../../constants';
import {
  Bot,
  Entity,
  FloatingText,
  Food,
  GamePhase,
  GameState,
  Particle,
  Player,
  Projectile,
  Vector2,
} from '../../types';
import { mixPigment, calcMatchPercent } from '../cjr/colorMath';
import { bindEngine, createGameEngine, GameEngine, getCurrentSpatialGrid } from './context';
import {
  createBoss,
  createBot,
  createFood,
  createParticle,
  createPlayer,
  createProjectile,
} from './factories';
import { distance, normalize, randomRange } from './math';
import { updateAI } from './systems/ai';
import { applyProjectileEffect, resolveCombat, consumePickup } from './systems/combat';
import { applyPhysics, checkCollisions, constrainToMap } from './systems/physics';
import { applySkill } from './systems/skills';
import { updateRingLogic } from '../cjr/ringSystem';
import { updateWaveSpawner, resetWaveTimers } from '../cjr/waveSpawner';
import { updateWinCondition } from '../cjr/winCondition';
import { updateBossLogic, resetBossState } from '../cjr/bossCjr';
import { updateEmotion } from '../cjr/emotions';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { tattooSynergyManager } from '../cjr/tattooSynergies';

// --- Main Game Loop ---
export const updateGameState = (state: GameState, dt: number): GameState => {
  if (state.isPaused) return state;

  // 1. Bind Engine Context & Grid Setup
  bindEngine(state.engine);
  const grid = getCurrentSpatialGrid();
  grid.clear();

  // 2. Game Time & Round Logic
  state.gameTime += dt;
  if (state.gameTime > state.levelConfig.timeLimit && !state.result) {
    state.result = 'lose';
    state.isPaused = true;
  }

  // 3. Batch Entity Insertion
  const allEntities = [state.player, ...state.bots, ...state.food, ...state.projectiles];
  allEntities.forEach(entity => grid.insert(entity));

  // 4. BATCHED ENTITY UPDATES (Player + Bots)
  updatePlayer(state.player, state, dt);
  state.bots.forEach(bot => updateBot(bot, state, dt));

  // 5. BATCHED PROJECTILE & PARTICLE UPDATES
  updateProjectiles(state, dt);
  updateParticles(state, dt);

  // 6. BATCHED CJR SYSTEMS (Wave + Ring + Boss + Win)
  updateWaveSpawner(state, dt);
  updateRingLogic(state.player, dt, state.levelConfig, state);
  state.bots.forEach(b => updateRingLogic(b, dt, state.levelConfig, state));
  updateBossLogic(state, dt);
  updateWinCondition(state, dt, state.levelConfig);

  // 7. BATCHED EMOTION UPDATES (merged with camera)
  if (state.player) updateEmotion(state.player, dt);
  state.bots.forEach(b => updateEmotion(b, dt));
  updateCamera(state);

  // 8. Tattoo Unlock Check (only when needed)
  checkTattooUnlock(state);

  // 9. VFX System Updates (Premium Game Juice)
  vfxIntegrationManager.update(state, dt);

  // 10. Tattoo Synergy System Updates (Gameplay Depth)
  tattooSynergyManager.checkSynergies(state.player, state);
  tattooSynergyManager.updateSynergies(state, dt);

  // 11. Apply screen shake to camera
  const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
  state.camera.x += shakeOffset.x;
  state.camera.y += shakeOffset.y;

  return state;
};

const updatePlayer = (player: Player, state: GameState, dt: number) => {
  if (player.isDead) return;

  // Input Handling
  handleInput(player, state.inputs, dt, state);

  // Physics
  applyPhysics(player, dt);
  constrainToMap(player, MAP_RADIUS);

  // Interaction
  const nearby = getCurrentSpatialGrid().getNearby(player, 300);
  checkCollisions(player, nearby, (other) => {
    handleCollision(player, other, state, dt);
  });

  const catalystSense = player.tattoos.includes(TattooId.CatalystSense);
  const magnetRadius = player.magneticFieldRadius || 0;
  if (magnetRadius > 0 || catalystSense) {
    const catalystRange = (player.statusEffects.catalystSenseRange || 2.0) * 130; // Base 130, scaled
    const radius = catalystSense ? catalystRange : magnetRadius;
    state.food.forEach(f => {
      if (f.isDead) return;
      if (catalystSense && f.kind !== 'catalyst') return;
      const dx = player.position.x - f.position.x;
      const dy = player.position.y - f.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius && dist > 1) {
        const pull = 120 * dt;
        f.velocity.x += (dx / dist) * pull;
        f.velocity.y += (dy / dist) * pull;
      }
    });
  }

  // Regen / Decay
  if (player.currentHealth < player.maxHealth) {
    player.currentHealth += player.statusEffects.regen * dt;
  }

  player.lastEatTime += dt;
  player.lastHitTime += dt;

  if (player.skillCooldown > 0) {
    player.skillCooldown = Math.max(0, player.skillCooldown - dt * player.skillCooldownMultiplier);
  }

  // Decay status effect timers
  if (player.statusEffects.commitShield && player.statusEffects.commitShield > 0) {
    player.statusEffects.commitShield -= dt;
    if (player.statusEffects.commitShield <= 0) {
      player.statusEffects.shielded = false;
    }
  }
  if (player.statusEffects.tempSpeedTimer > 0) {
    player.statusEffects.tempSpeedTimer -= dt;
    if (player.statusEffects.tempSpeedTimer <= 0) {
      player.statusEffects.tempSpeedBoost = 1;
    }
  }
  if (player.statusEffects.colorBoostTimer && player.statusEffects.colorBoostTimer > 0) {
    player.statusEffects.colorBoostTimer -= dt;
    if (player.statusEffects.colorBoostTimer <= 0) {
      player.statusEffects.colorBoostMultiplier = 1;
    }
  }
  if (player.statusEffects.pityBoost && player.statusEffects.pityBoost > 0) {
    player.statusEffects.pityBoost -= dt;
  }
  if (player.statusEffects.overdriveTimer && player.statusEffects.overdriveTimer > 0) {
    player.statusEffects.overdriveTimer -= dt;
  }
  if (player.statusEffects.magnetTimer && player.statusEffects.magnetTimer > 0) {
    player.statusEffects.magnetTimer -= dt;
    if (player.statusEffects.magnetTimer <= 0) {
      player.magneticFieldRadius = 0;
    }
  }
  if (player.statusEffects.invulnerable && player.statusEffects.invulnerable > 0) {
    player.statusEffects.invulnerable -= dt;
  }
};

const updateBot = (bot: Bot, state: GameState, dt: number) => {
  if (bot.isDead) return;

  // AI Logic
  updateAI(bot, state, dt);

  // Physics
  applyPhysics(bot, dt);
  constrainToMap(bot, MAP_RADIUS);

  // Interaction
  const nearby = getCurrentSpatialGrid().getNearby(bot, 250);
  checkCollisions(bot, nearby, (other) => {
    handleCollision(bot, other, state, dt);
  });

  bot.lastEatTime += dt;
  bot.lastHitTime += dt;

  if (bot.skillCooldown > 0) {
    bot.skillCooldown = Math.max(0, bot.skillCooldown - dt * bot.skillCooldownMultiplier);
  }
  if (bot.statusEffects.tempSpeedTimer > 0) {
    bot.statusEffects.tempSpeedTimer -= dt;
    if (bot.statusEffects.tempSpeedTimer <= 0) {
      bot.statusEffects.tempSpeedBoost = 1;
    }
  }
  if (bot.statusEffects.colorBoostTimer && bot.statusEffects.colorBoostTimer > 0) {
    bot.statusEffects.colorBoostTimer -= dt;
    if (bot.statusEffects.colorBoostTimer <= 0) {
      bot.statusEffects.colorBoostMultiplier = 1;
    }
  }
  if (bot.statusEffects.overdriveTimer && bot.statusEffects.overdriveTimer > 0) {
    bot.statusEffects.overdriveTimer -= dt;
  }
  if (bot.statusEffects.magnetTimer && bot.statusEffects.magnetTimer > 0) {
    bot.statusEffects.magnetTimer -= dt;
    if (bot.statusEffects.magnetTimer <= 0) {
      bot.magneticFieldRadius = 0;
    }
  }
  if (bot.statusEffects.invulnerable && bot.statusEffects.invulnerable > 0) {
    bot.statusEffects.invulnerable -= dt;
  }
};

const handleInput = (player: Player, inputs: { space: boolean; w: boolean }, dt: number, state: GameState) => {
  // Movement vector is set by UI/Mouse elsewhere (player.targetPosition)
  // Here we just process actions like Space (Dash/Split in original, Skill in new)

  if (inputs.space) {
    // Trigger Skill
    applySkill(player, undefined, state);
  }

  // W for Eject? (Maybe keep for team play later)
};

const handleCollision = (entity: Player | Bot, other: Entity, state: GameState, dt: number) => {
  if (other === entity) return;
  if (entity.isDead || other.isDead) return;

  // 1. Food (Pickups)
  if ('value' in other) { // Is Food
    const food = other as Food;
    const dist = distance(entity.position, food.position);
    if (dist < entity.radius + food.radius) {
      // Eat
      consumePickup(entity, food, state);
    }
    return;
  }

  // 2. Projectile
  if ('ownerId' in other && 'damage' in other) {
    // Handled in updateProjectiles usually, or here if we want instant impact
    return;
  }

  // 3. Other Unit (Combat)
  // Check types to be safe
  const isUnit = (e: any): e is Player | Bot => 'score' in e;
  if (isUnit(other)) {
    resolveCombat(entity, other, dt, state, true, true);
  }
};



const updateProjectiles = (state: GameState, dt: number) => {
  state.projectiles.forEach(p => {
    if (p.isDead) return;

    p.duration -= dt;
    if (p.duration <= 0) {
      p.isDead = true;
      return;
    }

    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;

    // Collision logic could be here or in generic collision
    const nearby = getCurrentSpatialGrid().getNearby(p, 150);
    nearby.forEach(other => {
      if (other.id !== p.ownerId && ('score' in other)) { // Hit a unit
        const unit = other as Player | Bot;
        const dist = distance(p.position, unit.position);
        if (dist < p.radius + unit.radius) {
          applyProjectileEffect(p, unit, state);
          p.isDead = true;
        }
      }
    });
  });
};

const updateParticles = (state: GameState, dt: number) => {
  const engine = state.engine;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    if (p.life <= 0) {
      engine.particlePool.release(p); // Return to pool
      state.particles.splice(i, 1);
    }
  }
};

const handleSpawning = (state: GameState, dt: number) => {
  // Respawn Bots
  const activeBots = state.bots.filter(b => !b.isDead).length;
  if (activeBots < BOT_COUNT) {
    // Logic to respawn random bot
    // Simplified
    const newBot = createBot(Math.random().toString());
    state.bots.push(newBot);
  }

  // Respawn Food
  const activeFood = state.food.filter(f => !f.isDead).length;
  if (activeFood < FOOD_COUNT) {
    state.food.push(createFood());
  }
};

const updateCamera = (state: GameState) => {
  if (state.player && !state.player.isDead) {
    // Lerp camera to player
    state.camera.x += (state.player.position.x - state.camera.x) * 0.1;
    state.camera.y += (state.player.position.y - state.camera.y) * 0.1;
  }
};

const TATTOO_UNLOCK_RADII = [45, 70, 100];

const checkTattooUnlock = (state: GameState) => {
  if (state.tattooChoices || state.result) return;
  const idx = state.player.tattoos.length;
  if (idx >= TATTOO_UNLOCK_RADII.length) return;
  if (state.player.radius >= TATTOO_UNLOCK_RADII[idx]) {
    state.tattooChoices = getTattooChoices(MUTATION_CHOICES);
    state.isPaused = true;
  }
};

// Initial State Factory
export const createInitialState = (level: number = 1): GameState => {
  const engine = createGameEngine();
  bindEngine(engine);

  const player = createPlayer("Hero");
  const levelConfig = getLevelConfig(level);

  resetWaveTimers(levelConfig);
  resetBossState();

  const initialFood = Math.max(30, levelConfig.burstSizes.ring1 * 5);

  return {
    player,
    bots: Array.from({ length: levelConfig.botCount }, (_, i) => createBot(`${i}`)),
    creeps: [], // Deprecated
    boss: null,
    food: Array.from({ length: initialFood }, () => createFood()),
    particles: [],
    projectiles: [],
    floatingTexts: [],
    delayedActions: [],
    engine,
    worldSize: { x: WORLD_WIDTH, y: WORLD_HEIGHT },
    zoneRadius: MAP_RADIUS,
    gameTime: 0,
    currentRound: 1,
    camera: { x: 0, y: 0 },
    shakeIntensity: 0,
    kingId: null,
    level,
    levelConfig,
    tattooChoices: null,
    unlockedTattoos: [],
    isPaused: false,
    result: null,
    inputs: { space: false, w: false },
  };
};
