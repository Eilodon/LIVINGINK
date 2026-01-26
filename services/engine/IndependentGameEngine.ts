// EIDOLON-V FORGE: SOTA 2026 Game Engine Architecture
// Complete separation from React - Independent game loop

export interface GameEngineConfig {
  targetFPS: number;
  fixedDeltaTime: number;
  maxFrameTime: number;
  enableInputBuffering: boolean;
  enableObjectPooling: boolean;
  enableSpatialOptimization: boolean;
}

export interface EngineStats {
  fps: number;
  frameTime: number;
  entityCount: number;
  pooledObjects: number;
  memoryUsage: number;
  inputEvents: number;
}

// EIDOLON-V FIX: Independent Game Engine
export class IndependentGameEngine {
  private static instance: IndependentGameEngine;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private accumulator: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsUpdateTime: number = 0;

  private config: GameEngineConfig;
  private stats: EngineStats;
  private animationId: number | null = null;

  private gameState: any = null;
  private updateCallbacks: Array<(dt: number) => void> = [];
  private renderCallbacks: Array<(interpolation: number) => void> = [];

  private constructor(config: Partial<GameEngineConfig> = {}) {
    this.config = {
      targetFPS: 60,
      fixedDeltaTime: 1000 / 60,
      maxFrameTime: 250,
      enableInputBuffering: true,
      enableObjectPooling: true,
      enableSpatialOptimization: true,
      ...config
    };

    this.stats = {
      fps: 0,
      frameTime: 0,
      entityCount: 0,
      pooledObjects: 0,
      memoryUsage: 0,
      inputEvents: 0
    };
  }

  static getInstance(config?: Partial<GameEngineConfig>): IndependentGameEngine {
    if (!IndependentGameEngine.instance) {
      IndependentGameEngine.instance = new IndependentGameEngine(config);
    }
    return IndependentGameEngine.instance;
  }

  // EIDOLON-V FIX: Initialize engine systems
  async initialize(): Promise<void> {
    if (this.isRunning) return;

    try {
      // EIDOLON-V FIX: Initialize object pooling
      if (this.config.enableObjectPooling) {
        const { pooledEntityFactory } = await import('../pooling/ObjectPool');
        pooledEntityFactory.initializeAll();
      }

      // EIDOLON-V FIX: Initialize input system
      if (this.config.enableInputBuffering) {
        const { gameInputProcessor } = await import('../input/BufferedInput');
        // Input system auto-initializes
      }

      // EIDOLON-V FIX: Initialize math system
      const { mathPerformanceMonitor } = await import('../math/FastMath');
      mathPerformanceMonitor.reset();

      this.isRunning = true;
      console.log('🜂 EIDOLON-V Engine initialized successfully');

    } catch (error) {
      console.error('🜂 EIDOLON-V Engine initialization failed:', error);
      throw error;
    }
  }

  // EIDOLON-V FIX: Start game loop
  start(): void {
    if (!this.isRunning) {
      throw new Error('Engine must be initialized before starting');
    }

    if (this.animationId) {
      console.warn('Engine is already running');
      return;
    }

    this.lastFrameTime = performance.now();
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsUpdateTime = 0;

    console.log('🜂 EIDOLON-V Engine starting game loop');
    this.gameLoop();
  }

