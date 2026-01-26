import { GRID_CELL_SIZE } from '../../constants';
import { Entity, Particle } from '../../types/entity';
import { randomRange } from './math';

// --- Optimization: Persistent Spatial Grid ---
// WE DO NOT DESTROY THE GRID EVERY FRAME. WE REUSE THE ARRAYS.
// --- Optimization: Hierarchical Spatial Grid (The God Eye) ---
// Multiple layers for different query scales:
// Layer 0: Physics (Contact) - Cell Size ~100
// Layer 1: Local Awareness (Combat) - Cell Size ~300
// Layer 2: Network Culling / AI Vision - Cell Size ~1500
class SpatialGrid {
  private layers: { cellSize: number; grid: Map<number, Entity[]> }[];
  private usageTimestamps: Map<number, number> = new Map();
  private frameCount: number = 0;

  constructor() {
    // Defined resolutions
    this.layers = [
      { cellSize: 150, grid: new Map() },  // 0: High Precision
      { cellSize: 450, grid: new Map() },  // 1: Medium Range
      { cellSize: 1500, grid: new Map() }  // 2: Long Range (Vision)
    ];
  }

  // INTEGER key via bit-shifting
  private getKey(cellX: number, cellY: number): number {
    // 16-bit packed coordinates (Limits world to +/- 32768 cells)
    // For 150 size, that's roughly 5,000,000 units. Plenty.
    return ((cellX + 32768) << 16) | ((cellY + 32768) & 0xFFFF);
  }

  clear() {
    this.frameCount++;
    for (const layer of this.layers) {
      for (const bucket of layer.grid.values()) {
        bucket.length = 0;
      }

      // Garbage Collection for empty buckets (staggered)
      if (this.frameCount % 120 === 0) {
        for (const [key, bucket] of layer.grid.entries()) {
          if (bucket.length === 0) layer.grid.delete(key);
        }
      }
    }
  }

  insert(entity: Entity) {
    for (const layer of this.layers) {
      const cx = Math.floor(entity.position.x / layer.cellSize);
      const cy = Math.floor(entity.position.y / layer.cellSize);
      const key = this.getKey(cx, cy);

      let bucket = layer.grid.get(key);
      if (!bucket) {
        bucket = [];
        layer.grid.set(key, bucket);
      }
      bucket.push(entity);
    }
  }

  /**
   * Get nearby entities using the most appropriate layer for the requested range.
   * Auto-selects layer based on maxDistance.
   */
  getNearby(entity: Entity, maxDistance: number = 200): Entity[] {
    // Select appropriate layer
    // We want the cell size that is roughly >= 2 * maxDistance, or slightly smaller?
    // Actually, smaller cell size = more checks but less entities per cell.
    // Larger cell size = fewer checks but more entities.
    // Best practice: Cell Size ~= Query Diameter (2 * r).
    // range 100 -> Layer 0 (150)
    // range 300 -> Layer 1 (450)
    // range 1000 -> Layer 2 (1500)

    let layerIdx = 0;
    if (maxDistance > 600) layerIdx = 2;
    else if (maxDistance > 200) layerIdx = 1;

    const layer = this.layers[layerIdx];
    const cellSize = layer.cellSize;

    const cx = Math.floor(entity.position.x / cellSize);
    const cy = Math.floor(entity.position.y / cellSize);
    const distSq = maxDistance * maxDistance;

    const nearby: Entity[] = [];

    // Check 3x3 neighbor cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this.getKey(cx + dx, cy + dy);
        const bucket = layer.grid.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            const other = bucket[i];
            if (other === entity) continue;

            const ddx = other.position.x - entity.position.x;
            const ddy = other.position.y - entity.position.y;
            if (ddx * ddx + ddy * ddy <= distSq) {
              nearby.push(other);
            }
          }
        }
      }
    }
    return nearby;
  }
}

// --- Optimization: Particle Pooling ---
class ParticlePool {
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

export class GameEngine {
  public spatialGrid: SpatialGrid;
  public particlePool: ParticlePool;
  public physicsWorld: PhysicsWorld;

  constructor() {
    this.spatialGrid = new SpatialGrid();
    this.particlePool = new ParticlePool();
    this.physicsWorld = new PhysicsWorld(5000); // Capacity 5000
  }
}

// Factory function for creating engine instances
export const createGameEngine = (): GameEngine => new GameEngine();

// Module-level reference to current engine (set at start of each updateGameState call)
// This is safe because:
// 1. It's set FROM the state at the start of each frame
// 2. Only one game loop runs at a time per game instance
// 3. Each GameState owns its own GameEngine via state.engine
let currentEngine: GameEngine | null = null;
let currentSpatialGrid: SpatialGrid | null = null;

export const bindEngine = (engine: GameEngine) => {
  currentEngine = engine;
  currentSpatialGrid = engine.spatialGrid;
};

export const getCurrentEngine = () => {
  if (!currentEngine) {
    throw new Error('GameEngine not bound to update loop');
  }
  return currentEngine;
};

export const getCurrentSpatialGrid = () => {
  if (!currentSpatialGrid) {
    throw new Error('Spatial grid not bound to update loop');
  }
  return currentSpatialGrid;
};
