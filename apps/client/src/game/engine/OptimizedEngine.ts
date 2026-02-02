// EIDOLON-V FIX: Optimized Game Engine with Batch Processing
// Eliminates O(n²) complexity and reduces function call overhead

import { GameState, Player, Bot, Food, Entity, Projectile } from '../../types';
import { gameStateManager } from './GameStateManager';
import { bindEngine, getCurrentSpatialGrid, getCurrentEngine } from './context';

import { updateAI } from './systems/ai';
import { applyProjectileEffect, resolveCombat, consumePickupDOD } from './systems/combat';
import { applySkill } from './systems/skills';
import { EntityFlags, MAX_ENTITIES, PhysicsSystem, MovementSystem } from '@cjr/engine';
import { updateRingLogicLegacy as updateRingLogic } from '@cjr/engine/cjr';
import { updateWaveSpawnerLegacy as updateWaveSpawner, resetWaveTimersLegacy as resetWaveTimers } from '@cjr/engine/cjr';
import { updateBossLogicLegacy as updateBossLogic, resetBossStateLegacy as resetBossState } from '@cjr/engine/cjr';
import { updateWinCondition } from '@cjr/engine/cjr';
import { updateDynamicBounty } from '../cjr/dynamicBounty';
import { updateEmotion } from '../cjr/emotions';
import { assignRandomPersonality } from '../cjr/botPersonalities';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { tattooSynergyManager } from '../cjr/tattooSynergies';

import { resetContributionLog } from '../cjr/contribution';
import { TattooEventManager } from '../cjr/tattooEvents'; // EIDOLON-V: Static import
import { entityManager } from './dod/EntityManager'; // EIDOLON-V: DOD Manager

import { pooledEntityFactory } from '../pooling/ObjectPool';
import { filterInPlace } from '../core/utils/arrayUtils';
import {
  TransformStore,
  PhysicsStore,
  StatsStore,
  StateStore,
  SkillStore,
  TattooStore,
  ProjectileStore,
  InputStore,
} from '@cjr/engine';
import { EntityLookup } from './dod/ComponentStores';
import { SkillSystem } from './dod/systems/SkillSystem';
import { TattooSystem } from './dod/systems/TattooSystem';
import { ConfigStore } from './dod/ConfigStore';
import { networkTransformBuffer } from './networking/NetworkTransformBuffer';
import { clientEngineBridge } from './ClientEngineBridge';

// EIDOLON-V FIX: Batch processing removed in favor of Pure DOD Iteration
// Memory overhead reduced.

// EIDOLON-V FIX: Optimized game engine with direct DOD iteration
class OptimizedGameEngine {
  private static instance: OptimizedGameEngine;
  private spatialGrid: any;
  private frameCount: number = 0;

  // EIDOLON-V: Shared buffer for spatial queries (Zero-GC)
  private _queryBuffer: number[] = [];

  private constructor() {
    // EIDOLON-V FIX: Don't require spatial grid in constructor
  }

  public static getInstance(): OptimizedGameEngine {
    if (!OptimizedGameEngine.instance) {
      OptimizedGameEngine.instance = new OptimizedGameEngine();
    }
    return OptimizedGameEngine.instance;
  }

  // EIDOLON-V: DOD Spatial Grid Update
  private updateSpatialGridDOD(): void {
    const grid = this.spatialGrid;
    grid.clearDynamic();

    // EIDOLON-V FIX: Use MAX_ENTITIES instead of entityManager.count
    // entityManager.count can miss high indices when entities in the middle are removed
    const flags = StateStore.flags;

    for (let i = 0; i < MAX_ENTITIES; i++) {
      // Filter: Active only
      if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;
      if ((flags[i] & EntityFlags.DEAD) !== 0) continue;
      grid.insertIndex(i);
    }
  }

  // EIDOLON-V 2.2: Camera viewport bounds for render set filtering
  private viewportMinX: number = 0;
  private viewportMaxX: number = 0;
  private viewportMinY: number = 0;
  private viewportMaxY: number = 0;
  private viewportMargin: number = 200; // Extra margin around viewport

