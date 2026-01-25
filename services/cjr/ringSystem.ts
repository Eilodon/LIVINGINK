import { RingId, PigmentVec3 } from './cjrTypes';
import { RING_RADII, RING_THRESHOLDS } from './cjrConstants';
import { calculateMatch } from './colorMath';

export type RingCheckResult = {
    ring: RingId;
    action: 'stay' | 'commit' | 'bounce';
    message?: string;
};

/**
 * Calculates the current Ring based on distance from center.
 * DOES NOT handle logic of "gate keeping", just pure geometry.
 */
export function getGeometricRing(distance: number): RingId {
    if (distance <= RING_RADII.R3) return 3;
    if (distance <= RING_RADII.R2) return 2;
    if (distance <= RING_RADII.R1) return 1;
    return 0; // Out of bounds / Spawn
}

/**
 * Logic to check if a player CAN enter the next ring.
 * 1-Way Commit Rule: R1 -> R2 -> R3. (Cannot go back)
 */
export function updatePlayerRing(
    currentRing: RingId,
    positionsq: { x: number, y: number },
    currentPigment: PigmentVec3,
    targetPigment: PigmentVec3
): RingCheckResult {
    const dist = Math.sqrt(positionsq.x * positionsq.x + positionsq.y * positionsq.y);
    const geometricRing = getGeometricRing(dist);
    const match = calculateMatch(currentPigment, targetPigment);

    // Case 1: Player is geometrically in a "higher" (inner) ring
    if (geometricRing > currentRing) {
        // Attempting to ENTER Inner Ring

        // Check R1 -> R2
        if (currentRing === 1 && geometricRing >= 2) {
            if (match >= RING_THRESHOLDS.ENTER_R2) {
                return { ring: 2, action: 'commit', message: 'ENTERED RING 2' };
            } else {
                return { ring: 1, action: 'bounce', message: `NEED ${RING_THRESHOLDS.ENTER_R2 * 100}% MATCH` };
            }
        }

        // Check R2 -> R3
        if (currentRing === 2 && geometricRing === 3) {
            if (match >= RING_THRESHOLDS.ENTER_R3) {
                return { ring: 3, action: 'commit', message: 'ENTERED DEATH ZONE' };
            } else {
                return { ring: 2, action: 'bounce', message: `NEED ${RING_THRESHOLDS.ENTER_R3 * 100}% MATCH` };
            }
        }
    }

    // Case 2: Player is geometrically in a "lower" (outer) ring
    // Rule: Cannot go back easily? Or just allowed?
    // Vision doc says: "Vào rồi không ra: ring chỉ tăng, không giảm." (Enter then no exit: ring only increases, no decrease)
    if (geometricRing < currentRing) {
        // Player is trying to leave inner ring to outer.
        // Force them back? Or just keep their "RingId" status as inner but physically they are outside?
        // "RingId" usually determines spawn tier and rules.
        // If we want to physically trap them, we need Physics Wall.
        // If not physically trapped, they keep the ID.

        return { ring: currentRing, action: 'stay' };
    }

    return { ring: currentRing, action: 'stay' };
}

/**
 * Main update loop for Ring Logic.
 * apply bouncing or committing state changes.
 */
export function updateRingLogic(
    entity: any, // Player or Bot
    dt: number,
    levelConfig: any,
    state: any
) {
    if (entity.isDead) return;

    const res = updatePlayerRing(
        entity.ring,
        entity.position,
        entity.pigment,
        entity.targetPigment
    );

    if (res.action === 'commit') {
        // ENTERING INNER RING
        entity.ring = res.ring;
        // Grant buff?
        // createFloatingText(entity.position, res.message || "Welcome!", "#fff", 20, state);
    } else if (res.action === 'bounce') {
        // REJECTED
        // Physics bounce vector
        const angle = Math.atan2(entity.position.y, entity.position.x);
        const bounceForce = 400; // Strong push back

        // Normalize position to outside the boundary to prevent sticking
        // This is simplified, ideally we know WHICH ring boundary
        // For now, simple push outward
        entity.velocity.x += Math.cos(angle) * bounceForce * dt;
        entity.velocity.y += Math.sin(angle) * bounceForce * dt;

        // Notify user occasionally (debounce this if possible)
        // createFloatingText(entity.position, "ACCESS DENIED", "#f00", 20, state);
    }
}
