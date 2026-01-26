// EIDOLON-V FORGE: SOTA 2026 Complete Integration Demo
// Shows how all forged systems work together

import { systemIntegrator, SystemIntegrationFactory } from '../engine/SystemIntegrator';
import { SpatialGrid } from '../spatial/SpatialHashGrid';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { fastMath, collisionSystem } from '../math/FastMath';
import { gameInputProcessor } from '../input/BufferedInput';

export interface GameEntity {
  id: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  radius: number;
  color: string;
  type: 'player' | 'food' | 'projectile';
  isDead?: boolean;
}

// EIDOLON-V FIX: Complete game integration example
export class IntegratedGameDemo {
  private spatialGrid: SpatialGrid;
  private entities: Map<string, GameEntity> = new Map();
  private integrator: any;
  private isRunning: boolean = false;

  constructor() {
    // EIDOLON-V FIX: Initialize spatial grid
    this.spatialGrid = new SpatialGrid({
      worldSize: 6000,
      cellSize: 100,
      maxEntities: 1000,
      enableDynamicResizing: true
    });
  }

  // EIDOLON-V FIX: Initialize all systems
  async initialize(): Promise<void> {
    console.log('🜂 EIDOLON-V: Initializing complete integration demo...');

    try {
      // EIDOLON-V FIX: Initialize system integrator
      this.integrator = SystemIntegrationFactory.createProductionIntegration();
      await this.integrator.initialize();

      // EIDOLON-V FIX: Register update callback
      this.integrator.onUpdate((dt: number) => {
        this.update(dt);
      });

      // EIDOLON-V FIX: Register render callback
      this.integrator.onRender((interpolation: number) => {
        this.render(interpolation);
      });

      // EIDOLON-V FIX: Create test entities
      this.createTestEntities();

      console.log('🜂 EIDOLON-V: Complete integration demo initialized');

    } catch (error) {
      console.error('🜂 EIDOLON-V: Integration demo failed:', error);
      throw error;
    }
  }

  // EIDOLON-V FIX: Create test entities using object pooling
  private createTestEntities(): void {
    console.log('🜂 Creating test entities...');

    // EIDOLON-V FIX: Create player entity
    const playerEntity: GameEntity = {
      id: 'player',
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 20,
      color: '#ff0000',
      type: 'player'
    };
    this.entities.set('player', playerEntity);
    this.spatialGrid.addEntity(playerEntity);

    // EIDOLON-V FIX: Create food entities using object pool
    const foodPool = pooledEntityFactory.createPooledFood();
    for (let i = 0; i < 100; i++) {
      const food = foodPool.acquire();
      const foodEntity: GameEntity = {
        id: `food_${i}`,
        position: {
          x: (Math.random() - 0.5) * 3000,
          y: (Math.random() - 0.5) * 3000
        },
        velocity: { x: 0, y: 0 },
        radius: 5,
        color: '#00ff00',
        type: 'food'
      };
      this.entities.set(foodEntity.id, foodEntity);
      this.spatialGrid.addEntity(foodEntity);
    }

    console.log(`🜂 Created ${this.entities.size} test entities`);
  }

  // EIDOLON-V FIX: Master update method using all systems
  private update(dt: number): void {
    if (!this.isRunning) return;

    // EIDOLON-V FIX: Process input
    const input = gameInputProcessor.processFrame();
    this.handleInput(input);

    // EIDOLON-V FIX: Update entities
    this.updateEntities(dt);

    // EIDOLON-V FIX: Process collisions using spatial grid
    this.processCollisions();

    // EIDOLON-V FIX: Update spatial grid
    this.updateSpatialGrid();

    // EIDOLON-V FIX: Remove dead entities
    this.removeDeadEntities();
  }

  // EIDOLON-V FIX: Handle input using buffered input system
  private handleInput(input: any): void {
    const player = this.entities.get('player');
    if (!player) return;

    // EIDOLON-V FIX: Process movement input
    const speed = 200; // pixels per second
    const moveX = input.joystick.x * speed * (1/60); // dt = 1/60 for 60fps
    const moveY = input.joystick.y * speed * (1/60);

    player.velocity.x = moveX;
    player.velocity.y = moveY;

    // EIDOLON-V FIX: Process action input
    if (input.actions.has('action')) {
      this.shootProjectile(player);
    }
  }

  // EIDOLON-V FIX: Update entities using fast math
  private updateEntities(dt: number): void {
    for (const entity of this.entities.values()) {
      if (entity.isDead) continue;

      // EIDOLON-V FIX: Update position using velocity
      entity.position.x += entity.velocity.x * dt;
      entity.position.y += entity.velocity.y * dt;

      // EIDOLON-V FIX: Apply friction
      entity.velocity.x *= 0.98;
      entity.velocity.y *= 0.98;

      // EIDOLON-V FIX: Constrain to world bounds
      const worldSize = 3000;
      entity.position.x = fastMath.clamp(entity.position.x, -worldSize, worldSize);
      entity.position.y = fastMath.clamp(entity.position.y, -worldSize, worldSize);
    }
  }

