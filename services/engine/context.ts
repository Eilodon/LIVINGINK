import { GRID_CELL_SIZE } from '../../constants';
import { IGameEngine, ISpatialGrid, IParticlePool } from '../../types/engine';
import { Entity, Particle } from '../../types/entity';
import { randomRange } from './math';

// --- Optimization: Persistent Spatial Grid ---
// WE DO NOT DESTROY THE GRID EVERY FRAME. WE REUSE THE ARRAYS.
// --- Optimization: Hierarchical Spatial Grid (The God Eye) ---
// Multiple layers for different query scales:
// Layer 0: Physics (Contact) - Cell Size ~100
// Layer 1: Local Awareness (Combat) - Cell Size ~300
// Layer 2: Network Culling / AI Vision - Cell Size ~1500
import { SpatialHashGrid, SpatialQueryResult } from '../spatial/SpatialHashGrid';

// --- Optimization: Persistent Spatial Grid ---
// ADAPTER: Wraps the new SOTA SpatialHashGrid to match legacy API used in OptimizedEngine
import { EntityLookup } from './dod/ComponentStores';

// --- Optimization: Persistent Spatial Grid ---
// ADAPTER: Wraps the new SOTA SpatialHashGrid to match legacy API used in OptimizedEngine
export class SpatialGrid implements ISpatialGrid {
  private grid: SpatialHashGrid;

  constructor() {
    this.grid = new SpatialHashGrid({
      worldSize: 6000,
      cellSize: 150,
      enableDynamicResizing: false // Legacy engine expects fixed behavior maybe?
    });
  }

  clear() {
    this.grid.clear();
  }

  // Clear only dynamic entities (used by optimized engine)
  clearDynamic() {
    this.grid.clearDynamic();
  }

  insert(entity: Entity) {
    if (entity.physicsIndex !== undefined) {
      this.grid.add(entity.physicsIndex, entity.isStatic);
    }
  }

  insertStatic(entity: Entity) {
    entity.isStatic = true;
    if (entity.physicsIndex !== undefined) {
      this.grid.add(entity.physicsIndex, true);
    }
  }

  removeStatic(entity: Entity) {
    if (entity.physicsIndex !== undefined) {
      this.grid.remove(entity.physicsIndex);
    }
  }

  // Legacy Adapter: Returns Objects (Slow)
  getNearby(entity: Entity, maxDistance: number = 200): Entity[] {
    const result = this.grid.queryRadius(entity.position, maxDistance);
    const entities: Entity[] = [];
    for (const idx of result.indices) {
      const obj = EntityLookup[idx];
      if (obj) entities.push(obj);
    }
    return entities;
  }

  // Legacy Adapter: Zero-allocation query (optimally supported by native methods, but adapter proxies it)
  // WARNING: This is now "Slow-allocation" because we must look up objects. 
  // Optimized Consumers should use `grid.queryRadiusInto` with indices directly.
  getNearbyInto(entity: Entity, outArray: Entity[], maxDistance: number = 200): number {
    // Temp array for indices
    const indices: number[] = [];
    this.grid.queryRadiusInto(entity.position.x, entity.position.y, maxDistance, indices);

    outArray.length = 0;
    for (const idx of indices) {
      const obj = EntityLookup[idx];
      if (obj) outArray.push(obj);
    }
    return outArray.length;
  }
}

// --- Optimization: Particle Pooling ---
class ParticlePool implements IParticlePool {
  private pool: Particle[] = [];
  private readonly MAX_POOL_SIZE = 2000; // Increased pool for 'The Swarm'
  private static nextId = 0; // EIDOLON-V FIX: Integer ID Counter

  get(x: number, y: number, color: string, speed: number): Particle {
    const p = this.pool.pop() || this.createNew();
    p.position.x = x;
    p.position.y = y;
    p.velocity.x = randomRange(-speed, speed);
    p.velocity.y = randomRange(-speed, speed);
    p.color = color;
    p.life = 1.0;
    p.maxLife = 1.0;
    p.style = undefined;
    p.lineLength = undefined;
    p.lineWidth = undefined;
    p.angle = undefined;
    p.isDead = false;
    p.radius = randomRange(3, 8);
    return p;
  }

  release(particle: Particle) {
    // Only keep particles in pool if under limit
    if (this.pool.length < this.MAX_POOL_SIZE) {
      particle.isDead = true; // Mark as dead just in case
      this.pool.push(particle);
    }
  }

  private createNew(): Particle {
    return {
      id: (ParticlePool.nextId++).toString(), // EIDOLON-V FIX: Sequential ID (Fast)
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 0,
      color: '',
      life: 0,
      maxLife: 1.0,
      isDead: true,
      trail: [],
    };
  }
}

// --- S-TIER: GameEngine Class (Encapsulated Singletons) ---
// Each GameState owns its own engine instance, preventing multi-mount issues.
import { PhysicsWorld } from './PhysicsWorld';

export class GameEngine implements IGameEngine {
  public spatialGrid: SpatialGrid;
  public particlePool: ParticlePool;
  public physicsWorld: PhysicsWorld;

  constructor() {
    this.spatialGrid = new SpatialGrid();
    this.particlePool = new ParticlePool();
    this.physicsWorld = new PhysicsWorld(); // EIDOLON-V: DOD Adapter manages capacity
  }
}

// Factory function for creating engine instances
export const createGameEngine = (): IGameEngine => new GameEngine();

// Module-level reference to current engine (set at start of each updateGameState call)
// This is safe because:
// 1. It's set FROM the state at the start of each frame
// 2. Only one game loop runs at a time per game instance
// 3. Each GameState owns its own GameEngine via state.engine
let currentEngine: IGameEngine | null = null;
let currentSpatialGrid: ISpatialGrid | null = null;

export const bindEngine = (engine: IGameEngine) => {
  currentEngine = engine;
  currentSpatialGrid = engine.spatialGrid;
};

export const getCurrentEngine = (): IGameEngine => {
  if (!currentEngine) {
    throw new Error('GameEngine not bound to update loop');
  }
  return currentEngine;
};

export const getCurrentSpatialGrid = (): ISpatialGrid => {
  if (!currentSpatialGrid) {
    throw new Error('Spatial grid not bound to update loop');
  }
  return currentSpatialGrid;
};

export const getPhysicsWorld = (): PhysicsWorld => {
  if (!currentEngine || !currentEngine.physicsWorld) {
    throw new Error('PhysicsWorld not bound to update loop');
  }
  return currentEngine.physicsWorld;
};
