
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
import { createFloatingText } from './effects';
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
import { assignRandomPersonality } from '../cjr/botPersonalities';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { tattooSynergyManager } from '../cjr/tattooSynergies';
import { resetContributionLog } from '../cjr/contribution';

import { updatePhysicsWorld } from './systems/physics';

// --- Main Game Loop ---
export const updateGameState = (state: GameState, dt: number): GameState => {
  if (state.isPaused) return state;

  const players = state.players?.length ? state.players : [state.player];
  if (!state.players?.length) {
    state.players = players;
  }
  if (players.length > 0 && state.player !== players[0]) {
    state.player = players[0];
  }

  // 1. Bind Engine Context & Grid Setup
  bindEngine(state.engine);
  const grid = getCurrentSpatialGrid();
  grid.clear();
  const indexer = state.engine.physicsWorld;

  // 1.5. SYNC ENTITIES TO PHYSICS WORLD (Hybrid Bridge)
  const syncList = [...players, ...state.bots]; // Only sync movers
  syncList.forEach(e => {
    let idx = indexer.idToIndex.get(e.id);
    if (idx === undefined) {
      // Register Layout
      // Calculate Mass for initial setup
      const r = e.radius;
      const m = r * r;
      idx = indexer.addBody(e.id, e.position.x, e.position.y, e.radius, m, true);
    }
    // Sync Velocity/Input from Logic
    indexer.velocities[idx * 2] = e.velocity.x;
    indexer.velocities[idx * 2 + 1] = e.velocity.y;
    indexer.radii[idx] = e.radius;
    indexer.positions[idx * 2] = e.position.x; // Strict Sync In case Logic moved it
    indexer.positions[idx * 2 + 1] = e.position.y;
  });

  // 2. RUN DOD PHYSICS
  updatePhysicsWorld(indexer, dt);

  // 3. SYNC BACK TO ENTITIES
  syncList.forEach(e => {
    const idx = indexer.idToIndex.get(e.id);
    if (idx !== undefined) {
      e.position.x = indexer.positions[idx * 2];
      e.position.y = indexer.positions[idx * 2 + 1];
      e.velocity.x = indexer.velocities[idx * 2];
      e.velocity.y = indexer.velocities[idx * 2 + 1];
    }
  });

  // 4. Game Time & Round Logic
  state.gameTime += dt;
  if (state.gameTime > state.levelConfig.timeLimit && !state.result) {
    state.result = 'lose';
    state.isPaused = true;
  }

  // 5. Batch Entity Insertion
  const allEntities = [...players, ...state.bots, ...state.food, ...state.projectiles];
  allEntities.forEach(entity => grid.insert(entity));

  // 6. LOGIC UPDATES
  players.forEach(player => updatePlayer(player, state, dt));
  state.bots.forEach(bot => updateBot(bot, state, dt));

  // ... Rest of Loop ...
  updateProjectiles(state, dt);

  // EIDOLON-V: Removed particle update loop (Client Side specific now)
  // updateParticles(state, dt);

  updateFloatingTexts(state, dt);
  cleanupTransientEntities(state);

  updateWaveSpawner(state, dt);
  players.forEach(player => updateRingLogic(player, dt, state.levelConfig, state));
  state.bots.forEach(b => updateRingLogic(b, dt, state.levelConfig, state));
  updateBossLogic(state, dt);
  updateWinCondition(state, dt, state.levelConfig);

  players.forEach(player => updateEmotion(player, dt));
  state.bots.forEach(b => updateEmotion(b, dt));
  updateCamera(state);

  checkTattooUnlock(state);
  vfxIntegrationManager.update(state, dt);

  players.forEach(player => tattooSynergyManager.checkSynergies(player, state));
  tattooSynergyManager.updateSynergies(state, dt);

  const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
  state.camera.x += shakeOffset.x;
  state.camera.y += shakeOffset.y;

  return state;
};

export const updateClientVisuals = (state: GameState, dt: number): void => {
  bindEngine(state.engine);
  // updateParticles(state, dt); // Removed
  updateFloatingTexts(state, dt);
  vfxIntegrationManager.update(state, dt);
  updateCamera(state);

  const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
  state.camera.x += shakeOffset.x;
  state.camera.y += shakeOffset.y;
};

