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
 */

import { PhysicsSystem, MovementSystem } from '../systems';
import { SkillSystem } from '../systems/SkillSystem';
import { eventBuffer } from '../events';
import { resetAllStores } from '../dod/ComponentStores';
import { EntityFlags, MAX_ENTITIES } from '../dod/EntityFlags';
import { StateStore } from '../dod/ComponentStores';
import { DirtyTracker, DirtyMask } from '../networking/DirtyTracker';

export interface ISimulationConfig {
    tickRate: number;
    maxEntities?: number;
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
 * 2. DOD store management
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
        this.context = {
            gameTime: 0,
            dt: 1 / config.tickRate,
            frameCount: 0,
        };
        this.dirtyTracker = new DirtyTracker(this.config.maxEntities);
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
        resetAllStores();
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
        if (!this.running) return;

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
        // 1. Physics (always run)
        this.updatePhysics(dt);

        // 2. Core systems
        this.updateSystems(dt);

        // 3. Entity logic (override in subclass)
        this.updateEntities(dt);

        // 4. Collisions
        this.updateCollisions(dt);

        // 5. Lifecycle
        this.updateLifecycle(dt);

        // Emit tick event (noop for now)
        // eventBuffer.push(EngineEventType.NONE, 0, 0, 0, 0);
    }

    /**
     * Update physics systems
     */
    protected updatePhysics(dt: number): void {
        PhysicsSystem.update(dt);
    }

    /**
     * Update core systems (Movement, Skills, etc.)
     */
    protected updateSystems(dt: number): void {
        // Update all entities' movement
        const flags = StateStore.flags;
        for (let i = 0; i < MAX_ENTITIES; i++) {
            if ((flags[i] & EntityFlags.ACTIVE) !== 0) {
                MovementSystem.update(i, dt);
            }
        }

        // Update skill system
        SkillSystem.update(dt);
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
     */
    protected updateLifecycle(_dt: number): void {
        // Mark dead entities for cleanup
        const flags = StateStore.flags;
        for (let i = 0; i < MAX_ENTITIES; i++) {
            if ((flags[i] & EntityFlags.DEAD) !== 0) {
                this.onEntityDeath(i);
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
