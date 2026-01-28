import { MAX_ENTITIES, EntityFlags } from './EntityFlags';

export class TransformStore {
    // [x, y, rotation, scale, prevX, prevY, prevRotation, _pad]
    // Stride = 8
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * TransformStore.STRIDE);

    // Helper accessors

    static set(id: number, x: number, y: number, rotation: number, scale: number = 1.0) {
        const idx = id * 8;
        this.data[idx] = x;
        this.data[idx + 1] = y;
        this.data[idx + 2] = rotation;
        this.data[idx + 3] = scale;
        // Initialize prev
        this.data[idx + 4] = x;
        this.data[idx + 5] = y;
        this.data[idx + 6] = rotation;
    }
}

export class PhysicsStore {
    // [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
    // Stride = 8
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * PhysicsStore.STRIDE);

    static set(id: number, vx: number, vy: number, mass: number, radius: number) {
        const idx = id * 8;
        this.data[idx] = vx;
        this.data[idx + 1] = vy;
        this.data[idx + 2] = 0; // vRotation
        this.data[idx + 3] = mass;
        this.data[idx + 4] = radius;
    }
}

export class StateStore {
    // Flags for type and status
    public static readonly flags = new Uint8Array(MAX_ENTITIES);

    static setFlag(id: number, flag: EntityFlags) {
        this.flags[id] |= flag;
    }

    static clearFlag(id: number, flag: EntityFlags) {
        this.flags[id] &= ~flag;
    }

    static hasFlag(id: number, flag: EntityFlags): boolean {
        return (this.flags[id] & flag) === flag;
    }
}

export class StatsStore {
    // [currentHealth, maxHealth, score, matchPercent, _pad, _pad, _pad, _pad]
    // Stride = 8 (Aligned for future expansion/SIMD thoughts, though 4 is tight)
    // Let's use 8 to be safe or 4? 4 is fine.
    // [currentHealth, maxHealth, score, matchPercent]
    public static readonly STRIDE = 4;
    public static readonly data = new Float32Array(MAX_ENTITIES * StatsStore.STRIDE);

    static set(id: number, currentHealth: number, maxHealth: number, score: number, matchPercent: number) {
        const idx = id * StatsStore.STRIDE;
        this.data[idx] = currentHealth;
        this.data[idx + 1] = maxHealth;
        this.data[idx + 2] = score;
        this.data[idx + 3] = matchPercent;
    }
}

export function resetAllStores() {
    TransformStore.data.fill(0);
    PhysicsStore.data.fill(0);
    StatsStore.data.fill(0);
    StateStore.flags.fill(0);
    EntityLookup.fill(null);
}

import { Entity } from '../../../types';

// Global Lookup for Reverse Mapping (DOD Index -> Logic Object)
// This bridges the gap for Systems that need to access the full JS Object (Rendering, Combat Logic)
export const EntityLookup: (Entity | null)[] = new Array(MAX_ENTITIES).fill(null);
