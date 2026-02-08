/**
 * @cjr/engine - PhysicsSystem
 * Pure physics integration - no VFX dependencies
 * 
 * EIDOLON-V REFACTOR: Now uses generated WorldState from schema.
 * Uses Generated Accessors for Type Safety.
 */

import { WorldState } from '../generated/WorldState';
import { EntityFlags, TransformAccess, PhysicsAccess } from '../generated/ComponentAccessors';

// EIDOLON-V P2 FIX: Document the intentional difference between physics and visual boundaries
export const PHY_MAP_RADIUS = 2500;
export const FRICTION_BASE = 0.92;

import { GameConfig } from '../config/GameConfig';

// EIDOLON-V Phase 3: Anti-cheat speed limits
const MAX_SPEED_BASE = 150;
const SPEED_VALIDATION_TOLERANCE = 1.15;

export class PhysicsSystem {
    /**
     * Update physics for all active entities
     */
    /**
     * Update physics for all active entities
     * Uses active list for zero-overhead skipping of empty slots
     */
    static update(world: WorldState, dt: number, excludeId?: number, dirtyTracker?: { markDirty: (id: number, mask: number) => void }): void {
        const deltaTime = dt;

        // Time scaling
        const timeScale = deltaTime * 60;
        const useFastFriction = Math.abs(timeScale - 1.0) < 0.01;
        const defaultFrictionUnstable = Math.pow(FRICTION_BASE, timeScale);

        // ITERATION STRATEGY:
        // Use WorldState Sparse Set (O(Active)) - ZERO OVERHEAD
        const count = world.activeCount;
        const activeEntities = world.activeEntities;

        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];
            if (id === excludeId) continue;
            if (id === excludeId) continue;
            PhysicsSystem.processEntity(world, id, deltaTime, useFastFriction, defaultFrictionUnstable, timeScale, dirtyTracker);
        }
    }

    // Extracted for JIT inlining
    private static processEntity(
        world: WorldState,
        id: number,
        deltaTime: number,
        useFastFriction: boolean,
        defaultFrictionUnstable: number,
        timeScale: number,
        dirtyTracker?: { markDirty: (id: number, mask: number) => void }
    ) {
        const frictionBase = PhysicsAccess.getFriction(world, id);

        let effectiveFriction: number;
        if (useFastFriction) {
            effectiveFriction = frictionBase;
        } else {
            if (Math.abs(frictionBase - FRICTION_BASE) < 0.0001) {
                effectiveFriction = defaultFrictionUnstable;
            } else {
                effectiveFriction = Math.pow(frictionBase, timeScale);
            }
        }

        this.integrateEntity(world, id, deltaTime, effectiveFriction, dirtyTracker);
    }

    static integrateEntity(
        world: WorldState,
        id: number,
        dt: number,
        friction: number,
        dirtyTracker?: { markDirty: (id: number, mask: number) => void }
    ): void {

        // 1. Get Velocity
        let vx = PhysicsAccess.getVx(world, id);
        let vy = PhysicsAccess.getVy(world, id);

        // EIDOLON-V OPTIMIZATION: Skip static entities
        if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) return;

        // 2. Apply Friction
        vx *= friction;
        vy *= friction;

        // 3. Snapshot for interpolation (Prev = Current)
        const currX = TransformAccess.getX(world, id);
        const currY = TransformAccess.getY(world, id);
        TransformAccess.setPrevX(world, id, currX);
        TransformAccess.setPrevY(world, id, currY);

        // 4. Integrate Position
        const delta = dt * GameConfig.PHYSICS.TIME_SCALE;

        let newX = currX + vx * delta;
        let newY = currY + vy * delta;

        // 5. Map Constraints
        const radius = PhysicsAccess.getRadius(world, id);
        const limit = PHY_MAP_RADIUS - radius;
        const limitSq = limit * limit;
        const distSq = newX * newX + newY * newY;

        if (distSq > limitSq) {
            const dist = Math.sqrt(distSq);
            const invDist = 1.0 / dist;
            const nx = newX * invDist;
            const ny = newY * invDist;

            // Clamp
            newX = nx * limit;
            newY = ny * limit;

            // Bounce
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
                const bounceFactor = 1.5;
                vx -= bounceFactor * dot * nx;
                vy -= bounceFactor * dot * ny;
            }
        }

        // EIDOLON-V Phase 3: Anti-cheat speed validation
        // Clamp velocity to max speed (server-authoritative)
        const speedSq = vx * vx + vy * vy;
        const maxSpeed = MAX_SPEED_BASE * SPEED_VALIDATION_TOLERANCE;
        const maxSpeedSq = maxSpeed * maxSpeed;

        if (speedSq > maxSpeedSq) {
            const speed = Math.sqrt(speedSq);
            const scale = maxSpeed / speed;
            vx *= scale;
            vy *= scale;
        }

        // 6. Write Back
        TransformAccess.setX(world, id, newX);
        TransformAccess.setY(world, id, newY);
        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);

        // Mark Dirty (Mask 1 = TRANSFORM)
        if (dirtyTracker) {
            dirtyTracker.markDirty(id, 1);
        }
    }
}

