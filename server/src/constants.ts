
import { PigmentVec3 } from './cjrTypes';

// World Settings
export const WORLD_WIDTH = 3400;
export const WORLD_HEIGHT = 3400;
export const MAP_RADIUS = 1600;
export const INITIAL_ZONE_RADIUS = 1600;
export const CENTER_RADIUS = 320;
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

// --- CJR SPECIFIC CONSTANTS (Moved from cjrConstants.ts to here for single source of truth or compatibility) ---
// Ring radii (distance from center)
export const RING_RADII = {
  R1_OUTER: 1600,
  R2_BOUNDARY: 1000,
  R3_BOUNDARY: 500,
  CENTER: 150,
};

// Match thresholds
export const THRESHOLDS = {
  INTO_RING2: 0.50,
  INTO_RING3: 0.70,
  WIN_HOLD: 0.90,
};

// Commit buffs
export const COMMIT_BUFFS = {
  SHIELD_DURATION: 2.0,
  SPEED_BOOST: 1.10,
  SPEED_DURATION: 2.0,
};

export const COLOR_PALETTE = {
  background: '#020617', // Void color
  grid: 'rgba(255,255,255,0.05)',
  zone: 'rgba(20, 0, 20, 0.5)',
  zoneBorder: '#ef4444',
  text: '#ffffff',
  indicatorSafe: '#22c55e',
  indicatorDanger: '#ef4444',
  indicatorCombat: '#eab308',
  indicatorCounter: '#3b82f6',
  indicatorCountered: '#f97316',
};
