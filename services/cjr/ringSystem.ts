
import {
    RING_RADII,
    THRESHOLDS,
    COMMIT_BUFFS
} from './cjrConstants';
import { Player, Bot, RingId } from '../../types';
import { distance, normalize } from '../engine/math';
import { isRingAccessible, isRushWindowActive, getRushThreshold } from './bossCjr';

export const updateRingLogic = (entity: Player | Bot, dt: number) => {
    const dist = distance(entity.position, { x: 0, y: 0 });
    const r = entity.radius;

    // 1. Check current Ring based on position
    let physicalRing: RingId = 1;
    if (dist < RING_RADII.R3_BOUNDARY) physicalRing = 3;
    else if (dist < RING_RADII.R2_BOUNDARY) physicalRing = 2;
    else physicalRing = 1;

    // 2. Logic: One-way gates with BOSS BLOCKING
    // If entity.ring (committed ring) < physicalRing, valid transition if:
    //   a) Boss for that ring is defeated
    //   b) Match threshold met (reduced if Rush Window active)
    // If entity.ring > physicalRing, must push back (Trap)

    // --- GATE CHECK (Entering inner ring) ---
    if (physicalRing > entity.ring) {
        // Attempting to enter higher ring
        let allowed = false;
        let deniedReason = '';

        if (physicalRing === 2) {
            // Check Boss1 defeated
            if (!isRingAccessible(2)) {
                deniedReason = 'BOSS_BLOCKING';
            } else {
                // Check threshold (with rush window reduction)
                const threshold = isRushWindowActive(2)
                    ? getRushThreshold(THRESHOLDS.INTO_RING2)
                    : THRESHOLDS.INTO_RING2;
                if (entity.matchPercent >= threshold) {
                    allowed = true;
                } else {
                    deniedReason = 'LOW_MATCH';
                }
            }
        } else if (physicalRing === 3) {
            // Check Boss2 defeated
            if (!isRingAccessible(3)) {
                deniedReason = 'BOSS_BLOCKING';
            } else {
                const threshold = isRushWindowActive(3)
                    ? getRushThreshold(THRESHOLDS.INTO_RING3)
                    : THRESHOLDS.INTO_RING3;
                if (entity.matchPercent >= threshold) {
                    allowed = true;
                } else {
                    deniedReason = 'LOW_MATCH';
                }
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
};

const commitToRing = (entity: Player | Bot, ring: RingId) => {
    entity.ring = ring;

    // Apply Commit Buffs
    entity.statusEffects.speedBoost = COMMIT_BUFFS.SPEED_BOOST;
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
    if (reason === 'BOSS_BLOCKING') {
        console.log(`[CJR] ${entity.name} blocked by Boss! Defeat boss to enter Ring ${targetRing}.`);
    } else if (reason === 'LOW_MATCH') {
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
