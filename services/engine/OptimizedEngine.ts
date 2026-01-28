// EIDOLON-V FIX: Optimized Game Engine with Batch Processing
// Eliminates O(n²) complexity and reduces function call overhead

import { GameState, Player, Bot, Food, Entity, Projectile } from '../../types';
import { gameStateManager } from './GameStateManager';
import { bindEngine, getCurrentSpatialGrid, getCurrentEngine } from './context';

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

import { pooledEntityFactory } from '../pooling/ObjectPool';
import { filterInPlace } from '../utils/arrayUtils';
import { PhysicsSystem } from './dod/systems/PhysicsSystem';
import { MovementSystem } from './dod/systems/MovementSystem';
import { TransformStore, PhysicsStore, EntityLookup } from './dod/ComponentStores';

// EIDOLON-V FIX: Batch processing system to reduce function call overhead
interface EntityBatch {
  players: Player[];
  bots: Bot[];
  projectiles: Entity[];
  food: Food[];
  // EIDOLON-V FIX: Removed 'all' to prevent polymorphism de-opt
}

// EIDOLON-V FIX: Object pool for entity arrays
class PersistentBatch {
  public players: Player[] = [];
  public bots: Bot[] = [];
  public projectiles: Entity[] = [];
  public food: Food[] = [];

  clear(): void {
    this.players.length = 0;
    this.bots.length = 0;
    this.projectiles.length = 0;
    this.food.length = 0;
  }
}

// EIDOLON-V FIX: Optimized game engine with batch processing
class OptimizedGameEngine {
  private static instance: OptimizedGameEngine;
  private spatialGrid: any;
  private batch: PersistentBatch;
  private frameCount: number = 0;

  private constructor() {
    // EIDOLON-V FIX: Don't require spatial grid in constructor
    // It will be bound when engine is properly initialized
    this.batch = new PersistentBatch();
  }

  public static getInstance(): OptimizedGameEngine {
    if (!OptimizedGameEngine.instance) {
      OptimizedGameEngine.instance = new OptimizedGameEngine();
    }
    return OptimizedGameEngine.instance;
  }

  // EIDOLON-V FIX: Zero Allocation Entity Collection
  private collectEntities(state: GameState): EntityBatch {
    // Đảm bảo state.players luôn là mảng valid
    if (!state.players || state.players.length === 0) {
      if (state.player) state.players = [state.player];
      else state.players = [];
    }

    // Clear batch arrays (giữ nguyên tham chiếu mảng, chỉ reset length = 0)
    this.batch.clear();

    const { players, bots, projectiles, food } = this.batch;

    // Fill arrays - ZERO ALLOCATION (Không dùng map/filter/concat)
    // 1. Players
    const sourcePlayers = state.players;
    for (let i = 0; i < sourcePlayers.length; i++) {
      players.push(sourcePlayers[i]);
    }

    // 2. Bots
    const sourceBots = state.bots;
    for (let i = 0; i < sourceBots.length; i++) {
      bots.push(sourceBots[i]);
    }

    // 3. Projectiles
    const sourceProj = state.projectiles;
    for (let i = 0; i < sourceProj.length; i++) {
      projectiles.push(sourceProj[i]);
    }

    // 4. Food
    const sourceFood = state.food;
    for (let i = 0; i < sourceFood.length; i++) {
      food.push(sourceFood[i]);
    }

    return this.batch;
  }

  // EIDOLON-V FIX: Return arrays to pool
  // No-op for persistent batch
  private returnArrays(batch: EntityBatch): void {
    // Intentionally empty
  }

  // EIDOLON-V FIX: Correct Physics Integration Pipeline
  private integratePhysics(batch: EntityBatch, dt: number): void {
    const world = getCurrentEngine().physicsWorld;

    // BƯỚC 1: PUSH (Sync từ Logic game -> Physics World)
    // Ensures DOD Entities exist and have up-to-date props (like mass/radius changes)
    world.syncBodiesFromBatch(batch.players);
    world.syncBodiesFromBatch(batch.bots);
    // Projectiles? If projectiles are physics bodies, sync them too.

    // BƯỚC 2: EXECUTE (Chạy mô phỏng vật lý SoA)
    // DOD Physics update
    PhysicsSystem.update(dt);

    // BƯỚC 3: PULL (Sync từ Physics World -> Logic game)
    // Required for Collision Logic (checkUnitCollisions) and Legacy Renderers
    this.syncBatchFromDOD(batch.players);
    this.syncBatchFromDOD(batch.bots);
  }

