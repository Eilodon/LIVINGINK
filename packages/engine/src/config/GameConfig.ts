/**
 * @cjr/engine - Game Configuration
 * Centralized constants for gameplay, physics, and networking.
 * Replaces scattered magic numbers.
 */

export const GameConfig = {
    // Physics
    PHYSICS: {
        /**
         * Legacy velocity integration scale.
         * Scales dt before applying velocity.
         * @deprecated Should eventually standardize on 1.0 (pixels/sec)
         */
        TIME_SCALE: 10,
    },

    // Camera
    CAMERA: {
        /**
         * Camera position lerp factor (0-1).
         * Higher = faster snapping.
         */
        LERP_FACTOR: 0.1,
    },

    // Networking
    NETWORK: {
        /**
         * Maximum allowed position divergence before forcing a snap (pixels).
         */
        RECONCILE_THRESHOLD: 20,

        /**
         * Render delay for interpolation (ms).
         * Smooths out network jitter at the cost of latency.
         */
        INTERPOLATION_DELAY_MS: 100,

        /**
         * Maximum allowed sequence jump in inputs before rejection.
         * Prevents speed hacks / replay attacks.
         */
        MAX_SEQUENCE_JUMP: 60,
    },

    // Memory / Performance
    MEMORY: {
        /**
         * Maximum number of food items to keep in memory before culling.
         */
        MAX_FOOD_COUNT: 200,
    },

    // Performance Manager
    PERFORMANCE: {
        /**
         * Target FPS for HIGH tier.
         */
        TARGET_FPS: 60,

        /**
         * Number of consecutive bad frames before tier downgrade.
         */
        DOWNGRADE_THRESHOLD: 3,

        /**
         * Number of consecutive good frames before tier upgrade.
         */
        UPGRADE_THRESHOLD: 10,
    }
} as const;
