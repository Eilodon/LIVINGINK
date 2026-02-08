import { PigmentVec3 } from './game/cjr/cjrTypes';

// World Settings (Core Engine Constants)
export const WORLD_WIDTH = 3400;
export const WORLD_HEIGHT = 3400;
export const MAP_RADIUS = 1600;
export const INITIAL_ZONE_RADIUS = 1600;
export const CENTER_RADIUS = 320;
// EIDOLON-V AUDIT FIX: Synced with @cjr/shared (was 150, server uses 480)
export const GAME_DURATION = 480;
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
// EIDOLON-V FIX: Unified with @cjr/engine SSOT (was 2.3 legacy)
// Use @cjr/engine's MAX_SPEED_BASE instead of this local copy
export const MAX_SPEED_BASE = 150;

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

// EIDOLON-V FIX: Add CJR constants to main file for single source of truth
// These were previously duplicated in services/cjr/cjrConstants.ts
// EIDOLON-V AUDIT FIX: Synced with @cjr/shared (R3 was 400, CENTER was 100)
export const RING_RADII = {
  R1: 1600,
  R2: 1000,
  R3: 500,
  CENTER: 150,
};

export const THRESHOLDS = {
  ENTER_RING2: 0.5,
  ENTER_RING3: 0.7,
  WIN_HOLD: 0.9,
  // Alias for backward compatibility if needed
  INTO_RING2: 0.5,
  INTO_RING3: 0.7,
};

export const COMMIT_BUFFS = {
  SHIELD_DURATION: 2.0,
  SPEED_BOOST: 1.1,
  SPEED_DURATION: 2.0,
  // Ring specific buffs
  R2: {
    duration: 2.0,
    speed: 1.1,
  },
  R3: {
    duration: 3.0,
    speed: 1.2,
  },
};

// --- EIDOLON-V: Unified Color System ---
// Re-export from @cjr/shared (Single Source of Truth)
export { COLOR_PALETTE_HEX, COLOR_DATA, COLOR_INT, COLOR_HEX, COLOR_VEC3 } from '@cjr/shared';
