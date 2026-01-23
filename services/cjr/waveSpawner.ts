
import {
    WAVE_INTERVALS,
    SPAWN_WEIGHTS,
    RING_RADII
} from './cjrConstants';
import { GameState, Food, PickupKind } from '../../types';
import { createFood } from '../engine/factories';
import { randomRange } from '../engine/math';

export const updateWaveSpawner = (state: GameState, dt: number) => {
    if (!state.engine) return;

    // Burst Waves Logic (Placeholder for population cap)
    maintainPopulation(state, 1, 30); // Ring 1
    maintainPopulation(state, 2, 20); // Ring 2
    maintainPopulation(state, 3, 10); // Ring 3
};

const maintainPopulation = (state: GameState, ring: 1 | 2 | 3, targetCount: number) => {
    let count = 0;
    state.food.forEach(f => {
        const r = getRingFromPos(f.position.x, f.position.y);
        if (r === ring) count++;
    });

    if (count < targetCount) {
        spawnInRing(state, ring);
    }
};

const getRingFromPos = (x: number, y: number) => {
    const d = Math.hypot(x, y);
    if (d < RING_RADII.R3_BOUNDARY) return 3;
    if (d < RING_RADII.R2_BOUNDARY) return 2;
    return 1;
};

const spawnInRing = (state: GameState, ring: 1 | 2 | 3) => {
    const w = (ring === 1) ? SPAWN_WEIGHTS.RING1 : (ring === 2) ? SPAWN_WEIGHTS.RING2 : SPAWN_WEIGHTS.RING3;
    const rand = Math.random();

    let kind: PickupKind = 'pigment';
    if (rand > w.pigment + w.neutral) kind = 'shield';
    else if (rand > w.pigment) kind = 'neutral';

    const minR = (ring === 3) ? RING_RADII.CENTER : (ring === 2) ? RING_RADII.R3_BOUNDARY : RING_RADII.R2_BOUNDARY;
    const maxR = (ring === 3) ? RING_RADII.R3_BOUNDARY : (ring === 2) ? RING_RADII.R2_BOUNDARY : RING_RADII.R1_OUTER;

    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(randomRange(minR * minR, maxR * maxR));

    const f = createFood();
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    f.position.x = x;
    f.position.y = y;
    f.kind = kind;

    state.food.push(f);
};
