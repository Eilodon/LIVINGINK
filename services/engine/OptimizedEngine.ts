// EIDOLON-V FIX: Optimized Game Engine with Batch Processing
// Eliminates O(n²) complexity and reduces function call overhead

import { GameState, Player, Bot, Food, Entity } from '../../types';
import { gameStateManager } from './GameStateManager';
import { bindEngine, getCurrentSpatialGrid } from './context';
import { integrateEntity, checkCollisions, constrainToMap } from './systems/physics';
import { updateAI } from './systems/ai';
import { applyProjectileEffect, resolveCombat, consumePickup } from './systems/combat';
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
import { inputManager } from '../input/InputManager';

// EIDOLON-V FIX: Batch processing system to reduce function call overhead
interface EntityBatch {
  players: Player[];
  bots: Bot[];
  projectiles: Entity[];
  food: Food[];
  all: Entity[];
}

// EIDOLON-V FIX: Object pool for entity arrays
// EIDOLON-V FIX: Object pool for entity arrays
class PersistentBatch {
  public players: Player[] = [];
  public bots: Bot[] = [];
  public projectiles: Entity[] = [];
  public food: Food[] = [];
  public all: Entity[] = [];

  clear(): void {
    this.players.length = 0;
    this.bots.length = 0;
    this.projectiles.length = 0;
    this.food.length = 0;
    this.all.length = 0;
  }
}

// EIDOLON-V FIX: Optimized game engine with batch processing
class OptimizedGameEngine {
  private static instance: OptimizedGameEngine;
  private spatialGrid: any;
  private batch: PersistentBatch;
  private frameCount: number = 0;

  private constructor() {
    this.spatialGrid = getCurrentSpatialGrid();
    this.batch = new PersistentBatch();
  }

  public static getInstance(): OptimizedGameEngine {
    if (!OptimizedGameEngine.instance) {
      OptimizedGameEngine.instance = new OptimizedGameEngine();
    }
    return OptimizedGameEngine.instance;
  }

  // EIDOLON-V FIX: Batch entity collection to reduce array operations
  private collectEntities(state: GameState): EntityBatch {
    const players = state.players?.length ? state.players : [state.player];
    if (!state.players?.length) state.players = players;
    if (players.length > 0 && state.player !== players[0]) state.player = players[0];

    // Reset batch
    this.batch.clear();

    const { players: batchPlayers, bots: batchBots, projectiles: batchProjectiles, food: batchFood, all: batchAll } = this.batch;

    // Direct assignment safe-guarding
    // We strictly assume downstream systems do NOT modify the REFERENCE of these arrays, only content.

    // Fill arrays - ZERO ALLOCATION
    for (let i = 0; i < players.length; i++) {
      batchPlayers.push(players[i]);
      batchAll.push(players[i] as Entity);
    }

    for (let i = 0; i < state.bots.length; i++) {
      batchBots.push(state.bots[i]);
      batchAll.push(state.bots[i] as Entity);
    }

    for (let i = 0; i < state.projectiles.length; i++) {
      batchProjectiles.push(state.projectiles[i]);
      batchAll.push(state.projectiles[i]);
    }

    for (let i = 0; i < state.food.length; i++) {
      batchFood.push(state.food[i]);
      batchAll.push(state.food[i] as Entity);
    }

    return this.batch;
  }

  // EIDOLON-V FIX: Return arrays to pool
  // No-op for persistent batch
  private returnArrays(batch: EntityBatch): void {
    // Intentionally empty
  }

  // EIDOLON-V FIX: Batch physics integration
  private integratePhysics(batch: EntityBatch, dt: number): void {
    // Process all entities in single loop
    const allEntities = batch.all;
    const length = batch.players.length + batch.bots.length;

    for (let i = 0; i < length; i++) {
      const entity = allEntities[i];
      // Only integrate Players and Bots for physics here? Or checks type?
      // Based on original code: integrateEntity(p, dt)
      // We know first `length` items are players and bots.
      integrateEntity(entity as Player | Bot, dt);
    }
  }

  // EIDOLON-V FIX: Optimized spatial grid updates
  private updateSpatialGrid(batch: EntityBatch): void {
    const grid = this.spatialGrid;
    grid.clear();

    // Batch insert dynamic entities
    const dynamicEntities = batch.all;
    grid.clearDynamic();

    for (let i = 0; i < dynamicEntities.length; i++) {
      grid.insert(dynamicEntities[i]);
    }
  }

  // EIDOLON-V FIX: Batch logic updates
  private updateLogic(batch: EntityBatch, state: GameState, dt: number): void {
    // Update players
    for (let i = 0; i < batch.players.length; i++) {
      this.updatePlayer(batch.players[i], state, dt);
    }

    // Update bots
    for (let i = 0; i < batch.bots.length; i++) {
      this.updateBot(batch.bots[i], state, dt);
    }

    // Update projectiles
    this.updateProjectiles(state, dt);

    // Update visual effects
    this.updateFloatingTexts(state, dt);
    this.cleanupTransientEntities(state);
  }

