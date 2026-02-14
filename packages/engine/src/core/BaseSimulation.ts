/**
 * @eidolon/engine - BaseSimulation
 *
 * Core game simulation logic - headless, game-agnostic.
 * Runs on both client and server with the same deterministic logic.
 *
 * ## Architecture
 * BaseSimulation provides the foundation for both:
 * - ClientRunner: extends with prediction, interpolation, render sync
 * - ServerRunner: extends with authoritative state, network sync
 * 
 * EIDOLON-V REFACTOR: Now uses generated WorldState from schema.
 */

import { PhysicsSystem, MovementSystem } from '../systems/index.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { eventBuffer } from '../events/index.js';
import { WorldState, MAX_ENTITIES } from '../generated/index.js';
import { EntityFlags, StateAccess } from '../generated/ComponentAccessors.js';
import { DirtyTracker, DirtyMask } from '../networking/DirtyTracker.js';

export interface ISimulationConfig {
    tickRate: number;
    maxEntities?: number;
    /** Optional: provide custom WorldState (for multi-instance servers) */
    world?: WorldState;
}

export interface ISimulationContext {
    gameTime: number;
    dt: number;
    frameCount: number;
}

/**
 * BaseSimulation - Core game simulation (headless)
 *
 * Responsibilities:
 * 1. Fixed-timestep physics simulation
 * 2. DOD store management via WorldState
 * 3. Entity lifecycle (spawn/despawn)
 * 4. Dirty tracking for network sync
 * 5. Event emission for gameplay events
 *
 * NOT responsible for:
 * - Rendering (client-only)
 * - Network transmission (server/client specific)
 * - Input handling (platform specific)
 */
export abstract class BaseSimulation {
    protected config: ISimulationConfig;
    protected context: ISimulationContext;
    protected dirtyTracker: DirtyTracker;

    /** EIDOLON-V: Instance-based world state */
    protected world: WorldState;

    // Fixed timestep configuration
    protected static readonly FIXED_DT = 1 / 60;
    protected static readonly MAX_ACCUMULATOR = 0.25;

    private accumulator = 0;
    private running = false;

    constructor(config: ISimulationConfig) {
        this.config = {
            maxEntities: MAX_ENTITIES,
            ...config,
        };

        // EIDOLON-V: WorldState is REQUIRED - no singleton fallback
        if (!config.world) {
            throw new Error('[BaseSimulation] WorldState is required. Pass new WorldState() in config.');
        }
        this.world = config.world;

        this.context = {
            gameTime: 0,
            dt: 1 / config.tickRate,
            frameCount: 0,
        };
        this.dirtyTracker = new DirtyTracker(this.config.maxEntities);
    }

    /**
     * Get the WorldState instance for this simulation
     */
    getWorld(): WorldState {
        return this.world;
    }

    /**
     * Initialize the simulation
     * Called once before first update
     */
    initialize(): void {
        this.running = true;
        this.onInitialize();
    }

    /**
     * Shutdown the simulation
     */
    shutdown(): void {
        this.running = false;
        this.onShutdown();
    }

    /**
     * Reset simulation state
     */
    reset(): void {
        this.world.reset();
        this.dirtyTracker.clearAll();
        eventBuffer.clear();
        this.context.gameTime = 0;
        this.context.frameCount = 0;
        this.accumulator = 0;
    }

    /**
     * Main update loop with fixed timestep
     *
     * @param dt Delta time from external clock
     */
    update(dt: number): void {
        if (!this.running) {
            return;
        }

        // Clamp dt for safety
        dt = Math.max(0.001, Math.min(dt, 0.1));

        // Accumulate time for fixed timestep
        this.accumulator = Math.min(
            this.accumulator + dt,
            BaseSimulation.MAX_ACCUMULATOR
        );

        // Fixed timestep loop
        while (this.accumulator >= BaseSimulation.FIXED_DT) {
            this.context.frameCount++;
            this.context.gameTime += BaseSimulation.FIXED_DT;

            // Core simulation tick
            this.tick(BaseSimulation.FIXED_DT);

            // Update dirty tracker
            this.dirtyTracker.tick();

            this.accumulator -= BaseSimulation.FIXED_DT;
        }

        // Calculate interpolation alpha for rendering
        const alpha = this.accumulator / BaseSimulation.FIXED_DT;
        this.onInterpolate(alpha);
    }

