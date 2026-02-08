/**
 * @cjr/engine - Pigment Utilities
 * 
 * Business logic utility functions for pigment color manipulation.
 * Separated from generated PigmentAccess to keep generator simple.
 * 
 * @example
 * import { PigmentUtils } from '@cjr/engine';
 * const colorInt = PigmentUtils.getColorInt(world, entityId);
 * PigmentUtils.mix(world, entityId, 0.5, 0.2, 0.8, 0.3);
 */

import { PigmentAccess } from '../generated/ComponentAccessors';
import type { WorldState } from '../generated/WorldState';

export class PigmentUtils {
    /**
     * Convert RGB floats (0-1) to packed integer (0xRRGGBB)
     */
    static getColorInt(world: WorldState, id: number): number {
        const r = Math.floor(PigmentAccess.getR(world, id) * 255);
        const g = Math.floor(PigmentAccess.getG(world, id) * 255);
        const b = Math.floor(PigmentAccess.getB(world, id) * 255);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Get match percent (shorthand for PigmentAccess.getMatchPercent)
     */
    static getMatch(world: WorldState, id: number): number {
        return PigmentAccess.getMatchPercent(world, id);
    }

    /**
     * Blend current pigment with new color using linear interpolation
     * @param ratio - Blend ratio (0 = keep current, 1 = replace with new)
     */
    static mix(world: WorldState, id: number, r: number, g: number, b: number, ratio: number): void {
        const cR = PigmentAccess.getR(world, id);
        const cG = PigmentAccess.getG(world, id);
        const cB = PigmentAccess.getB(world, id);

        PigmentAccess.setR(world, id, cR + (r - cR) * ratio);
        PigmentAccess.setG(world, id, cG + (g - cG) * ratio);
        PigmentAccess.setB(world, id, cB + (b - cB) * ratio);
    }

    /**
     * Set RGB values directly (shorthand for individual setters)
     */
    static set(world: WorldState, id: number, r: number, g: number, b: number): void {
        PigmentAccess.setR(world, id, r);
        PigmentAccess.setG(world, id, g);
        PigmentAccess.setB(world, id, b);
    }

    /**
     * Calculate match percent between current pigment and target pigment
     * Uses fast distance formula (no sqrt for comparison)
     */
    static calculateMatch(world: WorldState, id: number): number {
        const r = PigmentAccess.getR(world, id);
        const g = PigmentAccess.getG(world, id);
        const b = PigmentAccess.getB(world, id);
        const tR = PigmentAccess.getTargetR(world, id);
        const tG = PigmentAccess.getTargetG(world, id);
        const tB = PigmentAccess.getTargetB(world, id);

        // Euclidean distance squared (max = 3 for RGB normalized)
        const distSq = (r - tR) ** 2 + (g - tG) ** 2 + (b - tB) ** 2;
        const maxDistSq = 3; // sqrt(1^2 + 1^2 + 1^2)^2

        return Math.max(0, 1 - Math.sqrt(distSq / maxDistSq));
    }
}
