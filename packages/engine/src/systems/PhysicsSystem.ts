/**
 * @cjr/engine - PhysicsSystem
 * Pure physics integration - no VFX dependencies
 * 
 * EIDOLON-V REFACTOR: Now uses generated WorldState from schema.
 * Uses Generated Accessors for Type Safety.
 */

import { WorldState, defaultWorld } from '../generated/WorldState';
import { EntityFlags, TransformAccess, PhysicsAccess } from '../generated/ComponentAccessors';

// EIDOLON-V P2 FIX: Document the intentional difference between physics and visual boundaries
export const PHY_MAP_RADIUS = 2500;
export const FRICTION_BASE = 0.92;

export class PhysicsSystem {
    /**
     * Update physics for all active entities
     */
    static update(worldOrDt: WorldState | number, dt?: number): void {
        let world: WorldState;
        let deltaTime: number;

        if (typeof worldOrDt === 'number') {
            world = defaultWorld;
            deltaTime = worldOrDt;
        } else {
            world = worldOrDt;
            deltaTime = dt!;
        }

        const count = world.maxEntities;

        // Time scaling
        const timeScale = deltaTime * 60;
        const useFastFriction = Math.abs(timeScale - 1.0) < 0.01;
        const defaultFrictionUnstable = Math.pow(FRICTION_BASE, timeScale);

        // Iterate entities
        // Optimization: In a real ECS query, we'd have a list of active entities.
        // Here we scan. Accessors are inlineable.
        for (let id = 0; id < count; id++) {
            // Check ACTIVE flag directly via Accessor
            // Note: StateAccess.isActive is slightly slower than direct array access but safer.
            // For tight loop, we can access stateFlags directly if we really want, but let's stick to Accessors first.
            // Actually, StateAccess uses world.stateFlags directly.
            if ((world.stateFlags[id] & EntityFlags.ACTIVE) === 0) continue;

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

            this.integrateEntity(world, id, deltaTime, effectiveFriction);
        }
    }

    static integrateEntity(
        worldOrId: WorldState | number,
        idOrDt: number,
        dtOrFriction: number,
        friction?: number
    ): void {
        let world: WorldState;
        let id: number;
        let dt: number;
        let fric: number;

        if (typeof worldOrId === 'number') {
            world = defaultWorld;
            id = worldOrId;
            dt = idOrDt;
            fric = dtOrFriction;
        } else {
            world = worldOrId;
            id = idOrDt;
            dt = dtOrFriction;
            fric = friction!;
        }

        // 1. Get Velocity
        let vx = PhysicsAccess.getVx(world, id);
        let vy = PhysicsAccess.getVy(world, id);

        // 2. Apply Friction
        vx *= fric;
        vy *= fric;

        // 3. Snapshot for interpolation (Prev = Current)
        const currX = TransformAccess.getX(world, id);
        const currY = TransformAccess.getY(world, id);
        TransformAccess.setPrevX(world, id, currX);
        TransformAccess.setPrevY(world, id, currY);

        // 4. Integrate Position
        const PHYSICS_TIME_SCALE = 10;
        const delta = dt * PHYSICS_TIME_SCALE;

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

        // 6. Write Back
        TransformAccess.setX(world, id, newX);
        TransformAccess.setY(world, id, newY);
        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);
    }
}

