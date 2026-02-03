/**
 * @eidolon/engine - EntityFlags (Core)
 *
 * EIDOLON-V PLATFORMIZATION:
 * Pure const enum for entity type bitmasks.
 * Only generic engine flags - game-specific flags should be defined
 * in game modules using bits 8+.
 *
 * Zero dependencies - headless compatible.
 */

export enum EntityFlags {
    // Core Entity States (bits 0-7 reserved for engine)
    NONE = 0,
    ACTIVE = 1 << 0,
    PLAYER = 1 << 1,
    BOT = 1 << 2,
    FOOD = 1 << 3,
    PROJECTILE = 1 << 4,
    DEAD = 1 << 5,
    OBSTACLE = 1 << 6,
    BOSS = 1 << 7,

    // Bits 8-31 available for game modules
    // Game modules should define their flags starting from 1 << 8
}

/**
 * First available bit for game-specific flags.
 * Modules should use: MY_FLAG = ENGINE_FLAG_OFFSET << 0, etc.
 */
export const ENGINE_FLAG_OFFSET = 8;

/**
 * Maximum entities in the DOD stores.
 * Can be overridden by module configuration.
 */
export const MAX_ENTITIES = 4096;
