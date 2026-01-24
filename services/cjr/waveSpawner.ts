
import {
    RING_RADII
} from './cjrConstants';
import { GameState, Food, PickupKind } from '../../types';
import { createFood } from '../engine/factories';
import { randomRange } from '../engine/math';
import { getRushWindowInfo } from './bossCjr';
import { LevelConfig } from './levels';

// Wave timers per ring
let waveTimers = {
    ring1: 8,
    ring2: 10,
    ring3: 13
};

export const updateWaveSpawner = (state: GameState, dt: number) => {
    if (!state.engine) return;

    const config = state.levelConfig;

    const aliveCount = [
        state.player,
        ...state.bots.filter(b => !b.isDead)
    ].filter(Boolean).length || 1;
    const scale = Math.max(1, Math.round(aliveCount / 6));

    const rush = getRushWindowInfo();

    // Timer-based burst waves (Vision Doc PR5)
    waveTimers.ring1 -= dt;
    if (waveTimers.ring1 <= 0) {
        spawnWaveBurst(state, 1, config.burstSizes.ring1 * scale, false, config);
        waveTimers.ring1 = config.waveIntervals.ring1;
    }

    waveTimers.ring2 -= dt;
    if (waveTimers.ring2 <= 0) {
        const rushSpecial = rush.ring === 2 && rush.timer > 0;
        spawnWaveBurst(state, 2, config.burstSizes.ring2 * scale, rushSpecial, config);
        waveTimers.ring2 = config.waveIntervals.ring2;
    }

    waveTimers.ring3 -= dt;
    if (waveTimers.ring3 <= 0) {
        const rushSpecial = rush.ring === 3 && rush.timer > 0;
        spawnWaveBurst(state, 3, config.burstSizes.ring3 * scale, rushSpecial, config);
        waveTimers.ring3 = config.waveIntervals.ring3;
    }
};

const spawnWaveBurst = (state: GameState, ring: 1 | 2 | 3, count: number, rushSpecial: boolean, config: LevelConfig) => {
    const leader = getLeader(state);
    const leaderAngle = leader ? Math.atan2(leader.position.y, leader.position.x) : null;

    for (let i = 0; i < count; i++) {
        const baseAngle = (i / count) * Math.PI * 2;
        const angle = pickAngleAwayFromLeader(baseAngle, leaderAngle, ring);
        spawnInRing(state, ring, angle, rushSpecial, config);
    }
};

const spawnInRing = (state: GameState, ring: 1 | 2 | 3, angle: number, rushSpecial: boolean, config: LevelConfig) => {
    const w = config.spawnWeights;
    const rand = Math.random();

    let kind: PickupKind = 'pigment';
    if (rand > w.pigment + w.neutral) {
        kind = pickSpecialKind(rushSpecial);
    }
    else if (rand > w.pigment) kind = 'neutral';

    const minR = (ring === 3) ? RING_RADII.CENTER : (ring === 2) ? RING_RADII.R3_BOUNDARY : RING_RADII.R2_BOUNDARY;
    const maxR = (ring === 3) ? RING_RADII.R3_BOUNDARY : (ring === 2) ? RING_RADII.R2_BOUNDARY : RING_RADII.R1_OUTER;

    const r = Math.sqrt(randomRange(minR * minR, maxR * maxR));

    const f = createFood();
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    f.position.x = x;
    f.position.y = y;
    f.kind = kind;
    if (kind === 'pigment') {
        f.color = f.pigment ? `rgb(${f.pigment.r * 255},${f.pigment.g * 255},${f.pigment.b * 255})` : '#ffffff';
    } else if (kind === 'neutral') {
        f.color = '#9ca3af';
        f.pigment = { r: 0.5, g: 0.5, b: 0.5 };
    } else if (kind === 'solvent') {
        f.color = '#a5b4fc';
        f.pigment = undefined;
    } else if (kind === 'catalyst') {
        f.color = '#d946ef';
        f.pigment = undefined;
    } else if (kind === 'shield') {
        f.color = '#22d3ee';
        f.pigment = undefined;
    }

    state.food.push(f);
};

const pickSpecialKind = (rushSpecial: boolean): PickupKind => {
    const roll = Math.random();
    if (rushSpecial && roll > 0.6) return 'catalyst';
    if (roll < 0.4) return 'solvent';
    if (roll < 0.75) return 'catalyst';
    return 'shield';
};

const getLeader = (state: GameState) => {
    const all = [state.player, ...state.bots.filter(b => !b.isDead)].filter(Boolean) as any[];
    return all.sort((a, b) => b.score - a.score)[0];
};

const pickAngleAwayFromLeader = (baseAngle: number, leaderAngle: number | null, ring: 1 | 2 | 3) => {
    if (leaderAngle === null) return baseAngle + (Math.random() - 0.5) * 0.4;
    const minGap = ring === 1 ? 0.8 : ring === 2 ? 0.6 : 0.4;
    let angle = baseAngle + (Math.random() - 0.5) * 0.4;
    let attempts = 0;
    while (attempts < 5) {
        const diff = Math.abs(Math.atan2(Math.sin(angle - leaderAngle), Math.cos(angle - leaderAngle)));
        if (diff >= minGap) break;
        angle = Math.random() * Math.PI * 2;
        attempts++;
    }
    return angle;
};

export const resetWaveTimers = (config?: LevelConfig) => {
    waveTimers = {
        ring1: config?.waveIntervals.ring1 ?? 8,
        ring2: config?.waveIntervals.ring2 ?? 10,
        ring3: config?.waveIntervals.ring3 ?? 13
    };
};
