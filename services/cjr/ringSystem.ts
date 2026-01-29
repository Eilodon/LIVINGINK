
import { GameState, Player, Bot } from '../../types';
import { RING_RADII, THRESHOLDS, COMMIT_BUFFS } from '../../constants';
import { fastMath, distance } from '../math/FastMath';
import { StatusFlag } from '../engine/statusFlags';

/**
 * Determines which ring a position falls into physically.
 * Ring 1 (Outer) -> Ring 2 (Mid) -> Ring 3 (Inner)
 */
export const getRingAtPosition = (x: number, y: number): 1 | 2 | 3 => {
    // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
    const distSq = x * x + y * y;
    const R3_sq = RING_RADII.R3 * RING_RADII.R3;
    const R2_sq = RING_RADII.R2 * RING_RADII.R2;

    if (distSq <= R3_sq) return 3;
    if (distSq <= R2_sq) return 2;
    return 1;
};

/**
 * Main update function called by engine/index.ts
 */
export const updateRingLogic = (entity: Player | Bot, dt: number, levelConfig: any, state: GameState) => {
    if (entity.isDead) return;

    // Only players commit? Or bots too? 
    // For MVP, lets enforce ring logic on everyone but maybe bots cheat?
    // Let's enforce for Player types mainly to avoid bots stuck if AI is dumb.
    // But bots should also follow rules.
    if ('matchPercent' in entity) {
        checkRingTransition(entity as Player);
    }
};

/**
 * Checks if a player should transition to a deeper ring.
 * Enforces one-way commit logic.
 */
export const checkRingTransition = (player: Player) => {
    // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
    const distSq = fastMath.distanceFromOriginSquared(player.position);
    const R2_sq = RING_RADII.R2 * RING_RADII.R2;
    const R3_sq = RING_RADII.R3 * RING_RADII.R3;

    // Transition Logic: Ring 1 -> Ring 2
    if (player.ring === 1) {
        // Physical entry check
        if (distSq < R2_sq) {
            // Condition check
            if (player.matchPercent >= THRESHOLDS.ENTER_RING2) {
                // COMMIT!
                player.ring = 2;
                applyCommitBuff(player, COMMIT_BUFFS.R2);
            } else {
                // REJECT! Elastic Membrane
                // Membrane thickness 50px
                applyElasticRejection(player, RING_RADII.R2, 50);
            }
        }
    }

    // Transition Logic: Ring 2 -> Ring 3
    else if (player.ring === 2) {
        if (distSq < R3_sq) {
            // Condition check
            if (player.matchPercent >= THRESHOLDS.ENTER_RING3) {
                // COMMIT!
                player.ring = 3;
                applyCommitBuff(player, COMMIT_BUFFS.R3);
            } else {
                // REJECT! Elastic Membrane
                applyElasticRejection(player, RING_RADII.R3, 50);
            }
        }
        // Backward check: keep them in R2 (Inner bound is R3, Outer bound is R2)
        // "Commit 1-way" means once in Ring 2, cannot go back to Ring 1 (R > R2).
        else if (distSq > R2_sq) {
            // Pull back in
            clampToRingOuter(player, RING_RADII.R2);
        }
    }

    // Transition Logic: Ring 3
    else if (player.ring === 3) {
        // Cannot leave R3
        if (distSq > R3_sq) {
            clampToRingOuter(player, RING_RADII.R3);
        }
    }
};

const applyCommitBuff = (player: Player, buff: any) => {
    player.statusScalars.commitShield = buff.shield;
    player.statusMultipliers.speed = Math.max(player.statusMultipliers.speed || 1, buff.speed);
    player.statusTimers.tempSpeed = buff.duration;
};

/**
 * Applies organic elastic force when trying to cross a membrane without permission.
 * F = -k * x - c * v (Spring + Damping)
 */
const applyElasticRejection = (player: Player, radiusLimit: number, thickness: number) => {
    // EIDOLON-V FIX: Use squared distance comparison (no sqrt)
    const distSq = fastMath.distanceFromOriginSquared(player.position);
    const dist = fastMath.fastSqrt(distSq); // Only calculate sqrt when absolutely necessary
    const penetration = radiusLimit - dist; // Positive if inside

    // Safety clamp (if they break through somehow, push them out hard)
    if (dist > radiusLimit + thickness) {
        clampToRingOuter(player, radiusLimit + thickness);
        return;
    }

    const angle = Math.atan2(player.position.y, player.position.x);

    // Soft membrane zone
    // K_SPRING = 2.0 (Force per pixel)
    // C_DAMPING = 0.5 (Drag)
    const k = 5.0;
    const c = 0.2;

    // If they are deep in the membrane, push back OUT
    // Vector pointing OUT
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // Force magnitude
    // We want to push them AWAY from the center if they are trying to enter inner ring
    // BUT wait, entering Ring 2 (Inner) means dist < R2.
    // So penetration = R2 - dist. Positive.
    // We want to push them OUT (increase dist).

    const force = penetration * k;

    player.velocity.x += dirX * force * 0.016; // dt approx
    player.velocity.y += dirY * force * 0.016;

    // Damping / Friction in the membrane
    player.velocity.x *= (1 - c);
    player.velocity.y *= (1 - c);
};

const clampToRingOuter = (player: Player, radiusLimit: number) => {
    const angle = Math.atan2(player.position.y, player.position.x);
    const safeR = radiusLimit - 2; // Slight buffer

    player.position.x = Math.cos(angle) * safeR;
    player.position.y = Math.sin(angle) * safeR;

    // Kill velocity into the wall
    // Project velocity onto normal
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const dot = player.velocity.x * nx + player.velocity.y * ny;
    if (dot > 0) { // If moving OUT
        player.velocity.x -= dot * nx;
        player.velocity.y -= dot * ny;
    }
};
