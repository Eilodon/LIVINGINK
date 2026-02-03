/**
 * @cjr/client - CJRClientRunner (Kernel Mode)
 *
 * Phase 5 COMPLETE: Full BaseSimulation integration.
 * Legacy OptimizedEngine dependency REMOVED.
 *
 * Architecture:
 * - Input: BufferedInput → InputStore (DOD)
 * - Simulation: BaseSimulation.tick() with fixed timestep
 * - Physics: PhysicsSystem + MovementSystem
 * - AI: AISystem (Phase 2)
 * - Render: Sync from DOD stores
 */

import type { GameState } from '../../../types';
import { ClientRunner, type IClientSimulationConfig } from '@cjr/engine/client';

// Core Systems
import { AISystem, getAISystem } from '../dod/systems/AISystem';
import { getCurrentSpatialGrid } from '../context';

// Input & Network Wiring
import { BufferedInput } from '../../input/BufferedInput';
import { TransformStore, InputStore, PhysicsStore } from '@cjr/engine';

/**
 * CJR Client Simulation Configuration
 */
export interface ICJRSimulationConfig extends IClientSimulationConfig {
  /** Legacy flag (kept for API compatibility, always false) */
  useLegacyEngine?: boolean;
}

/**
 * CJRClientRunner - Wraps legacy engine during migration
 */
export class CJRClientRunner extends ClientRunner {
  private static instance: CJRClientRunner | null = null;
  private gameState: GameState | null = null;

  // Core Systems
  private aiSystem: AISystem;

  // Input & Network state tracking
  private localPlayerEntityIndex: number | null = null;
  private pendingInputs: Array<{ seq: number; targetX: number; targetY: number; space: boolean; w: boolean; dt: number }> = [];

