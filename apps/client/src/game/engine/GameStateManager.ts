// EIDOLON-V FIX: Unified Game State Manager
// Single Source of Truth for all game state operations

import { GameState, Player, Bot, Food, Entity } from '../../types';
import { createInitialState } from './index';
import { getCurrentSpatialGrid } from './context';
import { FixedGameLoop } from './GameLoop';
import { cjrClientRunner } from './runner/CJRClientRunner';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { mathPerformanceMonitor } from '../math/FastMath';
import { performanceMonitor } from '../../core/performance/PerformanceMonitor';

// EIDOLON-V FIX: Dependency Injection
import { BufferedInput } from '../input/BufferedInput';
import { InputStore, TransformStore, PhysicsStore, resetAllStores } from '@cjr/engine';
import {
  NetworkClient,
  networkClient as defaultNetworkClient,
  NetworkStatus,
} from '../../network/NetworkClient';
import { AudioEngine, audioEngine as defaultAudioEngine } from '../audio/AudioEngine';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { ShapeId } from '../cjr/cjrTypes';
import { clientLogger } from '../../core/logging/ClientLogger';

// EIDOLON-V FIX: Event System Types
export type GameEvent =
  | { type: 'GAME_OVER'; result: 'win' | 'lose' }
  | { type: 'TATTOO_REQUEST' }
  | { type: 'LEVEL_UNLOCKED'; level: number }
  | { type: 'NETWORK_STATUS'; status: NetworkStatus };

export interface GameSessionConfig {
  name: string;
  shape: ShapeId;
  level: number;
  useMultiplayer: boolean;
  usePixi: boolean; // EIDOLON-V FIX: Lifecycle Config
}

export class GameStateManager {
  private static instance: GameStateManager;
  private currentState: GameState | null = null;
  private subscribers: Set<(state: GameState) => void> = new Set();

  // EIDOLON-V FIX: New Event System
  private eventListeners: Set<(event: GameEvent) => void> = new Set();

  private gameLoop: FixedGameLoop | null = null; // EIDOLON-V FIX: Centralized GameLoop
  private renderCallback: ((alpha: number) => void) | null = null;
  private currentConfig: GameSessionConfig | null = null;

  // EIDOLON-V FIX: Injected Dependencies (BufferedInput only - InputManager removed)
  private bufferedInput: BufferedInput;
  private networkClient: NetworkClient;
  private audioEngine: AudioEngine;

