/**
 * PHASE 2: O(N²) Performance Optimizations
 * Eliminate quadratic complexity bottlenecks in game loop
 */

import { profiler, profile } from './Profiler';
import { logger } from '../logging/Logger';

export interface CollisionPair {
  entityA: any;
  entityB: any;
  distance: number;
}

export interface SpatialGrid {
  width: number;
  height: number;
  cellSize: number;
  grid: Map<string, Set<any>>;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private spatialGrid: SpatialGrid;
  private collisionCache: Map<string, CollisionPair[]> = new Map();
  private lastCacheUpdate = 0;
  private cacheValidityPeriod = 100; // 100ms
  
  private constructor() {
    this.spatialGrid = {
      width: 3400,
      height: 3400,
      cellSize: 100,
      grid: new Map()
    };
  }
  
  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }
  
  // EIDOLON-V PHASE2: Optimized collision detection using spatial grid
  @profile('collision_detection')
  detectCollisions(entities: any[], maxDistance: number): CollisionPair[] {
    const startTime = Date.now();
    
    // Check if we can use cached results
    const cacheKey = this.generateCacheKey(entities, maxDistance);
    if (this.canUseCachedResult(cacheKey)) {
      const cached = this.collisionCache.get(cacheKey);
      if (cached) {
        logger.debug('Using cached collision results', { pairs: cached.length });
        return cached;
      }
    }
    
    // Build spatial grid
    this.buildSpatialGrid(entities);
    
    // Find collisions using spatial grid (O(N) instead of O(N²))
    const collisions: CollisionPair[] = [];
    const checkedPairs = new Set<string>();
    
    for (const entity of entities) {
      if (entity.isDead) continue;
      
      // Get nearby entities from spatial grid
      const nearbyEntities = this.getNearbyEntities(entity, maxDistance);
      
      for (const nearby of nearbyEntities) {
        if (nearby.isDead || nearby === entity) continue;
        
        // Create unique pair key to avoid duplicate checks
        const pairKey = this.createPairKey(entity.id, nearby.id);
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        
        // Calculate distance
        const dx = entity.position.x - nearby.position.x;
        const dy = entity.position.y - nearby.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= maxDistance) {
          collisions.push({
            entityA: entity,
            entityB: nearby,
            distance
          });
        }
      }
    }
    
    // Cache results
    this.collisionCache.set(cacheKey, collisions);
    this.lastCacheUpdate = Date.now();
    
    const duration = Date.now() - startTime;
    logger.debug('Collision detection completed', {
      entities: entities.length,
      collisions: collisions.length,
      duration
    });
    
    return collisions;
  }
  
  // EIDOLON-V PHASE2: Build spatial grid for efficient collision detection
  private buildSpatialGrid(entities: any[]): void {
    // Clear existing grid
    this.spatialGrid.grid.clear();
    
    // Add entities to grid cells
    for (const entity of entities) {
      if (entity.isDead) continue;
      
      const cells = this.getEntityCells(entity);
      for (const cellKey of cells) {
        if (!this.spatialGrid.grid.has(cellKey)) {
          this.spatialGrid.grid.set(cellKey, new Set());
        }
        this.spatialGrid.grid.get(cellKey)!.add(entity);
      }
    }
  }
  
  // EIDOLON-V PHASE2: Get grid cells for an entity
  private getEntityCells(entity: any): string[] {
    const cells: string[] = [];
    const radius = entity.radius || 50;
    
    const minX = Math.floor((entity.position.x - radius) / this.spatialGrid.cellSize);
    const maxX = Math.floor((entity.position.x + radius) / this.spatialGrid.cellSize);
    const minY = Math.floor((entity.position.y - radius) / this.spatialGrid.cellSize);
    const maxY = Math.floor((entity.position.y + radius) / this.spatialGrid.cellSize);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    
    return cells;
  }
  
  // EIDOLON-V PHASE2: Get nearby entities from spatial grid
  private getNearbyEntities(entity: any, maxDistance: number): any[] {
    const nearby: any[] = [];
    const cells = this.getEntityCells(entity);
    
    for (const cellKey of cells) {
      const cellEntities = this.spatialGrid.grid.get(cellKey);
      if (cellEntities) {
        for (const cellEntity of cellEntities) {
          if (!nearby.includes(cellEntity)) {
            nearby.push(cellEntity);
          }
        }
      }
    }
    
    return nearby;
  }
  
  // EIDOLON-V PHASE2: Generate cache key for collision results
  private generateCacheKey(entities: any[], maxDistance: number): string {
    // Create a hash based on entity positions and max distance
    const positions = entities
      .filter(e => !e.isDead)
      .map(e => `${e.id}:${Math.round(e.position.x)}:${Math.round(e.position.y)}`)
      .sort()
      .join('|');
    
    return `${positions}:${maxDistance}`;
  }
  
  // EIDOLON-V PHASE2: Check if cached result is still valid
  private canUseCachedResult(cacheKey: string): boolean {
    return this.collisionCache.has(cacheKey) && 
           (Date.now() - this.lastCacheUpdate) < this.cacheValidityPeriod;
  }
  
  // EIDOLON-V PHASE2: Create unique pair key
  private createPairKey(id1: string, id2: string): string {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }
  
  // EIDOLON-V PHASE2: Optimized entity synchronization
  @profile('entity_sync')
  syncEntities(entities: any[], state: any): void {
    // Batch process entities to reduce individual operations
    const batchSize = 50;
    const batches: any[][] = [];
    
    for (let i = 0; i < entities.length; i += batchSize) {
      batches.push(entities.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      this.processEntityBatch(batch, state);
    }
  }
  
  // EIDOLON-V PHASE2: Process entity batch
  private processEntityBatch(batch: any[], state: any): void {
    // Collect all updates
    const updates: Array<{ id: string; data: any }> = [];
    
    for (const entity of batch) {
      if (entity.isDead) continue;
      
      const updateData = {
        position: { x: entity.position.x, y: entity.position.y },
        velocity: { x: entity.velocity.x, y: entity.velocity.y },
        radius: entity.radius,
        score: entity.score,
        currentHealth: entity.currentHealth
      };
      
      updates.push({ id: entity.id, data: updateData });
    }
    
    // Apply batch updates
    this.applyBatchUpdates(updates, state);
  }
  
  // EIDOLON-V PHASE2: Apply batch updates to state
  private applyBatchUpdates(updates: Array<{ id: string; data: any }>, state: any): void {
    for (const update of updates) {
      let serverEntity = state.players.get(update.id) || 
                        state.bots.get(update.id) || 
                        state.food.get(update.id);
      
      if (serverEntity) {
        Object.assign(serverEntity, update.data);
      }
    }
  }
  
  // EIDOLON-V PHASE2: Optimized input processing
  @profile('input_processing')
  processInputs(inputs: Map<string, any>, state: any): void {
    // Process inputs in batch
    const inputArray = Array.from(inputs.entries());
    const batchSize = 20;
    
    for (let i = 0; i < inputArray.length; i += batchSize) {
      const batch = inputArray.slice(i, i + batchSize);
      this.processInputBatch(batch, state);
    }
  }
  
  // EIDOLON-V PHASE2: Process input batch
  private processInputBatch(batch: Array<[string, any]>, state: any): void {
    for (const [sessionId, input] of batch) {
      const player = state.players.get(sessionId);
      if (!player || player.isDead) continue;
      
      // Apply input validation and updates
      if (input.targetX !== undefined && input.targetY !== undefined) {
        player.targetPosition = { x: input.targetX, y: input.targetY };
      }
      
      if (input.space !== undefined) {
        player.inputs = { ...player.inputs, space: input.space };
      }
      
      if (input.w !== undefined) {
        player.inputs = { ...player.inputs, w: input.w };
      }
    }
  }
  
  // EIDOLON-V PHASE2: Memory optimization - cleanup old data
  optimizeMemory(): void {
    // Clean up old collision cache
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheValidityPeriod * 10) {
      this.collisionCache.clear();
      logger.debug('Collision cache cleared due to age');
    }
    
    // Limit cache size
    if (this.collisionCache.size > 100) {
      const entries = Array.from(this.collisionCache.entries());
      entries.sort((a, b) => a[1].length - b[1].length);
      
      // Keep only the 100 most useful caches
      this.collisionCache.clear();
      for (let i = 0; i < Math.min(100, entries.length); i++) {
        this.collisionCache.set(entries[i][0], entries[i][1]);
      }
    }
  }
  
  // EIDOLON-V PHASE2: Get performance statistics
  getPerformanceStats(): {
    spatialGridSize: number;
    collisionCacheSize: number;
    lastCacheUpdate: number;
    cacheValidityPeriod: number;
  } {
    return {
      spatialGridSize: this.spatialGrid.grid.size,
      collisionCacheSize: this.collisionCache.size,
      lastCacheUpdate: this.lastCacheUpdate,
      cacheValidityPeriod: this.cacheValidityPeriod
    };
  }
  
  // EIDOLON-V PHASE2: Reset optimizer state
  reset(): void {
    this.spatialGrid.grid.clear();
    this.collisionCache.clear();
    this.lastCacheUpdate = 0;
    logger.info('Performance optimizer reset');
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const optimizer = PerformanceOptimizer.getInstance();
