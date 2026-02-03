/**
 * @cjr/client - CJRClientRunner (Wrapper Pattern)
 *
 * Migration strategy: Wrap legacy OptimizedEngine, then migrate incrementally.
 *
 * Phase 1 (Current): Delegate to legacy OptimizedGameEngine
 * Phase 2: Migrate AI system to use BaseSimulation.updateEntities()
 * Phase 3: Migrate Combat system to use BaseSimulation.updateCollisions()
 * Phase 4: Migrate Render sync to use ClientRunner.syncToRenderState()
 * Phase 5: Remove legacy dependency
 *
 * ## Benefits
 * - Game continues working during migration
 * - Can test each phase independently
 * - Rollback capability if issues arise
 */

import type { GameState } from '../../../types';
import { ClientRunner, type IClientSimulationConfig } from '@cjr/engine/client';

// Phase 2: New Systems (gradually replacing legacy)
import { AISystem, getAISystem } from '../dod/systems/AISystem';
import { getCurrentSpatialGrid } from '../context';

// Legacy engine import - will be gradually replaced
import { optimizedEngine } from '../OptimizedEngine';

/**
 * CJR Client Simulation Configuration
 */
export interface ICJRSimulationConfig extends IClientSimulationConfig {
  /** Use legacy engine (for rollback capability) */
  useLegacyEngine?: boolean;
}

/**
 * CJRClientRunner - Wraps legacy engine during migration
 */
export class CJRClientRunner extends ClientRunner {
  private static instance: CJRClientRunner | null = null;
  private gameState: GameState | null = null;
  private legacyMode = true;

  // Phase 2: New systems
  private aiSystem: AISystem;

  private constructor(config: ICJRSimulationConfig) {
    super(config);
    this.legacyMode = config.useLegacyEngine ?? true;
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
   * Phase 1: Just call legacy engine setup
   */
  protected onInitialize(): void {
    if (this.legacyMode) {
      // Legacy engine self-initializes
      return;
    }

    // Future: Initialize new systems here
  }

  /**
   * Called during shutdown
   */
  protected onShutdown(): void {
    if (this.legacyMode) {
      // Legacy cleanup if needed
      return;
    }
  }

  /**
   * Called for render interpolation
   * Phase 1: Let legacy engine handle it
   */
  protected onInterpolate(_alpha: number): void {
    if (this.legacyMode) {
      // Legacy engine handles interpolation internally
      return;
    }
  }

  /**
   * Called when entity dies
   * Phase 1: Let legacy engine handle cleanup
   */
  protected onEntityDeath(_entityId: number): void {
    if (this.legacyMode) {
      // Legacy engine handles death
      return;
    }
  }

  // =============================================================================
  // ClientRunner Abstract Methods
  // =============================================================================

  /**
   * Setup client systems
   * Phase 1: Legacy handles this
   */
  protected setupClientSystems(): void {
    if (this.legacyMode) {
      return;
    }
  }

  /**
   * Cleanup client systems
   */
  protected cleanupClientSystems(): void {
    if (this.legacyMode) {
      return;
    }
  }

  /**
   * Handle entity death visuals
   * Phase 1: Legacy handles VFX
   */
  protected onEntityDeathVisual(_entityId: number): void {
    if (this.legacyMode) {
      return;
    }
  }

  /**
   * Handle predicted input
   * Phase 1: Legacy handles input prediction
   */
  protected handlePredictedInput(): void {
    if (this.legacyMode) {
      return;
    }
  }

  /**
   * Reconcile prediction with server state
   * Phase 1: Legacy handles reconciliation
   */
  protected reconcilePrediction(): void {
    if (this.legacyMode) {
      return;
    }
  }

  /**
   * Sync DOD state to render objects
   * Phase 1: Legacy handles render sync
   */
  protected syncToRenderState(): void {
    if (this.legacyMode) {
      return;
    }
  }

  // =============================================================================
  // BaseSimulation Abstract Methods (For Future Migration)
  // =============================================================================

  /**
   * Update entities - CJR specific logic
   * Phase 1: Disabled (legacy handles it)
   * Phase 2: Enable and migrate AI
   */
  protected updateEntities(_dt: number): void {
    if (this.legacyMode) {
      return;
    }

    // Phase 2: New AI System
    if (this.gameState) {
      // Connect spatial grid to AI system
      const grid = getCurrentSpatialGrid();
      if (grid) {
        this.aiSystem.setSpatialGrid(grid as unknown as import('../context').SpatialGrid);
      }
      this.aiSystem.update(this.gameState, _dt);
    }

    // Future: Ring logic, emotions, tattoo synergies
  }

  /**
   * Update collisions - CJR specific
   * Phase 1: Disabled (legacy handles it)
   * Phase 3: Enable and migrate combat
   */
  protected updateCollisions(_dt: number): void {
    if (this.legacyMode) {
      // Legacy engine handles collisions
      return;
    }

    // Future: Combat, magnet logic, projectiles
  }

  // =============================================================================
  // Public API - Delegates to Legacy
  // =============================================================================

  /**
   * Main update method - delegates to legacy engine
   */
  update(dt: number): void {
    if (!this.gameState) return;

    try {
      if (this.legacyMode) {
        // Phase 1: Delegate to legacy
        const result = optimizedEngine.updateGameState(this.gameState, dt);
        this.gameState = result;
      } else {
        // Future: Use BaseSimulation update
        super.update(dt);
      }
    } catch (error) {
      console.error('[CJRClientRunner] Error:', error);
      this.emitErrorEvent(error);
    }
  }

  /**
   * Update only visuals (for background tabs)
   */
  updateVisualsOnly(dt: number): void {
    if (!this.gameState) return;

    if (this.legacyMode) {
      optimizedEngine.updateClientVisuals?.(this.gameState, dt);
    }
  }

  /**
   * Reset game state
   */
  reset(): void {
    if (this.legacyMode) {
      // Legacy reset logic - call if available
      (optimizedEngine as unknown as { reset?: () => void }).reset?.();
    }

    super.reset();
  }

  /**
   * Get performance stats from legacy
   */
  getPerformanceStats() {
    if (this.legacyMode) {
      return optimizedEngine.getPerformanceStats?.() || {
        frameCount: 0,
        poolSize: 0,
        memoryUsage: 0,
      };
    }

    return {
      frameCount: this.getFrameCount(),
      poolSize: 0,
      memoryUsage: 0,
    };
  }

  // =============================================================================
  // Migration Helpers
  // =============================================================================

  /**
   * Check if running in legacy mode
   */
  isLegacyMode(): boolean {
    return this.legacyMode;
  }

  /**
   * Toggle legacy mode (for A/B testing)
   */
  setLegacyMode(enabled: boolean): void {
    this.legacyMode = enabled;
    console.info(`[CJRClientRunner] Legacy mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get legacy engine reference (for debug)
   */
  getLegacyEngine(): typeof optimizedEngine {
    return optimizedEngine;
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
