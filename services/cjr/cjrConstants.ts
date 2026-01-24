
// Ring Radii
export const RING_RADII = {
    R1_OUTER: 1600,
    R2_BOUNDARY: 1000,
    R3_BOUNDARY: 500,
    CENTER: 150,
};

// Match Thresholds (to enter next ring)
export const THRESHOLDS = {
    INTO_RING2: 0.50, // 50% Match
    INTO_RING3: 0.70, // 70% Match
    WIN_HOLD: 0.90,   // 90% Match to channel win
};

// Wave Mechanics
export const WAVE_INTERVALS = {
    RING1: 8,
    RING2: 10,
    RING3: 13,
};

// Spawn Ratios per Ring (Pigment / Neutral / Special)
export const SPAWN_WEIGHTS = {
    RING1: { pigment: 0.6, neutral: 0.25, special: 0.15 },
    RING2: { pigment: 0.6, neutral: 0.25, special: 0.15 },
    RING3: { pigment: 0.6, neutral: 0.25, special: 0.15 },
};

// Commit Buffs (Momentum for entering new ring)
export const COMMIT_BUFFS = {
    SPEED_DURATION: 2.0,
    SPEED_BOOST: 1.1,
    SHIELD_DURATION: 2.0,
};

export const CONTRIBUTION_TIERS = [
    { rank: 1, speedBoost: 1.2, shieldDuration: 5 },
    { rank: 2, speedBoost: 1.1, shieldDuration: 3 },
    { rank: 3, speedBoost: 1.05, shieldDuration: 0 }
];
