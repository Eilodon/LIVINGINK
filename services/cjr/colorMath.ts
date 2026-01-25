
import { PigmentVec3 } from './cjrTypes';

// Linear interpolation between two colors
export const lerpPigment = (current: PigmentVec3, target: PigmentVec3, alpha: number): PigmentVec3 => {
    return {
        r: current.r + (target.r - current.r) * alpha,
        g: current.g + (target.g - current.g) * alpha,
        b: current.b + (target.b - current.b) * alpha,
    };
};

// Calculate match percentage (0..1)
// Using 1 - Euclidean distance normalized
export const calculateMatchPercent = (current: PigmentVec3, target: PigmentVec3): number => {
    const dr = current.r - target.r;
    const dg = current.g - target.g;
    const db = current.b - target.b;

    // Max possible distance is sqrt(1^2 + 1^2 + 1^2) = sqrt(3) ~ 1.732
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxDist = 1.732;

    return Math.max(0, 1 - (dist / maxDist));
};

// Helper to convert PigmentVec3 to Hex String for PIXI
export const pigmentToHex = (p: PigmentVec3): string => {
    const r = Math.round(Math.max(0, Math.min(1, p.r)) * 255);
    const g = Math.round(Math.max(0, Math.min(1, p.g)) * 255);
    const b = Math.round(Math.max(0, Math.min(1, p.b)) * 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Mix logic: Small jelly eating big pigment changes fast? 
// No, conservation of mass logic usually suggests:
// newColor = (m1*c1 + m2*c2) / (m1+m2)
export const mixPigmentWithMass = (
    c1: PigmentVec3, m1: number,
    c2: PigmentVec3, m2: number
): PigmentVec3 => {
    const total = m1 + m2;
    if (total <= 0) return c1;

    return {
        r: (c1.r * m1 + c2.r * m2) / total,
        g: (c1.g * m1 + c2.g * m2) / total,
        b: (c1.b * m1 + c2.b * m2) / total,
    };
};

export const getSnapAlpha = (currentMatch: number, baseRatio: number): number => {
    // Boost mixing speed if player is already close to target (Snap effect)
    if (currentMatch > 0.9) return baseRatio * 2.0;
    if (currentMatch > 0.8) return baseRatio * 1.5;
    return baseRatio;
};

export const calcMatchPercent = calculateMatchPercent;
export const mixPigment = lerpPigment;