  private updateViewportBounds(state: GameState): void {
    // Assume viewport size based on typical screen (can be made dynamic)
    const viewWidth = 1920;
    const viewHeight = 1080;
    const halfW = viewWidth / 2;
    const halfH = viewHeight / 2;

    this.viewportMinX = state.camera.x - halfW - this.viewportMargin;
    this.viewportMaxX = state.camera.x + halfW + this.viewportMargin;
    this.viewportMinY = state.camera.y - halfH - this.viewportMargin;
    this.viewportMaxY = state.camera.y + halfH + this.viewportMargin;
  }

  private isInViewport(x: number, y: number): boolean {
    return (
      x >= this.viewportMinX &&
      x <= this.viewportMaxX &&
      y >= this.viewportMinY &&
      y <= this.viewportMaxY
    );
  }

  private syncBatchFromDOD(entities: Entity[], alwaysSyncId?: string): void {
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;
    const sData = StatsStore.data;
    const stateFlags = StateStore.flags;

    // EIDOLON-V 2.1: Throttle stats sync (every 4 frames)
    const syncStats = this.frameCount % 4 === 0;

    const count = entities.length;
    for (let i = 0; i < count; i++) {
      const ent = entities[i];

      // EIDOLON-V 2.1: Skip dead entities early (no render needed)
      if (ent.isDead) continue;

      const idx = ent.physicsIndex;
      if (idx !== undefined) {
        // EIDOLON-V P0-1 FIX: Validate entity is still ACTIVE in DOD store
        // This prevents reading stale data from deallocated entities
        if ((stateFlags[idx] & EntityFlags.ACTIVE) === 0) {
          // Entity was removed from DOD but JS object still exists
          // Mark as dead to trigger cleanup on next frame
          ent.isDead = true;
          continue;
        }

        const tIdx = idx * 8;

        const pIdx = idx * 8;

        // Position/Velocity sync
        ent.position.x = tData[tIdx];
        ent.position.y = tData[tIdx + 1];
        ent.velocity.x = pData[pIdx];
        ent.velocity.y = pData[pIdx + 1];

        // EIDOLON-V 2.1: Stats sync throttled (every 4 frames)
        if (syncStats && 'score' in ent) {
          const sIdx = idx * 8;
          const unit = ent as any;
          unit.currentHealth = sData[sIdx];
          unit.score = sData[sIdx + 2];
          unit.matchPercent = sData[sIdx + 3];
        }

        // Sync Dead Flag (still every frame for cleanup)
        ent.isDead = (stateFlags[idx] & EntityFlags.DEAD) !== 0;
      }
    }
  }

  // EIDOLON-V FIX: Optimized spatial grid updates
  // This method is replaced by updateSpatialGridDOD but kept for signature compatibility
  // @ts-ignore
  private updateSpatialGrid(batch: any): void {
    const grid = this.spatialGrid;
    if (!grid) return;

    // EIDOLON-V: Clean existing
    grid.clearDynamic();

    // Re-insert based on Active Flags in DOD
    // Ideally we iterate ALL active entities and insert them.
    // For now, relies on the updateSpatialGridDOD method which is correct.
    // If this legacy method is called, we should warn or redirect.
    this.updateSpatialGridDOD();
  }

