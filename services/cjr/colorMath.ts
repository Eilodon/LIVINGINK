
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
    // Cosine Similarity might be better for "Hue" matching regardless of intensity
    // But our pigments are 0..1 RGB, which includes intensity.
    // Euclidean distance is safest for "Exact Match".
    // Max distance sqrt(3) ~ 1.732
    const dist = Math.sqrt(
        Math.pow(p1.r - p2.r, 2) +
        Math.pow(p1.g - p2.g, 2) +
        Math.pow(p1.b - p2.b, 2)
    );

    // Return 1 - normalized distance
    // Sharp falloff? 
    // Let's say tolerance is 0.5 distance.
    return Math.max(0, 1 - (dist / 0.8));
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

    if (absR > absG && absR > absB) return diffR > 0 ? "Need RED" : "Too RED";
    if (absG > absR && absG > absB) return diffG > 0 ? "Need GREEN" : "Too GREEN";
    return diffB > 0 ? "Need BLUE" : "Too BLUE";
};
