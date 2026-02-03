/**
 * @eidolon/engine - ISystem Interface
 *
 * Base interface for all game systems (ECS pattern).
 * Systems contain logic that operates on entities with specific components.
 */

/**
 * System priority levels for execution ordering.
 * Lower values execute first.
 */
export enum SystemPriority {
    /** Input processing - runs first */
    INPUT = 0,
    /** Physics simulation */
    PHYSICS = 100,
    /** Movement and steering */
    MOVEMENT = 200,
    /** Game logic (skills, abilities) */
    LOGIC = 300,
    /** Collision detection and response */
    COLLISION = 400,
    /** State updates (health, score) */
    STATE = 500,
    /** Cleanup and garbage collection */
    CLEANUP = 900,
    /** Rendering preparation - runs last */
    RENDER = 1000,
}

/**
 * System execution context passed to update methods.
 */
export interface ISystemContext {
    /** Delta time in seconds */
    dt: number;
    /** Total elapsed game time */
    gameTime: number;
    /** Current frame number */
    frameCount: number;
    /** Is this a fixed timestep tick? */
    isFixedUpdate: boolean;
}

/**
 * Base interface for all ECS systems.
 * Systems are stateless processors that operate on component data.
 */
export interface ISystem {
    /** Unique identifier for this system */
    readonly id: string;

    /** Execution priority (lower = earlier) */
    readonly priority: SystemPriority | number;

    /** Component IDs this system requires */
    readonly requiredComponents: string[];

    /** Component IDs this system optionally uses */
    readonly optionalComponents?: string[];

    /**
     * Called once when system is registered.
     * Use for one-time initialization.
     */
    initialize?(): void;

    /**
     * Called every frame/tick to update entities.
     * @param ctx Execution context with timing info
     */
    update(ctx: ISystemContext): void;

    /**
     * Called at fixed timestep (for deterministic physics).
     * @param ctx Execution context with timing info
     */
    fixedUpdate?(ctx: ISystemContext): void;

    /**
     * Called when system is removed from engine.
     * Use for cleanup.
     */
    dispose?(): void;

    /**
     * Enable/disable this system at runtime.
     */
    enabled: boolean;
}

/**
 * Factory function type for creating systems.
 * Allows deferred system instantiation.
 */
export type SystemFactory = () => ISystem;

/**
 * System group for organizing related systems.
 */
export interface ISystemGroup {
    /** Group identifier */
    readonly id: string;

    /** Systems in this group (executed in priority order) */
    readonly systems: ISystem[];

    /** Enable/disable entire group */
    enabled: boolean;
}
