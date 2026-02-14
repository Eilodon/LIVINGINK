/**
 * @cjr/engine - SkillSystem
 * Pure skill logic - VFX decoupled via eventBuffer
 * 
 * EIDOLON-V: Refactored to use generated WorldState and accessors
 */

import { WorldState, MAX_ENTITIES } from '../generated/WorldState.js';
import { EntityFlags, StateAccess, SkillAccess, TransformAccess, PhysicsAccess } from '../generated/ComponentAccessors.js';
import { eventBuffer, EngineEventType } from '../events/EventRingBuffer.js';

/**
 * Shape ID Enum for compile-time optimization
 */
export const enum ShapeEnum {
    CIRCLE = 1,
    SQUARE = 2,
    TRIANGLE = 3,
    HEX = 4,
}

export class SkillSystem {
    /**
     * Handle skill input for an entity
     */
    static handleInput(
        id: number,
        input: { space: boolean; target: { x: number; y: number } },
        world: WorldState  // EIDOLON-V: WorldState is now REQUIRED
    ) {
        // Validation via StateAccess
        if (!StateAccess.isActive(world, id)) return;
        if (!input.space) return;

        // Check cooldown
        const cooldown = SkillAccess.getCooldown(world, id);
        if (cooldown > 0) return;

        // Execute skill
        const shapeId = SkillAccess.getShapeId(world, id);
        this.executeSkillDOD(id, shapeId, input.target, world);

        // Reset cooldown
        const maxCooldown = SkillAccess.getMaxCooldown(world, id);
        SkillAccess.setCooldown(world, id, maxCooldown);
    }

    /**
     * Update cooldowns for all entities
     */
    static update(world: WorldState, dt: number) {
        const count = world.activeCount;
        const activeEntities = world.activeEntities;

        for (let i = 0; i < count; i++) {
            const id = activeEntities[i];

            const cooldown = SkillAccess.getCooldown(world, id);
            if (cooldown > 0) {
                SkillAccess.setCooldown(world, id, cooldown - dt);
            }
        }
    }

    /**
     * Execute skill based on shape type
     * Emits events instead of direct VFX calls
     */
    private static executeSkillDOD(
        id: number,
        shapeId: number,
        target: { x: number; y: number },
        world: WorldState  // EIDOLON-V: WorldState is now REQUIRED
    ) {
        const x = TransformAccess.getX(world, id);
        const y = TransformAccess.getY(world, id);
        const vx = PhysicsAccess.getVx(world, id);
        const vy = PhysicsAccess.getVy(world, id);

        // Circle (Jet Dash)
        if (shapeId === ShapeEnum.CIRCLE) {
            // Normalized velocity
            const speedSq = vx * vx + vy * vy;
            let dx = 1, dy = 0;

            if (speedSq > 0.001) {
                const invMag = 1.0 / Math.sqrt(speedSq);
                dx = vx * invMag;
                dy = vy * invMag;
            }

            const dashPower = 800;
            PhysicsAccess.setVx(world, id, dx * dashPower);
            PhysicsAccess.setVy(world, id, dy * dashPower);

            // Emit VFX event (Cyan particle burst)
            eventBuffer.push(
                EngineEventType.PARTICLE_BURST,
                id,
                x,
                y,
                0x00ffff // Color: Cyan
            );
        }

        // Square (Shockwave)
        else if (shapeId === ShapeEnum.SQUARE) {
            // Emit shockwave event
            eventBuffer.push(
                EngineEventType.SHOCKWAVE,
                id,
                x,
                y,
                150 // Radius
            );
        }

        // Triangle (Pierce) - Projectile
        else if (shapeId === ShapeEnum.TRIANGLE) {
            let angle = 0;
            // Calculate angle from velocity if moving, else towards target?
            // Actually target is mouse pos.
            const dx = target.x - x;
            const dy = target.y - y;
            angle = Math.atan2(dy, dx);

            // Pack data: We need Type ID.
            // Let's say Type 1 = Pierce.
            // We can pack angle? eventBuffer data is 32-bit float.
            // We can't pack everything. The spawner in GameRoom will have to recalculate or we assume firing towards target.
            // Actually, we pass Angle in Data? Float32 can store angle.

            eventBuffer.push(
                EngineEventType.SPAWN_PROJECTILE,
                id, // Source Entity ID (Owner)
                x,
                y,
                angle // Data = Angle in radians
            );
        }

        // Hex (Vortex) - Area Effect / Projectile?
        else if (shapeId === ShapeEnum.HEX) {
            eventBuffer.push(
                EngineEventType.SHOCKWAVE,
                id,
                x,
                y,
                200 // Larger radius
            );
        }
    }
}
