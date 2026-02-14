/**
 * @cjr/engine - Color Math
 * Pure color manipulation utilities - OkLCH perceptually uniform
 * Zero dependencies - headless compatible
 */

import type { PigmentVec3 } from './types.js';

// ==========================================
// COLOR MATH: OkLCH (Perceptually Uniform)
// ==========================================

export const getColorHint = (current: PigmentVec3, target: PigmentVec3): string => {
    const dist = getDeltaE(current, target);

    if (dist < 0.05) return 'Perfect!';

    // Analyze specific differences in OkLCH
    const cLCH = sRGB_to_OkLCH(current);
    const tLCH = sRGB_to_OkLCH(target);

    const dL = tLCH.l - cLCH.l;
    const dC = tLCH.c - cLCH.c;
    // Hue diff is tricky due to wrapping, but fast heuristic:
    let dH = tLCH.h - cLCH.h;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;

    if (Math.abs(dL) > 0.15) return dL > 0 ? 'Need Lighter' : 'Need Darker';
    if (Math.abs(dC) > 0.1) return dC > 0 ? 'Need More Color' : 'Too Vibrant';

    // Fallback to primary channel hints if hue is off (easier for players to understand)
    // Diff in RGB
    const rDiff = target.r - current.r;
    const gDiff = target.g - current.g;
    const bDiff = target.b - current.b;

    if (Math.abs(rDiff) > Math.abs(gDiff) && Math.abs(rDiff) > Math.abs(bDiff)) {
        return rDiff > 0 ? 'Need RED' : 'Less RED';
    }
    if (Math.abs(gDiff) > Math.abs(bDiff)) {
        return gDiff > 0 ? 'Need GREEN' : 'Less GREEN';
    }
    return bDiff > 0 ? 'Need BLUE' : 'Less BLUE';
};

export const calcMatchPercent = (p1: PigmentVec3, p2: PigmentVec3): number => {
    // DeltaE 0..1 range roughly
    // 0 = Identity
    // 0.2 = Clearly different
    // 0.4+ = Very different

    const dE = getDeltaE(p1, p2);
    // Score: 1.0 at 0 distance. 0.0 at >0.3 distance.
    const score = 1.0 - dE / 0.3;
    return Math.max(0, Math.min(1, score));
};

export const mixPigment = (
    current: PigmentVec3,
    added: PigmentVec3,
    ratio: number
): PigmentVec3 => {
    // 1. Convert to OkLCH
    const cLCH = sRGB_to_OkLCH(current);
    const aLCH = sRGB_to_OkLCH(added);

    // 2. Interpolate
    // Hue requires shortest path
    const h1 = cLCH.h;
    let h2 = aLCH.h;
    const dH = h2 - h1;

    if (dH > 180) h2 -= 360;
    else if (dH < -180) h2 += 360;

    const resLCH = {
        l: cLCH.l + (aLCH.l - cLCH.l) * ratio,
        c: cLCH.c + (aLCH.c - cLCH.c) * ratio,
        h: h1 + (h2 - h1) * ratio,
    };

    // Wrap Hue
    resLCH.h = resLCH.h % 360;
    if (resLCH.h < 0) resLCH.h += 360;

    // 3. Convert back to sRGB
    return OkLCH_to_sRGB(resLCH);
};

// ==========================================
// UTILS: Integer Color Math (EIDOLON-V Optimized)
// ==========================================

export const pigmentToInt = (p: PigmentVec3): number => {
    const r = Math.max(0, Math.min(255, Math.floor(p.r * 255)));
    const g = Math.max(0, Math.min(255, Math.floor(p.g * 255)));
    const b = Math.max(0, Math.min(255, Math.floor(p.b * 255)));
    return (r << 16) | (g << 8) | b;
};

export const hexToInt = (hex: string): number => {
    if (hex.startsWith('#')) hex = hex.slice(1);
    return parseInt(hex, 16);
};

export const intToHex = (color: number): string => {
    const hex = color.toString(16);
    return '#' + '0'.repeat(6 - hex.length) + hex;
};

