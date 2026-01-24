
import { PigmentVec3 } from './cjrTypes';

export const mixPigment = (current: PigmentVec3, target: PigmentVec3, ratio: number): PigmentVec3 => {
    // Simple Lerp for now
    // New = Current * (1-ratio) + Target * ratio
    return {
        r: current.r * (1 - ratio) + target.r * ratio,
        g: current.g * (1 - ratio) + target.g * ratio,
        b: current.b * (1 - ratio) + target.b * ratio,
    };
};

export const calcMatchPercent = (p1: PigmentVec3, p2: PigmentVec3): number => {
    // Euclidean distance in RGB space (0..1)
    const dr = p1.r - p2.r;
    const dg = p1.g - p2.g;
    const db = p1.b - p2.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    // Max distance is sqrt(3) ~ 1.732
    const maxDist = Math.sqrt(3);
    const raw = 1 - dist / maxDist;

    // Clamp and curve for smoother feel
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.pow(clamped, 1.1);
};

export const pigmentToHex = (p: PigmentVec3): string => {
    const toHex = (c: number) => {
        const hex = Math.floor(Math.max(0, Math.min(1, c)) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(p.r)}${toHex(p.g)}${toHex(p.b)}`;
};

export const getColorHint = (current: PigmentVec3, target: PigmentVec3): string => {
    const diffR = target.r - current.r;
    const diffG = target.g - current.g;
    const diffB = target.b - current.b;

    // Find biggest gap
    const absR = Math.abs(diffR);
    const absG = Math.abs(diffG);
    const absB = Math.abs(diffB);

    const brightnessDiff = (diffR + diffG + diffB) / 3;
    if (Math.abs(brightnessDiff) > 0.2 && absR < 0.15 && absG < 0.15 && absB < 0.15) {
        return brightnessDiff > 0 ? 'Need LIGHTER' : 'Need DARKER';
    }

    if (absR > absG && absR > absB) return diffR > 0 ? "Need RED" : "Too RED";
    if (absG > absR && absG > absB) return diffG > 0 ? "Need GREEN" : "Too GREEN";
    return diffB > 0 ? "Need BLUE" : "Too BLUE";
};

/**
 * Snap Assist: Bonus alpha when eating correct pigment at high match%
 * Vision Doc PR3: "If match >= 0.80: eating correct pigment gets bonus alpha"
 */
export const getSnapAlpha = (match: number, baseAlpha: number): number => {
    // If match >= 0.80, eating correct pigment gets 30% bonus alpha
    return match >= 0.80 ? baseAlpha * 1.3 : baseAlpha;
};

/**
 * Pity Boost: Temporary buff when stuck below threshold
 * Vision Doc PR3: "If stuck below threshold for long time: grant 4s buff"
 */
export const shouldGrantPityBoost = (stuckTime: number): boolean => {
    // If stuck below ring threshold for > 10 seconds, grant pity boost
    return stuckTime > 10.0;
};

export const PITY_BOOST_DURATION = 4.0; // seconds
export const PITY_BOOST_ALPHA_MULTIPLIER = 1.5; // 50% faster color mixing
