/**
 * @cjr/engine - EntityFlags
 *
 * EIDOLON-V UNIFICATION: Merged engine core flags with CJR game-specific flags.
 * This is the SINGLE SOURCE OF TRUTH for all entity flags.
 *
 * Zero dependencies - headless compatible.
 */

export enum EntityFlags {
    // Core Entity States (bits 0-7)
    NONE = 0,
    ACTIVE = 1 << 0,
    PLAYER = 1 << 1,
    BOT = 1 << 2,
    FOOD = 1 << 3,
    PROJECTILE = 1 << 4,
    DEAD = 1 << 5,
    OBSTACLE = 1 << 6,
    BOSS = 1 << 7,

    // CJR Food Subtypes (bits 8-12)
    FOOD_PIGMENT = 1 << 8,
    FOOD_CATALYST = 1 << 9,
    FOOD_SHIELD = 1 << 10,
    FOOD_SOLVENT = 1 << 11,
    FOOD_NEUTRAL = 1 << 12,

    // Reserved for future game modules (bits 13-15)
}

/**
 * First available bit for game-specific flags.
 * Modules should use: MY_FLAG = ENGINE_FLAG_OFFSET << 0, etc.
 */
export const ENGINE_FLAG_OFFSET = 16;

/**
 * Maximum entities in the DOD stores.
 */
export const MAX_ENTITIES = 4096;
