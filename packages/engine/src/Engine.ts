/**
 * @eidolon/engine - Engine Class
 *
 * Main coordinator for the headless game engine.
 * Orchestrates systems update order.
 *
 * NOTE: This engine is game-agnostic. Game-specific logic (like wave spawning)
 * should be handled by the game module (e.g., CJRModule) at the application level.
 */

import { PhysicsSystem } from './systems/PhysicsSystem';
import { MovementSystem } from './systems/MovementSystem';
import { SkillSystem } from './systems/SkillSystem';
import { eventBuffer } from './events/EventRingBuffer';
import { resetAllStores } from './dod/ComponentStores';

export interface IEngineConfig {
    tickRate: number;
}

export class Engine {
    // EIDOLON-V P0: Fixed timestep configuration
    private static readonly FIXED_DT = 1 / 60;  // 60 Hz physics
    private static readonly MAX_ACCUMULATOR = 0.25;  // Spiral of death prevention

    private tickRate: number;
    private dt: number;
    private time: number = 0;
    private accumulator: number = 0;
    private _interpolationAlpha: number = 0;  // For rendering interpolation

    constructor(config: IEngineConfig = { tickRate: 60 }) {
        this.tickRate = config.tickRate;
        this.dt = 1 / config.tickRate;
    }

    /**
     * Get interpolation alpha for smooth rendering
     */
    get interpolationAlpha(): number {
        return this._interpolationAlpha;
    }

    /**
     * Reset engine state (clears all entities)
     */
    reset() {
        resetAllStores();
        eventBuffer.clear();
        this.time = 0;
    }

    /**
     * Run simulation with fixed timestep accumulator
     * Prevents physics desync during lag spikes
     * @param dt Delta time in seconds from external clock
     */
    update(dt?: number) {
        const inputDt = dt || this.dt;

        // EIDOLON-V P0: Cap accumulator to prevent spiral of death
        this.accumulator = Math.min(
            this.accumulator + inputDt,
            Engine.MAX_ACCUMULATOR
        );

        // Fixed timestep loop - guarantees deterministic physics
        while (this.accumulator >= Engine.FIXED_DT) {
            this.time += Engine.FIXED_DT;

            // 1. Systems Update (DOD) with FIXED dt
            PhysicsSystem.update(Engine.FIXED_DT);
            MovementSystem.updateAll(Engine.FIXED_DT);
            SkillSystem.update(Engine.FIXED_DT);

            this.accumulator -= Engine.FIXED_DT;
        }

        // Store interpolation alpha for smooth rendering
        // Value between 0-1 representing position between last and next physics tick
        this._interpolationAlpha = this.accumulator / Engine.FIXED_DT;
    }

    /**
     * Get current simulation time
     */
    getTime(): number {
        return this.time;
    }
}
