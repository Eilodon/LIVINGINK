/**
 * @cjr/engine - MovementSystem
 * Pure movement logic - game-agnostic, no hardcoded constants
 * 
 * EIDOLON-V: Uses generated WorldState and Accessor classes from schema.
 */

import { WorldState, defaultWorld, STRIDES, MAX_ENTITIES } from '../generated/WorldState';
import {
    EntityFlags,
    StateAccess,
    PhysicsAccess,
    TransformAccess,
    InputAccess,
    ConfigAccess
} from '../generated/ComponentAccessors';

// Default values for when Config has no data
const DEFAULT_MAX_SPEED = 150;
const DEFAULT_ACCELERATION = 2000;

export class MovementSystem {
    /**
     * DOD Movement Logic using generated accessors
     * 
     * @param world WorldState instance
     * @param id Entity ID
     * @param dt Delta time
     * @param defaultMaxSpeed Optional default max speed
     */
    static update(world: WorldState, id: number, dt: number, defaultMaxSpeed: number = DEFAULT_MAX_SPEED) {
        // 1. Read inputs using accessor
        const tx = InputAccess.getTargetX(world, id);
        const ty = InputAccess.getTargetY(world, id);

        // 2. Read speed config
        const speedMult = ConfigAccess.getSpeedMult(world, id) || 1;
        const configMaxSpeed = ConfigAccess.getMagneticRadius(world, id); // Reusing first field for maxSpeed

        const baseMaxSpeed = configMaxSpeed > 0 ? configMaxSpeed : defaultMaxSpeed;
        const effectiveMaxSpeed = baseMaxSpeed * speedMult;

        // 3. Read position
        const px = TransformAccess.getX(world, id);
        const py = TransformAccess.getY(world, id);

        // 4. Calculate direction
        const dx = tx - px;
        const dy = ty - py;
        const distSq = dx * dx + dy * dy;

        // Deadzone
        if (distSq < 1) return;

        const dist = Math.sqrt(distSq);

        // Seek behavior
        const accel = DEFAULT_ACCELERATION;
        const ax = (dx / dist) * accel * dt;
        const ay = (dy / dist) * accel * dt;

        // Read current velocity
        let vx = PhysicsAccess.getVx(world, id) + ax;
        let vy = PhysicsAccess.getVy(world, id) + ay;

        // Cap speed
        const vSq = vx * vx + vy * vy;
        const maxSq = effectiveMaxSpeed * effectiveMaxSpeed;

        if (vSq > maxSq) {
            const v = Math.sqrt(vSq);
            const scale = effectiveMaxSpeed / v;
            vx *= scale;
            vy *= scale;
        }

        // Write velocity back
        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);
    }

    /**
     * Update all active entities
     */
    static updateAll(world: WorldState, dt: number, defaultMaxSpeed: number = DEFAULT_MAX_SPEED) {
        const count = world.activeCount;
        const activeEntities = world.activeEntities;

        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];
            this.update(world, id, dt, defaultMaxSpeed);
        }
    }

    /**
     * Apply input with explicit target/config (for external callers)
     */
    static applyInputDOD(
        world: WorldState,
        id: number,
        target: { x: number; y: number },
        config: { maxSpeed: number; speedMultiplier: number; acceleration?: number },
        dt: number
    ) {
        const px = TransformAccess.getX(world, id);
        const py = TransformAccess.getY(world, id);

        const dx = target.x - px;
        const dy = target.y - py;
        const distSq = dx * dx + dy * dy;

        if (distSq < 1) return;

        const dist = Math.sqrt(distSq);
        const accel = config.acceleration ?? DEFAULT_ACCELERATION;
        const ax = (dx / dist) * accel * dt;
        const ay = (dy / dist) * accel * dt;

        let vx = PhysicsAccess.getVx(world, id) + ax;
        let vy = PhysicsAccess.getVy(world, id) + ay;

        const effectiveMaxSpeed = config.maxSpeed * config.speedMultiplier;
        const vSq = vx * vx + vy * vy;
        const maxSq = effectiveMaxSpeed * effectiveMaxSpeed;

        if (vSq > maxSq) {
            const v = Math.sqrt(vSq);
            const scale = effectiveMaxSpeed / v;
            vx *= scale;
            vy *= scale;
        }

        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);
    }
}
