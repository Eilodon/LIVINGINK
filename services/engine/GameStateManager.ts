// EIDOLON-V FIX: Unified Game State Manager
// Single Source of Truth for all game state operations

import { GameState, Player, Bot, Food, Entity } from '../../types';
import { createInitialState } from './index';
import { updateClientVisuals } from './index';
import { FixedGameLoop } from './GameLoop'; // EIDOLON-V FIX: Import GameLoop

export class GameStateManager {
  private static instance: GameStateManager;
  private currentState: GameState | null = null;
  private subscribers: Set<(state: GameState) => void> = new Set();
  private gameLoop: FixedGameLoop | null = null; // EIDOLON-V FIX: Centralized GameLoop
  private updateCallback: ((dt: number) => void) | null = null;
  private renderCallback: ((alpha: number) => void) | null = null;

  private constructor() { }

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

  // EIDOLON-V FIX: Single source of truth for state updates
  public updateGameState(dt: number): GameState {
    if (!this.currentState || this.currentState.isPaused) {
      return this.currentState;
    }

    // Core game logic update
    this.updateCoreGameLogic(dt);

    // Notify subscribers
    this.notifySubscribers();

    return this.currentState;
  }

  // EIDOLON-V FIX: Single source of truth for client visual updates
  public updateClientVisuals(dt: number): void {
    if (!this.currentState) return;

    updateClientVisuals(this.currentState, dt);
    this.notifySubscribers();
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
    if (this.currentState) {
      this.subscribers.forEach(callback => callback(this.currentState));
    }
  }

  private updateCoreGameLogic(dt: number): void {
    // EIDOLON-V FIX: Logic is now handled by OptimizedEngine
    // This method remains empty to prevent double-updates
    // if logic somehow routes back here.
    if (!this.currentState) return;
  }

  private updatePlayer(entity: Player | Bot, dt: number): void {
    // Update position based on target
    if (entity.targetPosition) {
      const dx = entity.targetPosition.x - entity.position.x;
      const dy = entity.targetPosition.y - entity.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) { // Deadzone
        const speed = entity.maxSpeed * (entity.statusEffects?.speedBoost || 1);
        entity.velocity.x = (dx / dist) * speed;
        entity.velocity.y = (dy / dist) * speed;
      } else {
        entity.velocity.x *= 0.9;
        entity.velocity.y *= 0.9;
      }
    }

    // Update position
    entity.position.x += entity.velocity.x * dt;
    entity.position.y += entity.velocity.y * dt;
  }

  private checkWinLossConditions(): void {
    if (!this.currentState) return;

    // Check time limit
    if (this.currentState.gameTime > this.currentState.levelConfig.timeLimit && !this.currentState.result) {
      this.currentState.result = 'lose';
      this.currentState.isPaused = true;
    }

    // Check player death
    if (this.currentState.player?.isDead && !this.currentState.result) {
      this.currentState.result = 'lose';
      this.currentState.isPaused = true;
    }

    // Check win condition
    if (this.currentState.levelConfig.winCondition && !this.currentState.result) {
      // Implement win condition logic here
      // For now, just check if player reached certain score
      if (this.currentState.levelConfig.winCondition === 'default' && this.currentState.player.score >= 1000) {
        this.currentState.result = 'win';
        this.currentState.isPaused = true;
      }
    }
  }

  // EIDOLON-V FIX: Centralized cleanup
  public dispose(): void {
    this.stopGameLoop(); // EIDOLON-V FIX: Stop loop before cleanup
    this.currentState = null;
    this.subscribers.clear();
    this.updateCallback = null;
    this.renderCallback = null;
  }

  // EIDOLON-V FIX: GameLoop management methods
  public setGameLoopCallbacks(
    updateCallback: (dt: number) => void,
    renderCallback: (alpha: number) => void
  ): void {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
  }

  public startGameLoop(fps: number = 60): void {
    if (!this.updateCallback || !this.renderCallback) {
      console.warn('GameStateManager: Update or render callback not set');
      return;
    }

    // Stop existing loop if running
    this.stopGameLoop();

    // Create and start new loop
    this.gameLoop = new FixedGameLoop(fps, this.updateCallback, this.renderCallback);
    this.gameLoop.start();
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
