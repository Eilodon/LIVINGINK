/**
 * @cjr/engine - Ring System
 * Pure ring transition logic - no VFX dependencies
 * Handles ring commit and elastic rejection mechanics
 */

// NOTE: Code uses direct buffer access (world.transform, world.physics), not Store methods
import { WorldState } from '../../generated/WorldState.js';
import { RING_RADII, RING_RADII_SQ, THRESHOLDS, COMMIT_BUFFS } from './constants.js';
import { fastMath } from '../../math/FastMath.js';
import type { RingId } from './types.js';

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
// EIDOLON-V P1 FIX: Accept WorldState parameter instead of module-level singleton
const getEntityPos = (world: WorldState, entity: IRingEntity, out: { x: number; y: number }) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        out.x = world.transform[idx];
        out.y = world.transform[idx + 1];
    } else {
        out.x = entity.position.x;
        out.y = entity.position.y;
    }
};

const getEntityVel = (world: WorldState, entity: IRingEntity, out: { x: number; y: number }) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        out.x = world.physics[idx];
        out.y = world.physics[idx + 1];
    } else {
        out.x = entity.velocity.x;
        out.y = entity.velocity.y;
    }
};

const setEntityVel = (world: WorldState, entity: IRingEntity, vx: number, vy: number) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        world.physics[idx] = vx;
        world.physics[idx + 1] = vy;
    }
    entity.velocity.x = vx;
    entity.velocity.y = vy;
};

