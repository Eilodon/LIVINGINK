/**
 * EIDOLON-V P3-1: Entity Factory Functions
 * ============================================
 * Type-safe factory functions to replace unsafe `as unknown as Player/Bot` casts.
 * Provides default values for all required properties.
 */

import { Player, Bot } from './player';
import { Vector2, SizeTier } from './shared';
import { PigmentVec3, ShapeId, Emotion, RingId, TattooId } from '../game/cjr/cjrTypes';
import {
    createDefaultStatusTimers,
    createDefaultStatusMultipliers,
    createDefaultStatusScalars,
} from './status';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PIGMENT: PigmentVec3 = { r: 0.5, g: 0.5, b: 0.5 };
const DEFAULT_POSITION: Vector2 = { x: 0, y: 0 };
const DEFAULT_VELOCITY: Vector2 = { x: 0, y: 0 };

// ============================================================================
// PLAYER FACTORY
// ============================================================================

export interface CreatePlayerOptions {
    id: string;
    name: string;
    position?: Vector2;
    radius?: number;
    shape?: ShapeId;
    pigment?: PigmentVec3;
    targetPigment?: PigmentVec3;
}

export function createDefaultPlayer(options: CreatePlayerOptions): Player {
    const now = Date.now();

    return {
        // Identity
        id: options.id,
        name: options.name,
        score: 0,
        kills: 0,
        killStreak: 0,
        streakTimer: 0,

        // Position & Physics
        position: options.position ? { ...options.position } : { ...DEFAULT_POSITION },
        velocity: { ...DEFAULT_VELOCITY },
        radius: options.radius ?? 28,
        color: 0xffffff,
        isDead: false,

        // Health
        maxHealth: 100,
        currentHealth: 100,

        // Game State
        tier: SizeTier.Larva,
        targetPosition: { ...DEFAULT_POSITION },
        spawnTime: now,

        // CJR Specific
        pigment: options.pigment ? { ...options.pigment } : { ...DEFAULT_PIGMENT },
        targetPigment: options.targetPigment ? { ...options.targetPigment } : { ...DEFAULT_PIGMENT },
        matchPercent: 0,
        ring: 1 as RingId,
        emotion: 'neutral' as Emotion,
        shape: options.shape ?? 'circle',
        tattoos: [] as TattooId[],

        // Timers
        lastHitTime: 0,
        lastEatTime: 0,
        matchStuckTime: 0,
        ring3LowMatchTime: 0,
        emotionTimer: 0,

        // Physics Properties
        acceleration: 1.0,
        maxSpeed: 2.3,
        friction: 0.93,
        magneticFieldRadius: 0,

        // RPG Stats
        defense: 1,
        damageMultiplier: 1,
        critChance: 0,
        critMultiplier: 1.5,
        lifesteal: 0,
        armorPen: 0,
        reflectDamage: 0,
        visionMultiplier: 1,
        sizePenaltyMultiplier: 1,
        skillCooldownMultiplier: 1,
        skillPowerMultiplier: 1,
        skillDashMultiplier: 1,
        killGrowthMultiplier: 1,
        poisonOnHit: false,
        doubleCast: false,
        reviveAvailable: false,

        // Cooldowns
        isInvulnerable: false,
        skillCooldown: 0,
        maxSkillCooldown: 8,
        mutationCooldowns: {
            speedSurge: 0,
            invulnerable: 0,
            rewind: 0,
            lightning: 0,
            chaos: 0,
            kingForm: 0,
        },
        rewindHistory: [],
        stationaryTime: 0,

        // Status (DOD Synced)
        statusFlags: 0,
        tattooFlags: 0,
        extendedFlags: 0,
        statusTimers: createDefaultStatusTimers(),
        statusMultipliers: createDefaultStatusMultipliers(),
        statusScalars: createDefaultStatusScalars(),
    };
}

// ============================================================================
// BOT FACTORY
// ============================================================================

export interface CreateBotOptions extends CreatePlayerOptions {
    personality?: Bot['personality'];
}

export function createDefaultBot(options: CreateBotOptions): Bot {
    const player = createDefaultPlayer(options);

    return {
        ...player,
        aiState: 'wander',
        targetEntityId: null,
        aiReactionTimer: 0,
        personality: options.personality ?? 'farmer',
    };
}
