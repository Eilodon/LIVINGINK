/**
 * @cjr/engine - ProjectileSystem Test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState } from '../generated/WorldState.js';
import { EntityFlags, ProjectileAccess, StateAccess, TransformAccess, PhysicsAccess } from '../generated/ComponentAccessors.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { DirtyTracker } from '../networking/DirtyTracker.js';

describe('ProjectileSystem', () => {
    let world: WorldState;
    let dirtyTracker: DirtyTracker;

    beforeEach(() => {
        world = new WorldState({ maxEntities: 100 });
        dirtyTracker = new DirtyTracker(world.maxEntities);
    });

    it('manages projectile lifetime', () => {
        const id = 1;

        // Spawn Projectile
        StateAccess.activate(world, id);
        StateAccess.setFlag(world, id, EntityFlags.ACTIVE | EntityFlags.PROJECTILE);
        ProjectileAccess.setDuration(world, id, 1.0); // 1.0s duration

        // Initial Update (0.5s)
        ProjectileSystem.update(world, 0.5);
        expect(ProjectileAccess.getDuration(world, id)).toBeCloseTo(0.5);
        expect(StateAccess.isActive(world, id)).toBe(true);
        expect(StateAccess.hasFlag(world, id, EntityFlags.DEAD)).toBe(false);

        // Final Update (0.6s) -> Total 1.1s > 1.0s
        ProjectileSystem.update(world, 0.6);

        expect(ProjectileAccess.getDuration(world, id)).toBeLessThan(0);
        expect(StateAccess.isActive(world, id)).toBe(false); // Should be deactivated
        expect(StateAccess.hasFlag(world, id, EntityFlags.DEAD)).toBe(true);
    });

    it('moves projectiles via PhysicsSystem', () => {
        const id = 2;

        // Spawn Projectile
        StateAccess.activate(world, id);
        StateAccess.setFlag(world, id, EntityFlags.ACTIVE | EntityFlags.PROJECTILE);
        ProjectileAccess.setDuration(world, id, 2.0);

        // Set Velocity
        TransformAccess.set(world, id, 0, 0, 0, 1, 0, 0, 0);
        PhysicsAccess.set(world, id, 100, 0, 0, 1, 1, 0, 1.0); // vx=100, Friction=1.0

        // Update Physics (First Frame)
        PhysicsSystem.update(world, 0.1, undefined, dirtyTracker);

        // Check Position
        // TIME_SCALE is 10. Delta = 0.1 * 10 = 1.0.
        // vx = 100. New Pos = 0 + 100 * 1.0 = 100.
        expect(TransformAccess.getX(world, id)).toBeCloseTo(100);

        // Check Projectile Logic
        ProjectileSystem.update(world, 0.1);
        expect(StateAccess.isActive(world, id)).toBe(true);
    });
});
