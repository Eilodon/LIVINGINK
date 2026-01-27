// EIDOLON-V FIX: Unified Game State Manager
// Single Source of Truth for all game state operations

import { GameState, Player, Bot, Food, Entity } from '../../types';
import { createInitialState } from './index';
import { updateClientVisuals } from './index';
import { FixedGameLoop } from './GameLoop'; // EIDOLON-V FIX: Import GameLoop
import { optimizedEngine } from './OptimizedEngine';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { mathPerformanceMonitor } from '../math/FastMath';

// EIDOLON-V FIX: Dependency Injection
import { InputManager, inputManager as defaultInputManager } from '../input/InputManager';
import { NetworkClient, networkClient as defaultNetworkClient, NetworkStatus } from '../networking/NetworkClient';
import { AudioEngine, audioEngine as defaultAudioEngine } from '../audio/AudioEngine';
import { ShapeId } from '../cjr/cjrTypes';

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

  // EIDOLON-V FIX: Injected Dependencies
  private inputManager: InputManager;
  private networkClient: NetworkClient;
  private audioEngine: AudioEngine;

  public subscribeEvent(callback: (event: GameEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emitEvent(event: GameEvent): void {
    this.eventListeners.forEach(cb => cb(event));
  }

  private constructor() {
    // Default to singletons
    this.inputManager = defaultInputManager;
    this.networkClient = defaultNetworkClient;
    this.audioEngine = defaultAudioEngine;
  }

  // EIDOLON-V FIX: DI Setter for testing
  public injectDependencies(input: InputManager, network: NetworkClient, audio: AudioEngine): void {
    this.inputManager = input;
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
    console.log('🜂 EIDOLON-V: GameStateManager initializing systems...');
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
      updateClientVisuals(state, dt);

      // Send Inputs
      const events = this.inputManager.popEvents();
      const moveTarget = this.inputManager.getMoveTarget(state.player.position);

      const actions = this.inputManager.state.actions;
      const networkInputs = {
        space: actions.space,
        w: actions.w
      };

      this.networkClient.sendInput(moveTarget, networkInputs, dt, events);
    } else {
      // Singleplayer Logic
      // Singleplayer Logic
      // EIDOLON-V: Pull from InputManager
      const events = this.inputManager.popEvents();
      // Using deprecated inputEvents for now on Player, but populating from IM is correct 
      // Ideally we stop pushing to player array and handle events directly here or in engine.
      // For legacy compat, we push to player array if it exists
      if (events.length > 0 && state.player.inputEvents) {
        state.player.inputEvents.push(...events);
      } else if (events.length > 0) {
        // If array missing, define it or handle logic directly
        // Currently safe to ignore or just log, as Engine likely checks IM in future
        state.player.inputEvents = [...events];
      }

      const move = this.inputManager.state.move;
      if (move.x !== 0 || move.y !== 0) {
        state.player.targetPosition.x = state.player.position.x + move.x * 200;
        state.player.targetPosition.y = state.player.position.y + move.y * 200;
      }

      // Sync actions to player.inputs for backward compatibility
      // But Engine should read from IM ideally. 
      // Current legacy engines read player.inputs
      if (state.player.inputs) {
        state.player.inputs.space = this.inputManager.state.actions.space;
        state.player.inputs.w = this.inputManager.state.actions.w;
      }

      // Core physics/logic update
      optimizedEngine.updateGameState(state, dt);
    }

    // Audio Sync
    this.audioEngine.setListenerPosition(state.player.position.x, state.player.position.y);
    this.audioEngine.setBGMIntensity(Math.floor(state.player.matchPercent * 4));

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

    updateClientVisuals(this.currentState, dt);
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
    this.currentState = null;
    this.subscribers.clear();
    this.renderCallback = null;
  }

  public startSession(config: GameSessionConfig): void {
    // EIDOLON-V FIX: 1. Clean up old session
    this.stopGameLoop();
    this.inputManager.reset(); // SAFETY CRITICAL: Reset input to prevent "ghost" movement

    // EIDOLON-V FIX: 2. Setup Configuration
    this.currentConfig = config;

    // EIDOLON-V FIX: 3. Create State
    const state = this.createInitialState(config.level);

    // EIDOLON-V FIX: 4. Configure Player
    if (state.player) {
      state.player.name = config.name;
      state.player.shape = config.shape;
      state.player.velocity = { x: 0, y: 0 };
      // EIDOLON-V: Initialize legacy inputs if needed
      if (state.player.inputs) {
        state.player.inputs = { w: false, space: false };
      }
    } else {
      console.error('CRITICAL: Player not found in initial state');
    }

    // EIDOLON-V FIX: 5. Connect Networking (if valid)
    if (config.useMultiplayer) {
      this.networkClient.connectWithRetry(config.name, config.shape);
      this.networkClient.setLocalState(state);
    }

    // EIDOLON-V FIX: 6. Start Loop
    this.startGameLoop();
  }

  // EIDOLON-V FIX: Graceful Session Teardown
  public endSession(): void {
    this.stopGameLoop();
    this.networkClient.disconnect();
    this.currentState = null;
    // We don't clear subscribers here as UI might persist
  }

  public startGameLoop(fps: number = 60): void {
    if (!this.renderCallback) {
      console.warn('GameStateManager: Render callback not set, visual updates may be broken.');
    }

    this.stopGameLoop();

    // Bind tick to this
    this.gameLoop = new FixedGameLoop(fps, (dt) => this.gameLoopLogic(dt), (alpha) => this.renderCallback?.(alpha));
    this.gameLoop.start();
  }

  public setRenderCallback(callback: (alpha: number) => void): void {
    this.renderCallback = callback;
  }

  public stopGameLoop(): void {
    if (this.gameLoop) {
      this.gameLoop.stop();
      this.gameLoop = null;
    }
  }

  public isGameLoopRunning(): boolean {
    return this.gameLoop !== null;
  }
}

// EIDOLON-V FIX: Export singleton instance
export const gameStateManager = GameStateManager.getInstance();
