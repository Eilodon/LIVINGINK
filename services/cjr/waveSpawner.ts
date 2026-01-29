
import { GameState, Food, PickupKind, PigmentVec3 } from '../../types';
import { WAVE_CONFIG, RING_RADII } from '../../constants';
import { randomRange } from '../math/FastMath';

export const updateWaveSpawner = (state: GameState, dt: number) => {
    // Check Wave Timers (assuming state.runtime.wave exists, defined in GameState)
    // Ensure state.runtime structure is initialized in factory

    // Ring 1 Wave
    state.runtime.wave.ring1 -= dt * 1000;
    if (state.runtime.wave.ring1 <= 0) {
        spawnWave(state, 1);
        state.runtime.wave.ring1 = WAVE_CONFIG.INTERVAL[1];
    }

    // Ring 2 Wave
    state.runtime.wave.ring2 -= dt * 1000;
    if (state.runtime.wave.ring2 <= 0) {
        spawnWave(state, 2);
        state.runtime.wave.ring2 = WAVE_CONFIG.INTERVAL[2];
    }

    // Ring 3 Wave
    state.runtime.wave.ring3 -= dt * 1000;
    if (state.runtime.wave.ring3 <= 0) {
        spawnWave(state, 3);
        state.runtime.wave.ring3 = WAVE_CONFIG.INTERVAL[3];
    }
};

export const resetWaveTimers = (runtime: any, levelConfig: any) => {
    runtime.wave.ring1 = levelConfig.waveIntervals?.ring1 || WAVE_CONFIG.INTERVAL_R1;
    runtime.wave.ring2 = levelConfig.waveIntervals?.ring2 || WAVE_CONFIG.INTERVAL_R2;
    runtime.wave.ring3 = levelConfig.waveIntervals?.ring3 || WAVE_CONFIG.INTERVAL_R3;
};

const spawnWave = (state: GameState, ring: 1 | 2 | 3) => {
    const count = WAVE_CONFIG.SPAWN_COUNTS[`R${ring}` as keyof typeof WAVE_CONFIG.SPAWN_COUNTS];

    // Radii
    const minR = ring === 3 ? 0 : (ring === 2 ? RING_RADII.R3 : RING_RADII.R2);
    const maxR = ring === 3 ? RING_RADII.R3 : (ring === 2 ? RING_RADII.R2 : RING_RADII.R1);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = randomRange(minR + 50, maxR - 50);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        // Choose Type
        const roll = Math.random();
        let kind: PickupKind = 'pigment';
        let pigment: PigmentVec3 | undefined = undefined;

        if (roll < 0.60) {
            kind = 'pigment';
            const cRoll = Math.random();
            if (cRoll < 0.33) pigment = { r: 1, g: 0, b: 0 };
            else if (cRoll < 0.66) pigment = { r: 0, g: 1, b: 0 };
            else pigment = { r: 0, g: 0, b: 1 };

        } else if (roll < 0.85) {
            kind = 'neutral';
        } else {
            kind = Math.random() < 0.5 ? 'solvent' : 'shield'; // using shield pickup as example
        }

        spawnFood(state, x, y, kind, pigment);
    }
};

const spawnFood = (state: GameState, x: number, y: number, kind: PickupKind, pigment?: PigmentVec3) => {
    const food: Food = {
        id: `food_${Date.now()}_${Math.random()}`,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        radius: kind === 'pigment' ? 12 : (kind === 'neutral' ? 8 : 10),
        color: 0xFFFFFF,
        value: kind === 'neutral' ? 5 : 2,
        isDead: false,
        kind,
        pigment
    };

    state.food.push(food);
    state.engine.spatialGrid.insert(food);
};