  // EIDOLON-V FIX: Magnet Logic (Pure DOD - No Object Lookup)
  private updateMagnetLogic(player: Player, state: GameState, dt: number): void {
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return;

    // Safety check: Needs physics index
    const pIdx = player.physicsIndex;
    if (pIdx === undefined) return;

    // 1. Read Config from DOD (Single Source of Truth)
    const magnetRadius = ConfigStore.getMagneticRadius(pIdx);
    // Legacy support: fall back to object if 0
    const effMagnetRadius = magnetRadius > 0 ? magnetRadius : player.magneticFieldRadius || 0;

    const catalystSense = player.tattoos && player.tattoos.includes(TattooId.CatalystSense);

    // Optimization: If magnetRadius is 0 and no catalyst sense, abort.
    if (effMagnetRadius <= 0 && !catalystSense) return;

    const catalystRange = (player.statusScalars.catalystSenseRange || 2.0) * 130;
    const searchRadius = catalystSense ? Math.max(catalystRange, effMagnetRadius) : effMagnetRadius;

    // 2. DOD Read Player Position
    const tIdxP = pIdx * 8;
    const px = TransformStore.data[tIdxP];
    const py = TransformStore.data[tIdxP + 1];

    // 3. Query Spatial Grid
    const indices = this._queryBuffer;
    indices.length = 0;
    rawGrid.queryRadiusInto(px, py, searchRadius, indices);

    const count = indices.length;
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;
    const sFlags = StateStore.flags;
    const pullPower = 120 * dt;
    const searchRadiusSq = searchRadius * searchRadius;

    for (let i = 0; i < count; i++) {
      const idx = indices[i];
      if (idx === pIdx) continue;

      const flags = sFlags[idx];

      // 4. Bitmask Check (Pure Integer Logic)
      // Must be Active AND Food. Not Dead.
      if (
        (flags & (EntityFlags.ACTIVE | EntityFlags.FOOD)) !==
        (EntityFlags.ACTIVE | EntityFlags.FOOD)
      )
        continue;
      if (flags & EntityFlags.DEAD) continue;

      // Catalyst Logic
      // EIDOLON-V FIX: Catalyst sense should allow seeing catalyst food even if magnet is 0
      if (catalystSense && magnetRadius <= 0) {
        if ((flags & EntityFlags.FOOD_CATALYST) === 0) continue; // Only skip if NOT catalyst
      } else if (magnetRadius <= 0) {
        continue; // No magnet, no catalyst sense -> skip
      }

      // 5. DOD Distance Check
      const tIdxT = idx * 8;
      const tx = tData[tIdxT];
      const ty = tData[tIdxT + 1];

      const dx = px - tx;
      const dy = py - ty;
      const distSq = dx * dx + dy * dy;

      if (distSq < searchRadiusSq && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const factor = pullPower / dist;

        // 6. DOD Write Velocity (PhysicsStore)
        const pIdxT = idx * 8;
        pData[pIdxT] += dx * factor;
        pData[pIdxT + 1] += dy * factor;
      }
    }
  }

  // EIDOLON-V FIX: Unit Collision (Optimized Index-Based & Bitmask)
  private checkUnitCollisions(entity: Player | Bot, state: GameState, dt: number): void {
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return;

    const pIdx = entity.physicsIndex;
    // If no physics index, use legacy object bounds (fallback)
    let px = entity.position.x;
    let py = entity.position.y;
    let radius = entity.radius;

    const tData = TransformStore.data;
    const pData = PhysicsStore.data; // Store reference to be safe
    const sFlags = StateStore.flags;

    if (pIdx !== undefined) {
      px = tData[pIdx * 8];
      py = tData[pIdx * 8 + 1];
      radius = pData[pIdx * 8 + 4]; // Radius is at offset 4
    }

    // Cache Pointers (Local Stack)
    const indices = this._queryBuffer;
    indices.length = 0;

    rawGrid.queryRadiusInto(px, py, 300, indices);

    const count = indices.length;
    for (let i = 0; i < count; i++) {
      const idx = indices[i];
      if (idx === pIdx) continue;

      // EIDOLON-V: BITMASK CHECK (Siêu nhanh)
      const flag = sFlags[idx];

      // Bỏ qua nếu không Active hoặc đã Chết
      if ((flag & EntityFlags.ACTIVE) === 0) continue;
      if ((flag & EntityFlags.DEAD) !== 0) continue;

      // 2. DOD Distance Check
      const tIdx = idx * 8;
      const ox = tData[tIdx];
      const oy = tData[tIdx + 1];

      // Radius from PhysicsStore
      const pIdxTarget = idx * 8;
      const or = pData[pIdxTarget + 4];

      const dx = px - ox;
      const dy = py - oy;
      const distSq = dx * dx + dy * dy;

      const minDist = radius + or;

      if (distSq < minDist * minDist) {
        // 3. Resolve Logic (Chỉ lookup Object khi thực sự va chạm)

        // Case A: FOOD Collision
        if ((flag & EntityFlags.FOOD) !== 0) {
          // EIDOLON-V: Use DOD Consume
          if (pIdx !== undefined) {
            consumePickupDOD(pIdx, idx, state);
          }
          continue;
        }

        // Case B: UNIT Collision (Player/Bot)
        if ((flag & (EntityFlags.PLAYER | EntityFlags.BOT)) !== 0) {
          const target = EntityLookup[idx];
          if (target) resolveCombat(entity, target as Player | Bot, dt, state, true, true);
        }
      }
    }
  }

