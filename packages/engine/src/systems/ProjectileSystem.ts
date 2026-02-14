/**
 * @cjr/engine - ProjectileSystem
 * Handles projectile movement and lifetime.
 * 
 * EIDOLON-V: Pure DOD implementation.
 */

import { WorldState } from '../generated/WorldState.js';
import { EntityFlags, TransformAccess, PhysicsAccess, ProjectileAccess, StateAccess } from '../generated/ComponentAccessors.js';

export class ProjectileSystem {
    /**
     * Update all active projectiles
     */
    static update(world: WorldState, dt: number) {
        // EIDOLON-V: Iterate using live count and handle removal properly
        const activeEntities = world.activeEntities;

        for (let i = 0; i < world.activeCount; i++) {
            const id = activeEntities[i];

            // Filter: ACTIVE && PROJECTILE
            // Note: Projectiles are not marked PHYSICALLY ACTIVE usually, or are they?
            // They need to move. PhysicsSystem handles movement if we set velocity.
            // But we need to handle LIFETIME here.

            if (StateAccess.hasFlag(world, id, EntityFlags.PROJECTILE)) {

                // 1. Lifetime check
                let duration = ProjectileAccess.getDuration(world, id);
                duration -= dt;
                ProjectileAccess.setDuration(world, id, duration);

                if (duration <= 0) {
                    // Expired
                    StateAccess.deactivate(world, id);
                    StateAccess.setFlag(world, id, EntityFlags.DEAD);
                    i--; // Decrement index since current element was swapped with last
                    continue;
                }

                // 2. Movement is handled by PhysicsSystem if we set Velocity.
                // However, custom projectile logic (homing, acceleration) goes here.

                // Example: Homing projectile (if Type requires it)
                // const type = ProjectileAccess.getTypeId(world, id);
                // if (type === ProjectileType.HOMING) { ... }
            }
        }
    }
}
