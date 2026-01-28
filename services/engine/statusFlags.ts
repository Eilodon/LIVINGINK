/**
 * EIDOLON-V: V8-Optimized Bitmask Status System
 * 
 * Separation of concerns:
 * - StatusFlag: Core gameplay states (Movement, Combat) - Bits 0-15
 * - TattooFlag: Synergy and Tattoo specific states - Bits 16-31 (or separate field)
 * - ExtendedFlag: Scaling for future mechanics
 */

export enum StatusFlag {
    NONE = 0,
    SHIELDED = 1 << 0,
    BURNING = 1 << 1,
    SLOWED = 1 << 2,
    POISONED = 1 << 3,
    AIRBORNE = 1 << 4,
    STEALTHED = 1 << 5,
    INVULNERABLE = 1 << 6,
    ROOTED = 1 << 7,
    // Bits 8-15 reserved for Core Mechanics
    DASHING = 1 << 8,
    STUNNED = 1 << 9,
    SILENCED = 1 << 10,
    DISARMED = 1 << 11,
}

export enum TattooFlag {
    NONE = 0,
    // Synergy Flags
    NEUTRAL_PURIFICATION = 1 << 0,
    OVERDRIVE_EXPLOSIVE = 1 << 1,
    GOLDEN_ATTRACTION = 1 << 2,
    ELEMENTAL_BALANCE = 1 << 3,
    SHIELD_SOLVENT_SYNERGY = 1 << 4,
    COLOR_IMMUNITY = 1 << 5,
    CATALYST_GUARANTEE = 1 << 6,
    NEUTRAL_GOD_MODE = 1 << 7,
    KINETIC_EXPLOSION = 1 << 8,
    SHIELD_PIERCING = 1 << 9,
    ABSOLUTE_MASTERY = 1 << 10,
    TEMPORAL_DISTORTION = 1 << 11,

    // Active Tattoo State Flags
    OVERDRIVE_ACTIVE = 1 << 12,
    CORE_SHIELD_BONUS = 1 << 13,
    PIGMENT_BOMB_ACTIVE = 1 << 14,
    CATALYST_SENSE_ACTIVE = 1 << 15,
}

export enum ExtendedFlag {
    NONE = 0,
    // Future expansion
}

// Pre-computed masks for hot paths
export const MASK_MOVEMENT_IMPAIRED = StatusFlag.SLOWED | StatusFlag.ROOTED | StatusFlag.STUNNED;
export const MASK_CONTROL_IMPAIRED = StatusFlag.STUNNED | StatusFlag.SILENCED | StatusFlag.DISARMED;
export const MASK_INVINCIBLE = StatusFlag.INVULNERABLE | StatusFlag.DASHING; // Dashing often grants i-frames

// Helper Functions (Inlined-style for V8)
export const hasFlag = (mask: number, flag: number): boolean => (mask & flag) === flag;
export const hasAnyFlag = (mask: number, flags: number): boolean => (mask & flags) !== 0;
export const setFlag = (mask: number, flag: number): number => mask | flag;
export const clearFlag = (mask: number, flag: number): number => mask & ~flag;
export const toggleFlag = (mask: number, flag: number): number => mask ^ flag;
