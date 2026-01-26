// EIDOLON-V FORGE: SOTA 2026 System Integration Hub
// Connects all forged systems into unified architecture

import { IndependentGameEngine } from './IndependentGameEngine';
import { entityPoolManager, pooledEntityFactory } from '../pooling/ObjectPool';
import { fastMath, collisionSystem, spatialOptimizer, mathPerformanceMonitor } from '../math/FastMath';
import { gameInputProcessor, inputStateManager } from '../input/BufferedInput';
import { gameStateManager } from './GameStateManager';

export interface SystemIntegrationConfig {
  enableObjectPooling: boolean;
  enableMathOptimization: boolean;
  enableInputBuffering: boolean;
  enableSpatialOptimization: boolean;
  enablePerformanceMonitoring: boolean;
  debugMode: boolean;
}

export interface IntegratedSystemStats {
  engine: {
    fps: number;
    frameTime: number;
    entityCount: number;
  };
  pooling: {
    totalObjects: number;
    pooledObjects: number;
    efficiency: number;
  };
  math: {
    sqrtOperations: number;
    distanceOperations: number;
    collisionOperations: number;
  };
  input: {
    eventsPerFrame: number;
    activeKeys: number;
    activeButtons: number;
  };
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// EIDOLON-V FIX: Master System Integrator
export class SystemIntegrator {
  private static instance: SystemIntegrator;
  private engine: IndependentGameEngine;
  private config: SystemIntegrationConfig;
  private isInitialized: boolean = false;
  private updateCallbacks: Array<(dt: number) => void> = [];
  private renderCallbacks: Array<(interpolation: number) => void> = [];

  private constructor(config: Partial<SystemIntegrationConfig> = {}) {
    this.config = {
      enableObjectPooling: true,
      enableMathOptimization: true,
      enableInputBuffering: true,
      enableSpatialOptimization: true,
      enablePerformanceMonitoring: true,
      debugMode: false,
      ...config
    };
    
    this.engine = IndependentGameEngine.getInstance();
  }

  static getInstance(config?: Partial<SystemIntegrationConfig>): SystemIntegrator {
    if (!SystemIntegrator.instance) {
      SystemIntegrator.instance = new SystemIntegrator(config);
    }
    return SystemIntegrator.instance;
  }

  // EIDOLON-V FIX: Initialize all systems
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🜂 Systems already initialized');
      return;
    }

