// EIDOLON-V FIX: Optimized Game Engine with Batch Processing
// Eliminates O(n²) complexity and reduces function call overhead

import { GameState, Player, Bot, Food, Entity, Projectile } from '../../types';
import { gameStateManager } from './GameStateManager';
import { bindEngine, getCurrentSpatialGrid, getCurrentEngine } from './context';

import { updateAI } from './systems/ai';
import { applyProjectileEffect, resolveCombat, consumePickupDOD } from './systems/combat';
import { applySkill } from './systems/skills';
import { EntityFlags } from './dod/EntityFlags';
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
import { entityManager } from './dod/EntityManager'; // EIDOLON-V: DOD Manager

import { pooledEntityFactory } from '../pooling/ObjectPool';
import { filterInPlace } from '../utils/arrayUtils';
import { PhysicsSystem } from './dod/systems/PhysicsSystem';
import { MovementSystem } from './dod/systems/MovementSystem';
import { TransformStore, PhysicsStore, EntityLookup, StatsStore, StateStore, SkillStore, TattooStore, ProjectileStore, InputStore } from './dod/ComponentStores';
import { SkillSystem } from './dod/systems/SkillSystem';
import { TattooSystem } from './dod/systems/TattooSystem';
import { ConfigStore } from './dod/ConfigStore';

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

    const count = entityManager.count;
    const flags = StateStore.flags;

    for (let i = 0; i < count; i++) {
      // Filter: Active only
      if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;

      // Insert into Grid (Hybrid: Grid still expects Objects for now)
      // Ideally we'd have a DOD Grid, but this bridges the gap.
      const obj = EntityLookup[i];
      if (obj && !obj.isDead) { // Double check dead flag on object if needed
        grid.insert(obj);
      }
    }
  }

  private syncBatchFromDOD(entities: Entity[]): void {
    const tData = TransformStore.data;
    const pData = PhysicsStore.data;
    const sData = StatsStore.data; // EIDOLON-V: Stats Access
    const stateFlags = StateStore.flags;

    const count = entities.length;
    for (let i = 0; i < count; i++) {
      const ent = entities[i];
      const idx = ent.physicsIndex;
      if (idx !== undefined) {
        const tIdx = idx * 8;
        const pIdx = idx * 8;
        const sIdx = idx * 8; // Stats Stride 8

        ent.position.x = tData[tIdx];
        ent.position.y = tData[tIdx + 1];
        ent.velocity.x = pData[pIdx];
        ent.velocity.y = pData[pIdx + 1];

        // Sync Stats
        if ('score' in ent) {
          const unit = ent as any;
          unit.currentHealth = sData[sIdx];
          // ent.maxHealth = sData[sIdx+1]; // Usually static or managed by upgrades
          unit.score = sData[sIdx + 2];
          unit.matchPercent = sData[sIdx + 3];
        }

        // Sync Dead Flag
        ent.isDead = (stateFlags[idx] & EntityFlags.DEAD) !== 0;
      }
    }
  }

  // EIDOLON-V FIX: Optimized spatial grid updates
  // This method is replaced by updateSpatialGridDOD
  // private updateSpatialGrid(batch: EntityBatch): void {
  //   const grid = this.spatialGrid;

  //   // EIDOLON-V: Chỉ clear dynamic entities (Player, Bot, Projectile)
  //   grid.clearDynamic();

  //   // Re-insert dynamic entities explicitly by type to avoid Type Pollution
  //   const { players, bots, projectiles } = batch;

  //   for (let i = 0; i < players.length; i++) {
  //     grid.insert(players[i]);
  //   }

  //   for (let i = 0; i < bots.length; i++) {
  //     grid.insert(bots[i]);
  //   }

  //   for (let i = 0; i < projectiles.length; i++) {
  //     grid.insert(projectiles[i]);
  //   }
  // }

  // EIDOLON-V FIX: Magnet Logic (Pure DOD - No Object Lookup)
  private updateMagnetLogic(player: Player, state: GameState, dt: number): void {
    const rawGrid = (this.spatialGrid as any).grid;
    if (!rawGrid) return;

    // Safety check: Needs physics index
    const pIdx = player.physicsIndex;
    if (pIdx === undefined) return;

    // 1. Read Config from DOD (Single Source of Truth)
    const magnetRadius = ConfigStore.getMagneticRadius(pIdx);
    const catalystSense = (player.tattoos && player.tattoos.includes(TattooId.CatalystSense)); // Keep legacy Tattoo check for now or move to Store? 
    // Optimization: If magnetRadius is 0 and no catalyst sense, abort.
    if (magnetRadius <= 0 && !catalystSense) return;

    const catalystRange = (player.statusScalars.catalystSenseRange || 2.0) * 130;
    const searchRadius = catalystSense ? Math.max(catalystRange, magnetRadius) : magnetRadius;

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
      if ((flags & (EntityFlags.ACTIVE | EntityFlags.FOOD)) !== (EntityFlags.ACTIVE | EntityFlags.FOOD)) continue;
      if (flags & EntityFlags.DEAD) continue;

      // Catalyst Logic
      if (catalystSense && magnetRadius <= 0) {
        if ((flags & EntityFlags.FOOD_CATALYST) === 0) continue;
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

      const dx = ox - projectile.position.x;
      const dy = oy - projectile.position.y;
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
      // EIDOLON-V: Read from DOD Store
      let px = state.player.position.x;
      let py = state.player.position.y;

      if (state.player.physicsIndex !== undefined) {
        const tIdx = state.player.physicsIndex * 8;
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
    // EIDOLON-V FIX: Bind engine and spatial grid at update time
    bindEngine(state.engine);
    this.spatialGrid = getCurrentSpatialGrid();

    if (state.isPaused) return state;

    this.frameCount++;

    // 1. PHYSICS (Pure DOD)
    PhysicsSystem.update(dt);

    // 2. UPDATE GRID (DOD Iteration)
    this.updateSpatialGridDOD();

    // 3. LOGIC (DOD Iteration)
    const count = entityManager.count;
    const flags = StateStore.flags;

    for (let i = 0; i < count; i++) {
      if ((flags[i] & EntityFlags.ACTIVE) === 0) continue;

      const isPlayer = (flags[i] & EntityFlags.PLAYER) !== 0;
      const isBot = (flags[i] & EntityFlags.BOT) !== 0;

      // A. MOVEMENT & LOGIC (Pure DOD)
      if (isPlayer || isBot) {
        // Sync Bot/Player Target to InputStore (Hybrid Bridge)
        const obj = EntityLookup[i] as Player | Bot;

        if (obj) {
          if (isBot) {
            // AI Runs on Object -> Writes to Store
            updateAI(obj as Bot, state, dt);
            // Sync Target to InputStore
            const bot = obj as Bot;
            if (bot.targetPosition) {
              InputStore.setTarget(i, bot.targetPosition.x, bot.targetPosition.y);
            }
          } else {
            // Player Input: Sync InputManager target to Store
            // (Assuming InputManager updates obj.targetPosition or we read it here)
            const player = obj as Player;
            if (player.targetPosition) {
              InputStore.setTarget(i, player.targetPosition.x, player.targetPosition.y);
            }

            // Skill Input (read from InputStore)
            if (InputStore.consumeSkillInput(i)) {
              SkillSystem.handleInput(i, { space: true, target: player.targetPosition }, state);
            }
          }

          // Config ConfigStore (Radius/Damage) from Object if it changed?
          // Doing this every frame is costly. Ideally only on change.
          // For now, assume ConfigStore is authoritative or synced elsewhere.

          // Visual Juice Decay (Object state)
          if (obj.aberrationIntensity && obj.aberrationIntensity > 0) {
            obj.aberrationIntensity -= dt * 3.0;
            if (obj.aberrationIntensity < 0) obj.aberrationIntensity = 0;
          }

          // Stats Regen & Cooldowns
          this.updateEntityTimers(i, obj, dt);
        }

        // CHẠY MOVEMENT (Pure DOD)
        MovementSystem.update(i, dt);

        // MAGNET (Pure DOD)
        if (obj && isPlayer) { // Magnet logic usually for players/bots
          this.updateMagnetLogic(obj as Player, state, dt);
        }

        // COLLISION (Pure DOD Check -> Hybrid Resolve)
        if (obj) {
          this.checkUnitCollisions(obj as Player, state, dt);
        }
      }
    }

    // 4. CJR SYSTEMS (DOD Iteration)
    for (let i = 0; i < count; i++) {
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
    vfxIntegrationManager.update(state, dt);
    tattooSynergyManager.updateSynergies(state, dt);

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
    const count = entityManager.count;
    const flags = StateStore.flags;

    // Use Index Loop for Projectiles
    for (let i = 0; i < count; i++) {
      if ((flags[i] & (EntityFlags.ACTIVE | EntityFlags.PROJECTILE)) !== (EntityFlags.ACTIVE | EntityFlags.PROJECTILE)) continue;

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

    // EIDOLON-V: Pull Sync from DOD for Rendering (Phase 6)
    // Disabled in integratePhysics, so we sync here for the View.
    this.syncBatchFromDOD(state.players);
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
      memoryUsage: 0 // TODO: Implement memory monitoring
    };
  }
}

// EIDOLON-V FIX: Export singleton optimized engine
export const optimizedEngine = OptimizedGameEngine.getInstance();