  private checkProjectileCollision(projectile: Entity, state: GameState): Entity | null {
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return null;

    // EIDOLON-V: Use Shared Buffer
    const indices = this._queryBuffer;
    indices.length = 0;

    const tData = TransformStore.data;
    const pData = PhysicsStore.data;

    // Query nearby
    let px = projectile.position.x;
    let py = projectile.position.y;

    // EIDOLON-V: Read from DOD Store
    if (projectile.physicsIndex !== undefined) {
      const tIdx = projectile.physicsIndex * 8;
      px = TransformStore.data[tIdx];
      py = TransformStore.data[tIdx + 1];
    }

    rawGrid.queryRadiusInto(px, py, 50, indices); // 50 seems safe margin

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

      const dx = ox - px;
      const dy = oy - py;
      const distSq = dx * dx + dy * dy;
      const collisionDist = or + projectile.radius;

      if (distSq < collisionDist * collisionDist) {
        // EIDOLON-V: DOD Owner Check (Integer)
        if (projectile.physicsIndex !== undefined) {
          const projIdx = projectile.physicsIndex * 4; // ProjectileStore.STRIDE
          const ownerId = ProjectileStore.data[projIdx];
          if (ownerId === idx) continue; // Owner ignores their own bullet
        } else {
          // Fallback if no physics index (legacy support)
          const entity = EntityLookup[idx];
          if (!entity) continue;
          if ((projectile as any).ownerId && entity.id === (projectile as any).ownerId) continue;
        }

        const entity = EntityLookup[idx];
        if (!entity) continue;

        return entity;
      }
    }

