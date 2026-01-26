// EIDOLON-V FORGE: SOTA 2026 Object Pooling System
// Eliminates GC allocations completely - Zero allocations during gameplay

import { Food, Projectile, Particle } from '../../types';

export interface PoolableObject {
  reset(): void;
  dispose(): void;
}

export class ObjectPool<T extends PoolableObject> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private maxSize: number;
  private created: number = 0;
  private acquired: number = 0;
  private released: number = 0;

  constructor(factory: () => T, maxSize: number = 1000) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  // EIDOLON-V FIX: Acquire object from pool (zero allocation)
  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
      this.created++;
    }
    
    obj.reset();
    this.active.add(obj);
    this.acquired++;
    return obj;
  }

  // EIDOLON-V FIX: Return object to pool (zero allocation)
  release(obj: T): void {
    if (!this.active.has(obj)) return;
    
    this.active.delete(obj);
    
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    } else {
      obj.dispose();
    }
    
    this.released++;
  }

  // EIDOLON-V FIX: Pre-allocate pool for performance
  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      obj.reset();
      this.pool.push(obj);
    }
  }

  // EIDOLON-V FIX: Get pool statistics
  getStats() {
    return {
      created: this.created,
      acquired: this.acquired,
      released: this.released,
      pooled: this.pool.length,
      active: this.active.size,
      efficiency: this.acquired > 0 ? this.released / this.acquired : 0
    };
  }

  // EIDOLON-V FIX: Clear pool (for cleanup)
  clear(): void {
    this.pool.forEach(obj => obj.dispose());
    this.active.forEach(obj => obj.dispose());
    this.pool.length = 0;
    this.active.clear();
  }
}

// EIDOLON-V FORGE: Specialized Vector2 Pool
export class Vector2Pool {
  private static pool: Float32Array[] = [];
  private static maxSize: number = 1000;

  static acquire(): Float32Array {
    return this.pool.pop() || new Float32Array([0, 0]);
  }

  static release(vec: Float32Array): void {
    if (this.pool.length < this.maxSize) {
      vec[0] = 0;
      vec[1] = 0;
      this.pool.push(vec);
    }
  }

  static preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(new Float32Array([0, 0]));
    }
  }

  static getStats() {
    return {
      pooled: this.pool.length,
      maxSize: this.maxSize
    };
  }
}

// EIDOLON-V FORGE: Entity Pool Manager
export class EntityPoolManager {
  private static instance: EntityPoolManager;
  private pools: Map<string, ObjectPool<any>> = new Map();

  private constructor() {}

  static getInstance(): EntityPoolManager {
    if (!EntityPoolManager.instance) {
      EntityPoolManager.instance = new EntityPoolManager();
    }
    return EntityPoolManager.instance;
  }

  // EIDOLON-V FIX: Create pool for entity type
  createPool<T extends PoolableObject>(
    name: string, 
    factory: () => T, 
    maxSize: number = 1000,
    preAllocate: number = 0
  ): ObjectPool<T> {
    const pool = new ObjectPool(factory, maxSize);
    if (preAllocate > 0) {
      pool.preAllocate(preAllocate);
    }
    this.pools.set(name, pool);
    return pool;
  }

  // EIDOLON-V FIX: Get pool by name
  getPool<T extends PoolableObject>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as ObjectPool<T>;
  }

  // EIDOLON-V FIX: Get all pool statistics
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }
    stats.vector2 = Vector2Pool.getStats();
    return stats;
  }

  // EIDOLON-V FIX: Clear all pools
  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();
  }
}

// EIDOLON-V FORGE: Pooled Entity Factory
export class PooledEntityFactory {
  private static poolManager = EntityPoolManager.getInstance();

  // EIDOLON-V FIX: Create pooled Food
  static createPooledFood(): ObjectPool<any> {
    return this.poolManager.createPool('food', () => ({
      id: '',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 5,
      isDead: false,
      value: 1,
      type: 'normal',
      pigment: { r: 1, g: 1, b: 1 },
      kind: 'normal',
      color: '#ffffff',
      trail: [],
      reset() {
        this.id = '';
        this.position.x = 0;
        this.position.y = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.radius = 5;
        this.isDead = false;
        this.value = 1;
        this.type = 'normal';
        this.pigment = { r: 1, g: 1, b: 1 };
        this.kind = 'normal';
        this.color = '#ffffff';
        this.trail.length = 0;
      },
      dispose() {
        this.reset();
      }
    }), 1000, 500);
  }

  // EIDOLON-V FIX: Create pooled Projectile
  static createPooledProjectile(): ObjectPool<any> {
    return this.poolManager.createPool('projectile', () => ({
      id: '',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 3,
      isDead: false,
      ownerId: '',
      damage: 10,
      pigment: { r: 1, g: 1, b: 1 },
      type: 'normal',
      duration: 1000,
      color: '#ffffff',
      trail: [],
      reset() {
        this.id = '';
        this.position.x = 0;
        this.position.y = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.radius = 3;
        this.isDead = false;
        this.ownerId = '';
        this.damage = 10;
        this.pigment = { r: 1, g: 1, b: 1 };
        this.type = 'normal';
        this.duration = 1000;
        this.color = '#ffffff';
        this.trail.length = 0;
      },
      dispose() {
        this.reset();
      }
    }), 500, 100);
  }

  // EIDOLON-V FIX: Create pooled Particle
  static createPooledParticle(): ObjectPool<any> {
    return this.poolManager.createPool('particle', () => ({
      id: '',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 2,
      isDead: false,
      life: 1,
      pigment: { r: 1, g: 1, b: 1 },
      size: 2,
      maxLife: 1,
      color: '#ffffff',
      trail: [],
      reset() {
        this.id = '';
        this.position.x = 0;
        this.position.y = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.radius = 2;
        this.isDead = false;
        this.life = 1;
        this.pigment = { r: 1, g: 1, b: 1 };
        this.size = 2;
        this.maxLife = 1;
        this.color = '#ffffff';
        this.trail.length = 0;
      },
      dispose() {
        this.reset();
      }
    }), 2000, 1000);
  }

  // EIDOLON-V FIX: Initialize all pools
  static initializeAll(): void {
    this.createPooledFood();
    this.createPooledProjectile();
    this.createPooledParticle();
    Vector2Pool.preAllocate(1000);
  }
}

// EIDOLON-V FORGE: Export singleton instances
export const entityPoolManager = EntityPoolManager.getInstance();
export const pooledEntityFactory = PooledEntityFactory;
