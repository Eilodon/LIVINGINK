/**
 * @eidolon/engine - CJR Module Constants
 *
 * All Color Jelly Rush specific constants.
 * These are the authoritative values for CJR game mode.
 */

// ============================================================
// RING SYSTEM
// ============================================================

/** Ring boundary radii - SYNCED with @cjr/shared */
export const RING_RADII = {
    R1: 1600,   // Outer ring
    R2: 1000,   // Middle ring
    R3: 500,    // Inner ring (was 400, synced with shared)
    CENTER: 150, // Win zone (was 100, synced with shared)
} as const;

/** Pre-computed squared radii for fast distance checks */
export const RING_RADII_SQ = {
    R1: RING_RADII.R1 * RING_RADII.R1,
    R2: RING_RADII.R2 * RING_RADII.R2,
    R3: RING_RADII.R3 * RING_RADII.R3,
    CENTER: RING_RADII.CENTER * RING_RADII.CENTER,
} as const;

/** Ring zone starting radius */
export const INITIAL_ZONE_RADIUS = 1600;
export const CENTER_RADIUS = 320;

// ============================================================
// COLOR MATCHING THRESHOLDS
// ============================================================

export const THRESHOLDS = {
    ENTER_RING2: 0.5,   // 50% match to enter ring 2
    ENTER_RING3: 0.7,   // 70% match to enter ring 3
    WIN_HOLD: 0.9,      // 90% match to win in center
    INTO_RING2: 0.5,
    INTO_RING3: 0.7,
} as const;

// ============================================================
// RING COMMIT BUFFS
// ============================================================

export const COMMIT_BUFFS = {
    SHIELD_DURATION: 2.0,
    SPEED_BOOST: 1.1,
    SPEED_DURATION: 2.0,
    R2: {
        duration: 2.0,
        speed: 1.1,
        shield: 0.3,
    },
    R3: {
        duration: 3.0,
        speed: 1.2,
        shield: 0.5,
    },
} as const;

// ============================================================
// ENTITY GROWTH
// ============================================================

export const TIER_RADIUS_RANGE = 150;
export const GROWTH_DECAY_START = 70;
export const GROWTH_DECAY_END = 155;
export const TRAIL_LENGTH = 12;

// ============================================================
// EJECT MECHANICS
// ============================================================

export const EJECT_MASS_COST = 8;
export const EJECT_SPEED = 18;
export const SKILL_COOLDOWN_BASE = 8;

// ============================================================
// RELIC SYSTEM
// ============================================================

export const RELIC_RESPAWN_TIME = 35;
export const RELIC_VALUE = 25;
export const RELIC_RADIUS = 18;

// ============================================================
// KING BOUNTY
// ============================================================

export const KING_DAMAGE_TAKEN_MULTIPLIER = 1.15;
export const KING_DAMAGE_DEALT_MULTIPLIER = 0.9;
export const KING_BOUNTY_SCORE = 200;

// ============================================================
// MUTATIONS / TATTOOS
// ============================================================

export const MUTATION_CHOICES = 3;

// ============================================================
// WAVE SPAWNER
// ============================================================

export const WAVE_CONFIG = {
    INTERVAL: {
        1: 8000,
        2: 10000,
        3: 14000,
    },
    INTERVAL_R1: 8000,
    INTERVAL_R2: 10000,
    INTERVAL_R3: 14000,
    SPAWN_WEIGHTS: {
        pigment: 0.6,
        neutral: 0.25,
        special: 0.15,
    },
    SPAWN_COUNTS: {
        R1: 5,
        R2: 4,
        R3: 3,
    },
} as const;

// ============================================================
// BOSS SYSTEM
// ============================================================

export const BOSS_CONFIGS = {
    BOSS_1_TRIGGER: 'RING_2_ACTIVE',
    BOSS_2_TRIGGER: 'RING_3_ACTIVE',
} as const;

export const BOSS_SPEED = 100;
export const BOSS_DASH_MULTIPLIER = 3;
export const BOSS_ATTACK_COOLDOWN = 5;