export const intToRgbString = (color: number): string => {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgb(${r},${g},${b})`;
};

export const pigmentToHex = (p: PigmentVec3): string => {
    return intToHex(pigmentToInt(p));
};

// Snap to closest 10% if close
export const getSnapAlpha = (currentMatch: number, baseRatio: number): number => {
    // Bonus for high match players?
    return baseRatio * 1.2;
};

// ==========================================
// UTILS: DeltaE (Perceptual Distance)
// ==========================================
// Simple Euclidean in OkLab
function getDeltaE(c1: PigmentVec3, c2: PigmentVec3): number {
    const lab1 = sRGB_to_OkLab(c1);
    const lab2 = sRGB_to_OkLab(c2);

    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dL * dL + da * da + db * db);
}

// ==========================================
// UTILS: Conversions
// ==========================================

// EIDOLON-V OPTIMIZATION: Pre-computed cbrt lookup table
// Math.cbrt is expensive; use lookup for common values
const CBRT_TABLE_SIZE = 1024;
const CBRT_TABLE_MAX = 1.0;
const cbrtTable = new Float32Array(CBRT_TABLE_SIZE);

// Initialize cbrt lookup table
(function initCbrtTable() {
    for (let i = 0; i < CBRT_TABLE_SIZE; i++) {
        const x = (i / (CBRT_TABLE_SIZE - 1)) * CBRT_TABLE_MAX;
        cbrtTable[i] = Math.cbrt(x);
    }
})();

/**
 * Fast cube root using lookup table + linear interpolation
 * ~3x faster than Math.cbrt for values in [0, 1]
 */
function fastCbrt(x: number): number {
    if (x <= 0) return 0;
    if (x >= CBRT_TABLE_MAX) return 1;

    const idx = x * (CBRT_TABLE_SIZE - 1);
    const idxFloor = Math.floor(idx);
    const idxCeil = Math.min(idxFloor + 1, CBRT_TABLE_SIZE - 1);
    const t = idx - idxFloor;

    return cbrtTable[idxFloor] * (1 - t) + cbrtTable[idxCeil] * t;
}

// sRGB [0..1] -> Linear sRGB [0..1]
function sRGB_to_Linear(c: number): number {
    return c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

// Linear sRGB [0..1] -> sRGB [0..1]
function Linear_to_sRGB(c: number): number {
    return c >= 0.0031308 ? 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055 : 12.92 * c;
}

// sRGB -> OkLab
function sRGB_to_OkLab(rgb: PigmentVec3): { L: number; a: number; b: number } {
    const r = sRGB_to_Linear(rgb.r);
    const g = sRGB_to_Linear(rgb.g);
    const b_ = sRGB_to_Linear(rgb.b);

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b_;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b_;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b_;

    // EIDOLON-V OPTIMIZED: Use fastCbrt instead of Math.cbrt
    const l_ = fastCbrt(l);
    const m_ = fastCbrt(m);
    const s_ = fastCbrt(s);

    return {
        L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    };
}

// OkLab -> sRGB
// EIDOLON-V P2 FIX: Clamp output to [0, 1] to prevent out-of-gamut colors
function OkLab_to_sRGB(lab: { L: number; a: number; b: number }): PigmentVec3 {
    const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    // EIDOLON-V P2 FIX: Clamp RGB to [0, 1] to prevent canvas/shader issues
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    return {
        r: clamp01(Linear_to_sRGB(4.0766 * l - 3.307711 * m + 0.230969 * s)),
        g: clamp01(Linear_to_sRGB(-1.268438 * l + 2.609757 * m - 0.341319 * s)),
        b: clamp01(Linear_to_sRGB(-0.004196 * l - 0.703418 * m + 1.707614 * s)),
    };
}

// sRGB -> OkLCH
function sRGB_to_OkLCH(rgb: PigmentVec3): { l: number; c: number; h: number } {
    const lab = sRGB_to_OkLab(rgb);
    const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
    if (h < 0) h += 360;
    return { l: lab.L, c, h };
}

// OkLCH -> sRGB
function OkLCH_to_sRGB(lch: { l: number; c: number; h: number }): PigmentVec3 {
    const hRad = lch.h * (Math.PI / 180);
    const a = lch.c * Math.cos(hRad);
    const b = lch.c * Math.sin(hRad);
    return OkLab_to_sRGB({ L: lch.l, a, b });
}

// ==========================================
// [EIDOLON-V OPTIMIZATION] Fast Color Match
// ==========================================
/**
 * Fast color match using squared Euclidean distance in RGB space.
 * Eliminates Math.cbrt and OkLCH conversion overhead.
 * Use for high-frequency physics/combat loops (60Hz).
 */
export const calcMatchPercentFast = (p1: PigmentVec3, p2: PigmentVec3): number => {
    // 1. Calculate delta RGB (no conversion needed)
    const dr = p1.r - p2.r;
    const dg = p1.g - p2.g;
    const db = p1.b - p2.b;

    // 2. Squared distance
    const distSq = dr * dr + dg * dg + db * db;

    // 3. Threshold (0.3^2 = 0.09)
    const thresholdSq = 0.09;

    // 4. Early exit (CPU branch optimization)
    if (distSq >= thresholdSq) return 0;

    // 5. Linear falloff score (no Math.sqrt)
    return 1.0 - distSq / thresholdSq;
};
