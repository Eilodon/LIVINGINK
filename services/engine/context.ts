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
    this.grid.addEntity(entity);
  }

  insertStatic(entity: Entity) {
    entity.isStatic = true;
    this.grid.addEntity(entity);
  }

  removeStatic(entity: Entity) {
    this.grid.removeEntity(entity);
  }

  getNearby(entity: Entity, maxDistance: number = 200): Entity[] {
    const result = this.grid.queryRadius(entity.position, maxDistance);
    return result.entities;
  }

  // Zero-allocation query (optimally supported by native methods, but adapter proxies it)
  getNearbyInto(entity: Entity, outArray: Entity[], maxDistance: number = 200): number {
    // The new grid allocates array in queryRadius. 
    // To strictly support zero-alloc here, we would need to add queryInto to SpatialHashGrid.
    // For now, we accept the allocation overhead of the adapter OR modify SpatialHashGrid.
    // Given step 4 constraints, let's just copy result.
    const result = this.grid.queryRadius(entity.position, maxDistance);
    outArray.length = 0;
    for (let i = 0; i < result.entities.length; i++) {
      outArray.push(result.entities[i]);
    }
    return result.entities.length;
  }
}

// --- Optimization: Particle Pooling ---
class ParticlePool implements IParticlePool {
  private pool: Particle[] = [];
  private readonly MAX_POOL_SIZE = 100; // Prevent memory leaks

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
      this.pool.push(particle);
    }
  }

  private createNew(): Particle {
    return {
      id: Math.random().toString(),
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
    this.physicsWorld = new PhysicsWorld(500); // EIDOLON-V: Reduced, grows on demand
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