  // EIDOLON-V FIX: Batch CJR system updates
  private updateCJRSystems(batch: EntityBatch, state: GameState, dt: number): void {
    // Batch ring updates
    for (let i = 0; i < batch.players.length; i++) {
      updateRingLogic(batch.players[i], dt, state.levelConfig, state);
    }
    for (let i = 0; i < batch.bots.length; i++) {
      updateRingLogic(batch.bots[i], dt, state.levelConfig, state);
    }

    // Batch emotion updates
    for (let i = 0; i < batch.players.length; i++) {
      updateEmotion(batch.players[i], dt);
    }
    for (let i = 0; i < batch.bots.length; i++) {
      updateEmotion(batch.bots[i], dt);
    }

    // Batch tattoo synergy checks
    for (let i = 0; i < batch.players.length; i++) {
      tattooSynergyManager.checkSynergies(batch.players[i], state);
    }
  }

  private updatePlayer(player: Player, state: GameState, dt: number): void {
    if (player.isDead) return;

    this.handleInput(player, state);

    // Optimized movement calculation
    const dx = player.targetPosition.x - player.position.x;
    const dy = player.targetPosition.y - player.position.y;
    const distSq = dx * dx + dy * dy;

    // Use squared distance to avoid sqrt operation
    if (distSq > 25) { // 5px deadzone squared
      const speed = player.maxSpeed * (player.statusEffects.speedBoost || 1);
      const dist = Math.sqrt(distSq);

      // Normalize and apply velocity
      player.velocity.x = (dx / dist) * speed;
      player.velocity.y = (dy / dist) * speed;
    } else {
      // Apply friction when close to target
      player.velocity.x *= 0.9;
      player.velocity.y *= 0.9;
    }

    // Apply skill
    if (player.inputs?.space) {
      applySkill(player, player.targetPosition, state);
    }

    // EIDOLON-V FIX: Ported Regen & Cooldown Logic
    if (player.currentHealth < player.maxHealth) {
      player.currentHealth += player.statusEffects.regen * dt;
    }
    player.lastEatTime += dt;
    player.lastHitTime += dt;

    if (player.skillCooldown > 0) {
      player.skillCooldown = Math.max(0, player.skillCooldown - dt * player.skillCooldownMultiplier);
    }

    if (player.streakTimer && player.streakTimer > 0) {
      player.streakTimer -= dt;
      if (player.streakTimer <= 0) {
        player.killStreak = 0;
        // createFloatingText(player.position, 'Streak Lost', '#ccc', 16, state); // Visual only, maybe skip in engine
      }
    }

    // EIDOLON-V FIX: Ported Magnet Logic
    this.updateMagnetLogic(player, state, dt);

    // EIDOLON-V FIX: Unit Collision (Combat)
    this.checkUnitCollisions(player, state, dt);
  }

  // EIDOLON-V FIX: Magnet Logic
  private updateMagnetLogic(player: Player, state: GameState, dt: number): void {
    const catalystSense = player.tattoos.includes(TattooId.CatalystSense);
    const magnetRadius = player.magneticFieldRadius || 0;

    if (magnetRadius > 0 || catalystSense) {
      const catalystRange = (player.statusEffects.catalystSenseRange || 2.0) * 130;
      const searchRadius = catalystSense ? Math.max(catalystRange, magnetRadius) : magnetRadius;
      const searchRadiusSq = searchRadius * searchRadius;
      const pullPower = 120 * dt;

      // Note: In optimized engine, we might want to use the spatial grid efficiently
      // But for now, parity first.
      const nearby = this.spatialGrid.getNearby(player, searchRadius);

      for (let i = 0; i < nearby.length; i++) {
        const entity = nearby[i];
        if (!('value' in entity)) continue; // Not food
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
  }

  // EIDOLON-V FIX: Unit Collision
  private checkUnitCollisions(entity: Player | Bot, state: GameState, dt: number): void {
    const nearby = this.spatialGrid.getNearby(entity, 300); // 300 range check
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other === entity) continue;
      if (entity.isDead || other.isDead) continue;

      // Food collision
      if ('value' in other) {
        const food = other as Food;
        const dx = entity.position.x - food.position.x;
        const dy = entity.position.y - food.position.y;
        const distSq = dx * dx + dy * dy;
        const minDist = entity.radius + food.radius;

        if (distSq < minDist * minDist) {
          consumePickup(entity, food, state);
        }
        continue;
      }

      // Combat Collision
      if ('score' in other) { // Is Unit
        resolveCombat(entity, other as Player | Bot, dt, state, true, true);
      }
    }
  }

  private updateBot(bot: Bot, state: GameState, dt: number): void {
    if (bot.isDead) return;

    // Bot AI update
    updateAI(bot, state, dt);

    // EIDOLON-V FIX: Bot Collisions (Combat & Food)
    this.checkUnitCollisions(bot, state, dt);
  }

