/**
 * @cjr/engine - Logic Factories
 * 
 * Pure entity data creation - no visual dependencies.
 * Client wraps these with visual creation (container setup, etc.)
 */

import { PLAYER_START_RADIUS, FOOD_RADIUS } from '../config/constants';
import type { PigmentVec3, ShapeId, PickupKind } from '../modules/cjr/types';

/**
 * Random pigment generator
 */
export const randomPigment = (): PigmentVec3 => ({
    r: Math.random(),
    g: Math.random(),
    b: Math.random(),
});

/**
 * Random position in ring
 */
export const randomPosInRing = (ring: 1 | 2 | 3): { x: number; y: number } => {
    const angle = Math.random() * Math.PI * 2;

    let minR: number, maxR: number;
    if (ring === 1) {
        minR = 1000;
        maxR = 1500;
    } else if (ring === 2) {
        minR = 400;
        maxR = 900;
    } else {
        minR = 50;
        maxR = 350;
    }

    const r = minR + Math.random() * (maxR - minR);
    return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
    };
};

/**
 * Player data structure (pure data, no DOD stores)
 */
export interface IPlayerData {
    name: string;
    shape: ShapeId;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;
    pigment: PigmentVec3;
    targetPigment: PigmentVec3;
    ring: 1 | 2 | 3;
    maxHealth: number;
    currentHealth: number;
    score: number;
    matchPercent: number;
    spawnTime: number;
}

/**
 * Create player data (pure logic - no DOD registration)
 */
export const createPlayerData = (
    name: string,
    shape: ShapeId = 'circle',
    spawnTime: number = 0
): IPlayerData => {
    const position = randomPosInRing(1);
    const pigment = randomPigment();

    return {
        name,
        shape,
        position,
        velocity: { x: 0, y: 0 },
        radius: PLAYER_START_RADIUS,
        pigment,
        targetPigment: randomPigment(),
        ring: 1,
        maxHealth: 100,
        currentHealth: 100,
        score: 0,
        matchPercent: 0,
        spawnTime,
    };
};

/**
 * Bot data structure
 */
export interface IBotData extends IPlayerData {
    aiState: 'wander' | 'hunt' | 'flee' | 'feed';
    personality: 'bully' | 'farmer' | 'killer' | 'balanced';
}

/**
 * Create bot data (pure logic)
 */
export const createBotData = (
    name: string,
    spawnTime: number = 0
): IBotData => {
    const playerData = createPlayerData(name, 'circle', spawnTime);

    return {
        ...playerData,
        aiState: 'wander',
        personality: 'farmer',
    };
};

/**
 * Food data structure
 */
export interface IFoodData {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;
    kind: PickupKind;
    pigment?: PigmentVec3;
    value: number;
}

/**
 * Create food data (pure logic)
 */
export const createFoodData = (
    position?: { x: number; y: number },
    kind: PickupKind = 'pigment'
): IFoodData => {
    const pos = position || randomPosInRing(1);
    const pigment = kind === 'pigment' ? randomPigment() : undefined;

    return {
        position: pos,
        velocity: { x: 0, y: 0 },
        radius: kind === 'pigment' ? 12 : kind === 'neutral' ? 8 : 10,
        kind,
        pigment,
        value: kind === 'neutral' ? 5 : 2,
    };
};

/**
 * Boss data structure
 */
export interface IBossData extends IBotData {
    isBoss: true;
}

/**
 * Create boss data (pure logic)
 */
export const createBossData = (spawnTime: number = 0): IBossData => {
    const botData = createBotData('Ring Guardian', spawnTime);

    return {
        ...botData,
        radius: 80,
        maxHealth: 2000,
        currentHealth: 2000,
        personality: 'bully',
        isBoss: true,
    };
};