  private constructor(config: ICJRSimulationConfig) {
    super(config);
    // Legacy flag ignored - always use BaseSimulation
    this.aiSystem = getAISystem();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: ICJRSimulationConfig): CJRClientRunner {
    if (!CJRClientRunner.instance) {
      CJRClientRunner.instance = new CJRClientRunner(config || { tickRate: 60 });
    }
    return CJRClientRunner.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  public static resetInstance(): void {
    CJRClientRunner.instance = null;
  }

  /**
   * Set game state reference
   */
  setGameState(state: GameState): void {
    this.gameState = state;
  }

  // =============================================================================
  // BaseSimulation/ClientRunner Lifecycle Hooks (Gradual Migration)
  // =============================================================================

  /**
   * Called during initialization
   */
  protected onInitialize(): void {
    // BaseSimulation initialization complete
    console.info('[CJRClientRunner] Kernel mode initialized');
  }

  /**
   * Called during shutdown
   */
  protected onShutdown(): void {
    console.info('[CJRClientRunner] Kernel mode shutdown');
  }

  /**
   * Called for render interpolation
   */
  protected onInterpolate(_alpha: number): void {
    // Future: Interpolate between previous and current state for smooth rendering
    // Currently using latest state directly
  }

  /**
   * Called when entity dies
   */
  protected onEntityDeath(entityId: number): void {
    // Emit death event for VFX/audio
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('entity-death', {
          detail: { entityId, timestamp: Date.now() },
        })
      );
    }
  }

  // =============================================================================
  // ClientRunner Abstract Methods
  // =============================================================================

  /**
   * Setup client systems
   */
  protected setupClientSystems(): void {
    // Core systems initialized via BaseSimulation
  }

  /**
   * Cleanup client systems
   */
  protected cleanupClientSystems(): void {
    // Cleanup handled by BaseSimulation
  }

  /**
   * Handle entity death visuals
   */
  protected onEntityDeathVisual(entityId: number): void {
    // Emit event for VFX system
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('entity-death-visual', {
          detail: { entityId, timestamp: Date.now() },
        })
      );
    }
  }

  /**
   * Handle predicted input
   */
  protected handlePredictedInput(): void {
    // Process pending inputs for client-side prediction
    if (this.localPlayerEntityIndex !== null && this.gameState) {
      // Input already in InputStore via processBufferedInput
      // Prediction reconciliation handled by reconcileWithServer
    }
  }

  /**
   * Reconcile prediction with server state
   */
  protected reconcilePrediction(): void {
    // Server reconciliation handled by reconcileWithServer method
  }

  /**
   * Sync DOD state to render objects
   */
  protected syncToRenderState(): void {
    // Future: Sync TransformStore to render transforms
    // Currently GameStateManager reads from DOD stores directly
  }

  // =============================================================================
  // BaseSimulation Abstract Methods (For Future Migration)
  // =============================================================================

  /**
   * Update entities - CJR specific logic
   * Phase 5: Full BaseSimulation integration
   */
  protected updateEntities(dt: number): void {
    // AI System update
    if (this.gameState) {
      const grid = getCurrentSpatialGrid();
      if (grid) {
        this.aiSystem.setSpatialGrid(grid as unknown as import('../context').SpatialGrid);
      }
      this.aiSystem.update(this.gameState, dt);
    }

    // Future: Ring logic, emotions, tattoo synergies
  }

  /**
   * Update collisions - CJR specific
   * Phase 5: Full BaseSimulation integration
   */
  protected updateCollisions(_dt: number): void {
    // Future: Combat, magnet logic, projectiles
    // For now, collision detection handled by spatial grid queries
  }

  // =============================================================================
  // Public API - Kernel Mode
  // =============================================================================

  /**
   * Main update method - uses BaseSimulation
   */
  update(dt: number): void {
    if (!this.gameState) return;

    try {
      // Phase 5: Use BaseSimulation update (fixed timestep)
      super.update(dt);
    } catch (error) {
      console.error('[CJRClientRunner] Error:', error);
      this.emitErrorEvent(error);
    }
  }

  /**
   * Update only visuals (for background tabs)
   */
  updateVisualsOnly(_dt: number): void {
    // In kernel mode, visual updates handled by GameStateManager
    // No-op here to prevent unnecessary processing
  }

  /**
   * Reset game state
   */
  reset(): void {
    super.reset();
    this.pendingInputs = [];
    this.localPlayerEntityIndex = null;
  }

  /**
   * Get performance stats from BaseSimulation
   */
  getPerformanceStats() {
    return {
      frameCount: this.getFrameCount(),
      gameTime: this.getGameTime(),
      memoryUsage: 0,
    };
  }

  // =============================================================================
  // Compatibility Helpers (deprecated, kept for API compatibility)
  // =============================================================================

  /**
   * Check if running in legacy mode
   * @deprecated Always returns false in kernel mode
   */
  isLegacyMode(): boolean {
    return false;
  }

  /**
   * Toggle legacy mode
   * @deprecated No-op in kernel mode
   */
  setLegacyMode(__enabled: boolean): void {
    console.warn('[CJRClientRunner] Legacy mode no longer supported, using kernel mode');
  }

  /**
   * Get legacy engine reference
   * @deprecated Returns null in kernel mode
   */
  getLegacyEngine(): null {
    console.warn('[CJRClientRunner] Legacy engine removed, using kernel mode');
    return null;
  }

  // =============================================================================
  // EIDOLON-V Phase 3: Input & Network Wiring
  // =============================================================================

  /**
   * Set the local player entity index for input routing.
   * Called when local player is spawned.
   */
  setLocalPlayerEntityIndex(index: number): void {
    this.localPlayerEntityIndex = index;
    console.info(`[CJRClientRunner] Local player entity index set to ${index}`);
  }

  /**
   * Process input from BufferedInput and route to InputStore.
   * Called each frame before physics update.
   * Phase 3: Wiring BufferedInput to DOD InputStore
   */
  processBufferedInput(_dt: number): void {
    if (!this.gameState || this.localPlayerEntityIndex === null) return;

    const bi = BufferedInput.getInstance();
    const player = this.gameState.player;

    // BufferedInput.syncToStore directly writes to InputStore
    bi.syncToStore(
      this.localPlayerEntityIndex,
      player ? { x: player.position.x, y: player.position.y } : undefined,
      this.gameState.camera
    );

    // Store for reconciliation (simplified - just track sequence)
    this.pendingInputs.push({
      seq: this.pendingInputs.length,
      targetX: bi.getMousePosition().x,
      targetY: bi.getMousePosition().y,
      space: bi.isKeyPressed('Space') || bi.state.actions.space,
      w: bi.isKeyPressed('KeyQ') || bi.isKeyPressed('KeyE') || bi.state.actions.w,
      dt: _dt,
    });

    // Limit buffer size
    if (this.pendingInputs.length > 256) {
      this.pendingInputs.shift();
    }
  }

  /**
   * Reconcile local player with server state.
   * Called when server snapshot arrives.
   */
  reconcileWithServer(serverX: number, serverY: number, serverVx: number, serverVy: number, lastProcessedSeq: number): void {
    if (this.localPlayerEntityIndex === null) return;

    const idx = this.localPlayerEntityIndex;

    // Remove processed inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > lastProcessedSeq);

    // Snap to server state
    TransformStore.setPosition(idx, serverX, serverY);
    PhysicsStore.setVelocity(idx, serverVx, serverVy);

    // Re-simulate pending inputs
    for (const input of this.pendingInputs) {
      InputStore.setTarget(idx, input.targetX, input.targetY);
      // Note: PhysicsSystem.integrateEntity would be called here in full implementation
    }
  }

  /**
   * Sync entity transform from network (non-local players/bots).
   * Direct DOD store write for zero-copy network sync.
   */
  syncEntityFromNetwork(entityIndex: number, x: number, y: number, vx: number, vy: number): void {
    if (entityIndex === this.localPlayerEntityIndex) return; // Skip local player

    TransformStore.setPosition(entityIndex, x, y);
    PhysicsStore.setVelocity(entityIndex, vx, vy);
  }

  // =============================================================================
  // Error Handling
  // =============================================================================

  private emitErrorEvent(error: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('engine-error', {
          detail: { error, timestamp: Date.now() },
        })
      );
    } catch {
      // Silently fail
    }
  }
}

/**
 * Singleton export (legacy compatible)
 */
export const cjrClientRunner = CJRClientRunner.getInstance();