const setEntityPos = (world: WorldState, entity: IRingEntity, x: number, y: number) => {
    if (entity.physicsIndex !== undefined) {
        const idx = entity.physicsIndex * 8;
        world.transform[idx] = x;
        world.transform[idx + 1] = y;
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
 * EIDOLON-V P1 FIX: Added optional world parameter for instance-based architecture
 */
export const updateRingLogic = (
    entity: IRingEntity,
    _dt: number,
    _levelConfig: unknown,
    world: WorldState  // EIDOLON-V: WorldState is now REQUIRED
): { transitioned: boolean; newRing?: RingId } => {
    if (entity.isDead) return { transitioned: false };

    if ('matchPercent' in entity) {
        return checkRingTransition(entity, world, _dt);  // EIDOLON-V P1 FIX: Pass dt
    }
    return { transitioned: false };
};

/**
 * Checks if an entity should transition to a deeper ring.
 * Enforces one-way commit logic.
 * Returns transition info for event emission by caller
 * EIDOLON-V OPTIMIZED: Uses pre-computed squares
 * EIDOLON-V P1 FIX: Added world parameter for instance-based architecture
 */
export const checkRingTransition = (
    entity: IRingEntity,
    world: WorldState,  // EIDOLON-V: WorldState is now REQUIRED
    dt: number = 0.016  // EIDOLON-V P1 FIX: dt for frame-rate independent physics
): { transitioned: boolean; newRing?: RingId } => {
    const pos = { x: 0, y: 0 };
    getEntityPos(world, entity, pos);

    const distSq = pos.x * pos.x + pos.y * pos.y;

    // Ring 1 -> Ring 2
    if (entity.ring === 1) {
        if (distSq < RING_RADII_SQ.R2) {
            if (entity.matchPercent >= THRESHOLDS.ENTER_RING2) {
                entity.ring = 2;
                applyCommitBuff(entity, COMMIT_BUFFS.R2);
                return { transitioned: true, newRing: 2 };
            } else {
                applyElasticRejection(entity, RING_RADII.R2, 50, world, dt);
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
                applyElasticRejection(entity, RING_RADII.R3, 50, world, dt);
            }
        }
        // Keep in Ring 2
        else if (distSq > RING_RADII_SQ.R2) {
            clampToRingOuter(entity, RING_RADII.R2, world);
        }
    }

    // Ring 3 - cannot leave
    else if (entity.ring === 3) {
        if (distSq > RING_RADII_SQ.R3) {
            clampToRingOuter(entity, RING_RADII.R3, world);
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
 * 
 * EIDOLON-V P1 FIX: Uses actual dt instead of hardcoded 0.016 to fix frame-rate dependency
 */
const applyElasticRejection = (
    entity: IRingEntity,
    radiusLimit: number,
    thickness: number,
    world: WorldState,
    dt: number = 0.016  // Default fallback for legacy callers
) => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    getEntityPos(world, entity, pos);
    getEntityVel(world, entity, vel);

    const distSq = pos.x * pos.x + pos.y * pos.y;
    const dist = fastMath.fastSqrt(distSq);
    const penetration = radiusLimit - dist;

    if (dist > radiusLimit + thickness) {
        clampToRingOuter(entity, radiusLimit + thickness, world);
        return;
    }

    const angle = Math.atan2(pos.y, pos.x);

    const k = 5.0;
    const c = 0.2;

    // EIDOLON-V P1 FIX: Clamp max repulsion force to prevent NaN from lag spikes
    const MAX_REPULSION_FORCE = 500;
    const force = Math.min(Math.abs(penetration * k), MAX_REPULSION_FORCE) * Math.sign(penetration);

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // EIDOLON-V P1 FIX: Use actual dt instead of hardcoded 0.016
    const newVx = vel.x + dirX * force * dt;
    const newVy = vel.y + dirY * force * dt;

    const dampedVx = newVx * (1 - c);
    const dampedVy = newVy * (1 - c);

    setEntityVel(world, entity, dampedVx, dampedVy);
};

const clampToRingOuter = (entity: IRingEntity, radiusLimit: number, world: WorldState) => {
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    getEntityPos(world, entity, pos);
    getEntityVel(world, entity, vel);

    const angle = Math.atan2(pos.y, pos.x);
    const safeR = radiusLimit - 2;

    const newX = Math.cos(angle) * safeR;
    const newY = Math.sin(angle) * safeR;

    setEntityPos(world, entity, newX, newY);

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const dotProduct = vel.x * nx + vel.y * ny;
    if (dotProduct > 0) {
        const newVx = vel.x - dotProduct * nx;
        const newVy = vel.y - dotProduct * ny;
        setEntityVel(world, entity, newVx, newVy);
    }
};

// ============================================================================
// LEGACY-COMPATIBLE WRAPPERS (for client migration)
// ============================================================================

/**
 * Type guard to validate entity has required IRingEntity fields
 * EIDOLON-V P3 FIX: Prevents crash from blind type casting
 */
const isRingEntity = (entity: unknown): entity is IRingEntity => {
    if (!entity || typeof entity !== 'object') return false;
    const e = entity as Record<string, unknown>;
    return (
        typeof e.position === 'object' && e.position !== null &&
        typeof e.velocity === 'object' && e.velocity !== null &&
        typeof e.ring === 'number' &&
        typeof e.matchPercent === 'number' &&
        typeof e.isDead === 'boolean' &&
        typeof e.statusScalars === 'object' && e.statusScalars !== null &&
        typeof e.statusMultipliers === 'object' && e.statusMultipliers !== null &&
        typeof e.statusTimers === 'object' && e.statusTimers !== null
    );
};

/**
 * Legacy-compatible updateRingLogic
 * EIDOLON-V: Now requires WorldState as 5th parameter
 */
export const updateRingLogicLegacy = (
    entity: unknown,
    dt: number,
    _levelConfig: unknown,
    _state: unknown,
    world?: WorldState
): void => {
    // EIDOLON-V: WorldState is required
    if (!world) {
        console.warn('[ringSystem] updateRingLogicLegacy requires WorldState parameter');
        return;
    }
    // EIDOLON-V P3 FIX: Validate before casting
    if (!isRingEntity(entity)) {
        console.warn('[ringSystem] updateRingLogicLegacy called with invalid entity');
        return;
    }
    updateRingLogic(entity, dt, _levelConfig, world);
};

/**
 * EIDOLON-V Finding 6: DOD-native ring transition check
 * 
 * Reads/writes directly to WorldState buffers.
 * No intermediate object allocation - eliminates GC pressure.
 * 
 * @param world WorldState instance
 * @param entityId Entity index
 * @param ring Current ring (1, 2, or 3)
 * @param matchPercent Color match percentage (0-100)
 * @param dt Delta time for physics calculations
 * @returns Transition result with newRing if transitioned
 */
export const checkRingTransitionDOD = (
    world: WorldState,
    entityId: number,
    ring: RingId,
    matchPercent: number,
    dt: number = 0.016
): { transitioned: boolean; newRing?: RingId } => {
    // Read position directly from transform buffer
    const transformIdx = entityId * 8;
    const x = world.transform[transformIdx];
    const y = world.transform[transformIdx + 1];
    const distSq = x * x + y * y;

    // Physics buffer index for velocity writes
    const physicsIdx = entityId * 8;

    // Ring 1 -> Ring 2 transition
    if (ring === 1) {
        if (distSq < RING_RADII_SQ.R2) {
            if (matchPercent >= THRESHOLDS.ENTER_RING2) {
                return { transitioned: true, newRing: 2 };
            } else {
                // Apply elastic rejection directly to DOD
                applyElasticRejectionDOD(world, physicsIdx, x, y, RING_RADII.R2, 50, dt);
            }
        }
    }
    // Ring 2 -> Ring 3 transition
    else if (ring === 2) {
        if (distSq < RING_RADII_SQ.R3) {
            if (matchPercent >= THRESHOLDS.ENTER_RING3) {
                return { transitioned: true, newRing: 3 };
            } else {
                applyElasticRejectionDOD(world, physicsIdx, x, y, RING_RADII.R3, 50, dt);
            }
        } else if (distSq > RING_RADII_SQ.R2) {
            clampToRingOuterDOD(world, transformIdx, physicsIdx, x, y, RING_RADII.R2);
        }
    }
    // Ring 3 - cannot leave
    else if (ring === 3) {
        if (distSq > RING_RADII_SQ.R3) {
            clampToRingOuterDOD(world, transformIdx, physicsIdx, x, y, RING_RADII.R3);
        }
    }

    return { transitioned: false };
};

// DOD-native elastic rejection - writes directly to physics buffer
const applyElasticRejectionDOD = (
    world: WorldState,
    physicsIdx: number,
    x: number,
    y: number,
    threshold: number,
    force: number,
    dt: number
) => {
    const distSq = x * x + y * y;
    const dist = fastMath.fastSqrt(distSq);
    if (dist < 0.001) return;

    const overlap = threshold - dist;
    if (overlap <= 0) return;

    const nx = x / dist;
    const ny = y / dist;
    const pushForce = overlap * force * dt;

    // Write directly to physics buffer (vx, vy)
    world.physics[physicsIdx] += nx * pushForce;
    world.physics[physicsIdx + 1] += ny * pushForce;
};

// DOD-native ring clamping - writes directly to transform/physics buffers
const clampToRingOuterDOD = (
    world: WorldState,
    transformIdx: number,
    physicsIdx: number,
    x: number,
    y: number,
    radius: number
) => {
    const dist = fastMath.fastSqrt(x * x + y * y);
    if (dist < 0.001) return;

    const nx = x / dist;
    const ny = y / dist;

    // Clamp position to ring boundary
    world.transform[transformIdx] = nx * radius;
    world.transform[transformIdx + 1] = ny * radius;

    // Nullify outward velocity component
    const vx = world.physics[physicsIdx];
    const vy = world.physics[physicsIdx + 1];
    const dot = vx * nx + vy * ny;
    if (dot > 0) {
        world.physics[physicsIdx] = vx - dot * nx;
        world.physics[physicsIdx + 1] = vy - dot * ny;
    }
};

