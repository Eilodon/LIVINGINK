
import { describe, it, expect } from 'vitest';
import { calcMatchPercent, mixPigment } from '../services/cjr/colorMath';

describe('CJR Color Math', () => {
    it('should calculate 100% match for identical pigments', () => {
        const p1 = { r: 1, g: 0, b: 0 };
        const p2 = { r: 1, g: 0, b: 0 };
        expect(calcMatchPercent(p1, p2)).toBeCloseTo(1.0);
    });

    it('should calculate 0% match for opposite pigments', () => {
        const p1 = { r: 0, g: 0, b: 0 };
        const p2 = { r: 1, g: 1, b: 1 };
        // Max distance is sqrt(3) ~ 1.732
        // Formula: 1 - dist / 1.732.
        // So 0,0,0 vs 1,1,1 is dist 1.732 -> 0%
        expect(calcMatchPercent(p1, p2)).toBeCloseTo(0.0);
    });

    it('should mix pigments linearly', () => {
        const p1 = { r: 1, g: 0, b: 0 };
        const p2 = { r: 0, g: 0, b: 1 };
        const mixed = mixPigment(p1, p2, 0.5);

        expect(mixed.r).toBeCloseTo(0.5);
        expect(mixed.g).toBeCloseTo(0.0);
        expect(mixed.b).toBeCloseTo(0.5);
    });

    it('should bias mix towards ratio', () => {
        const p1 = { r: 1, g: 0, b: 0 }; // Base
        const p2 = { r: 0, g: 1, b: 0 }; // Added
        const mixed = mixPigment(p1, p2, 0.1); // 10% new color

        expect(mixed.r).toBeCloseTo(0.9);
        expect(mixed.g).toBeCloseTo(0.1);
    });
});
