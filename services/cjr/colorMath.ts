import { PigmentVec3 } from './cjrTypes';
import { COLOR_LERP } from './cjrConstants';

/**
 * Calculates the Cosine Similarity between two pigments.
 * Returns 0.0 to 1.0
 */
export function calculateMatch(a: PigmentVec3, b: PigmentVec3): number {
    // Dot product
    const dot = a.r * b.r + a.g * b.g + a.b * b.b;

    // Magnitudes
    const magA = Math.sqrt(a.r * a.r + a.g * a.g + a.b * a.b);
    const magB = Math.sqrt(b.r * b.r + b.g * b.g + b.b * b.b);

    if (magA === 0 || magB === 0) return 0;

    const similarity = dot / (magA * magB);

    // Clamp to 0..1 to handle float errors
    return Math.max(0, Math.min(1, similarity));
}

/**
 * Mixes a target pigment into the current one based on mass ratio.
 * larger mass = harder to change color.
 */
export function mixColor(
    current: PigmentVec3,
    target: PigmentVec3,
    playerMass: number,
    pickupMass: number
): PigmentVec3 {
    // Calculate interpolation factor (alpha)
    // Base alpha is modified by the mass ratio.
    // if player is huge and pickup is small, alpha is tiny.
    const ratio = pickupMass / (playerMass + pickupMass);

    // Apply a curve so it's not linear, making it harder to shift as you get big
    // But ensure a minimum shift so gameplay isn't stagnant.
    const alpha = Math.min(1, ratio * COLOR_LERP.BASE_ALPHA * 10); // *10 is a scalar to tune feeling

    return {
        r: current.r + (target.r - current.r) * alpha,
        g: current.g + (target.g - current.g) * alpha,
        b: current.b + (target.b - current.b) * alpha,
    };
}

/**
 * Converts PigmentVec3 (0..1) to CSS Hex String
 */
export function pigmentToHex(p: PigmentVec3): string {
    const to255 = (v: number) => Math.min(255, Math.max(0, Math.round(v * 255)));
    const r = to255(p.r).toString(16).padStart(2, '0');
    const g = to255(p.g).toString(16).padStart(2, '0');
    const b = to255(p.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

/**
 * Converts Hex string to PigmentVec3
 */
export function hexToPigment(hex: string): PigmentVec3 {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
}

/**
 * Returns a user-friendly hint on what color is needed.
 */
export function getColorHint(current: PigmentVec3, target: PigmentVec3): string {
    const dr = target.r - current.r;
    const dg = target.g - current.g;
    const db = target.b - current.b;

    // Find biggest discrepancy
    const absDr = Math.abs(dr);
    const absDg = Math.abs(dg);
    const absDb = Math.abs(db);

    if (absDr > absDg && absDr > absDb) {
        if (dr > 0.1) return "Need RED (+R)";
        if (dr < -0.1) return "Less RED (-R)";
    } else if (absDg > absDr && absDg > absDb) {
        if (dg > 0.1) return "Need GREEN (+G)";
        if (dg < -0.1) return "Less GREEN (-G)";
    } else if (absDb > absDr && absDb > absDg) {
        if (db > 0.1) return "Need BLUE (+B)";
        if (db < -0.1) return "Less BLUE (-B)";
    }

    if (calculateMatch(current, target) > 0.95) return "PERFECT MATCH";
    return "";
}

// ALIASES for compatibility with existing systems
export const mixPigment = (current: PigmentVec3, target: PigmentVec3, arg3: number, arg4?: number): PigmentVec3 => {
    if (arg4 !== undefined) {
        // Mass-based mixing: arg3=playerMass, arg4=pickupMass
        return mixColor(current, target, arg3, arg4);
    }
    // Legacy Ratio mixing: arg3=ratio
    const ratio = Math.max(0, Math.min(1, arg3));
    return {
        r: current.r + (target.r - current.r) * ratio,
        g: current.g + (target.g - current.g) * ratio,
        b: current.b + (target.b - current.b) * ratio
    };
};
export const calcMatchPercent = calculateMatch;
export const getSnapAlpha = (match: number, base: number) => base; // Placeholder if needed
