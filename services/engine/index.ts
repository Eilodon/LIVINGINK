import {
  BOT_COUNT,
  FOOD_COUNT,
  MAP_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MUTATION_CHOICES,
} from '../../constants';
import {
  Bot,
  Entity,
  Food,
  GameState,
  Player,
} from '../../types';
import { bindEngine, createGameEngine, getCurrentSpatialGrid } from './context';
import {
  createBot,
  createFood,
  createPlayer,
} from './factories';
import { createFloatingText } from './effects';
import { updateAI } from './systems/ai';
import { applyProjectileEffect, resolveCombat, consumePickup } from './systems/combat';
import { integrateEntity, checkCollisions, constrainToMap } from './systems/physics';
import { applySkill } from './systems/skills';
import { updateRingLogic } from '../cjr/ringSystem';
import { updateWaveSpawner, resetWaveTimers } from '../cjr/waveSpawner';
import { updateWinCondition } from '../cjr/winCondition';
import { updateBossLogic, resetBossState } from '../cjr/bossCjr';
import { updateDynamicBounty } from '../cjr/dynamicBounty';
import { updateEmotion } from '../cjr/emotions';
import { assignRandomPersonality } from '../cjr/botPersonalities';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { tattooSynergyManager } from '../cjr/tattooSynergies';
import { resetContributionLog } from '../cjr/contribution';
import { inputManager } from '../input/InputManager'; // EIDOLON-V: Connected
import { gameStateManager } from './GameStateManager';

// EIDOLON-V FIX: Export unified game state manager
export { gameStateManager };

// Legacy export for backward compatibility
export const updateGameState = (state: GameState, dt: number): GameState => {
  // EIDOLON-V FIX: Use unified state manager
  gameStateManager.setCurrentState(state);
  return gameStateManager.updateGameState(dt);
};

export const updateClientVisuals = (state: GameState, dt: number): void => {
  // EIDOLON-V FIX: Use unified state manager
  gameStateManager.setCurrentState(state);
  gameStateManager.updateClientVisuals(dt);
};

const updatePlayer = (player: Player, state: GameState, dt: number) => {
  if (player.isDead) return;

  // EIDOLON-V: Input Handling via Manager
  // Note: App.tsx or useGameSession should push inputs to state.inputs/inputEvents
  // Here we assume state is already populated by the Loop logic using InputManager.
  // Movement logic is handled by targetPosition updates in useGameSession.

  handleInput(player, state);

  // EIDOLON-V FIX: Player Movement Logic (Steering)
  const dx = player.targetPosition.x - player.position.x;
  const dy = player.targetPosition.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // DEBUG: Log movement data
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    // EIDOLON-V FIX: Use simplified movement logic
    const speed = player.maxSpeed * (player.statusEffects.speedBoost || 1);
    player.velocity.x = (dx / dist) * speed;
    player.velocity.y = (dy / dist) * speed;
  } else {
    // Decelerate if no input (Friction handles this, but we can help it)
    // actually physics.ts handles friction, so we just stop adding force.
    player.velocity.x *= 0.9;
    player.velocity.y *= 0.9;
  }

  constrainToMap(player, MAP_RADIUS);

  const nearby = getCurrentSpatialGrid().getNearby(player, 300);
  checkCollisions(player, nearby, (other) => {
    handleCollision(player, other, state, dt);
  });

  // EIDOLON-V: OPTIMIZED MAGNET LOGIC (Spatial Grid)
  const catalystSense = player.tattoos.includes(TattooId.CatalystSense);
  const magnetRadius = player.magneticFieldRadius || 0;

  if (magnetRadius > 0 || catalystSense) {
    const catalystRange = (player.statusEffects.catalystSenseRange || 2.0) * 130;
    const searchRadius = catalystSense ? Math.max(catalystRange, magnetRadius) : magnetRadius;
    const searchRadiusSq = searchRadius * searchRadius;
    const pullPower = 120 * dt;

    // CHÌA KHÓA: Chỉ lấy food gần
    const nearbyEntities = getCurrentSpatialGrid().getNearby(player, searchRadius);

    for (let i = 0; i < nearbyEntities.length; i++) {
      const entity = nearbyEntities[i];
      if (!('value' in entity)) continue;
      const f = entity as unknown as any;
      if (f.isDead) continue;

      if (catalystSense && f.kind !== 'catalyst' && magnetRadius <= 0) continue;

      const dx = player.position.x - f.position.x;
      const dy = player.position.y - f.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < searchRadiusSq && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const factor = pullPower / dist;
        f.velocity.x += dx * factor;
        f.velocity.y += dy * factor;
      }
    }
  }

  // Regen / Decay logic...
  if (player.currentHealth < player.maxHealth) {
    player.currentHealth += player.statusEffects.regen * dt;
  }
  player.lastEatTime += dt;
  player.lastHitTime += dt;

  if (player.skillCooldown > 0) {
    player.skillCooldown = Math.max(0, player.skillCooldown - dt * player.skillCooldownMultiplier);
  }
  // ... (Giữ nguyên phần decay streak và status effects) ...
  if (player.streakTimer && player.streakTimer > 0) {
    player.streakTimer -= dt;
    if (player.streakTimer <= 0) {
      player.killStreak = 0;
      createFloatingText(player.position, 'Streak Lost', '#ccc', 16, state);
    }
  }
  // ... (Decay logic status effects như cũ) ...
};