    return null;
  }

  private cleanupTransientEntities(state: GameState): void {
    const grid = this.spatialGrid;

    // Remove dead food
    if (state.food.length > 0) {
      filterInPlace(state.food, f => {
        if (f.isDead) {
          grid.removeStatic(f);
          // EIDOLON-V FIX: Release DOD index to prevent memory leak
          if (f.physicsIndex !== undefined) {
            EntityLookup[f.physicsIndex] = null;
            StateStore.flags[f.physicsIndex] = 0; // Clear all flags
            entityManager.removeEntity(f.physicsIndex);
          }
          pooledEntityFactory.createPooledFood().release(f);
          return false;
        }
        return true;
      });
    }

    // Remove dead projectiles
    // This is now handled by updateProjectilesDOD setting DEAD flag
    // The actual removal from state.projectiles array might still be needed for rendering/legacy systems
    if (state.projectiles.length > 0) {
      filterInPlace(state.projectiles, p => {
        if (p.isDead) {
          // EIDOLON-V FIX: Release DOD index to prevent memory leak
          if (p.physicsIndex !== undefined) {
            EntityLookup[p.physicsIndex] = null;
            StateStore.flags[p.physicsIndex] = 0;
            entityManager.removeEntity(p.physicsIndex);
          }
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
        TattooEventManager.triggerDeactivate(b.id);
        // EIDOLON-V FIX: Release DOD index to prevent memory leak
        if (b.physicsIndex !== undefined) {
          EntityLookup[b.physicsIndex] = null;
          StateStore.flags[b.physicsIndex] = 0;
          entityManager.removeEntity(b.physicsIndex);
        }
        return false;
      }
      return true;
    });
    filterInPlace(state.particles, p => p.life > 0);
    filterInPlace(state.delayedActions, a => a.timer > 0);
  }

  // EIDOLON-V FIX: AGGRESSIVE MODE - Telemetry only, sync disabled
  // All gameplay logic now reads directly from DOD stores.
  // This function logs warnings if any entities lack physicsIndex for debugging.
  private syncEntityPositions(state: GameState): void {
    // Telemetry: Log if any entities are missing physicsIndex
    if (state.player && state.player.physicsIndex === undefined) {
      console.warn('[DOD] Player missing physicsIndex!');
    }

    for (const bot of state.bots) {
      if (bot.physicsIndex === undefined) {
        console.warn(`[DOD] Bot ${bot.id} missing physicsIndex`);
      }
    }

    for (const food of state.food) {
      if (food.physicsIndex === undefined) {
        console.warn(`[DOD] Food ${food.id} missing physicsIndex`);
      }
    }

    // ORIGINAL SYNC CODE (Disabled for aggressive mode):
    // -----------------------------------------------------------------
    // // Sync player position
    // if (state.player && state.player.physicsIndex !== undefined) {
    //   const tIdx = state.player.physicsIndex * 8;
    //   state.player.position.x = TransformStore.data[tIdx];
    //   state.player.position.y = TransformStore.data[tIdx + 1];
    //   state.player.velocity.x = PhysicsStore.data[tIdx];
    //   state.player.velocity.y = PhysicsStore.data[tIdx + 1];
    //   state.player.radius = PhysicsStore.data[tIdx + 4];
    //   state.player.score = StatsStore.data[tIdx + 2];
    //   state.player.matchPercent = StatsStore.data[tIdx + 3];
    // }
    // // Sync bot positions...
    // // Sync food positions...
    // -----------------------------------------------------------------
  }

  private updateCamera(state: GameState): void {
    if (state.player) {
      // EIDOLON-V: Prefer DOD as source of truth for camera
      let px = state.player.position.x;
      let py = state.player.position.y;
      if (state.player.physicsIndex !== undefined) {
        const tIdx = state.player.physicsIndex * TransformStore.STRIDE;
        px = TransformStore.data[tIdx];
        py = TransformStore.data[tIdx + 1];
      }

      // Smooth camera follow
      const smoothing = 0.1;
      state.camera.x += (px - state.camera.x) * smoothing;
      state.camera.y += (py - state.camera.y) * smoothing;
    }
  }

  private checkTattooUnlock(state: GameState): void {
    if (state.tattooChoices) return;

    const player = state.player;
    if (player.matchPercent >= 0.8 && (player as any).level >= 2) {
      state.tattooChoices = getTattooChoices(3);
    }
  }

  // EIDOLON-V FIX: Main optimized update method (Pure DOD Loop)
  public updateGameState(state: GameState, dt: number): GameState {
    try {
      // EIDOLON-V FIX: Bind engine and spatial grid at update time
      bindEngine(state.engine);
      this.spatialGrid = getCurrentSpatialGrid();

      if (state.isPaused) return state;

      this.frameCount++;

      // EIDOLON-V FIX: Flush network transforms BEFORE physics
      // This ensures SSOT - network queues, engine consumes at tick start
      networkTransformBuffer.flush();

      // 1. PHYSICS (Pure DOD)
      PhysicsSystem.update(dt);

      // 2. UPDATE GRID (DOD Iteration)
      this.updateSpatialGridDOD();

      // 3. LOGIC (DOD Iteration)
      // EIDOLON-V FIX: Use MAX_ENTITIES - entityManager.count can miss entities
      const flags = StateStore.flags;

      for (let i = 0; i < MAX_ENTITIES; i++) {
        if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;

        const isPlayer = (flags[i] & EntityFlags.PLAYER) !== 0;
        const isBot = (flags[i] & EntityFlags.BOT) !== 0;
        if (!isPlayer && !isBot) continue;

        const obj = EntityLookup[i] as Player | Bot;
        if (obj) {
          if (isBot) {
            updateAI(obj as Bot, state, dt);
            const bot = obj as Bot;
            if (bot.targetPosition) {
              InputStore.setTarget(i, bot.targetPosition.x, bot.targetPosition.y);
            }
          } else {
            const player = obj as Player;
            if (player.targetPosition) {
              InputStore.setTarget(i, player.targetPosition.x, player.targetPosition.y);
            }

            if (InputStore.consumeSkillInput(i)) {
              SkillSystem.handleInput(i, { space: true, target: player.targetPosition }, state);
            }
          }

          if (obj.aberrationIntensity && obj.aberrationIntensity > 0) {
            obj.aberrationIntensity -= dt * 3.0;
            if (obj.aberrationIntensity < 0) obj.aberrationIntensity = 0;
          }

          this.updateEntityTimers(i, obj, dt);
        }

        MovementSystem.update(i, dt);

        if (obj && isPlayer) {
          this.updateMagnetLogic(obj as Player, state, dt);
        }
      }

      // 5. COLLISION (Post-physics)
      for (let i = 0; i < MAX_ENTITIES; i++) {
        if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;
        if ((flags[i] & (EntityFlags.PLAYER | EntityFlags.BOT)) === 0) continue;
        const obj = EntityLookup[i] as Player | Bot;
        if (obj) {
          this.checkUnitCollisions(obj as Player, state, dt);
        }
      }

      // 4. CJR SYSTEMS (DOD Iteration)
      for (let i = 0; i < MAX_ENTITIES; i++) {
        if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;

        if (flags[i] & (EntityFlags.PLAYER | EntityFlags.BOT)) {
          const entity = EntityLookup[i] as Player | Bot;
          if (entity) {
            updateRingLogic(entity, dt, state.levelConfig, state);
            updateEmotion(entity, dt);
            if (flags[i] & EntityFlags.PLAYER) {
              tattooSynergyManager.checkSynergies(entity as Player, state);
            }
          }
        }
      }

      // 5. PROJECTILES (Hybrid Loop for now, or convert to Index loop if ProjectileStore is ready)
      // We can iterate indices for projectiles too.
      this.updateProjectilesDOD(state, dt);

      // 6. GLOBAL SYSTEMS
      state.gameTime += dt;
      if (state.gameTime > state.levelConfig.timeLimit && !state.result) {
        state.result = 'lose';
        state.isPaused = true;
      }

      updateWaveSpawner(state, dt);
      updateBossLogic(state, dt);
      updateDynamicBounty(state, dt);
      updateWinCondition(state, dt, state.levelConfig);

      this.checkTattooUnlock(state);

      // EIDOLON-V: Drain engine events to VFX system
      clientEngineBridge.drainEvents();

      vfxIntegrationManager.update(state, dt);
      tattooSynergyManager.updateSynergies(state, dt);

      // EIDOLON-V FIX: Sync positions from DOD Stores back to object state for rendering
      this.syncEntityPositions(state);

      this.updateCamera(state);

      // EIDOLON-V: DOD System Updates
      SkillSystem.update(dt);
      TattooSystem.update(dt);

      const shakeOffset = vfxIntegrationManager.getScreenShakeOffset();
      state.camera.x += shakeOffset.x;
      state.camera.y += shakeOffset.y;

      // Clean up dead
      this.cleanupTransientEntities(state);

      return state;
    } catch (error) {
      // EIDOLON-V P3: Error boundary for graceful recovery
      console.error('[Engine] Critical error in updateGameState:', error);
      this.emitErrorEvent(error);
      return this.attemptRecovery(state);
    }
  }

  // EIDOLON-V P3: Emit error event for UI recovery
  private emitErrorEvent(error: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('engine-error', {
          detail: { error, timestamp: Date.now() },
        })
      );
    } catch (e) {
      // Silently fail if event dispatch fails
    }
  }

  // EIDOLON-V P3: Attempt graceful recovery
  private attemptRecovery(state: GameState): GameState {
    console.warn('[Engine] Attempting graceful recovery...');
    state.isPaused = true;
    return state;
  }

  private updateEntityTimers(index: number, entityObj: Player | Bot, dt: number) {
    // 4. Stats Regen (DOD)
    const sIdx = index * StatsStore.STRIDE;
    let hp = StatsStore.data[sIdx];
    const maxHp = StatsStore.data[sIdx + 1];

    // Regen scalar from object for now
    const regen = entityObj.statusScalars.regen || 0;
    if (regen > 0 && hp < maxHp) {
      hp += regen * dt;
      if (hp > maxHp) hp = maxHp;
      StatsStore.data[sIdx] = hp;
      entityObj.currentHealth = hp; // Sync back
    }

    // 5. Cooldowns (Timers)
    entityObj.lastEatTime += dt;
    entityObj.lastHitTime += dt;

    // Sync Skill Cooldown from Store
    const skIdx = index * SkillStore.STRIDE;
    entityObj.skillCooldown = SkillStore.data[skIdx];

    if (entityObj.streakTimer > 0) {
      entityObj.streakTimer -= dt;
      if (entityObj.streakTimer <= 0) entityObj.killStreak = 0;
    }
  }

  private updateProjectilesDOD(state: GameState, dt: number): void {
    // EIDOLON-V FIX: Use MAX_ENTITIES - entityManager.count can miss entities
    const flags = StateStore.flags;

    // Use Index Loop for Projectiles
    for (let i = 0; i < MAX_ENTITIES; i++) {
      if (
        (flags[i] & (EntityFlags.ACTIVE | EntityFlags.PROJECTILE)) !==
        (EntityFlags.ACTIVE | EntityFlags.PROJECTILE)
      )
        continue;

      // Projectile Update Logic
      const projectile = EntityLookup[i] as Projectile; // Fallback to object for collision effect logic
      if (!projectile) continue;

      // Collision Check
      const hit = this.checkProjectileCollision(projectile, state);
      if (hit) {
        applyProjectileEffect(projectile, hit as Player | Bot, state);
        // Destroy Projectile (Deactivate)
        StateStore.clearFlag(i, EntityFlags.ACTIVE);
        StateStore.setFlag(i, EntityFlags.DEAD);
        projectile.isDead = true;
      }

      // Bounds Check
      const pIdx = i * 8;
      const px = TransformStore.data[pIdx];
      const py = TransformStore.data[pIdx + 1];
      const distSq = px * px + py * py;
      if (distSq > 3000 * 3000) {
        StateStore.clearFlag(i, EntityFlags.ACTIVE);
        StateStore.setFlag(i, EntityFlags.DEAD);
        projectile.isDead = true;
      }
    }
  }

  public updateClientVisuals(state: GameState, dt: number): void {
    // EIDOLON-V FIX: Bind engine and spatial grid at update time
    bindEngine(state.engine);
    this.spatialGrid = getCurrentSpatialGrid();

    // EIDOLON-V 2.2: Update viewport bounds for camera-based filtering
    this.updateViewportBounds(state);

    // EIDOLON-V: Pull Sync from DOD for Rendering (Phase 6)
    // Pass local player ID to always sync it regardless of position
    const localPlayerId = state.player?.id;
    this.syncBatchFromDOD(state.players, localPlayerId);
    this.syncBatchFromDOD(state.bots);
    this.syncBatchFromDOD(state.projectiles);

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
      poolSize: 0, // Batch arrays removed, now pure DOD iteration
      memoryUsage: 0, // TODO: Implement memory monitoring
    };
  }
}

// EIDOLON-V FIX: Export singleton optimized engine
export const optimizedEngine = OptimizedGameEngine.getInstance();
