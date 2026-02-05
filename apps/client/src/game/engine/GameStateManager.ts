// EIDOLON-V FIX: Unified Game State Manager
// Refactored: Split GOD Object into dedicated systems (Input, Audio, Session)

import { GameState, Player, Bot, Food, Entity } from '../../types';
import { createInitialState } from './index';
import { FixedGameLoop } from './GameLoop';
import { cjrClientRunner } from './runner/CJRClientRunner';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { mathPerformanceMonitor } from '../math/FastMath';
import { performanceMonitor } from '../../core/performance/PerformanceMonitor';

import { BufferedInput } from '../input/BufferedInput';
import { GameConfig } from '@cjr/engine';
import {
  NetworkClient,
  networkClient as defaultNetworkClient,
  NetworkStatus,
} from '../../network/NetworkClient';
import { AudioEngine, audioEngine as defaultAudioEngine } from '../audio/AudioEngine';
import { vfxIntegrationManager } from '../vfx/vfxIntegration';
import { ShapeId } from '../cjr/cjrTypes';
import { clientLogger } from '../../core/logging/ClientLogger';

// Systems
import { inputSystem, InputSystem } from './systems/InputSystem';
import { AudioSyncSystem } from './systems/AudioSyncSystem';
import { SessionManager } from './systems/SessionManager';

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
  usePixi: boolean;
}

export class GameStateManager {
  private static instance: GameStateManager;
  private currentState: GameState | null = null;
  private subscribers: Set<(state: GameState) => void> = new Set();
  private eventListeners: Set<(event: GameEvent) => void> = new Set();

  private gameLoop: FixedGameLoop | null = null;
  private renderCallback: ((alpha: number) => void) | null = null;

  // Dependencies
  private bufferedInput: BufferedInput;
  private networkClient: NetworkClient;
  private audioEngine: AudioEngine;

  // Sub-Systems
  private inputSystem: InputSystem;
  private audioSyncSystem: AudioSyncSystem;
  private sessionManager: SessionManager;

