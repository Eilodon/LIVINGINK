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
class EntityArrayPool {
  private pools: Map<string, Entity[]> = new Map();
  
  getArray(type: string, size: number): Entity[] {
    const pool = this.pools.get(type);
    if (pool && pool.length >= size) {
      const array = pool.splice(0, size);
      array.length = size; // Ensure exact size
      return array;
    }
    
    // Create new array if pool empty or insufficient
    return new Array(size);
  }
  
  returnArray(type: string, array: Entity[]): void {
    // Clear array and return to pool
    array.length = 0;
    const pool = this.pools.get(type);
    if (pool) {
      pool.push(...array);
    } else {
      this.pools.set(type, [...array]);
    }
  }
}

// EIDOLON-V FIX: Optimized game engine with batch processing
class OptimizedGameEngine {
  private static instance: OptimizedGameEngine;
  private spatialGrid: any;
  private arrayPool: EntityArrayPool;
  private frameCount: number = 0;
  
  private constructor() {
    this.spatialGrid = getCurrentSpatialGrid();
    this.arrayPool = new EntityArrayPool();
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
    
    // Get arrays from pool
    const allArray = this.arrayPool.getArray('all', players.length + state.bots.length + state.projectiles.length + state.food.length);
    const playersArray = this.arrayPool.getArray('players', players.length);
    const botsArray = this.arrayPool.getArray('bots', state.bots.length);
    const projectilesArray = this.arrayPool.getArray('projectiles', state.projectiles.length);
    const foodArray = this.arrayPool.getArray('food', state.food.length);
    
    // Fill arrays
    for (let i = 0; i < players.length; i++) {
      playersArray[i] = players[i];
      allArray[i] = players[i];
    }
    
    let allIndex = players.length;
    for (let i = 0; i < state.bots.length; i++) {
      botsArray[i] = state.bots[i];
      allArray[allIndex++] = state.bots[i];
    }
    
    for (let i = 0; i < state.projectiles.length; i++) {
      projectilesArray[i] = state.projectiles[i];
      allArray[allIndex++] = state.projectiles[i];
    }
    
    for (let i = 0; i < state.food.length; i++) {
      foodArray[i] = state.food[i];
      allArray[allIndex++] = state.food[i];
    }
    
    const batch: EntityBatch = {
      players: playersArray,
      bots: botsArray,
      projectiles: projectilesArray,
      food: foodArray,
      all: allArray
    };
    
    return batch;
  }
  
  // EIDOLON-V FIX: Return arrays to pool
  private returnArrays(batch: EntityBatch): void {
    this.arrayPool.returnArray('all', batch.all);
    this.arrayPool.returnArray('players', batch.players);
    this.arrayPool.returnArray('bots', batch.bots);
    this.arrayPool.returnArray('projectiles', batch.projectiles);
    this.arrayPool.returnArray('food', batch.food);
  }
  
  // EIDOLON-V FIX: Batch physics integration
  private integratePhysics(batch: EntityBatch, dt: number): void {
    // Process all entities in single loop
    const allEntities = batch.all;
    const length = batch.players.length + batch.bots.length;
    
    for (let i = 0; i < length; i++) {
      const entity = allEntities[i];
      integrateEntity(entity, dt);
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
      applySkill(player, state);
    }
  }
  
  private updateBot(bot: Bot, state: GameState, dt: number): void {
    if (bot.isDead) return;
    
    // Bot AI update
    updateAI(bot, state, dt);
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
        applyProjectileEffect(projectile, hit, state);
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
      if (entity.id === projectile.ownerId) continue;
      
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
    if (player.matchPercent >= 0.8 && player.level >= 2) {
      state.tattooChoices = getTattooChoices(player);
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
      poolSize: this.arrayPool['pools'].size,
      memoryUsage: 0 // TODO: Implement memory monitoring
    };
  }
}

// EIDOLON-V FIX: Export singleton optimized engine
export const optimizedEngine = OptimizedGameEngine.getInstance();