// ... (Giữ nguyên updateBot) ...
const updateBot = (bot: Bot, state: GameState, dt: number) => {
  if (bot.isDead) return;
  updateAI(bot, state, dt);
  constrainToMap(bot, MAP_RADIUS);
  const nearby = getCurrentSpatialGrid().getNearby(bot, 250);
  checkCollisions(bot, nearby, (other) => handleCollision(bot, other, state, dt));
  // ... rest of bot update ...
};

const handleInput = (player: Player, state: GameState) => {
  // Phase 3: Event Queue Processing
  if (player.inputEvents && player.inputEvents.length > 0) {
    player.inputEvents.forEach(evt => {
      if (evt.type === 'skill') applySkill(player, undefined, state);
      // eject logic here if needed
    });
    player.inputEvents = [];
  }
};

const handleCollision = (entity: Player | Bot, other: Entity, state: GameState, dt: number) => {
  if (other === entity) return;
  if (entity.isDead || other.isDead) return;

  if ('value' in other) { // Is Food
    const food = other as Food;
    const dx = entity.position.x - food.position.x;
    const dy = entity.position.y - food.position.y;
    const distSq = dx * dx + dy * dy;
    const minDist = entity.radius + food.radius;
    if (distSq < minDist * minDist) {
      consumePickup(entity, food, state);
    }
    return;
  }

  if ('ownerId' in other && 'damage' in other) return; // Projectile handled elsewhere

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

    const nearby = getCurrentSpatialGrid().getNearby(p, 150);
    nearby.forEach(other => {
      if (other.id !== p.ownerId && ('score' in other)) {
        const unit = other as Player | Bot;
        const dx = p.position.x - unit.position.x;
        const dy = p.position.y - unit.position.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p.radius + unit.radius;
        if (distSq < minDist * minDist) {
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
    if (t.life <= 0) state.floatingTexts.splice(i, 1);
  }
};

const cleanupTransientEntities = (state: GameState) => {
  const grid = getCurrentSpatialGrid();

  if (state.food.length > 0) {
    // Remove dead food from static grid
    const deadFood = state.food.filter(f => f.isDead);
    deadFood.forEach(food => grid.removeStatic(food));

    // Keep only alive food
    state.food = state.food.filter(f => !f.isDead);
  }
  if (state.projectiles.length > 0) state.projectiles = state.projectiles.filter(p => !p.isDead);
};

// ... (Giữ nguyên updateCamera, checkTattooUnlock, createInitialState) ...
const updateCamera = (state: GameState) => {
  if (state.player && !state.player.isDead) {
    const prevCamera = { x: state.camera.x, y: state.camera.y };
    state.camera.x += (state.player.position.x - state.camera.x) * 0.1;
    state.camera.y += (state.player.position.y - state.camera.y) * 0.1;

    // DEBUG: Log camera movement
    if (Math.abs(state.camera.x - prevCamera.x) > 1 || Math.abs(state.camera.y - prevCamera.y) > 1) {
      console.log('DEBUG: Camera movement - Player:', state.player.position, 'Camera:', state.camera);
    }
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

export const createInitialState = (level: number = 1): GameState => {
  // ... (Copy nguyên logic createInitialState cũ) ...
  const engine = createGameEngine();
  bindEngine(engine);
  const player = createPlayer("Hero");
  const levelConfig = getLevelConfig(level);
  const runtime = {
    wave: { ring1: levelConfig.waveIntervals.ring1, ring2: levelConfig.waveIntervals.ring2, ring3: levelConfig.waveIntervals.ring3 },
    boss: { bossDefeated: false, rushWindowTimer: 0, rushWindowRing: null, currentBossActive: false, attackCharging: false, attackTarget: null, attackChargeTimer: 0 },
    contribution: { damageLog: new Map<string, number>(), lastHitBy: new Map<string, string>() },
  };
  resetWaveTimers(runtime, levelConfig);
  resetBossState(runtime);
  resetContributionLog(runtime);
  tattooSynergyManager.reset();
  const initialFood = Math.max(50, levelConfig.burstSizes.ring1 * 8);

  // Create food and insert as static entities
  const foodArray = Array.from({ length: initialFood }, () => createFood());
  const grid = getCurrentSpatialGrid();
  foodArray.forEach(food => grid.insertStatic(food));

  return {
    player,
    players: [player],
    bots: Array.from({ length: Math.max(levelConfig.botCount, 10) }, (_, i) => {
      const b = createBot(`${i}`);
      assignRandomPersonality(b);
      return b;
    }),
    creeps: [],
    boss: null,
    food: foodArray,
    particles: [], // Không dùng nữa, để trống
    projectiles: [],
    floatingTexts: [],
    delayedActions: [],
    engine,
    runtime,
    worldSize: { x: WORLD_WIDTH, y: WORLD_HEIGHT },
    zoneRadius: MAP_RADIUS,
    gameTime: 0,
    currentRound: 1,
    camera: { x: player.position.x, y: player.position.y }, // EIDOLON-V FIX: Start camera at player position
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
    inputEvents: [],
  };
};
