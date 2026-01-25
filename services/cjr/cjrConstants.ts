// Ring System
export const RING_RADII = {
    R1: 2000, // Outer Ring Boundary
    R2: 1200, // Middle Ring Boundary
    R3: 500,  // Inner Ring Boundary (Death Zone start)
    CENTER: 0,
};

export const RING_THRESHOLDS = {
    ENTER_R2: 0.50, // Match % required to enter Ring 2
    ENTER_R3: 0.70, // Match % required to enter Ring 3
    WIN_HOLD: 0.90, // Match % required to start holding center
};

// Commit Buffs (when entering a new ring)
export const COMMIT_BUFFS = {
    SHIELD_DURATION: 2000, // ms
    SPEED_BOOST_PERCENT: 0.10,
    SPEED_BOOST_DURATION: 2000, // ms
};

// Wave Spawning
export const WAVE_INTERVALS = {
    R1: 8000, // ms
    R2: 10000, // ms
    R3: 12000, // ms
};

export const SPAWN_RATIOS = {
    PIGMENT: 0.60,
    NEUTRAL: 0.25,
    SPECIAL: 0.15,
};

// Candy Vein (Dynamic Bounty)
export const CANDY_VEIN = {
    TRIGGER_RATIO: 0.30, // Trigger if alive/total in R3 <= 30%
    LIFETIME: 10000, // ms
    SPAWN_RADIUS_MIN: 100,
    SPAWN_RADIUS_MAX: 400,
};

// Color Math
export const COLOR_LERP = {
    BASE_ALPHA: 0.1, // Default blending speed
    HEAVY_MASS_PENALTY: 0.05, // Reduction in blending speed as mass grows
};

// Win Condition
export const WIN_HOLD_DURATION = 1500; // ms to win in center
export const PULSE_INTERVAL = 500; // ms between heartbeat pulses