  // EIDOLON-V FIX: Stop game loop
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.isRunning = false;
    console.log('🜂 EIDOLON-V Engine stopped');
  }

  // EIDOLON-V FIX: Main game loop with fixed timestep
  private gameLoop(): void {
    const currentTime = performance.now();
    const frameTime = Math.min(currentTime - this.lastFrameTime, this.config.maxFrameTime);
    this.lastFrameTime = currentTime;

    // EIDOLON-V FIX: Update FPS counter
    this.updateFPS(currentTime);

    // EIDOLON-V FIX: Fixed timestep accumulation
    this.accumulator += frameTime;

    // EIDOLON-V FIX: Process input events
    if (this.config.enableInputBuffering) {
      this.processInput();
    }

    // EIDOLON-V FIX: Fixed update steps
    while (this.accumulator >= this.config.fixedDeltaTime) {
      this.update(this.config.fixedDeltaTime);
      this.accumulator -= this.config.fixedDeltaTime;
    }

    // EIDOLON-V FIX: Render with interpolation
    const interpolation = this.accumulator / this.config.fixedDeltaTime;
    this.render(interpolation);

    // EIDOLON-V FIX: Update stats
    this.updateStats(frameTime);

    // EIDOLON-V FIX: Continue loop
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  // EIDOLON-V FIX: Process input events
  private processInput(): void {
    try {
      const { gameInputProcessor } = require('../input/BufferedInput');
      const input = gameInputProcessor.processFrame();

      // EIDOLON-V FIX: Update input stats
      this.stats.inputEvents = input.events.length;

      // EIDOLON-V FIX: Process input actions
      // This would be handled by the game logic

    } catch (error) {
      console.warn('Input processing error:', error);
    }
  }

  // EIDOLON-V FIX: Fixed update step
  private update(dt: number): void {
    // EIDOLON-V FIX: Call all update callbacks
    for (const callback of this.updateCallbacks) {
      try {
        callback(dt);
      } catch (error) {
        console.error('Update callback error:', error);
      }
    }

    // EIDOLON-V FIX: Update game state
    if (this.gameState) {
      // This would update the actual game state
      // gameStateManager.updateGameState(this.gameState, dt);
    }
  }

  // EIDOLON-V FIX: Render with interpolation
  private render(interpolation: number): void {
    // EIDOLON-V FIX: Call all render callbacks
    for (const callback of this.renderCallbacks) {
      try {
        callback(interpolation);
      } catch (error) {
        console.error('Render callback error:', error);
      }
    }
  }

  // EIDOLON-V FIX: Update FPS counter
  private updateFPS(currentTime: number): void {
    this.frameCount++;

    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
      this.stats.fps = this.fps;
    }
  }

  // EIDOLON-V FIX: Update engine stats
  private updateStats(frameTime: number): void {
    this.stats.frameTime = frameTime;

    // EIDOLON-V FIX: Update memory usage
    if ((performance as any).memory) {
      this.stats.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    // EIDOLON-V FIX: Update pooled objects count
    if (this.config.enableObjectPooling) {
      try {
        const { entityPoolManager } = require('../pooling/ObjectPool');
        const poolStats = entityPoolManager.getAllStats();
        this.stats.pooledObjects = Object.values(poolStats).reduce<number>((sum: number, stat: any) => {
          const pooledCount = typeof stat?.pooled === 'number' ? stat.pooled : 0;
          return sum + pooledCount;
        }, 0);
      } catch (error) {
        // Pool system not available
      }
    }

    // EIDOLON-V FIX: Update entity count
    if (this.gameState) {
      this.stats.entityCount =
        (this.gameState.players?.length || 0) +
        (this.gameState.bots?.length || 0) +
        (this.gameState.food?.length || 0) +
        (this.gameState.projectiles?.length || 0);
    }
  }

  // EIDOLON-V FIX: Register update callback
  onUpdate(callback: (dt: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  // EIDOLON-V FIX: Register render callback
  onRender(callback: (interpolation: number) => void): void {
    this.renderCallbacks.push(callback);
  }

  // EIDOLON-V FIX: Remove update callback
  removeUpdateCallback(callback: (dt: number) => void): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  // EIDOLON-V FIX: Remove render callback
  removeRenderCallback(callback: (interpolation: number) => void): void {
    const index = this.renderCallbacks.indexOf(callback);
    if (index > -1) {
      this.renderCallbacks.splice(index, 1);
    }
  }

  // EIDOLON-V FIX: Set game state
  setGameState(state: any): void {
    this.gameState = state;
  }

  // EIDOLON-V FIX: Get game state
  getGameState(): any {
    return this.gameState;
  }

  // EIDOLON-V FIX: Get engine stats
  getStats(): EngineStats {
    return { ...this.stats };
  }

  // EIDOLON-V FIX: Get engine config
  getConfig(): GameEngineConfig {
    return { ...this.config };
  }

  // EIDOLON-V FIX: Update engine config
  updateConfig(newConfig: Partial<GameEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // EIDOLON-V FIX: Check if engine is running
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  // EIDOLON-V FIX: Force garbage collection
  forceGC(): void {
    if (window.gc) {
      window.gc();
    }
  }

  // EIDOLON-V FIX: Dispose engine
  dispose(): void {
    this.stop();

    // EIDOLON-V FIX: Clear callbacks
    this.updateCallbacks.length = 0;
    this.renderCallbacks.length = 0;

    // EIDOLON-V FIX: Cleanup systems
    if (this.config.enableObjectPooling) {
      try {
        const { entityPoolManager } = require('../pooling/ObjectPool');
        entityPoolManager.clearAll();
      } catch (error) {
        // Pool system not available
      }
    }

    if (this.config.enableInputBuffering) {
      try {
        const { inputStateManager } = require('../input/BufferedInput');
        inputStateManager.dispose();
      } catch (error) {
        // Input system not available
      }
    }

    this.gameState = null;
    this.isRunning = false;

    console.log('🜂 EIDOLON-V Engine disposed');
  }
}

// EIDOLON-V FIX: Engine factory for easy instantiation
export class EngineFactory {
  // EIDOLON-V FIX: Create development engine
  static createDevEngine(): IndependentGameEngine {
    return IndependentGameEngine.getInstance({
      targetFPS: 60,
      fixedDeltaTime: 1000 / 60,
      maxFrameTime: 100,
      enableInputBuffering: true,
      enableObjectPooling: true,
      enableSpatialOptimization: true
    });
  }

  // EIDOLON-V FIX: Create production engine
  static createProductionEngine(): IndependentGameEngine {
    return IndependentGameEngine.getInstance({
      targetFPS: 60,
      fixedDeltaTime: 1000 / 60,
      maxFrameTime: 50,
      enableInputBuffering: true,
      enableObjectPooling: true,
      enableSpatialOptimization: true
    });
  }

  // EIDOLON-V FIX: Create debug engine
  static createDebugEngine(): IndependentGameEngine {
    return IndependentGameEngine.getInstance({
      targetFPS: 30,
      fixedDeltaTime: 1000 / 30,
      maxFrameTime: 500,
      enableInputBuffering: true,
      enableObjectPooling: false,
      enableSpatialOptimization: false
    });
  }
}

// EIDOLON-V FORGE: Export singleton instance
export const gameEngine = IndependentGameEngine.getInstance();
