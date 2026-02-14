/**
 * @eidolon/engine - CJR Module Flags
 *
 * CJR-specific entity flags extending the core EntityFlags.
 * Uses bits 8+ as reserved by the engine for game modules.
 */

// EIDOLON-V FIX: Inline constant to break circular dependency
// Was: import { ENGINE_FLAG_OFFSET } from '../../compat.js';
// compat.ts re-exports from this file, causing: index -> compat -> flags -> compat
const ENGINE_FLAG_OFFSET = 8;

/**
 * CJR Food Subtype Flags
 * These extend EntityFlags.FOOD to specify the type of food
 */
export enum CJRFoodFlags {
    FOOD_PIGMENT = 1 << (ENGINE_FLAG_OFFSET + 0),   // bit 8
    FOOD_CATALYST = 1 << (ENGINE_FLAG_OFFSET + 1),  // bit 9
    FOOD_SHIELD = 1 << (ENGINE_FLAG_OFFSET + 2),    // bit 10
    FOOD_SOLVENT = 1 << (ENGINE_FLAG_OFFSET + 3),   // bit 11
    FOOD_NEUTRAL = 1 << (ENGINE_FLAG_OFFSET + 4),   // bit 12
}

/**
 * CJR Entity State Flags
 */
export enum CJRStateFlags {
    RUSHING = 1 << (ENGINE_FLAG_OFFSET + 5),        // bit 13: In rush window
    COMMITTED = 1 << (ENGINE_FLAG_OFFSET + 6),      // bit 14: Committed to ring
    SHIELDED = 1 << (ENGINE_FLAG_OFFSET + 7),       // bit 15: Has commit shield
}

/**
 * Backward compatibility exports
 * Maps old flag names to new CJRFoodFlags
 */
export const FOOD_PIGMENT = CJRFoodFlags.FOOD_PIGMENT;
export const FOOD_CATALYST = CJRFoodFlags.FOOD_CATALYST;
export const FOOD_SHIELD = CJRFoodFlags.FOOD_SHIELD;
export const FOOD_SOLVENT = CJRFoodFlags.FOOD_SOLVENT;
export const FOOD_NEUTRAL = CJRFoodFlags.FOOD_NEUTRAL;
