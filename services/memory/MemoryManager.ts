// EIDOLON-V FIX: Comprehensive Memory Management System
// Eliminates memory leaks and optimizes resource usage

export interface MemoryStats {
  totalObjects: number;
  pooledObjects: number;
  activeObjects: number;
  memoryUsage: number;
  gcPressure: number;
}

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
  private disposed: number = 0;

  constructor(factory: () => T, maxSize: number = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
      this.created++;
    }
    
    obj.reset();
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) return;
    
    this.active.delete(obj);
    
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    } else {
      obj.dispose();
      this.disposed++;
    }
  }

  getStats(): { created: number; disposed: number; pooled: number; active: number } {
    return {
      created: this.created,
      disposed: this.disposed,
      pooled: this.pool.length,
      active: this.active.size
    };
  }

  clear(): void {
    // Dispose all objects
    this.pool.forEach(obj => obj.dispose());
    this.active.forEach(obj => obj.dispose());
    
    this.pool.length = 0;
    this.active.clear();
  }
}

// EIDOLON-V FIX: Memory Manager for tracking and optimization
export class MemoryManager {
  private static instance: MemoryManager;
  private pools: Map<string, ObjectPool<any>> = new Map();
  private allocations: Map<string, number> = new Map();
  private frameAllocations: number = 0;
  private frameDeallocations: number = 0;
  private gcThreshold: number = 1000;
  private lastGCTime: number = 0;

  private constructor() {
    this.startMemoryMonitoring();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // EIDOLON-V FIX: Create object pool
  public createPool<T extends PoolableObject>(
    name: string, 
    factory: () => T, 
    maxSize: number = 100
  ): ObjectPool<T> {
    const pool = new ObjectPool(factory, maxSize);
    this.pools.set(name, pool);
    return pool;
  }

  // EIDOLON-V FIX: Get pool by name
  public getPool<T extends PoolableObject>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as ObjectPool<T>;
  }

  // EIDOLON-V FIX: Track memory allocation
  public trackAllocation(name: string, size: number): void {
    this.frameAllocations++;
    const current = this.allocations.get(name) || 0;
    this.allocations.set(name, current + size);
  }

  // EIDOLON-V FIX: Track memory deallocation
  public trackDeallocation(name: string, size: number): void {
    this.frameDeallocations++;
    const current = this.allocations.get(name) || 0;
    this.allocations.set(name, Math.max(0, current - size));
  }

  // EIDOLON-V FIX: Get memory statistics
  public getMemoryStats(): MemoryStats {
    let totalObjects = 0;
    let pooledObjects = 0;
    let activeObjects = 0;

    for (const [name, pool] of this.pools) {
      const stats = pool.getStats();
      totalObjects += stats.created;
      pooledObjects += stats.pooled;
      activeObjects += stats.active;
    }

    // Estimate memory usage (rough calculation)
    const memoryUsage = this.estimateMemoryUsage();
    const gcPressure = this.calculateGCPressure();

    return {
      totalObjects,
      pooledObjects,
      activeObjects,
      memoryUsage,
      gcPressure
    };
  }

  // EIDOLON-V FIX: Force garbage collection
  public forceGC(): void {
    if (window.gc) {
      window.gc();
    }
    
    // Clear pools if necessary
    this.clearOldPools();
    
    this.lastGCTime = performance.now();
  }

  // EIDOLON-V FIX: Automatic memory management
  public update(): void {
    const now = performance.now();
    
    // Check if GC is needed
    if (this.shouldTriggerGC(now)) {
      this.forceGC();
    }
    
    // Reset frame counters
    this.frameAllocations = 0;
    this.frameDeallocations = 0;
  }

  // EIDOLON-V FIX: Cleanup all pools
  public dispose(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();
    this.allocations.clear();
  }

  private startMemoryMonitoring(): void {
    // Monitor memory usage periodically
    setInterval(() => {
      this.update();
    }, 1000); // Update every second
  }

  private estimateMemoryUsage(): number {
    let total = 0;
    
    // Estimate pool memory
    for (const [name, pool] of this.pools) {
      const stats = pool.getStats();
      total += (stats.pooled + stats.active) * 100; // Rough estimate
    }
    
    // Add tracked allocations
    for (const [name, size] of this.allocations) {
      total += size;
    }
    
    return total;
  }