  public subscribeEvent(callback: (event: GameEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emitEvent(event: GameEvent): void {
    this.eventListeners.forEach(cb => cb(event));
  }

  private constructor() {
    this.bufferedInput = BufferedInput.getInstance();
    this.networkClient = defaultNetworkClient;
    this.audioEngine = defaultAudioEngine;

    // Initialize Systems
    this.inputSystem = inputSystem;
    this.audioSyncSystem = new AudioSyncSystem(this.audioEngine);
    this.sessionManager = new SessionManager(
      this.networkClient,
      this.bufferedInput,
      (e) => this.emitEvent(e)
    );
  }

  public injectDependencies(network: NetworkClient, audio: AudioEngine): void {
    this.networkClient = network;
    this.audioEngine = audio;
    // Re-init dependent systems
    this.audioSyncSystem = new AudioSyncSystem(this.audioEngine);
    this.sessionManager = new SessionManager(this.networkClient, this.bufferedInput, (e) => this.emitEvent(e));
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  public createInitialState(level: number): GameState {
    this.currentState = createInitialState(level);
    this.notifySubscribers();
    return this.currentState;
  }

  public initialize(): void {
    clientLogger.info('🜂 EIDOLON-V: GameStateManager initializing systems...');
    mathPerformanceMonitor.reset();
  }

  // --- Core Loop ---
  private gameLoopLogic(dt: number): void {
    try {
      if (!this.currentState) return;
      if (this.currentState.isPaused) return;

      const state = this.currentState;
      const isMultiplayer = Boolean(this.sessionManager.getCurrentConfig()?.useMultiplayer && this.networkClient.getRoomId());

      // 1. Simulation Update
      if (isMultiplayer) {
        cjrClientRunner.setGameState(state);
        cjrClientRunner.updateVisualsOnly(dt);
      } else {
        cjrClientRunner.setGameState(state);
        cjrClientRunner.update(dt);
      }

      // 2. Input System (Sync to DOD / Network)
      this.inputSystem.update(state, this.networkClient, isMultiplayer, dt);

      // 3. Camera (View Logic - Lightweight enough to stay or move to RenderSystem)
      // EIDOLON-V FIX: Camera follows player with smooth interpolation
      const CAMERA_LERP = GameConfig.CAMERA.LERP_FACTOR;
      state.camera.x += (state.player.position.x - state.camera.x) * CAMERA_LERP;
      state.camera.y += (state.player.position.y - state.camera.y) * CAMERA_LERP;

      // 4. Audio System
      this.audioSyncSystem.update(state);

      // 5. VFX System
      vfxIntegrationManager.update(state, dt);

      // 6. Game Logic (Win/Loss/Events)
      this.checkGameEvents(state);

      this.notifySubscribers();

    } catch (error) {
      clientLogger.error('CRITICAL: Game Loop Crash', undefined, error instanceof Error ? error : undefined);
      this.stopGameLoop();
      this.emitEvent({ type: 'GAME_OVER', result: 'lose' });
    }
  }

  private checkGameEvents(state: GameState): void {
    if (state.result) {
      if (state.result === 'win') {
        this.emitEvent({ type: 'LEVEL_UNLOCKED', level: state.level + 1 });
      }
      this.stopGameLoop();
      this.emitEvent({ type: 'GAME_OVER', result: state.result });
    }

    if (state.tattooChoices) {
      this.emitEvent({ type: 'TATTOO_REQUEST' });
    }
  }

  // --- Lifecycle Delegates ---

  public startSession(config: GameSessionConfig): void {
    this.currentState = this.sessionManager.startSession(
      config,
      () => this.stopGameLoop(),
      () => this.startGameLoop()
    );
    this.notifySubscribers();
  }

  public endSession(): void {
    this.sessionManager.endSession(() => this.stopGameLoop());
    this.currentState = null;
  }

  public startGameLoop(fps: number = 60): void {
    if (!this.renderCallback) {
      console.warn('GameStateManager: Render callback not set, visual updates may be broken.');
    }
    this.stopGameLoop();
    cjrClientRunner.initialize();

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

  public stopGameLoop(): void {
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
      performanceMonitor.stopMonitoring();
    }
  }

  public dispose(): void {
    this.endSession(); // Encapsulates cleanup
    this.subscribers.clear();
    this.renderCallback = null;
  }

  // --- Valid Getters/Setters ---

  public updateClientVisuals(dt: number): void {
    if (!this.currentState) return;
    cjrClientRunner.setGameState(this.currentState);
    cjrClientRunner.updateVisualsOnly(dt);
  }

  public setRenderCallback(callback: (alpha: number) => void): void {
    this.renderCallback = callback;
  }

  public getCurrentState(): GameState | null {
    return this.currentState;
  }

  public isGameLoopRunning(): boolean {
    return this.gameLoop !== null;
  }

  public getPerformanceStats(): { memoryUsage: number } {
    const memory = (performance as any).memory;
    return { memoryUsage: memory ? memory.usedJSHeapSize : 0 };
  }

  // --- Entity Management (Delegates) ---
  // Ideally these should move to an EntityManagementSystem but simple enough to keep wrapper

  public addPlayer(player: Player): void {
    this.currentState?.players?.push(player);
    this.notifySubscribers();
  }
  public removePlayer(id: string): void {
    if (this.currentState?.players) {
      this.currentState.players = this.currentState.players.filter(p => p.id !== id);
      this.notifySubscribers();
    }
  }
  public addBot(bot: Bot): void {
    this.currentState?.bots?.push(bot);
    this.notifySubscribers();
  }
  public removeBot(botId: string): void {
    if (this.currentState?.bots) {
      this.currentState.bots = this.currentState.bots.filter(b => b.id !== botId);
      this.notifySubscribers();
    }
  }
  public addFood(food: Food): void {
    this.currentState?.food?.push(food);
    this.notifySubscribers();
  }
  public removeFood(foodId: string): void {
    if (this.currentState?.food) {
      this.currentState.food = this.currentState.food.filter(f => f.id !== foodId);
      this.notifySubscribers();
    }
  }

  public updateGameState(dt: number): GameState {
    this.gameLoopLogic(dt);
    return this.currentState!;
  }

  public setCurrentState(state: GameState): void {
    this.currentState = state;
    this.notifySubscribers();
  }

  public subscribe(callback: (state: GameState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    if (this.currentState) {
      this.subscribers.forEach(cb => cb(this.currentState!));
    }
  }
}

export const gameStateManager = GameStateManager.getInstance();