  // EIDOLON-V FIX: Process collisions using spatial grid and fast math
  private processCollisions(): void {
    const player = this.entities.get('player');
    if (!player || player.isDead) return;

    // EIDOLON-V FIX: Query nearby entities using spatial grid
    const nearbyEntities = this.spatialGrid.queryRadius(player.position, player.radius + 50);

    for (const nearby of nearbyEntities.entities) {
      if (nearby.id === player.id) continue; // EIDOLON-V FIX: Remove isDead check
      
      // EIDOLON-V FIX: Convert SpatialEntity to GameEntity for collision
      const gameEntity = this.entities.get(nearby.id);
      if (!gameEntity) continue;
      
      // EIDOLON-V FIX: Check collision using squared distance (no sqrt!)
      const distSq = fastMath.distanceSquared(player.position, gameEntity.position);
      const collisionDist = player.radius + gameEntity.radius;

      if (distSq <= collisionDist * collisionDist) {
        this.handleCollision(player, gameEntity);
      }
    }
  }

  // EIDOLON-V FIX: Handle collision between entities
  private handleCollision(entity1: GameEntity, entity2: GameEntity): void {
    if (entity1.type === 'player' && entity2.type === 'food') {
      // EIDOLON-V FIX: Player eats food
      entity2.isDead = true;
      console.log(`🜂 Player ate food ${entity2.id}`);
    } else if (entity1.type === 'projectile' && entity2.type === 'food') {
      // EIDOLON-V FIX: Projectile destroys food
      entity1.isDead = true;
      entity2.isDead = true;
      console.log(`🜂 Projectile ${entity1.id} destroyed food ${entity2.id}`);
    }
  }

  // EIDOLON-V FIX: Shoot projectile using object pool
  private shootProjectile(player: GameEntity): void {
    const projectilePool = pooledEntityFactory.createPooledProjectile();
    const projectile = projectilePool.acquire();
    
    const projectileEntity: GameEntity = {
      id: `projectile_${Date.now()}`,
      position: { ...player.position },
      velocity: {
        x: player.velocity.x * 2,
        y: player.velocity.y * 2
      },
      radius: 3,
      color: '#ffff00',
      type: 'projectile'
    };

    this.entities.set(projectileEntity.id, projectileEntity);
    this.spatialGrid.addEntity(projectileEntity);
  }

  // EIDOLON-V FIX: Update spatial grid for all entities
  private updateSpatialGrid(): void {
    for (const entity of this.entities.values()) {
      if (!entity.isDead) {
        this.spatialGrid.updateEntity(entity);
      }
    }
  }

  // EIDOLON-V FIX: Remove dead entities and return to pools
  private removeDeadEntities(): void {
    const deadEntities: string[] = [];

    for (const [id, entity] of this.entities) {
      if (entity.isDead) {
        deadEntities.push(id);
        this.spatialGrid.removeEntity(entity);

        // EIDOLON-V FIX: Return to appropriate pool
        if (entity.type === 'food') {
          const foodPool = pooledEntityFactory.createPooledFood();
          foodPool.release(entity as any);
        } else if (entity.type === 'projectile') {
          const projectilePool = pooledEntityFactory.createPooledProjectile();
          projectilePool.release(entity as any);
        }
      }
    }

    // EIDOLON-V FIX: Remove from entities map
    for (const id of deadEntities) {
      this.entities.delete(id);
    }

    if (deadEntities.length > 0) {
      console.log(`🜂 Removed ${deadEntities.length} dead entities`);
    }
  }

  // EIDOLON-V FIX: Render method (placeholder for actual rendering)
  private render(interpolation: number): void {
    // This would integrate with PixiJS or Canvas rendering
    // For now, just log stats
    if (Math.random() < 0.01) { // Log 1% of frames
      const stats = this.getPerformanceStats();
      console.log(`🜂 Render: ${stats.entityCount} entities, ${stats.fps.toFixed(1)} FPS`);
    }
  }

  // EIDOLON-V FIX: Start the demo
  start(): void {
    console.log('🜂 EIDOLON-V: Starting integrated game demo...');
    this.isRunning = true;
    this.integrator.start();
  }

  // EIDOLON-V FIX: Stop the demo
  stop(): void {
    console.log('🜂 EIDOLON-V: Stopping integrated game demo...');
    this.isRunning = false;
    this.integrator.stop();
  }

  // EIDOLON-V FIX: Get comprehensive performance stats
  getPerformanceStats() {
    const systemStats = this.integrator.getSystemStats();
    const spatialStats = this.spatialGrid.getStats();

    return {
      entityCount: this.entities.size,
      fps: systemStats.engine.fps,
      frameTime: systemStats.engine.frameTime,
      memory: systemStats.memory.usedJSHeapSize,
      pooling: systemStats.pooling,
      math: systemStats.math,
      input: systemStats.input,
      spatial: spatialStats
    };
  }

  // EIDOLON-V FIX: Get spatial grid visualization
  getSpatialVisualization(): string {
    return this.spatialGrid.visualize();
  }

  // EIDOLON-V FIX: Dispose demo
  dispose(): void {
    console.log('🜂 EIDOLON-V: Disposing integrated game demo...');
    
    this.stop();
    this.spatialGrid.clear();
    this.entities.clear();
    this.integrator.dispose();
  }
}

// EIDOLON-V FIX: Demo factory
export class IntegratedDemoFactory {
  // EIDOLON-V FIX: Create performance demo
  static createPerformanceDemo(): IntegratedGameDemo {
    const demo = new IntegratedGameDemo();
    // Configure for performance testing
    return demo;
  }

  // EIDOLON-V FIX: Create debug demo
  static createDebugDemo(): IntegratedGameDemo {
    const demo = new IntegratedGameDemo();
    // Configure for debugging
    return demo;
  }
}

// EIDOLON-V FORGE: Export demo class
export const integratedGameDemo = new IntegratedGameDemo();
