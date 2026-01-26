
import { PigmentVec3 } from './services/cjr/cjrTypes';

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
// Growth decay logic might need tuning for CJR mass-based mixing
export const GROWTH_DECAY_START = 70;
export const GROWTH_DECAY_END = 155;

// PHYSICS 4.0: NEURAL-LINK RESPONSIVENESS
export const TURN_SPEED_BASE = 0.25;
export const ACCELERATION_BASE = 1.0;
export const FRICTION_BASE = 0.93;
export const MAX_SPEED_BASE = 6.8;

export const FOOD_COUNT = 260;
export const BOT_COUNT = 28;
export const BOT_RESPAWN_TIME = 20;
export const FOOD_RADIUS = 7;
export const TRAIL_LENGTH = 12;
export const FOOD_GROWTH_MULTIPLIER = 0.08;
export const KILL_GROWTH_MULTIPLIER = 0.16;

// THE HOLY TRINITY RULES
export const EAT_THRESHOLD_RATIO = 0.90;
export const DANGER_THRESHOLD_RATIO = 1.10;

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

// EIDOLON-V FIX: Add CJR constants to main file for single source of truth
// These were previously duplicated in services/cjr/cjrConstants.ts
export const RING_RADII = {
  R1: 1600,
  R2: 1000,
  R3: 400,
  CENTER: 100,
};

export const THRESHOLDS = {
  ENTER_RING2: 0.50,
  ENTER_RING3: 0.70,
  WIN_HOLD: 0.90,
  // Alias for backward compatibility if needed
  INTO_RING2: 0.50,
  INTO_RING3: 0.70,
};

export const COMMIT_BUFFS = {
  SHIELD_DURATION: 2.0,
  SPEED_BOOST: 1.10,
  SPEED_DURATION: 2.0,
  // Ring specific buffs
  R2: {
    duration: 2.0,
    speed: 1.10
  },
  R3: {
    duration: 3.0,
    speed: 1.20
  }
};

export const COLOR_PALETTE = {
  background: '#111111',
  rings: {
    r1: '#475569', // Slate
    r2: '#3b82f6', // Blue
    r3: '#ef4444'  // Red
  }
};

export const WAVE_CONFIG = {
  INTERVAL: {
    1: 8000,
    2: 10000,
    3: 14000,
  },
  // Flattened aliases for waveSpawner.ts
  INTERVAL_R1: 8000,
  INTERVAL_R2: 10000,
  INTERVAL_R3: 14000,

  SPAWN_WEIGHTS: {
    pigment: 0.60,
    neutral: 0.25,
    special: 0.15
  },
  SPAWN_COUNTS: {
    R1: 5,
    R2: 4,
    R3: 3
  }
};

export const BOSS_CONFIGS = {
  BOSS_1_TRIGGER: 'RING_2_ACTIVE',
  BOSS_2_TRIGGER: 'RING_3_ACTIVE',
};
