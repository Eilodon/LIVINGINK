/**
 * @cjr/shared - Unified Color System
 * Single Source of Truth for all color definitions
 * 
 * Three formats available:
 * - COLOR_INT: For Pixi.js / WebGL (0xRRGGBB)
 * - COLOR_HEX: For CSS / Canvas2D ('#RRGGBB')
 * - COLOR_VEC3: For Shaders (Float32Array [r, g, b])
 */

// =============================================================================
// MASTER DEFINITIONS (Edit only here)
// =============================================================================

const RING_COLORS = {
    r1: { int: 0x475569, hex: '#475569' }, // Outer - Gray/Slate
    r2: { int: 0x3b82f6, hex: '#3b82f6' }, // Middle - Blue
    r3: { int: 0xef4444, hex: '#ef4444' }, // Inner - Red
} as const;

const CENTER_COLOR = { int: 0xfbbf24, hex: '#fbbf24' }; // Gold/Amber
const BACKGROUND_COLOR = { int: 0x111111, hex: '#111111' }; // Dark

const UI_COLORS = {
    safe: { int: 0x22c55e, hex: '#22c55e' },      // Green
    danger: { int: 0xef4444, hex: '#ef4444' },    // Red
    combat: { int: 0xeab308, hex: '#eab308' },    // Yellow
    counter: { int: 0x3b82f6, hex: '#3b82f6' },   // Blue
    countered: { int: 0xf97316, hex: '#f97316' }, // Orange
} as const;

// =============================================================================
// EXPORTED FORMATS
// =============================================================================

/** Integer format for Pixi.js / WebGL */
export const COLOR_INT = {
    rings: {
        r1: RING_COLORS.r1.int,
        r2: RING_COLORS.r2.int,
        r3: RING_COLORS.r3.int,
    },
    center: CENTER_COLOR.int,
    background: BACKGROUND_COLOR.int,
    ui: {
        safe: UI_COLORS.safe.int,
        danger: UI_COLORS.danger.int,
        combat: UI_COLORS.combat.int,
        counter: UI_COLORS.counter.int,
        countered: UI_COLORS.countered.int,
    },
} as const;

/** Hex string format for CSS / Canvas2D */
export const COLOR_HEX = {
    rings: {
        r1: RING_COLORS.r1.hex,
        r2: RING_COLORS.r2.hex,
        r3: RING_COLORS.r3.hex,
    },
    center: CENTER_COLOR.hex,
    background: BACKGROUND_COLOR.hex,
    ui: {
        safe: UI_COLORS.safe.hex,
        danger: UI_COLORS.danger.hex,
        combat: UI_COLORS.combat.hex,
        counter: UI_COLORS.counter.hex,
        countered: UI_COLORS.countered.hex,
    },
} as const;

// Helper for shader vec3
const intToVec3 = (c: number): Float32Array => new Float32Array([
    ((c >> 16) & 0xff) / 255,
    ((c >> 8) & 0xff) / 255,
    (c & 0xff) / 255,
]);

/** Float32Array format for Shaders */
export const COLOR_VEC3 = {
    R1: intToVec3(RING_COLORS.r1.int),
    R2: intToVec3(RING_COLORS.r2.int),
    R3: intToVec3(RING_COLORS.r3.int),
    CENTER: intToVec3(CENTER_COLOR.int),
    BG: intToVec3(BACKGROUND_COLOR.int),
} as const;

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================

/** @deprecated Use COLOR_HEX instead */
export const COLOR_PALETTE_HEX = COLOR_HEX;

/** @deprecated Use COLOR_VEC3 instead */
export const COLOR_DATA = COLOR_VEC3;