  private syncBatchFromDOD(entities: Entity[]): void {
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      const idx = ent.physicsIndex;
      if (idx !== undefined) {
        const baseIdx = idx * 8; // Stride 8
        ent.position.x = tData[baseIdx];
        ent.position.y = tData[baseIdx + 1];
        ent.velocity.x = pData[baseIdx];
        ent.velocity.y = pData[baseIdx + 1];
      }
    }
  }

  // EIDOLON-V FIX: Optimized spatial grid updates
  private updateSpatialGrid(batch: EntityBatch): void {
    const grid = this.spatialGrid;

    // EIDOLON-V: Chỉ clear dynamic entities (Player, Bot, Projectile)
    grid.clearDynamic();

    // Re-insert dynamic entities explicitly by type to avoid Type Pollution
    const { players, bots, projectiles } = batch;

    for (let i = 0; i < players.length; i++) {
      grid.insert(players[i]);
    }

    for (let i = 0; i < bots.length; i++) {
      grid.insert(bots[i]);
    }

    for (let i = 0; i < projectiles.length; i++) {
      grid.insert(projectiles[i]);
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

    // Input handled externally (by useGameSession or NetworkClient)

    // EIDOLON-V FIX: Read Position from Physics World (DOD)
    // Position is already synced back in integratePhysics step 3.
    // So player.position IS correct here.
    const px = player.position.x;
    const py = player.position.y;

    // EIDOLON-V FIX: Unified Movement Logic (DOD)
    // Use the same logic as Prediction/Re-simulation
    MovementSystem.applyInput(
      player.position,
      player.velocity,
      player.targetPosition,
      {
        maxSpeed: player.maxSpeed,
        speedMultiplier: player.statusMultipliers.speed || 1
      },
      dt
    );

    // Apply skill
    if (player.inputs?.space) {
      applySkill(player, player.targetPosition, state);
    }

    // EIDOLON-V FIX: Ported Regen & Cooldown Logic
    if (player.currentHealth < player.maxHealth) {
      player.currentHealth += player.statusScalars.regen * dt;
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

  // EIDOLON-V FIX: Magnet Logic (Optimized)
  private updateMagnetLogic(player: Player, state: GameState, dt: number): void {
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return;

    const catalystSense = player.tattoos.includes(TattooId.CatalystSense);
    const magnetRadius = player.magneticFieldRadius || 0;

    if (magnetRadius > 0 || catalystSense) {
      const catalystRange = (player.statusScalars.catalystSenseRange || 2.0) * 130;
      const searchRadius = catalystSense ? Math.max(catalystRange, magnetRadius) : magnetRadius;

      const indices: number[] = [];
      rawGrid.queryRadiusInto(player.position.x, player.position.y, searchRadius, indices);

      const searchRadiusSq = searchRadius * searchRadius;
      const pullPower = 120 * dt;
      const tData = TransformStore.data;

      const count = indices.length;
      for (let i = 0; i < count; i++) {
        const idx = indices[i];
        if (idx === player.physicsIndex) continue;

        // Lookup Object to check if it's Food/Catalyst
        // We can't tell just from indices if it's Food vs Projectile vs Bot efficiently without Flag bitmask?
        // Optimization: Use StateStore.flags checking! 
        // EntityFlags.FOOD = 1 << 4

        // EIDOLON-V OPT: Bitmask check
        // We need to import StateStore and EntityFlags first? They are not imported in this file yet?
        // Wait, OptimizedEngine imports TransformStore, PhysicsStore, EntityLookup. I should import StateStore and EntityFlags if I want to use them.
        // For now, Lookup is safe enough.

        const entity = EntityLookup[idx];
        if (!entity) continue;
        if (!('value' in entity)) continue; // Not food
        const f = entity as unknown as any;
        if (f.isDead) continue;

        if (catalystSense && f.kind !== 'catalyst' && magnetRadius <= 0) continue;

        const dx = player.position.x - f.position.x; // Use object position or DOD? Object is synced.
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

  // EIDOLON-V FIX: Unit Collision (Optimized Index-Based)
  private checkUnitCollisions(entity: Player | Bot, state: GameState, dt: number): void {
    const rawGrid = (this.spatialGrid as any).grid; // Access raw SpatialHashGrid
    if (!rawGrid) return; // Should not happen if initialized correctly

    const indices: number[] = [];
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    // 1. Query Indices (Zero Alloc)
    // Range 300 for awareness/combat
    rawGrid.queryRadiusInto(entity.position.x, entity.position.y, 300, indices);

    const count = indices.length;
    for (let i = 0; i < count; i++) {
      const idx = indices[i];

      // Skip self
      if (idx === entity.physicsIndex) continue;

      // 2. DOD Distance Check (Zero Object Access)
      const tIdx = idx * 8;
      const pIdx = idx * 8;

      const ox = tData[tIdx];
      const oy = tData[tIdx + 1];
      const or = pData[pIdx + 4]; // radius

      const dx = entity.position.x - ox;
      const dy = entity.position.y - oy;
      const distSq = dx * dx + dy * dy;

      // Broad phase check (Sum of radii)
      const minDist = entity.radius + or;

      if (distSq < minDist * minDist) {
        // 3. Resolve Object (Only on Collision)
        const other = EntityLookup[idx];
        if (!other) continue;

        if (other.isDead) continue;

        // Food collision
        if ('value' in other) {
          consumePickup(entity, other as Food, state);
          continue;
        }

        // Unit Collision
        if ('score' in other) {
          resolveCombat(entity, other as Player | Bot, dt, state, true, true);
        }
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
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return null;

    const indices: number[] = [];
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    // Query nearby
    rawGrid.queryRadiusInto(projectile.position.x, projectile.position.y, 50, indices); // 50 seems safe margin

    const count = indices.length;
    for (let i = 0; i < count; i++) {
      const idx = indices[i];

      // Skip self (if projectile was in grid? usually it is)
      if (idx === projectile.physicsIndex) continue;

      // DOD Distance Check
      const tIdx = idx * 8;
      const pIdx = idx * 8;

      const ox = tData[tIdx];
      const oy = tData[tIdx + 1];
      const or = pData[pIdx + 4];

      const dx = ox - projectile.position.x;
      const dy = oy - projectile.position.y;
      const distSq = dx * dx + dy * dy;
      const collisionDist = or + projectile.radius;

      if (distSq < collisionDist * collisionDist) {
        const entity = EntityLookup[idx];
        if (!entity) continue;

        // Logic Check: Owner
        if ((projectile as any).ownerId && entity.id === (projectile as any).ownerId) continue;

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
    const grid = this.spatialGrid;

    // Remove dead food
    if (state.food.length > 0) {
      filterInPlace(state.food, f => {
        if (f.isDead) {
          grid.removeStatic(f);
          pooledEntityFactory.createPooledFood().release(f);
          return false;
        }
        return true;
      });
    }

    // Remove dead projectiles
    if (state.projectiles.length > 0) {
      filterInPlace(state.projectiles, p => {
        if (p.isDead) {
          pooledEntityFactory.createPooledProjectile().release(p);
          return false;
        }
        return true;
      });
    }

    // Remove dead entities
    filterInPlace(state.bots, b => {
      if (b.isDead) {
        // EIDOLON-V FIX: Cleanup events/synergies to prevent ID reuse bugs
        const { TattooEventManager } = require('../cjr/tattooEvents');
        TattooEventManager.triggerDeactivate(b.id);
        return false;
      }
      return true;
    });
    filterInPlace(state.particles, p => p.life > 0);
    filterInPlace(state.delayedActions, a => a.timer > 0);
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
    // EIDOLON-V FIX: Bind engine and spatial grid at update time
    bindEngine(state.engine);
    this.spatialGrid = getCurrentSpatialGrid();

    if (state.isPaused) return state;

    this.frameCount++;

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
    // EIDOLON-V FIX: Bind engine and spatial grid at update time
    bindEngine(state.engine);
    this.spatialGrid = getCurrentSpatialGrid();

    this.updateFloatingTexts(state, dt);
    vfxIntegrationManager.update(state, dt);
    this.updateCamera(state);

    const visualShakeOffset = vfxIntegrationManager.getScreenShakeOffset();
    state.camera.x += visualShakeOffset.x;
    state.camera.y += visualShakeOffset.y;
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
