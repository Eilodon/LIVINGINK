/**
 * BALANCE.TS - Central Tuning Knobs
 * 
 * All gameplay balance parameters in one place for easy playtesting iteration.
 * Vision Doc: "balance.ts" module for tuning without touching core logic.
 */

// ============================================
// COLOR MIXING BALANCE
// ============================================

export const COLOR_BALANCE = {
    // Base alpha for pigment mixing (how fast color changes)
    BASE_ALPHA: 0.15, // 15% of pickup color per eat

    // Alpha scaling by entity size (bigger = harder to change color)
    ALPHA_SIZE_CURVE: (entityRadius: number, pickupRadius: number): number => {
        const ratio = pickupRadius / entityRadius;
        // Smaller pickups have less impact on big jellies
        return Math.min(1.0, ratio * 2.0);
    },

    // Snap assist bonus (when match >= 80%)
    SNAP_ASSIST_MULTIPLIER: 1.3,

    // Pity boost parameters
    PITY_STUCK_THRESHOLD: 10.0, // seconds stuck below threshold
    PITY_BOOST_DURATION: 4.0,
    PITY_BOOST_ALPHA_MULT: 1.5,
};

// ============================================
// RING PROGRESSION BALANCE
// ============================================

export const RING_BALANCE = {
    // Match thresholds (can be tweaked for difficulty)
    THRESHOLD_RING2: 0.50,
    THRESHOLD_RING3: 0.70,
    THRESHOLD_WIN: 0.90,

    // Rush window (after boss defeat)
    RUSH_WINDOW_DURATION: 5.0,
    RUSH_THRESHOLD_REDUCTION: 0.8, // 20% easier during rush

    // Commit buffs
    COMMIT_SPEED_BOOST: 1.2,
    COMMIT_SPEED_DURATION: 3.0,
    COMMIT_SHIELD_DURATION: 3.0,
};

// ============================================
// WAVE SPAWNING BALANCE
// ============================================

export const WAVE_BALANCE = {
    // Wave intervals (seconds between bursts)
    INTERVAL_RING1: 8,
    INTERVAL_RING2: 10,
    INTERVAL_RING3: 13,

    // Burst sizes (pickups per wave)
    BURST_RING1: 8,
    BURST_RING2: 6,
    BURST_RING3: 4,

    // Spawn weights per ring
    WEIGHTS_RING1: { pigment: 0.7, neutral: 0.2, special: 0.1 },
    WEIGHTS_RING2: { pigment: 0.5, neutral: 0.3, special: 0.2 },
    WEIGHTS_RING3: { pigment: 0.3, neutral: 0.4, special: 0.3 },
};

// ============================================
// BOSS BALANCE
// ============================================

export const BOSS_BALANCE = {
    // Boss 1 (Ring 2 Guardian)
    BOSS1_HEALTH: 500,
    BOSS1_DAMAGE: 15,
    BOSS1_ATTACK_INTERVAL: 3.0,
    BOSS1_SPAWN_TIME: 45, // seconds into game

    // Boss 2 (Ring 3 Guardian)
    BOSS2_HEALTH: 800,
    BOSS2_DAMAGE: 25,
    BOSS2_ATTACK_INTERVAL: 2.0,
    BOSS2_SPAWN_TIME: 90,

    // Contribution tier rewards
    CONTRIB_TOP1_SPEED: 1.20,
    CONTRIB_TOP1_SHIELD: 5.0,
    CONTRIB_TOP2_SPEED: 1.15,
    CONTRIB_TOP2_SHIELD: 3.0,
    CONTRIB_TOP3_SPEED: 1.10,
    CONTRIB_TOP3_SHIELD: 2.0,
};

// ============================================
// CANDY VEIN (DYNAMIC BOUNTY) BALANCE
// ============================================

export const BOUNTY_BALANCE = {
    // Trigger when Ring3 population drops below this ratio
    TRIGGER_THRESHOLD: 0.30, // 30% of alive players

    // Spawn cooldown
    SPAWN_COOLDOWN: 15.0, // seconds

    // Candy Vein properties
    LIFETIME: 10.0,
    MATCH_BOOST: 0.25, // Direct +25% match
    MASS_BOOST: 25,
    RADIUS: 15,
};

// ============================================
// WIN CONDITION BALANCE
// ============================================

export const WIN_BALANCE = {
    CHANNEL_DURATION: 1.5, // seconds to hold center
    CENTER_RADIUS: 150,
    REQUIRED_MATCH: 0.90,

    // Pulse heartbeat intervals
    PULSE_INTERVALS: [0.5, 0.3, 0.2], // Gets faster as channel progresses
};

// ============================================
// SHAPE SKILLS BALANCE
// ============================================

export const SKILL_BALANCE = {
    // Circle: Jet Dash
    CIRCLE_COOLDOWN: 3.0,
    CIRCLE_DASH_POWER: 800,
    CIRCLE_INVULN_DURATION: 0.3,

    // Square: Shockwave Bump
    SQUARE_COOLDOWN: 5.0,
    SQUARE_KNOCKBACK: 400,
    SQUARE_DAMAGE: 10,
    SQUARE_SHIELD_DURATION: 2.0,

    // Triangle: Piercing Strike
    TRIANGLE_COOLDOWN: 4.0,
    TRIANGLE_DAMAGE_MULT: 2.5,
    TRIANGLE_ARMOR_PEN: 0.5,
    TRIANGLE_BUFF_DURATION: 3.0,

    // Hex: Vortex Pull
    HEX_COOLDOWN: 8.0,
    HEX_MAGNET_RADIUS: 200,
    HEX_PULL_STRENGTH: 150,
    HEX_VALUE_BOOST: 1.3,
    HEX_DURATION: 2.0,
};

// ============================================
// EMOTION SYSTEM BALANCE
// ============================================

export const EMOTION_BALANCE = {
    // Emotion priorities (higher = overrides lower)
    PRIORITY_KO: 100,
    PRIORITY_VICTORY: 90,
    PRIORITY_PANIC: 70,
    PRIORITY_DESPAIR: 60,
    PRIORITY_FOCUS: 50,
    PRIORITY_GREED: 40,
    PRIORITY_YUM: 30,
    PRIORITY_HUNGRY: 20,
    PRIORITY_HAPPY: 10,

    // Trigger thresholds
    LOW_HEALTH_THRESHOLD: 0.3, // 30% HP for despair
    HIGH_MATCH_THRESHOLD: 0.8, // 80% match for focus
    HUNGRY_TIME: 5.0, // seconds without eating
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Apply difficulty scaling (for future easy/normal/hard modes)
 */
export const applyDifficultyScale = (difficulty: 'easy' | 'normal' | 'hard') => {
    switch (difficulty) {
        case 'easy':
            RING_BALANCE.THRESHOLD_RING2 = 0.40;
            RING_BALANCE.THRESHOLD_RING3 = 0.60;
            BOSS_BALANCE.BOSS1_HEALTH = 400;
            BOSS_BALANCE.BOSS2_HEALTH = 600;
            break;
        case 'hard':
            RING_BALANCE.THRESHOLD_RING2 = 0.60;
            RING_BALANCE.THRESHOLD_RING3 = 0.80;
            BOSS_BALANCE.BOSS1_HEALTH = 700;
            BOSS_BALANCE.BOSS2_HEALTH = 1200;
            break;
        default: // normal
            break;
    }
};
