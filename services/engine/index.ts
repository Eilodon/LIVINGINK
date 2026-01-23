
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
import { updateWaveSpawner } from '../cjr/waveSpawner';
import { updateWinCondition } from '../cjr/winCondition';
import { updateBossLogic } from '../cjr/bossCjr';
import { updateEmotion } from '../cjr/emotions';
import { updateDynamicBounty } from '../cjr/dynamicBounty';

// --- Main Game Loop ---
export const updateGameState = (state: GameState, dt: number): GameState => {
  if (state.isPaused) return state;

  // 1. Bind Engine Context
  bindEngine(state.engine);
  const grid = getCurrentSpatialGrid();
  grid.clear();

  // 2. Game Time & Round Logic
  state.gameTime += dt;
  if (state.gameTime > GAME_DURATION) {
    // Basic timeout win/loss
  }

  // 3. Insert Entities into Grid
  grid.insert(state.player);
  state.bots.forEach(b => grid.insert(b));
  state.food.forEach(f => grid.insert(f));
  state.projectiles.forEach(p => grid.insert(p));

  // 4. Update Player
  updatePlayer(state.player, state, dt);

  // 5. Update Bots
  state.bots.forEach(bot => {
    updateBot(bot, state, dt);
  });

  // 6. Update Projectiles
  updateProjectiles(state, dt);

  // 7. Update Particles
  updateParticles(state, dt);

  // 8. Respawn Logic (Replaced by Wave Spawner)
  // handleSpawning(state, dt); // Legacy
  updateWaveSpawner(state, dt); // CJR

  // 9. Camera Follow
  updateCamera(state);

  // 10. Ring Logic (Check every frame or slower?)
  // Frame is fine for physics
  updateRingLogic(state.player, dt);
  state.bots.forEach(b => updateRingLogic(b, dt));

  // 11. Win Condition
  updateWinCondition(state, dt);

  // 12. Boss Logic
  updateBossLogic(state, dt);

  // 13. Dynamic Bounty (Candy Vein rubber-band)
  updateDynamicBounty(state, dt);

  // 14. Emotions
  if (state.player) updateEmotion(state.player, dt);
  state.bots.forEach(b => updateEmotion(b, dt));

  return state;
};

const updatePlayer = (player: Player, state: GameState, dt: number) => {
  if (player.isDead) return;

  // Input Handling
  handleInput(player, state.inputs, dt);

  // Physics
  applyPhysics(player, dt);
  constrainToMap(player, MAP_RADIUS);

  // Interaction
  const nearby = getCurrentSpatialGrid().getNearby(player);
  checkCollisions(player, nearby, (other) => {
    handleCollision(player, other, state, dt);
  });

  // Regen / Decay
  if (player.currentHealth < player.maxHealth) {
    player.currentHealth += player.statusEffects.regen * dt;
  }

  // Decay status effect timers
  if (player.statusEffects.commitShield && player.statusEffects.commitShield > 0) {
    player.statusEffects.commitShield -= dt;
    if (player.statusEffects.commitShield <= 0) {
      player.statusEffects.shielded = false;
    }
  }
  if (player.statusEffects.pityBoost && player.statusEffects.pityBoost > 0) {
    player.statusEffects.pityBoost -= dt;
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
  const nearby = getCurrentSpatialGrid().getNearby(bot);
  checkCollisions(bot, nearby, (other) => {
    handleCollision(bot, other, state, dt);
  });
};

const handleInput = (player: Player, inputs: { space: boolean; w: boolean }, dt: number) => {
  // Movement vector is set by UI/Mouse elsewhere (player.targetPosition)
  // Here we just process actions like Space (Dash/Split in original, Skill in new)

  if (inputs.space) {
    // Trigger Skill
    applySkill(player, undefined, undefined); // Placeholder for skill system
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
    const nearby = getCurrentSpatialGrid().getNearby(p);
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

// Initial State Factory
export const createInitialState = (): GameState => {
  const engine = createGameEngine();
  bindEngine(engine);

  const player = createPlayer("Hero");

  return {
    player,
    bots: Array.from({ length: 10 }, (_, i) => createBot(`${i}`)),
    creeps: [], // Deprecated
    boss: null,
    food: Array.from({ length: 50 }, () => createFood()),
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
    tattooChoices: null,
    unlockedTattoos: [],
    isPaused: false,
    inputs: { space: false, w: false },
  };
};