  private updateProjectiles(state: GameState, dt: number): void {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];

      // Update projectile position
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.y += projectile.velocity.y * dt;

      // Apply projectile effect on collision
      const hit = this.checkProjectileCollision(projectile, state);
      if (hit) {
        applyProjectileEffect(projectile, hit as Player | Bot, state);
        state.projectiles.splice(i, 1);
      }

      // Remove if out of bounds
      const distFromCenter = Math.sqrt(
        projectile.position.x * projectile.position.x +
        projectile.position.y * projectile.position.y
      );
      if (distFromCenter > 3000) { // MAP_RADIUS
        state.projectiles.splice(i, 1);
      }
    }
  }

  private checkProjectileCollision(projectile: Entity, state: GameState): Entity | null {
    const nearby = this.spatialGrid.getNearby(projectile);

    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      if ((projectile as any).ownerId && entity.id === (projectile as any).ownerId) continue;

      const dx = entity.position.x - projectile.position.x;
      const dy = entity.position.y - projectile.position.y;
      const distSq = dx * dx + dy * dy;
      const collisionDist = entity.radius + projectile.radius;

      if (distSq < collisionDist * collisionDist) {
        return entity;
      }
    }

    return null;
  }

  private updateFloatingTexts(state: GameState, dt: number): void {
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const text = state.floatingTexts[i];

      text.position.x += text.velocity.x * dt;
      text.position.y += text.velocity.y * dt;
      text.life -= dt;

      if (text.life <= 0) {
        state.floatingTexts.splice(i, 1);
      }
    }
  }

  private cleanupTransientEntities(state: GameState): void {
    // Remove dead entities
    state.bots = state.bots.filter(b => !b.isDead);
    state.particles = state.particles.filter(p => p.life > 0);
    state.delayedActions = state.delayedActions.filter(a => a.timer > 0);
  }

  private handleInput(player: Player, state: GameState): void {
    // Input handling logic
    const events = inputManager.popEvents();
    if (events.length > 0) {
      if (!player.inputEvents) player.inputEvents = [];
      player.inputEvents.push(...events);
    }

    const move = inputManager.state.move;
    if (move.x !== 0 || move.y !== 0) {
      player.targetPosition.x = player.position.x + move.x * 200;
      player.targetPosition.y = player.position.y + move.y * 200;
    }
  }

  private updateCamera(state: GameState): void {
    if (state.player) {
      // Smooth camera follow
      const smoothing = 0.1;
      state.camera.x += (state.player.position.x - state.camera.x) * smoothing;
      state.camera.y += (state.player.position.y - state.camera.y) * smoothing;
    }
  }

  private checkTattooUnlock(state: GameState): void {
    if (state.tattooChoices) return;

    const player = state.player;
    if (player.matchPercent >= 0.8 && (player as any).level >= 2) {
      state.tattooChoices = getTattooChoices(3);
    }
  }

  // EIDOLON-V FIX: Main optimized update method
  public updateGameState(state: GameState, dt: number): GameState {
    if (state.isPaused) return state;

    this.frameCount++;

    bindEngine(state.engine);

    // Collect entities once
    const batch = this.collectEntities(state);

    // Batch updates
    this.integratePhysics(batch, dt);

    state.gameTime += dt;
    if (state.gameTime > state.levelConfig.timeLimit && !state.result) {
      state.result = 'lose';
      state.isPaused = true;
    }

    this.updateSpatialGrid(batch);
    this.updateLogic(batch, state, dt);

    // System updates
    updateWaveSpawner(state, dt);
    this.updateCJRSystems(batch, state, dt);
    updateBossLogic(state, dt);
    updateDynamicBounty(state, dt);
    updateWinCondition(state, dt, state.levelConfig);

    this.checkTattooUnlock(state);
    vfxIntegrationManager.update(state, dt);
    tattooSynergyManager.updateSynergies(state, dt);

    this.updateCamera(state);

    const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
    state.camera.x += shakeOffset.x;
    state.camera.y += shakeOffset.y;

    // Return arrays to pool
    this.returnArrays(batch);

    return state;
  }

  public updateClientVisuals(state: GameState, dt: number): void {
    bindEngine(state.engine);
    this.updateFloatingTexts(state, dt);
    vfxIntegrationManager.update(state, dt);
    this.updateCamera(state);

    const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
    state.camera.x += shakeOffset.x;
    state.camera.y += shakeOffset.y;
  }

  // EIDOLON-V FIX: Performance monitoring
  public getPerformanceStats(): {
    frameCount: number;
    poolSize: number;
    memoryUsage: number;
  } {
    return {
      frameCount: this.frameCount,
      poolSize: 5, // Static batch arrays
      memoryUsage: 0 // TODO: Implement memory monitoring
    };
  }
}

// EIDOLON-V FIX: Export singleton optimized engine
export const optimizedEngine = OptimizedGameEngine.getInstance();