  public subscribeEvent(callback: (event: GameEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emitEvent(event: GameEvent): void {
    this.eventListeners.forEach(cb => cb(event));
  }

  // EIDOLON-V FIX: Reused objects for Zero GC
  private tempMoveTarget = { x: 0, y: 0 };

  private constructor() {
    // Default to singletons
    this.bufferedInput = BufferedInput.getInstance();
    this.networkClient = defaultNetworkClient;
    this.audioEngine = defaultAudioEngine;
  }

  // EIDOLON-V FIX: DI Setter for testing (InputManager removed)
  public injectDependencies(network: NetworkClient, audio: AudioEngine): void {
    this.networkClient = network;
    this.audioEngine = audio;
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  // EIDOLON-V FIX: Single source of truth for state creation
  public createInitialState(level: number): GameState {
    this.currentState = createInitialState(level);
    this.notifySubscribers();
    return this.currentState;
  }

  // EIDOLON-V FIX: Initialize system dependencies
  public initialize(): void {
    clientLogger.info('🜂 EIDOLON-V: GameStateManager initializing systems...');
    // pooledEntityFactory auto-initializes via singleton access
    mathPerformanceMonitor.reset();
  }

  // EIDOLON-V FIX: The core game loop logic (The Heart Transplant)
  private gameLoopLogic(dt: number): void {
    if (!this.currentState) return; // Should not happen if loop is running
    if (this.currentState.isPaused) return;

    const state = this.currentState;
    const isMultiplayer = this.currentConfig?.useMultiplayer && this.networkClient.getRoomId();

    if (isMultiplayer) {
      // Multiplayer Logic
      cjrClientRunner.setGameState(state);
      cjrClientRunner.updateVisualsOnly(dt);

      // EIDOLON-V: Use BufferedInput for both SP and MP (unified API)
      const events = this.bufferedInput.popEvents();
      this.bufferedInput.updateTargetPosition(state.player.position, this.tempMoveTarget);

      const actions = this.bufferedInput.state.actions;
      const networkInputs = {
        space: actions.space,
        w: actions.w,
      };

      this.networkClient.sendInput(this.tempMoveTarget, networkInputs, dt, events);
    } else {
      // Singleplayer Logic
      // EIDOLON-V: Pull from InputManager and sync to DOD InputStore
      // BƯỚC 1.3: KÍCH HOẠT "BUFFERED INPUT"
      // Thay vì inputManager.updateTargetPosition(...), gọi bufferedInput.syncToStore(localPlayerIndex)

      // Get player position from DOD Store for input conversion
      const pIdx = state.player.physicsIndex ?? 0;
      const tIdx = pIdx * 8;
      const playerWorldX = TransformStore.data[tIdx];
      const playerWorldY = TransformStore.data[tIdx + 1];

      // Sync Input directly to DOD Store (Player Index = 0) with world coordinate conversion
      this.bufferedInput.syncToStore(
        0,
        { x: playerWorldX, y: playerWorldY },
        { x: state.camera.x, y: state.camera.y }
      );

      // Update logic target position from Store for compatibility
      // Using helper:
      const inputTarget = { x: 0, y: 0 };
      InputStore.getTarget(0, inputTarget);

      // Apply to State for legacy compatibility (if needed)
      // OptimizedEngine uses store directly, but state.targetPosition might be used by UI?
      state.player.targetPosition.x = inputTarget.x;
      state.player.targetPosition.y = inputTarget.y;

      // Note: Skill input is already in Store via syncToStore
      // We don't need to manually check inputManager.state.actions.space anymore for engine logic
      // But clearing it? InputStore.consumeSkillInput(0) will be called by Systems.

      // Legacy support: if something else checks inputManager, we might leave it or remove it.
      // Instruction says: "Kết quả: Input đi thẳng từ Bàn phím/Chuột -> Ring Buffer -> InputStore (DOD). Không qua Object trung gian."

      // So we rely on Store.

      // Core physics/logic update
      cjrClientRunner.setGameState(state);
      cjrClientRunner.update(dt);

      // EIDOLON-V FIX: Sync player position from DOD Store back to object state after physics
      if (state.player.physicsIndex !== undefined) {
        const playerTIdx = state.player.physicsIndex * 8;
        state.player.position.x = TransformStore.data[playerTIdx];
        state.player.position.y = TransformStore.data[playerTIdx + 1];
        state.player.velocity.x = PhysicsStore.data[playerTIdx];
        state.player.velocity.y = PhysicsStore.data[playerTIdx + 1];
      }

      // EIDOLON-V FIX: Camera follows player with smooth interpolation
      const CAMERA_LERP = 0.1; // Smoothing factor (0 = no movement, 1 = instant snap)
      const targetCamX = state.player.position.x;
      const targetCamY = state.player.position.y;
      state.camera.x += (targetCamX - state.camera.x) * CAMERA_LERP;
      state.camera.y += (targetCamY - state.camera.y) * CAMERA_LERP;
    }

    // Audio Sync - EIDOLON-V: Read from DOD first
    let listenerX = state.player.position.x;
    let listenerY = state.player.position.y;
    if (state.player.physicsIndex !== undefined) {
      const tIdx = state.player.physicsIndex * 8;
      listenerX = TransformStore.data[tIdx];
      listenerY = TransformStore.data[tIdx + 1];
    }
    this.audioEngine.setListenerPosition(listenerX, listenerY);
    this.audioEngine.setBGMIntensity(Math.floor(state.player.matchPercent * 4));

    // EIDOLON-V FIX: Update VFX System (Particles, Shake, etc)
    vfxIntegrationManager.update(state, dt);

    // Check Win/Loss
    if (state.result) {
      if (state.result === 'win') {
        // EIDOLON-V FIX: Specialized event for progression
        this.emitEvent({ type: 'LEVEL_UNLOCKED', level: state.level + 1 });
      }
      this.stopGameLoop();
      this.emitEvent({ type: 'GAME_OVER', result: state.result });
    }

    // Check Tattoos
    // Note: We need to know if UI is already showing tattoo pick.
    // The Manager shouldn't know UI state.
    // However, the event is 'TATTOO_REQUEST'. UI can decide to ignore if already showing.
    if (state.tattooChoices) {
      // Simple debounce/check could be done here if we tracked last event time,
      // but for now just emit and let UI handle idempotency or we clear it in state?
      // optimizedEngine typically clears tattooChoices after selection?
      // Actually, tattooChoices persists until picked.
      // We should emit only if we haven't recently? or just emit.
      // The UI checks: !ui.overlays.some(o => o.type === 'tattooPick')
      this.emitEvent({ type: 'TATTOO_REQUEST' });
    }

    // Notify state subscribers (e.g. for debug UI or minimally reactive UI)
    this.notifySubscribers();
  }

  // EIDOLON-V FIX: Public update method that users might call manually (debugging) or legacy
  public updateGameState(dt: number): GameState {
    this.gameLoopLogic(dt);
    return this.currentState!;
  }

  // EIDOLON-V FIX: Single source of truth for client visual updates
  public updateClientVisuals(dt: number): void {
    if (!this.currentState) return;

    cjrClientRunner.setGameState(this.currentState);
    cjrClientRunner.updateVisualsOnly(dt);
  }

  // EIDOLON-V FIX: Centralized state access
  public getCurrentState(): GameState | null {
    return this.currentState;
  }

  public setCurrentState(state: GameState): void {
    this.currentState = state;
    this.notifySubscribers();
  }

  // EIDOLON-V FIX: Centralized entity management
  public addPlayer(player: Player): void {
    if (!this.currentState) return;

    if (!this.currentState.players) {
      this.currentState.players = [];
    }

    this.currentState.players.push(player);
    this.notifySubscribers();
  }

  public removePlayer(playerId: string): void {
    if (!this.currentState || !this.currentState.players) return;

    this.currentState.players = this.currentState.players.filter(p => p.id !== playerId);
    this.notifySubscribers();
  }

  public addBot(bot: Bot): void {
    if (!this.currentState) return;

    if (!this.currentState.bots) {
      this.currentState.bots = [];
    }

    this.currentState.bots.push(bot);
    this.notifySubscribers();
  }

  public removeBot(botId: string): void {
    if (!this.currentState || !this.currentState.bots) return;

    this.currentState.bots = this.currentState.bots.filter(b => b.id !== botId);
    this.notifySubscribers();
  }

  public addFood(food: Food): void {
    if (!this.currentState) return;

    if (!this.currentState.food) {
      this.currentState.food = [];
    }

    this.currentState.food.push(food);
    this.notifySubscribers();
  }

  public removeFood(foodId: string): void {
    if (!this.currentState || !this.currentState.food) return;

    this.currentState.food = this.currentState.food.filter(f => f.id !== foodId);
    this.notifySubscribers();
  }

  // EIDOLON-V FIX: Centralized subscription system
  public subscribe(callback: (state: GameState) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    const state = this.currentState;
    if (state) {
      this.subscribers.forEach(callback => callback(state));
    }
  }

  // EIDOLON-V FIX: Get performance stats including memory
  public getPerformanceStats(): { memoryUsage: number } {
    let memoryUsage = 0;
    if ((performance as any).memory) {
      memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
    return { memoryUsage };
  }

  // EIDOLON-V FIX: Centralized cleanup
  public dispose(): void {
    this.stopGameLoop(); // EIDOLON-V FIX: Stop loop before cleanup

    // EIDOLON-V: Clear spatial grid to prevent memory leak
    try {
      const grid = getCurrentSpatialGrid();
      if (grid) {
        grid.clear();
      }
    } catch (e) {
      // Ignore error if grid not initialized
    }

    this.currentState = null;
    this.subscribers.clear();
    this.renderCallback = null;
  }

  public startSession(config: GameSessionConfig): void {
    try {
      clientLogger.info('🎮 Starting game session', { name: config.name, level: config.level });

      // EIDOLON-V FIX: 1. Clean up old session
      this.stopGameLoop();
      this.bufferedInput.reset(); // SAFETY CRITICAL: Reset input to prevent "ghost" movement

      // EIDOLON-V FIX: 2. Setup Configuration
      this.currentConfig = config;

      // EIDOLON-V FIX: 3. Create State
      const state = this.createInitialState(config.level);
      if (!state) {
        throw new Error('Failed to create initial state');
      }
      clientLogger.info('✅ Initial state created', { playerId: state.player?.id });

      // EIDOLON-V FIX: 4. Configure Player
      if (state.player) {
        state.player.name = config.name;
        state.player.shape = config.shape;
        state.player.velocity = { x: 0, y: 0 };
        clientLogger.info('✅ Player configured', { name: config.name, shape: config.shape });
      } else {
        console.error('CRITICAL: Player not found in initial state');
        throw new Error('Player not found in initial state');
      }

      // EIDOLON-V FIX: 5. Connect Networking (if valid)
      if (config.useMultiplayer) {
        this.networkClient.connectWithRetry(config.name, config.shape);
        this.networkClient.setLocalState(state);
      }

      // EIDOLON-V FIX: 6. Start Loop
      this.startGameLoop();
      clientLogger.info('✅ Game loop started');
    } catch (error) {
      clientLogger.error(
        '❌ Failed to start session',
        undefined,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  // EIDOLON-V FIX: Graceful Session Teardown
  public endSession(): void {
    this.stopGameLoop();
    this.networkClient.disconnect();

    // EIDOLON-V FIX: Reset DOD stores and pools to prevent memory leaks
    resetAllStores();
    pooledEntityFactory.clear();

    this.currentState = null;
    // We don't clear subscribers here as UI might persist
  }

  public startGameLoop(fps: number = 60): void {
    if (!this.renderCallback) {
      console.warn('GameStateManager: Render callback not set, visual updates may be broken.');
    }

    this.stopGameLoop();

    // EIDOLON-V FIX: Initialize CJRClientRunner to enable simulation (sets running = true)
    console.log('[DEBUG] startGameLoop: Calling cjrClientRunner.initialize()');
    cjrClientRunner.initialize();
    console.log('[DEBUG] startGameLoop: initialize() completed');

    // Bind tick to this
    this.gameLoop = new FixedGameLoop(
      fps,
      dt => this.gameLoopLogic(dt),
      alpha => {
        this.renderCallback?.(alpha);
        performanceMonitor.updateFrame();
      }
    );
    this.gameLoop.start();
    performanceMonitor.startMonitoring();
  }

  public setRenderCallback(callback: (alpha: number) => void): void {
    this.renderCallback = callback;
  }

  public stopGameLoop(): void {
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
      performanceMonitor.stopMonitoring();
    }
  }

  public isGameLoopRunning(): boolean {
    return this.gameLoop !== null;
  }
}

// EIDOLON-V FIX: Export singleton instance
export const gameStateManager = GameStateManager.getInstance();
