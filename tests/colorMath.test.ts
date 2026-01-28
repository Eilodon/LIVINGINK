import { describe, it, expect } from 'vitest';
import { calcMatchPercent, mixPigment, getColorHint, pigmentToHex } from '../services/cjr/colorMath';

describe('CJR Color Math (OkLCH)', () => {
    it('should calculate 100% match for identical pigments', () => {
        const p1 = { r: 1, g: 0, b: 0 };
        const p2 = { r: 1, g: 0, b: 0 };
        expect(calcMatchPercent(p1, p2)).toBeCloseTo(1.0);
    });

    it('should calculate ~0% match for opposite pigments', () => {
        const p1 = { r: 0, g: 0, b: 0 }; // Black
        const p2 = { r: 1, g: 1, b: 1 }; // White
        // In Perceptual space, Black vs White is max distance
        const score = calcMatchPercent(p1, p2);
        expect(score).toBeLessThan(0.1);
    });

    it('should mix pigments (Perceptual)', () => {
        const p1 = { r: 1, g: 0, b: 0 }; // Red
        const p2 = { r: 0, g: 0, b: 1 }; // Blue
        const mixed = mixPigment(p1, p2, 0.5);

        // In Linear RGB, this would be 0.5, 0, 0.5 (Dark Magenta)
        // In OkLCH, it preserves lightness/chroma better, so it might be brighter/different.
        // We just check it's not pure red or pure blue.
        expect(mixed.r).toBeGreaterThan(0.2);
        expect(mixed.b).toBeGreaterThan(0.2);

        // It should NOT be exactly 0.5 (Non-linear)
        // verify it's valid color
        expect(mixed.r).toBeGreaterThanOrEqual(0);
        expect(mixed.r).toBeLessThanOrEqual(1);
    });

    it('should bias mix towards ratio', () => {
        const p1 = { r: 1, g: 0, b: 0 };
        const p2 = { r: 0, g: 1, b: 0 };
        const mixed = mixPigment(p1, p2, 0.1); // 10% Green

        // Should be mostly Red
        expect(mixed.r).toBeGreaterThan(0.5);
        expect(mixed.g).toBeGreaterThan(0);
        expect(mixed.g).toBeLessThan(mixed.r);
    });

    it('should provide hints', () => {
        const current = { r: 0.5, g: 0.5, b: 0.5 };
        const target = { r: 0.6, g: 0.5, b: 0.5 }; // Need Red (or Lighter/Color)
        const hint = getColorHint(current, target);
        expect(hint).toBeTruthy();
        expect(typeof hint).toBe('string');
    });

    it('should generate valid hex', () => {
        const hex = pigmentToHex({ r: 0.5, g: 1.0, b: 0 });
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    });
});
