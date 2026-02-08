/**
 * @cjr/engine - Unit Tests: PhysicsSystem
 * 
 * EIDOLON-V: Updated to use instance-based WorldState (no defaultWorld singleton)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { WorldState } from '../generated/WorldState';
import {
    TransformAccess,
    PhysicsAccess,
    StateAccess,
    EntityFlags
} from '../generated/ComponentAccessors';

describe('PhysicsSystem', () => {
    let world: WorldState;

    beforeEach(() => {
        world = new WorldState();
    });

    describe('update', () => {
        it('should integrate velocity into position', () => {
            const entityId = 0;

            // Setup entity using accessors (7 non-pad args for Transform, 7 non-pad args for Physics)
            TransformAccess.set(world, entityId, 100, 100, 0, 1, 0, 0, 0);
            PhysicsAccess.set(world, entityId, 50, 30, 0, 1, 10, 0.5, 0.9);
            StateAccess.activate(world, entityId);

            // Run physics for 1 second
            PhysicsSystem.update(world, 1.0);

            // Check position changed
            const newX = TransformAccess.getX(world, entityId);
            const newY = TransformAccess.getY(world, entityId);

            // Position should have moved in direction of velocity
            expect(newX).toBeGreaterThan(100);
            expect(newY).toBeGreaterThan(100);
        });

        it('should apply friction to velocity', () => {
            const entityId = 0;
            const friction = 0.9;

            // Setup entity with velocity
            TransformAccess.set(world, entityId, 0, 0, 0, 1, 0, 0, 0);
            PhysicsAccess.set(world, entityId, 100, 100, 0, 1, 10, 0.5, friction);
            StateAccess.activate(world, entityId);

            // Get initial velocity
            const initialVx = PhysicsAccess.getVx(world, entityId);

            // Run physics
            PhysicsSystem.update(world, 1.0);

            // Velocity should be reduced by friction
            const newVx = PhysicsAccess.getVx(world, entityId);
            expect(newVx).toBeLessThan(initialVx);
        });

        it('should skip inactive entities', () => {
            const entityId = 0;

            // Setup entity but DON'T set ACTIVE flag
            TransformAccess.set(world, entityId, 100, 100, 0, 1, 0, 0, 0);
            PhysicsAccess.set(world, entityId, 50, 30, 0, 1, 10, 0.5, 0.9);
            // NOT calling StateAccess.activate()

            // Run physics
            PhysicsSystem.update(world, 1.0);

            // Position should NOT have changed
            expect(TransformAccess.getX(world, entityId)).toBe(100);
            expect(TransformAccess.getY(world, entityId)).toBe(100);
        });

        it('should handle multiple entities', () => {
            // Setup 3 entities
            for (let i = 0; i < 3; i++) {
                TransformAccess.set(world, i, i * 100, i * 100, 0, 1, 0, 0, 0);
                PhysicsAccess.set(world, i, 10, 10, 0, 1, 10, 0.5, 0.9);
                StateAccess.activate(world, i);
            }

            // Run physics
            PhysicsSystem.update(world, 1.0);

            // All entities should have moved
            for (let i = 0; i < 3; i++) {
                expect(TransformAccess.getX(world, i)).toBeGreaterThan(i * 100);
            }
        });
    });

    it('should respect excludeId', () => {
        const entityId = 0;
        const excludedId = 0;

        // Setup entity
        TransformAccess.set(world, entityId, 100, 100, 0, 1, 0, 0, 0);
        PhysicsAccess.set(world, entityId, 50, 30, 0, 1, 10, 0.5, 0.9);
        StateAccess.activate(world, entityId);

        // Run physics with excludeId
        PhysicsSystem.update(world, 1.0, excludedId);

        // Position should NOT have changed because it was excluded
        expect(TransformAccess.getX(world, entityId)).toBe(100);
        expect(TransformAccess.getY(world, entityId)).toBe(100);
    });
});