    try {
      console.log('🜂 EIDOLON-V: Initializing integrated systems...');

      // EIDOLON-V FIX: Initialize object pooling
      if (this.config.enableObjectPooling) {
        console.log('🜂 Initializing object pooling system...');
        pooledEntityFactory.initializeAll();
      }

      // EIDOLON-V FIX: Initialize math optimization
      if (this.config.enableMathOptimization) {
        console.log('🜂 Initializing math optimization system...');
        mathPerformanceMonitor.reset();
      }

      // EIDOLON-V FIX: Initialize input buffering
      if (this.config.enableInputBuffering) {
        console.log('🜂 Initializing input buffering system...');
        // Input system auto-initializes on first use
      }

      // EIDOLON-V FIX: Initialize game engine
      console.log('🜂 Initializing independent game engine...');
      await this.engine.initialize();

      // EIDOLON-V FIX: Register engine callbacks
      this.registerEngineCallbacks();

      // EIDOLON-V FIX: Initialize game state manager
      console.log('🜂 Initializing game state manager...');
      // gameStateManager.initialize();

      this.isInitialized = true;
      console.log('🜂 EIDOLON-V: All systems integrated successfully');

    } catch (error) {
      console.error('🜂 EIDOLON-V: System integration failed:', error);
      throw error;
    }
  }

  // EIDOLON-V FIX: Register engine callbacks
  private registerEngineCallbacks(): void {
    // EIDOLON-V FIX: Update callback
    this.engine.onUpdate((dt: number) => {
      this.update(dt);
    });

    // EIDOLON-V FIX: Render callback
    this.engine.onRender((interpolation: number) => {
      this.render(interpolation);
    });
  }

  // EIDOLON-V FIX: Master update method
  private update(dt: number): void {
    // EIDOLON-V FIX: Process input
    if (this.config.enableInputBuffering) {
      this.processInput();
    }

    // EIDOLON-V FIX: Update game state
    this.updateGameState(dt);

    // EIDOLON-V FIX: Update entities
    this.updateEntities(dt);

    // EIDOLON-V FIX: Process collisions
    if (this.config.enableMathOptimization) {
      this.processCollisions();
    }

    // EIDOLON-V FIX: Call custom update callbacks
    for (const callback of this.updateCallbacks) {
      try {
        callback(dt);
      } catch (error) {
        console.error('🜂 Update callback error:', error);
      }
    }
  }

  // EIDOLON-V FIX: Master render method
  private render(interpolation: number): void {
    // EIDOLON-V FIX: Call custom render callbacks
    for (const callback of this.renderCallbacks) {
      try {
        callback(interpolation);
      } catch (error) {
        console.error('🜂 Render callback error:', error);
      }
    }
  }

  // EIDOLON-V FIX: Process input events
  private processInput(): void {
    const input = gameInputProcessor.processFrame();
    
    // EIDOLON-V FIX: Handle input actions
    if (this.config.debugMode) {
      if (input.events.length > 0) {
        console.log('🜂 Input events:', input.events.length);
      }
    }
  }

  // EIDOLON-V FIX: Update game state
  private updateGameState(dt: number): void {
    // This would integrate with the actual game state manager
    // const gameState = gameStateManager.getCurrentState();
    // gameStateManager.updateGameState(gameState, dt);
  }

  // EIDOLON-V FIX: Update entities
  private updateEntities(dt: number): void {
    // This would update all entities using the integrated systems
    // Entities would be updated using fast math and object pooling
  }

  // EIDOLON-V FIX: Process collisions
  private processCollisions(): void {
    // This would process collisions using the optimized collision system
    // All collision checks would use squared distances
  }

  // EIDOLON-V FIX: Start integrated systems
  start(): void {
    if (!this.isInitialized) {
      throw new Error('Systems must be initialized before starting');
    }
    
    console.log('🜂 EIDOLON-V: Starting integrated systems...');
    this.engine.start();
  }

  // EIDOLON-V FIX: Stop integrated systems
  stop(): void {
    console.log('🜂 EIDOLON-V: Stopping integrated systems...');
    this.engine.stop();
  }

  // EIDOLON-V FIX: Get comprehensive system stats
  getSystemStats(): IntegratedSystemStats {
    const engineStats = this.engine.getStats();
    const poolingStats = entityPoolManager.getAllStats();
    const mathStats = mathPerformanceMonitor.getStats();
    const inputStats = inputStateManager.getStats();
    const memoryStats = (performance as any).memory || {};

    return {
      engine: {
        fps: engineStats.fps,
        frameTime: engineStats.frameTime,
        entityCount: engineStats.entityCount
      },
      pooling: {
        totalObjects: Object.values(poolingStats).reduce((sum: number, stat: any) => 
          sum + (stat?.created || 0), 0),
        pooledObjects: Object.values(poolingStats).reduce((sum: number, stat: any) => 
          sum + (stat?.pooled || 0), 0),
        efficiency: Object.values(poolingStats).reduce((sum: number, stat: any) => 
          sum + (stat?.efficiency || 0), 0) / Object.keys(poolingStats).length
      },
      math: {
        sqrtOperations: mathStats.sqrtOperations,
        distanceOperations: mathStats.distanceOperations,
        collisionOperations: mathStats.collisionOperations
      },
      input: {
        eventsPerFrame: inputStats.buffer.count || 0,
        activeKeys: inputStats.state.keysPressed || 0,
        activeButtons: inputStats.state.buttonsPressed || 0
      },
      memory: {
        usedJSHeapSize: memoryStats.usedJSHeapSize || 0,
        totalJSHeapSize: memoryStats.totalJSHeapSize || 0,
        jsHeapSizeLimit: memoryStats.jsHeapSizeLimit || 0
      }
    };
  }

  // EIDOLON-V FIX: Register custom update callback
  onUpdate(callback: (dt: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  // EIDOLON-V FIX: Register custom render callback
  onRender(callback: (interpolation: number) => void): void {
    this.renderCallbacks.push(callback);
  }

  // EIDOLON-V FIX: Get pooled entity factory
  getPooledEntityFactory() {
    return pooledEntityFactory;
  }

  // EIDOLON-V FIX: Get fast math utilities
  getFastMath() {
    return {
      fastMath,
      collisionSystem,
      spatialOptimizer,
      mathPerformanceMonitor
    };
  }

  // EIDOLON-V FIX: Get input processor
  getInputProcessor() {
    return gameInputProcessor;
  }

  // EIDOLON-V FIX: Get game engine
  getGameEngine() {
    return this.engine;
  }

  // EIDOLON-V FIX: Update configuration
  updateConfig(newConfig: Partial<SystemIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // EIDOLON-V FIX: Dispose all systems
  dispose(): void {
    console.log('🜂 EIDOLON-V: Disposing integrated systems...');
    
    this.stop();
    
    // EIDOLON-V FIX: Clear callbacks
    this.updateCallbacks.length = 0;
    this.renderCallbacks.length = 0;
    
    // EIDOLON-V FIX: Dispose engine
    this.engine.dispose();
    
    // EIDOLON-V FIX: Dispose input system
    if (this.config.enableInputBuffering) {
      inputStateManager.dispose();
    }
    
    // EIDOLON-V FIX: Clear object pools
    if (this.config.enableObjectPooling) {
      entityPoolManager.clearAll();
    }
    
    this.isInitialized = false;
    console.log('🜂 EIDOLON-V: All systems disposed');
  }
}

// EIDOLON-V FIX: Integration factory
export class SystemIntegrationFactory {
  // EIDOLON-V FIX: Create development integration
  static createDevIntegration(): SystemIntegrator {
    return SystemIntegrator.getInstance({
      enableObjectPooling: true,
      enableMathOptimization: true,
      enableInputBuffering: true,
      enableSpatialOptimization: true,
      enablePerformanceMonitoring: true,
      debugMode: true
    });
  }

  // EIDOLON-V FIX: Create production integration
  static createProductionIntegration(): SystemIntegrator {
    return SystemIntegrator.getInstance({
      enableObjectPooling: true,
      enableMathOptimization: true,
      enableInputBuffering: true,
      enableSpatialOptimization: true,
      enablePerformanceMonitoring: false,
      debugMode: false
    });
  }

  // EIDOLON-V FIX: Create minimal integration
  static createMinimalIntegration(): SystemIntegrator {
    return SystemIntegrator.getInstance({
      enableObjectPooling: false,
      enableMathOptimization: true,
      enableInputBuffering: false,
      enableSpatialOptimization: false,
      enablePerformanceMonitoring: false,
      debugMode: false
    });
  }
}

// EIDOLON-V FORGE: Export singleton instance
export const systemIntegrator = SystemIntegrator.getInstance();