    /**
     * Single simulation tick (fixed timestep)
     * Override this for custom game logic
     */
    protected tick(dt: number): void {
        // EIDOLON-V FIX: Input Lag Reduction
        // 1. Core systems (Logic/Input/AI) - Calculate NEW desired state
        this.updateSystems(dt);

        // 2. Physics (Integration) - Apply NEW state to positions
        this.updatePhysics(dt);

        // 3. Entity logic (override in subclass)
        this.updateEntities(dt);

        // 4. Collisions
        this.updateCollisions(dt);

        // 5. Lifecycle
        this.updateLifecycle(dt);
    }

    /**
     * Update physics systems
     */
    protected updatePhysics(dt: number): void {
        PhysicsSystem.update(this.world, dt);
    }

    /**
     * Update core systems (Movement, Skills, etc.)
     */
    protected updateSystems(dt: number): void {
        // Update all entities' movement using new accessor pattern
        MovementSystem.updateAll(this.world, dt);

        // Update skill system
        SkillSystem.update(this.world, dt);
    }

    /**
     * Update entity-specific logic
     * Override in subclass for game-specific logic
     */
    protected abstract updateEntities(_dt: number): void;

    /**
     * Update collisions
     * Override in subclass for game-specific collision handling
     */
    protected abstract updateCollisions(_dt: number): void;

    /**
     * Update entity lifecycle (spawn/despawn)
     * EIDOLON-V FIX: O(Active) instead of O(N) using Sparse Set
     */
    protected updateLifecycle(_dt: number): void {
        // Mark dead entities for cleanup
        // Uses Sparse Set for O(activeCount) instead of O(maxEntities)
        const activeEntities = this.world.activeEntities;
        const activeCount = this.world.activeCount;

        for (let i = 0; i < activeCount; i++) {
            const entityId = activeEntities[i];
            if (StateAccess.isDead(this.world, entityId)) {
                this.onEntityDeath(entityId);
            }
        }
    }

    /**
     * Mark entity component as dirty for network sync
     */
    protected markDirty(entityId: number, mask: DirtyMask): void {
        this.dirtyTracker.markDirty(entityId, mask);
    }

    /**
     * Get dirty entities for network sync
     */
    getDirtyEntities(componentMask?: DirtyMask): number[] {
        return this.dirtyTracker.getDirtyEntities(componentMask);
    }

    /**
     * Clear dirty flags after sync
     */
    clearDirty(entityId: number): void {
        this.dirtyTracker.clearDirty(entityId);
    }

    /**
     * Get current simulation time
     */
    getGameTime(): number {
        return this.context.gameTime;
    }

    /**
     * Get current frame count
     */
    getFrameCount(): number {
        return this.context.frameCount;
    }

    /**
     * Check if simulation is running
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * Get dirty tracker stats for debugging
     */
    getDirtyStats() {
        return this.dirtyTracker.getStats();
    }

    // =============================================================================
    // Abstract lifecycle hooks (override in subclass)
    // =============================================================================

    /**
     * Called during initialization
     */
    protected abstract onInitialize(): void;

    /**
     * Called during shutdown
     */
    protected abstract onShutdown(): void;

    /**
     * Called for render interpolation
     * @param _alpha Interpolation factor (0-1)
     */
    protected abstract onInterpolate(_alpha: number): void;

    /**
     * Called when entity dies
     */
    protected abstract onEntityDeath(_entityId: number): void;
}