  private calculateGCPressure(): number {
    const allocationRate = this.frameAllocations;
    const deallocationRate = this.frameDeallocations;
    const netAllocation = allocationRate - deallocationRate;
    
    // Higher pressure when more allocations than deallocations
    return Math.max(0, netAllocation / 100);
  }

  private shouldTriggerGC(now: number): boolean {
    const timeSinceLastGC = now - this.lastGCTime;
    const highGCPressure = this.calculateGCPressure() > 0.5;
    const longTimeSinceGC = timeSinceLastGC > 30000; // 30 seconds
    
    return highGCPressure || longTimeSinceGC;
  }

  private clearOldPools(): void {
    for (const [name, pool] of this.pools) {
      const stats = pool.getStats();
      
      // Clear pools with high disposal rate
      if (stats.disposed > stats.created * 2) {
        pool.clear();
      }
    }
  }
}

// EIDOLON-V FIX: Predefined pools for common objects
export class CommonPools {
  private static memoryManager = MemoryManager.getInstance();
  
  // Vector pool
  public static vector2Pool = this.memoryManager.createPool('vector2', () => ({
    x: 0,
    y: 0,
    reset() { this.x = 0; this.y = 0; },
    dispose() { /* No cleanup needed */ }
  }), 1000);
  
  // Array pool
  public static arrayPool = this.memoryManager.createPool('array', () => {
    const arr: any[] = [];
    // EIDOLON-V FIX: Add required PoolableObject methods
    (arr as any).reset = () => arr.length = 0;
    (arr as any).dispose = () => arr.length = 0;
    return arr as any;
  }, 500);
  
  // Entity pool (simplified)
  public static entityPool = this.memoryManager.createPool('entity', () => ({
    id: '',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: 0,
    isDead: false,
    reset() {
      this.id = '';
      this.position.x = 0;
      this.position.y = 0;
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.radius = 0;
      this.isDead = false;
    },
    dispose() {
      this.reset();
    }
  }), 1000);
}

// EIDOLON-V FIX: Memory monitoring utilities
export class MemoryMonitor {
  private static memoryManager = MemoryManager.getInstance();
  
  // Get detailed memory report
  public static getDetailedReport(): {
    timestamp: number;
    stats: MemoryStats;
    pools: Record<string, any>;
    allocations: Record<string, number>;
  } {
    return {
      timestamp: performance.now(),
      stats: this.memoryManager.getMemoryStats(),
      pools: this.getPoolStats(),
      allocations: this.getAllocationStats()
    };
  }
  
  // Get pool statistics
  private static getPoolStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    const memoryManager = MemoryManager.getInstance();
    
    for (const [name, pool] of memoryManager['pools']) {
      stats[name] = pool.getStats();
    }
    
    return stats;
  }
  
  // Get allocation statistics
  private static getAllocationStats(): Record<string, number> {
    const memoryManager = MemoryManager.getInstance();
    return Object.fromEntries(memoryManager['allocations']);
  }
  
  // Check for memory leaks
  public static detectMemoryLeaks(): {
    hasLeaks: boolean;
    leakyPools: string[];
    recommendations: string[];
  } {
    const stats = this.memoryManager.getMemoryStats();
    const poolStats = this.getPoolStats();
    const leakyPools: string[] = [];
    const recommendations: string[] = [];
    
    // Check for pools with high disposal rates
    for (const [name, poolStat] of Object.entries(poolStats)) {
      const disposalRate = poolStat.disposed / Math.max(1, poolStat.created);
      if (disposalRate > 0.8) {
        leakyPools.push(name);
        recommendations.push(`Consider reducing pool size for ${name} or investigating object lifecycle`);
      }
    }
    
    // Check for high GC pressure
    if (stats.gcPressure > 0.7) {
      recommendations.push('High GC pressure detected - consider reducing object creation');
    }
    
    // Check for low pool efficiency
    const poolEfficiency = stats.pooledObjects / Math.max(1, stats.totalObjects);
    if (poolEfficiency < 0.3) {
      recommendations.push('Low pool efficiency - consider increasing pool sizes or reducing object creation');
    }
    
    return {
      hasLeaks: leakyPools.length > 0 || stats.gcPressure > 0.7,
      leakyPools,
      recommendations
    };
  }
}

// EIDOLON-V FIX: Export singleton instance
export const memoryManager = MemoryManager.getInstance();
