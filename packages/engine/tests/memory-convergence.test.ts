/**
 * @eidolon/engine - Memory Convergence Test
 *
 * Verifies that ComponentStores and ComponentRegistry share the same memory.
 * This is the critical test for Phase 3 & 4: Unification.
 *
 * Test: Set TransformStore.data[0] = 123, expect ComponentRegistry.getStore('Transform').data[0] === 123
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getComponentRegistry,
    resetComponentRegistry,
} from '../src/core/ComponentRegistry';
import { registerCoreComponents } from '../src/core/CoreRegistry';
import {
    TransformStore,
    PhysicsStore,
    StatsStore,
    StateStore,
    InputStore,
    ConfigStore,
    SkillStore,
    ProjectileStore,
} from '../src/dod/ComponentStores';

describe('Phase 3 & 4: Memory Convergence', () => {
    beforeEach(() => {
        resetComponentRegistry();
        // Register core components before accessing stores
        registerCoreComponents();
    });

    afterEach(() => {
        resetComponentRegistry();
    });

    describe('Memory Identity Test', () => {
        it('TransformStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Transform');

            expect(registryStore).toBeDefined();

            // Write via TransformStore
            TransformStore.data[0] = 123.456;

            // Read via ComponentRegistry - must be the same buffer
            expect(registryStore!.data[0]).toBe(123.456);

            // Write via ComponentRegistry
            registryStore!.data[1] = 789.012;

            // Read via TransformStore - must see the change
            expect(TransformStore.data[1]).toBe(789.012);

            // Verify they reference the exact same array instance
            expect(TransformStore.data).toBe(registryStore!.data);
        });

        it('PhysicsStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Physics');

            expect(registryStore).toBeDefined();

            // Write via PhysicsStore
            PhysicsStore.data[0] = 100;
            PhysicsStore.data[1] = 200;

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(100);
            expect(registryStore!.data[1]).toBe(200);

            // Verify same instance
            expect(PhysicsStore.data).toBe(registryStore!.data);
        });

        it('StatsStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Stats');

            expect(registryStore).toBeDefined();

            // Write via StatsStore
            StatsStore.data[0] = 50; // currentHealth
            StatsStore.data[1] = 100; // maxHealth

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(50);
            expect(registryStore!.data[1]).toBe(100);

            // Verify same instance
            expect(StatsStore.data).toBe(registryStore!.data);
        });

        it('StateStore (flags) and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('State');

            expect(registryStore).toBeDefined();

            // Write via StateStore
            StateStore.flags[0] = 1;
            StateStore.flags[5] = 42;

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(1);
            expect(registryStore!.data[5]).toBe(42);

            // Verify same instance
            expect(StateStore.flags).toBe(registryStore!.data);
        });

        it('InputStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Input');

            expect(registryStore).toBeDefined();

            // Write via InputStore
            InputStore.data[0] = 100; // targetX
            InputStore.data[1] = 200; // targetY

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(100);
            expect(registryStore!.data[1]).toBe(200);

            // Verify same instance
            expect(InputStore.data).toBe(registryStore!.data);
        });

        it('ConfigStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Config');

            expect(registryStore).toBeDefined();

            // Write via ConfigStore
            ConfigStore.data[0] = 500; // maxSpeed

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(500);

            // Verify same instance
            expect(ConfigStore.data).toBe(registryStore!.data);
        });

        it('SkillStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Skill');

            expect(registryStore).toBeDefined();

            // Write via SkillStore
            SkillStore.data[0] = 5; // cooldown

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(5);

            // Verify same instance
            expect(SkillStore.data).toBe(registryStore!.data);
        });

        it('ProjectileStore and ComponentRegistry should share the same buffer', () => {
            const registry = getComponentRegistry();
            const registryStore = registry.getStore('Projectile');

            expect(registryStore).toBeDefined();

            // Write via ProjectileStore
            ProjectileStore.data[0] = 42; // ownerId

            // Read via ComponentRegistry
            expect(registryStore!.data[0]).toBe(42);

            // Verify same instance
            expect(ProjectileStore.data).toBe(registryStore!.data);
        });
    });

    describe('Lazy Initialization', () => {
        it('stores should lazily fetch from registry on first access', () => {
            const registry = getComponentRegistry();

            // Initially, no data accessed yet
            expect(registry.getStore('Transform')).toBeDefined();

            // First access triggers lazy fetch
            const val = TransformStore.data[0];

            // Subsequent accesses use cached reference
            TransformStore.data[1] = 999;
            expect(registry.getStore('Transform')!.data[1]).toBe(999);
        });
    });

    describe('Store Helper Methods', () => {
        it('TransformStore helper methods should work with registry-backed data', () => {
            // Initialize via TransformStore.set
            TransformStore.set(0, 10, 20, 0.5, 1.0);

            // Verify via direct data access
            expect(TransformStore.data[0]).toBe(10); // x
            expect(TransformStore.data[1]).toBe(20); // y
            expect(TransformStore.data[2]).toBe(0.5); // rotation
            expect(TransformStore.data[3]).toBe(1.0); // scale

            // Verify via helper methods
            expect(TransformStore.getX(0)).toBe(10);
            expect(TransformStore.getY(0)).toBe(20);

            // Update via helper
            TransformStore.setPosition(0, 30, 40);
            expect(TransformStore.getX(0)).toBe(30);
            expect(TransformStore.getY(0)).toBe(40);
        });

        it('PhysicsStore helper methods should work with registry-backed data', () => {
            PhysicsStore.set(0, 1, 2, 10, 5);

            expect(PhysicsStore.getVelocityX(0)).toBe(1);
            expect(PhysicsStore.getVelocityY(0)).toBe(2);
            expect(PhysicsStore.getRadius(0)).toBe(5);

            PhysicsStore.setVelocity(0, 3, 4);
            expect(PhysicsStore.getVelocityX(0)).toBe(3);
            expect(PhysicsStore.getVelocityY(0)).toBe(4);
        });

        it('StateStore helper methods should work with registry-backed data', () => {
            const { EntityFlags } = await import('../src/dod/EntityFlags');

            StateStore.setFlag(0, EntityFlags.ACTIVE);
            expect(StateStore.isActive(0)).toBe(true);

            StateStore.clearFlag(0, EntityFlags.ACTIVE);
            expect(StateStore.isActive(0)).toBe(false);
        });
    });
});
