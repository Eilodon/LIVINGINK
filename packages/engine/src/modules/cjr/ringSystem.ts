/**
 * @cjr/engine - Ring System
 * Pure ring transition logic - no VFX dependencies
 * Handles ring commit and elastic rejection mechanics
 */

import { TransformStore, PhysicsStore } from '../../compat';
import { defaultWorld } from '../../generated/WorldState';
import { RING_RADII, RING_RADII_SQ, THRESHOLDS, COMMIT_BUFFS } from './constants';
import { fastMath } from '../../math/FastMath';
import type { RingId } from './types';

// EIDOLON-V AUDIT: Cache world reference for DOD store access
const w = defaultWorld;

/**
 * Entity interface for ring system operations
 * Uses minimal properties to avoid client type dependency
 */
export interface IRingEntity {
    physicsIndex?: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    ring: RingId;
    matchPercent: number;
    isDead: boolean;
    statusScalars: Record<string, number>;
    statusMultipliers: Record<string, number>;
    statusTimers: Record<string, number>;
}

// DOD helpers for ring system
const getEntityPos = (entity: IRingEntity, out: { x: number; y: number }) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        out.x = w.transform[idx];
        out.y = w.transform[idx + 1];
    } else {
        out.x = entity.position.x;
        out.y = entity.position.y;
    }
};

const getEntityVel = (entity: IRingEntity, out: { x: number; y: number }) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        out.x = w.physics[idx];
        out.y = w.physics[idx + 1];
    } else {
        out.x = entity.velocity.x;
        out.y = entity.velocity.y;
    }
};

const setEntityVel = (entity: IRingEntity, vx: number, vy: number) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        w.physics[idx] = vx;
        w.physics[idx + 1] = vy;
    }
    entity.velocity.x = vx;
    entity.velocity.y = vy;
};

const setEntityPos = (entity: IRingEntity, x: number, y: number) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        w.transform[idx] = x;
        w.transform[idx + 1] = y;
    }
    entity.position.x = x;
    entity.position.y = y;
};

/**
 * Determines which ring a position falls into physically.
 * Ring 1 (Outer) -> Ring 2 (Mid) -> Ring 3 (Inner)
 * EIDOLON-V OPTIMIZED: Uses pre-computed squares
 */
export const getRingAtPosition = (x: number, y: number): RingId => {
    const distSq = x * x + y * y;

    if (distSq <= RING_RADII_SQ.R3) return 3;
    if (distSq <= RING_RADII_SQ.R2) return 2;
    return 1;
};

/**
 * Main update function for ring logic
 */
export const updateRingLogic = (
    entity: IRingEntity,
    _dt: number,
    _levelConfig: unknown
): { transitioned: boolean; newRing?: RingId } => {
    if (entity.isDead) return { transitioned: false };

    if ('matchPercent' in entity) {
        return checkRingTransition(entity);
    }
    return { transitioned: false };
};

/**
 * Checks if an entity should transition to a deeper ring.
 * Enforces one-way commit logic.
 * Returns transition info for event emission by caller
 * EIDOLON-V OPTIMIZED: Uses pre-computed squares
 */
export const checkRingTransition = (
    entity: IRingEntity
): { transitioned: boolean; newRing?: RingId } => {
    const pos = { x: 0, y: 0 };
    getEntityPos(entity, pos);

    const distSq = pos.x * pos.x + pos.y * pos.y;

    // Ring 1 -> Ring 2
    if (entity.ring === 1) {
        if (distSq < RING_RADII_SQ.R2) {
            if (entity.matchPercent >= THRESHOLDS.ENTER_RING2) {
                entity.ring = 2;
                applyCommitBuff(entity, COMMIT_BUFFS.R2);
                return { transitioned: true, newRing: 2 };
            } else {
                applyElasticRejection(entity, RING_RADII.R2, 50);
            }
        }
    }

    // Ring 2 -> Ring 3
    else if (entity.ring === 2) {
        if (distSq < RING_RADII_SQ.R3) {
            if (entity.matchPercent >= THRESHOLDS.ENTER_RING3) {
                entity.ring = 3;
                applyCommitBuff(entity, COMMIT_BUFFS.R3);
                return { transitioned: true, newRing: 3 };
            } else {
                applyElasticRejection(entity, RING_RADII.R3, 50);
            }
        }
        // Keep in Ring 2
        else if (distSq > RING_RADII_SQ.R2) {
            clampToRingOuter(entity, RING_RADII.R2);
        }
    }

    // Ring 3 - cannot leave
    else if (entity.ring === 3) {
        if (distSq > RING_RADII_SQ.R3) {
            clampToRingOuter(entity, RING_RADII.R3);
        }
    }

    return { transitioned: false };
};

const applyCommitBuff = (
    entity: IRingEntity,
    buff: { duration: number; speed: number; shield?: number }
) => {
    entity.statusScalars.commitShield = buff.shield ?? 0;
    entity.statusMultipliers.speed = Math.max(
        entity.statusMultipliers.speed || 1,
        buff.speed
    );
    entity.statusTimers.tempSpeed = buff.duration;
};

/**
 * Applies organic elastic force when trying to cross a membrane without permission.
 * F = -k * x - c * v (Spring + Damping)
 */
const applyElasticRejection = (
    entity: IRingEntity,
    radiusLimit: number,
    thickness: number
) => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    getEntityPos(entity, pos);
    getEntityVel(entity, vel);

    const distSq = pos.x * pos.x + pos.y * pos.y;
    const dist = fastMath.fastSqrt(distSq);
    const penetration = radiusLimit - dist;

    if (dist > radiusLimit + thickness) {
        clampToRingOuter(entity, radiusLimit + thickness);
        return;
    }

    const angle = Math.atan2(pos.y, pos.x);

    const k = 5.0;
    const c = 0.2;

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const force = penetration * k;

    const newVx = vel.x + dirX * force * 0.016;
    const newVy = vel.y + dirY * force * 0.016;

    const dampedVx = newVx * (1 - c);
    const dampedVy = newVy * (1 - c);

    setEntityVel(entity, dampedVx, dampedVy);
};

const clampToRingOuter = (entity: IRingEntity, radiusLimit: number) => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    getEntityPos(entity, pos);
    getEntityVel(entity, vel);

    const angle = Math.atan2(pos.y, pos.x);
    const safeR = radiusLimit - 2;

    const newX = Math.cos(angle) * safeR;
    const newY = Math.sin(angle) * safeR;

    setEntityPos(entity, newX, newY);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const dotProduct = vel.x * nx + vel.y * ny;
    if (dotProduct > 0) {
        const newVx = vel.x - dotProduct * nx;
        const newVy = vel.y - dotProduct * ny;
        setEntityVel(entity, newVx, newVy);
    }
};

// ============================================================================
// LEGACY-COMPATIBLE WRAPPERS (for client migration)
// ============================================================================

/**
 * Legacy-compatible updateRingLogic
 * Matches client signature: (entity: Player | Bot, dt: number, levelConfig: any, state: GameState) => void
 */
export const updateRingLogicLegacy = (
    entity: any,
    dt: number,
    _levelConfig: any,
    _state: any
): void => {
    updateRingLogic(entity as IRingEntity, dt, _levelConfig);
};