const updatePlayer = (player: Player, state: GameState, dt: number) => {
  if (player.isDead) return;

  // Input Handling
  const activeInputs = player.inputs ?? state.inputs;
  handleInput(player, activeInputs, dt, state);

  // Physics
  applyPhysics(player, dt);
  constrainToMap(player, MAP_RADIUS);

  // Interaction
  const nearby = getCurrentSpatialGrid().getNearby(player, 300);
  checkCollisions(player, nearby, (other) => {
    handleCollision(player, other, state, dt);
  });

  // EIDOLON-V: OPTIMIZED MAGNET LOGIC (Spatial Grid Lookups)
  const catalystSense = player.tattoos.includes(TattooId.CatalystSense);
  const magnetRadius = player.magneticFieldRadius || 0;

  if (magnetRadius > 0 || catalystSense) {
    const catalystRange = (player.statusEffects.catalystSenseRange || 2.0) * 130;
    // Tìm bán kính quét lớn nhất
    const searchRadius = catalystSense ? Math.max(catalystRange, magnetRadius) : magnetRadius;
    const searchRadiusSq = searchRadius * searchRadius;
    const pullPower = 120 * dt;

    // CHÌA KHÓA: Chỉ lấy food trong lưới không gian gần player
    // Thay vì state.food.forEach (quét hàng nghìn item), ta chỉ quét vài chục item.
    const nearbyEntities = getCurrentSpatialGrid().getNearby(player, searchRadius);

    for (let i = 0; i < nearbyEntities.length; i++) {
      const entity = nearbyEntities[i];
      // Kiểm tra nhanh xem entity có phải là Food không (có thuộc tính 'value')
      if (!('value' in entity)) continue;

      const f = entity as unknown as any; // Cast về Food
      if (f.isDead) continue;

      // Logic lọc Catalyst Sense
      if (catalystSense && f.kind !== 'catalyst' && magnetRadius <= 0) continue;

      const dx = player.position.x - f.position.x;
      const dy = player.position.y - f.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < searchRadiusSq && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const factor = pullPower / dist; // Normalize force
        f.velocity.x += dx * factor;
        f.velocity.y += dy * factor;
      }
    }
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

  // Decay Streak
  if (player.streakTimer && player.streakTimer > 0) {
    player.streakTimer -= dt;
    if (player.streakTimer <= 0) {
      player.killStreak = 0;
      createFloatingText(player.position, 'Streak Lost', '#ccc', 16, state);
    }
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

const updateFloatingTexts = (state: GameState, dt: number) => {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const t = state.floatingTexts[i];
    t.life -= dt;
    t.position.x += t.velocity.x * dt;
    t.position.y += t.velocity.y * dt;
    if (t.life <= 0) {
      state.floatingTexts.splice(i, 1);
    }
  }
};

const cleanupTransientEntities = (state: GameState) => {
  if (state.food.length > 0) {
    state.food = state.food.filter(f => !f.isDead);
  }
  if (state.projectiles.length > 0) {
    state.projectiles = state.projectiles.filter(p => !p.isDead);
  }
};

const handleSpawning = (state: GameState, dt: number) => {
  // Respawn Bots
  const activeBots = state.bots.filter(b => !b.isDead).length;
  if (activeBots < BOT_COUNT) {
    // Logic to respawn random bot
    // Simplified
    const newBot = createBot(Math.random().toString());
    assignRandomPersonality(newBot);
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

  const runtime = {
    wave: {
      ring1: levelConfig.waveIntervals.ring1,
      ring2: levelConfig.waveIntervals.ring2,
      ring3: levelConfig.waveIntervals.ring3,
    },
    boss: {
      bossDefeated: false,
      rushWindowTimer: 0,
      rushWindowRing: null,
      currentBossActive: false,
      attackCharging: false,
      attackTarget: null,
      attackChargeTimer: 0,
    },
    contribution: {
      damageLog: new Map<string, number>(),
      lastHitBy: new Map<string, string>(),
    },
  };

  resetWaveTimers(runtime, levelConfig);
  resetBossState(runtime);
  resetContributionLog(runtime);
  tattooSynergyManager.reset();

  const initialFood = Math.max(50, levelConfig.burstSizes.ring1 * 8); // INCREASED FOR TESTING

  return {
    player,
    players: [player],
    bots: Array.from({ length: Math.max(levelConfig.botCount, 10) }, (_, i) => {
      const b = createBot(`${i}`);
      assignRandomPersonality(b);
      return b;
    }), // MINIMUM 10 BOTS
    creeps: [], // Deprecated
    boss: null,
    food: Array.from({ length: initialFood }, () => createFood()),
    particles: [],
    projectiles: [],
    floatingTexts: [],
    delayedActions: [],
    engine,
    runtime,
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
    vfxEvents: [],
    inputs: { space: false, w: false },
  };
};
