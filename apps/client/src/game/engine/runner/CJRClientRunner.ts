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
import {
  TransformAccess,
  PhysicsAccess,
  InputAccess,
  PhysicsSystem,
  MovementSystem
} from '@cjr/engine';
import { networkTransformBuffer } from '../../../network/NetworkTransformBuffer';
import { networkClient } from '../../../network/NetworkClient';

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

    // EIDOLON-V: Check environment for Multithreading support
    import('../../../utils/capabilityCheck').then(({ checkEnvironmentCapabilities }) => {
      if (checkEnvironmentCapabilities()) {
        this.initWorker();
      }
    });
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
  /**
   * Called for render interpolation
   */
  protected onInterpolate(alpha: number): void {
    // EIDOLON-V: Trigger remote entity interpolation via NetworkClient
    // This allows smoothing remote entities based on their buffer timestamps relative to render time.
    if (this.gameState) {
      // We need to access the NetworkClient instance.
      // It seems CJRClientRunner doesn't hold a reference to it directly, or does it?
      // NetworkClient is instantiated in the hooks mainly.
      // But wait, we can't easily access NetworkClient from here if it's not injected.
      // However, we DO need to smooth LOCAL entities (using ClientRunner's logic).

      // 1. Interpolate Local Entities (ClientRunner Base Logic)
      // This handles smoothing of things actively simulated on client (like local particles, or local player if needed)
      super.onInterpolate(alpha);

      // 2. Network Client Interpolation?
      // NetworkClient.interpolateState() is usually called by the Frame Loop in React or via a global ticker.
      // If we want tight integration, we should probably bind it here.
      // But for now, let's assume the React layer handles NetworkClient.interpolateState() 
      // OR we accept that we need to inject NetworkClient into CJRClientRunner if we want to drive it.

      // Given the legacy code kept them separate, we will stick to Local Interpolation here.
      // Local Player smoothing during Worker execution is critical.

      // If we use Worker, the DOD stores are updated by Worker at 60Hz.
      // Render loop runs at 144Hz+. We MUST interpolate DOD positions.

      // The base ClientRunner.onInterpolate() calls this.interpolateEntities(alpha)
      // which interpolates anything in 'activeEntityIds'.
      // We just need to ensure our entities ARE in activeEntityIds.

      // CJR Local Player Logic Override:
      // If using Worker, local player position in DOD store updates step-wise.
      // We need to smooth it for render.
    }
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
  // EIDOLON-V Phase 5: Multithreading Bridge (Physics Worker)
  // =============================================================================

  private worker: Worker | null = null;
  private useWorker = false;

  /**
   * Initialize Physics Worker if environment supports it
   */
  private async initWorker() {
    // 1. Check Capabilities
    const { checkEnvironmentCapabilities } = await import('../../../utils/capabilityCheck');
    const isReady = checkEnvironmentCapabilities();

    if (!isReady) {
      console.warn('[CJRClientRunner] Environment not ready for Multithreading. Fallback to Main Thread.');
      return;
    }

    try {
      console.info('[CJRClientRunner] Spawning Physics Worker...');

      // 2. Create Worker (Vite worker import)
      this.worker = new Worker(new URL('../../../workers/physics.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'INIT_COMPLETE') {
          console.info('[CJRClientRunner] Worker Initialized. Switching to Split-Brain Mode.');
          this.useWorker = true;
          this.useWorker = true;

          // EIDOLON-V FIX: Ensure worker knows about local player if already set
          if (this.localPlayerEntityIndex !== null) {
            this.worker?.postMessage({
              type: 'SET_LOCAL_PLAYER',
              id: this.localPlayerEntityIndex
            });
          }

          this.worker?.postMessage({ type: 'START' });
        }
      };

      // 3. Send Shared Buffers (Zero Copy)
      // Note: We need to cast 'world' to access buffers because they are protected in BaseSimulation
      // But we added public accessors in generated code.
      const world = this.world as any;

      const buffers = {
        stateFlags: world.stateFlags.buffer, // Should be SAB if init correctly
        transform: world.transformBuffer,
        physics: world.physicsBuffer,
        pigment: world.pigmentBuffer,
        stats: world.statsBuffer,
        input: world.inputBuffer,
        skill: world.skillBuffer,
        config: world.configBuffer,
        projectile: world.projectileBuffer,
        tattoo: world.tattooBuffer
      };

      this.worker.postMessage({
        type: 'INIT',
        config: {
          maxEntities: world.maxEntities,
          tickRate: 60
        },
        buffers: buffers
      });

    } catch (err) {
      console.error('[CJRClientRunner] Worker Spawn Failed:', err);
      this.useWorker = false;
    }
  }

  // =============================================================================
  // BaseSimulation Abstract Methods (For Future Migration)
  // =============================================================================

  /**
   * Update entities - CJR specific logic
   * Phase 5: Full BaseSimulation integration
   */
  protected updateEntities(dt: number): void {
    // AI System update (Still on Main Thread for Phase 5)
    if (this.gameState) {
      const grid = getCurrentSpatialGrid();
      if (grid) {
        this.aiSystem.setSpatialGrid(grid as unknown as import('../context').SpatialGrid);
      }
      this.aiSystem.update(this.gameState, this.world, dt);
    }

    // EIDOLON-V: Split Brain Architecture
    // 0. Flush Network Transforms (Critical: Apply SSOT updates before simulation)
    // Runs on Main Thread regardless of Worker mode (Shared Memory write)
    // 0. Flush Network Transforms (Critical: Apply SSOT updates before simulation)
    // Runs on Main Thread regardless of Worker mode (Shared Memory write)
    networkTransformBuffer.flush(this.world);

    // EIDOLON-V: Reconcile Client Prediction (Replay Inputs on top of Server Snapshot)
    // Now that WorldState has the Server Snapshot (via Flush), we replay pending inputs.
    networkClient.reconcile();

    if (this.useWorker) {
      // WORKER MODE:
      // Physics/Movement is calculated in Worker.
      // Main thread only handles rendering interpolation (in onInterpolate).
      // We DO NOT call PhysicsSystem.update() here.
    } else {
      // LEGACY/FALLBACK MODE:
      // 1. MovementSystem: Convert input targets to velocities
      // EIDOLON-V: Use injected world
      MovementSystem.updateAll(this.world, dt);

      // 2. PhysicsSystem: Integrate velocity to position
      PhysicsSystem.update(this.world, dt);
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
  private static updateDebugCount = 0;
  update(dt: number): void {
    // EIDOLON-V DEBUG: Trace update execution (REMOVE AFTER DEBUG)
    if (CJRClientRunner.updateDebugCount++ < 5) {
      console.info(`[DEBUG] CJRClientRunner.update: gameState=${!!this.gameState}, running=${this.isRunning()}, dt=${dt.toFixed(4)}`);
    }

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

    // EIDOLON-V: Update Worker with Local Player ID to prevent Race Conditions
    if (this.worker && this.useWorker) {
      this.worker.postMessage({
        type: 'SET_LOCAL_PLAYER',
        id: index
      });
    }
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
      this.gameState.camera,
      this.world // EIDOLON-V: BufferInput needs world now?
    );

    // EIDOLON-V FIX: Send Input via NetworkClient (populates InputRingBuffer for reconciliation)
    const actions = bi.state.actions;
    const target = bi.getMousePosition();
    const networkInputs = {
      space: bi.isKeyPressed('Space') || actions.space,
      w: bi.isKeyPressed('KeyQ') || bi.isKeyPressed('KeyE') || actions.w,
    };

    // Events (Entity Death, etc) - currently empty but prepared
    const events: any[] = [];

    networkClient.sendInput(
      target,
      networkInputs,
      _dt,
      events
    );
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
    TransformAccess.setX(this.world, idx, serverX);
    TransformAccess.setY(this.world, idx, serverY);
    PhysicsAccess.setVx(this.world, idx, serverVx);
    PhysicsAccess.setVy(this.world, idx, serverVy);

    // Re-simulate pending inputs
    for (const input of this.pendingInputs) {
      InputAccess.setTargetX(this.world, idx, input.targetX);
      InputAccess.setTargetY(this.world, idx, input.targetY);
      // Note: PhysicsSystem.integrateEntity would be called here in full implementation
    }
  }

  /**
   * Sync entity transform from network (non-local players/bots).
   * Direct DOD store write for zero-copy network sync.
   */
  syncEntityFromNetwork(entityIndex: number, x: number, y: number, vx: number, vy: number): void {
    if (entityIndex === this.localPlayerEntityIndex) return; // Skip local player

    TransformAccess.setX(this.world, entityIndex, x);
    TransformAccess.setY(this.world, entityIndex, y);
    PhysicsAccess.setVx(this.world, entityIndex, vx);
    PhysicsAccess.setVy(this.world, entityIndex, vy);
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
