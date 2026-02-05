/**
 * @eidolon/engine - Core Engine Constants
 *
 * EIDOLON-V PLATFORMIZATION:
 * Pure engine constants - no game-specific logic.
 * Game-specific constants should be in modules.
 */

// ============================================================
// WORLD SETTINGS (Core Engine)
// ============================================================
export const WORLD_WIDTH = 3400;
export const WORLD_HEIGHT = 3400;
export const MAP_RADIUS = 1600;
export const GRID_CELL_SIZE = 300;

// ============================================================
// ENTITY SETTINGS (Core Engine)
// ============================================================
export const PLAYER_START_RADIUS = 28;
export const MAX_ENTITY_RADIUS = 155;
export const FOOD_RADIUS = 7;

// ============================================================
// PHYSICS CONSTANTS (Core Engine)
// ============================================================
export const TURN_SPEED_BASE = 0.25;
export const ACCELERATION_BASE = 1.0;
export const FRICTION_BASE = 0.93;
// EIDOLON-V FIX: Unified MAX_SPEED_BASE = 150 (was 2.3 legacy)
// This matches MovementSystem and GameRoom server validation
export const MAX_SPEED_BASE = 150;

export const PHYSICS = {
    // Integration
    DT_MULTIPLIER: 60,          // Base units/sec
    FIXED_DT: 1 / 60,           // 60Hz fixed timestep
    MAX_ACCUMULATOR: 0.25,      // Spiral of death cap

    // Collision
    ELASTIC_K: 5.0,             // Spring constant
    ELASTIC_C: 0.2,             // Damping

    // Network
    TICK_RATE: 20,              // Server ticks per second
    BINARY_BUFFER_SIZE: 131072, // 128KB
    MAX_ENTITIES_PER_PACKET: 4000,
} as const;

// ============================================================
// GAME BALANCE (Core - can be overridden by modules)
// ============================================================
export const EAT_THRESHOLD_RATIO = 0.9;
export const DANGER_THRESHOLD_RATIO = 1.1;
export const SPAWN_PROTECTION_TIME = 5;
export const GAME_DURATION = 150;

// ============================================================
// BOT/FOOD DEFAULTS (Can be overridden by module config)
// ============================================================
export const FOOD_COUNT = 260;
export const BOT_COUNT = 28;
export const BOT_RESPAWN_TIME = 20;
export const FOOD_GROWTH_MULTIPLIER = 0.08;
export const KILL_GROWTH_MULTIPLIER = 0.16;


