/**
 * @cjr/engine - Game Constants
 * Pure constant definitions - no dependencies
 */

// World Settings (Core Engine Constants)
export const WORLD_WIDTH = 3400;
export const WORLD_HEIGHT = 3400;
export const MAP_RADIUS = 1600;
export const INITIAL_ZONE_RADIUS = 1600;
export const CENTER_RADIUS = 320;
export const GAME_DURATION = 150;
export const SPAWN_PROTECTION_TIME = 5;
export const GRID_CELL_SIZE = 300;

// Entity Settings
export const PLAYER_START_RADIUS = 28;
export const TIER_RADIUS_RANGE = 150;
export const MAX_ENTITY_RADIUS = 155;
export const GROWTH_DECAY_START = 70;
export const GROWTH_DECAY_END = 155;

// PHYSICS 4.0: NEURAL-LINK RESPONSIVENESS
export const TURN_SPEED_BASE = 0.25;
export const ACCELERATION_BASE = 1.0;
export const FRICTION_BASE = 0.93;
export const MAX_SPEED_BASE = 2.3;

export const FOOD_COUNT = 260;
export const BOT_COUNT = 28;
export const BOT_RESPAWN_TIME = 20;
export const FOOD_RADIUS = 7;
export const TRAIL_LENGTH = 12;
export const FOOD_GROWTH_MULTIPLIER = 0.08;
export const KILL_GROWTH_MULTIPLIER = 0.16;

// THE HOLY TRINITY RULES
export const EAT_THRESHOLD_RATIO = 0.9;
export const DANGER_THRESHOLD_RATIO = 1.1;

// Mechanics
export const EJECT_MASS_COST = 8;
export const EJECT_SPEED = 18;
export const SKILL_COOLDOWN_BASE = 8;

// Objective
export const RELIC_RESPAWN_TIME = 35;
export const RELIC_VALUE = 25;
export const RELIC_RADIUS = 18;

// King Bounty
export const KING_DAMAGE_TAKEN_MULTIPLIER = 1.15;
export const KING_DAMAGE_DEALT_MULTIPLIER = 0.9;
export const KING_BOUNTY_SCORE = 200;

// Mutations
export const MUTATION_CHOICES = 3;

// Ring Radii
export const RING_RADII = {
    R1: 1600,
    R2: 1000,
    R3: 400,
    CENTER: 100,
} as const;

// EIDOLON-V OPTIMIZATION: Pre-computed squares for fast distance checks
export const RING_RADII_SQ = {
    R1: RING_RADII.R1 * RING_RADII.R1,
    R2: RING_RADII.R2 * RING_RADII.R2,
    R3: RING_RADII.R3 * RING_RADII.R3,
    CENTER: RING_RADII.CENTER * RING_RADII.CENTER,
} as const;

// Match Thresholds
export const THRESHOLDS = {
    ENTER_RING2: 0.5,
    ENTER_RING3: 0.7,
    WIN_HOLD: 0.9,
    INTO_RING2: 0.5,
    INTO_RING3: 0.7,
} as const;

// Commit Buffs
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

// Wave Config
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

// Boss Config
export const BOSS_CONFIGS = {
    BOSS_1_TRIGGER: 'RING_2_ACTIVE',
    BOSS_2_TRIGGER: 'RING_3_ACTIVE',
} as const;
