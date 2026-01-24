
import {
    RING_RADII,
    COMMIT_BUFFS
} from './cjrConstants';
import { Player, Bot, RingId } from '../../types';
import { distance } from '../engine/math';
import { LevelConfig } from './levels';

export const updateRingLogic = (entity: Player | Bot, dt: number, config: LevelConfig) => {
    const dist = distance(entity.position, { x: 0, y: 0 });

    // 1. Check current Ring based on position
    let physicalRing: RingId = 1;
    if (dist < RING_RADII.R3_BOUNDARY) physicalRing = 3;
    else if (dist < RING_RADII.R2_BOUNDARY) physicalRing = 2;
    else physicalRing = 1;

    // 2. Logic: One-way membrane, no gate blocking
    // If entity.ring (committed ring) < physicalRing, allow only if match threshold met.
    // If entity.ring > physicalRing, must push back (Trap)

    // --- GATE CHECK (Entering inner ring) ---
    if (physicalRing > entity.ring) {
        // Attempting to enter higher ring
        let allowed = false;
        let deniedReason = '';

        if (physicalRing === 2) {
            // Check threshold
            if (entity.matchPercent >= config.thresholds.ring2) {
                allowed = true;
            } else {
                deniedReason = 'LOW_MATCH';
            }
        } else if (physicalRing === 3) {
            if (entity.matchPercent >= config.thresholds.ring3) {
                allowed = true;
            } else {
                deniedReason = 'LOW_MATCH';
            }
        }

        if (allowed) {
            // Success! Commit to new ring
            commitToRing(entity, physicalRing);
        } else {
            // Denied! Membrane Bounce
            applyMembraneBounce(entity, physicalRing, deniedReason);
        }
    }

    // --- TRAP CHECK (Leaving committed ring) ---
    else if (physicalRing < entity.ring) {
        // Trying to go OUT to outer ring? No backzies!
        // Push back IN
        const boundary = (entity.ring === 3) ? RING_RADII.R3_BOUNDARY : RING_RADII.R2_BOUNDARY;
        applyMembraneTrap(entity, boundary);
    }

    // Ring 3 low-match debuff
    if (entity.ring === 3) {
        if (config.ring3Debuff.enabled && entity.matchPercent < config.ring3Debuff.threshold) {
            entity.ring3LowMatchTime += dt;
            if (entity.ring3LowMatchTime >= config.ring3Debuff.duration) {
                applyTempSpeedBoost(entity, config.ring3Debuff.speedMultiplier, config.ring3Debuff.duration);
                entity.ring3LowMatchTime = 0;
            }
        } else {
            entity.ring3LowMatchTime = 0;
        }
    }

    // Pity boost when stuck below threshold too long
    const targetThreshold = entity.ring === 1
        ? config.thresholds.ring2
        : entity.ring === 2
            ? config.thresholds.ring3
            : config.thresholds.win;
    if (entity.matchPercent < targetThreshold) {
        entity.matchStuckTime += dt;
        if (entity.matchStuckTime >= config.pity.stuckThreshold) {
            entity.statusEffects.colorBoostMultiplier = config.pity.multiplier;
            entity.statusEffects.colorBoostTimer = config.pity.duration;
            entity.statusEffects.pityBoost = config.pity.duration;
            entity.matchStuckTime = 0;
        }
    } else {
        entity.matchStuckTime = 0;
    }
};

const commitToRing = (entity: Player | Bot, ring: RingId) => {
    entity.ring = ring;

    // Apply Commit Buffs
    applyTempSpeedBoost(entity, COMMIT_BUFFS.SPEED_BOOST, COMMIT_BUFFS.SPEED_DURATION);
    entity.statusEffects.shielded = true;
    entity.statusEffects.commitShield = COMMIT_BUFFS.SHIELD_DURATION;

    console.log(`[CJR] ${entity.name} committed to Ring ${ring}!`);
};

const applyMembraneBounce = (entity: Player | Bot, targetRing: RingId, reason?: string) => {
    // Bounce OUT (Away from center)
    const boundary = (targetRing === 3) ? RING_RADII.R3_BOUNDARY : RING_RADII.R2_BOUNDARY;
    forcePosToRadius(entity, boundary + entity.radius + 5);

    // Velocity Reflection
    bounceVelocity(entity, 1.5); // Strong bounce

    // Log reason for debugging/VFX
    if (reason === 'LOW_MATCH') {
        console.log(`[CJR] ${entity.name} needs higher match% to enter Ring ${targetRing}.`);
    }
};

const applyMembraneTrap = (entity: Player | Bot, boundaryRadius: number) => {
    // Bounce IN (Towards center)
    // Position must be < boundary
    forcePosToRadius(entity, boundaryRadius - entity.radius - 5);
    bounceVelocity(entity, 0.5); // Soft bounce
};

const forcePosToRadius = (entity: Player | Bot, r: number) => {
    const angle = Math.atan2(entity.position.y, entity.position.x);
    entity.position.x = Math.cos(angle) * r;
    entity.position.y = Math.sin(angle) * r;
};

const bounceVelocity = (entity: Player | Bot, elasticity: number) => {
    const angle = Math.atan2(entity.position.y, entity.position.x);
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };

    // V_new = V - (1+e)*(V.N)*N
    const dot = entity.velocity.x * normal.x + entity.velocity.y * normal.y;
    entity.velocity.x -= (1 + elasticity) * dot * normal.x;
    entity.velocity.y -= (1 + elasticity) * dot * normal.y;
};

const applyTempSpeedBoost = (entity: Player | Bot, multiplier: number, duration: number) => {
    const current = entity.statusEffects.tempSpeedBoost || 1;
    if (multiplier >= 1) {
        entity.statusEffects.tempSpeedBoost = Math.max(current, multiplier);
    } else {
        entity.statusEffects.tempSpeedBoost = Math.min(current, multiplier);
    }
    entity.statusEffects.tempSpeedTimer = Math.max(entity.statusEffects.tempSpeedTimer || 0, duration);
};
