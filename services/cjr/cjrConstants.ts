
// COLOR JELLY RUSH - Constants & Balance

export const RING_RADII = {
    CENTER: 0,
    R3: 600,  // Inner (Death Zone / Win Hold)
    R2: 1200, // Mid (Boss 1)
    R1: 2000, // Outer (Spawn)
    MAP: 2200, // Wall
};

export const THRESHOLDS = {
    ENTER_RING2: 0.50, // 50% match
    ENTER_RING3: 0.70, // 70% match
    WIN_HOLD: 0.90,    // 90% match to channel win
};

export const WAVE_CONFIG = {
    INTERVAL_R1: 8000, // ms
    INTERVAL_R2: 10000,
    INTERVAL_R3: 14000,

    SPAWN_COUNTS: {
        R1: 20,
        R2: 15,
        R3: 10, // Scarce logic, rely on candy vein
    }
};

export const COLOR_PALETTE = {
    background: '#1a1a1a',
    grid: '#333333',
    rings: {
        r1: '#4b5563', // gray-600
        r2: '#2563eb', // blue-600
        r3: '#dc2626', // red-600
    },
    ui: {
        matchHigh: '#22c55e',
        matchMed: '#eab308',
        matchLow: '#ef4444',
    }
};

export const COMMIT_BUFFS = {
    R2: { speed: 1.10, duration: 2000, shield: 2000 },
    R3: { speed: 1.20, duration: 3000, shield: 3000 },
};
