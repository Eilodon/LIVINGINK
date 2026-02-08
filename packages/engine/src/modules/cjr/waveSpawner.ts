/**
 * @cjr/engine - Wave Spawner
 * Pure spawning logic - no state.engine dependency
 */

import { WAVE_CONFIG, RING_RADII } from './constants';
import { randomRange, PRNG } from '../../math/FastMath';
import type { PigmentVec3, PickupKind } from './types';

export interface IFood {
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;
    color: number;
    value: number;
    isDead: boolean;
    kind: PickupKind;
    pigment?: PigmentVec3;
}

export interface IWaveState {
    runtime: {
        wave: {
            ring1: number;
            ring2: number;
            ring3: number;
        };
    };
}

export interface ISpawnResult {
    foods: IFood[];
}

/**
 * EIDOLON-V P3 FIX: DOD-friendly spawn descriptor
 * Use this instead of IFood[] to avoid object allocation.
 * Caller populates WorldState directly using these raw values.
 */
export interface SpawnDescriptor {
    x: number;
    y: number;
    kind: PickupKind;
    pigmentR: number;
    pigmentG: number;
    pigmentB: number;
    radius: number;
    value: number;
}

export interface ISpawnResultDOD {
    descriptors: SpawnDescriptor[];
}

/**
 * Callback for spawning food directly to state/store
 * Eliminates GC pressure from creating intermediate objects
 */
export type SpawnCallback = (
    x: number,
    y: number,
    kind: PickupKind,
    pigment?: PigmentVec3
) => void;

/**
 * Update wave spawner logic
 * Invokes onSpawn callback for new items instead of allocating arrays
 */
export const updateWaveSpawner = (
    waveState: IWaveState['runtime']['wave'],
    dt: number,
    onSpawn: SpawnCallback
): void => {
    // Ring 1 Wave
    waveState.ring1 -= dt * 1000;
    if (waveState.ring1 <= 0) {
        spawnWave(1, onSpawn);
        waveState.ring1 = WAVE_CONFIG.INTERVAL[1];
    }

    // Ring 2 Wave
    waveState.ring2 -= dt * 1000;
    if (waveState.ring2 <= 0) {
        spawnWave(2, onSpawn);
        waveState.ring2 = WAVE_CONFIG.INTERVAL[2];
    }

    // Ring 3 Wave
    waveState.ring3 -= dt * 1000;
    if (waveState.ring3 <= 0) {
        spawnWave(3, onSpawn);
        waveState.ring3 = WAVE_CONFIG.INTERVAL[3];
    }
};

export const resetWaveTimers = (
    waveState: IWaveState['runtime']['wave'],
    levelConfig: { waveIntervals?: { ring1?: number; ring2?: number; ring3?: number } }
): void => {
    waveState.ring1 = levelConfig.waveIntervals?.ring1 || WAVE_CONFIG.INTERVAL_R1;
    waveState.ring2 = levelConfig.waveIntervals?.ring2 || WAVE_CONFIG.INTERVAL_R2;
    waveState.ring3 = levelConfig.waveIntervals?.ring3 || WAVE_CONFIG.INTERVAL_R3;
};

/**
 * Spawn a wave of food items for a specific ring
 * Directly invokes callback to avoid allocation
 */
const spawnWave = (ring: 1 | 2 | 3, onSpawn: SpawnCallback): void => {
    const count = WAVE_CONFIG.SPAWN_COUNTS[`R${ring}` as keyof typeof WAVE_CONFIG.SPAWN_COUNTS];

    // Radii
    const minR = ring === 3 ? 0 : ring === 2 ? RING_RADII.R3 : RING_RADII.R2;
    const maxR = ring === 3 ? RING_RADII.R3 : ring === 2 ? RING_RADII.R2 : RING_RADII.R1;

    for (let i = 0; i < count; i++) {
        const angle = PRNG.next() * Math.PI * 2;
        const r = randomRange(minR + 50, maxR - 50);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        // Choose Type (EIDOLON-V: Use seeded PRNG for determinism)
        const roll = PRNG.next();
        let kind: PickupKind = 'pigment';
        let pigment: PigmentVec3 | undefined = undefined;

        if (roll < 0.6) {
            kind = 'pigment';
            const cRoll = PRNG.next();
            if (cRoll < 0.33) pigment = { r: 1, g: 0, b: 0 };
            else if (cRoll < 0.66) pigment = { r: 0, g: 1, b: 0 };
            else pigment = { r: 0, g: 0, b: 1 };
        } else if (roll < 0.85) {
            kind = 'neutral';
        } else {
            kind = PRNG.next() < 0.5 ? 'solvent' : 'shield';
        }

        onSpawn(x, y, kind, pigment);
    }
};

/**
 * Create a food entity (pure - no spatial grid insertion)
 */
const createFood = (
    x: number,
    y: number,
    kind: PickupKind,
    pigment?: PigmentVec3
): IFood => {
    return {
        id: `food_${Date.now()}_${PRNG.next()}`,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        radius: kind === 'pigment' ? 12 : kind === 'neutral' ? 8 : 10,
        color: 0xffffff,
        value: kind === 'neutral' ? 5 : 2,
        isDead: false,
        kind,
        pigment,
    };
};

/**
 * Spawn a single food at specific location
 */
export const spawnFoodAt = (
    x: number,
    y: number,
    kind: PickupKind,
    pigment?: PigmentVec3
): IFood => {
    return createFood(x, y, kind, pigment);
};

// ============================================================================
// LEGACY-COMPATIBLE WRAPPERS (for client migration)
// These provide the same API as the old client versions while using pure logic
// ============================================================================

/**
 * Legacy-compatible updateWaveSpawner
 * Matches client signature: (state: GameState, dt: number) => void
 */
export const updateWaveSpawnerLegacy = (state: {
    runtime: { wave: { ring1: number; ring2: number; ring3: number } };
    food: IFood[];
    engine?: { spatialGrid?: { insert: (food: IFood) => void } };
}, dt: number): void => {
    updateWaveSpawner(state.runtime.wave, dt, (x, y, kind, pigment) => {
        const food = createFood(x, y, kind, pigment);
        state.food.push(food);
        // Insert into spatial grid if available
        if (state.engine?.spatialGrid) {
            state.engine.spatialGrid.insert(food);
        }
    });
};

/**
 * Legacy-compatible resetWaveTimers
 * Matches client signature: (runtime: any, levelConfig: any) => void
 */
export const resetWaveTimersLegacy = (
    runtime: { wave: { ring1: number; ring2: number; ring3: number } },
    levelConfig: { waveIntervals?: { ring1?: number; ring2?: number; ring3?: number } }
): void => {
    resetWaveTimers(runtime.wave, levelConfig);
};
