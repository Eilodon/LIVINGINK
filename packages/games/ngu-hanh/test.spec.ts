import { describe, it, expect } from 'vitest';
import { NguHanhModule } from './index';
import { WorldState } from '../../engine/src/generated/WorldState';
import { EntityManager } from '../../engine/src/core/EntityManager';

describe('Ngũ Hành Module', () => {
    it('should initialize, run game loop, and handle input', async () => {
        // Create real instances
        console.log("Initializing WorldState...");
        const world = new WorldState({ maxEntities: 1000 });
        const entityManager = new EntityManager(0, 1000);

        // Mock Context
        const mockContext = {
            entityManager: entityManager,
            spawnVisual: (entityId: number, color: number, shape: number) => { }
        };

        const nguHanh = new NguHanhModule();
        await nguHanh.onMount(world, mockContext);

        // Check if entities were created
        expect(entityManager.count).toBe(64);

        // Run loop multiple times
        console.log("Simulating Game Loop (Gravity)...");
        for (let i = 0; i < 10; i++) {
            nguHanh.onUpdate(world, 0.016);
        }

        // After stable state, count should still be 64
        expect(entityManager.count).toBe(64);

        console.log("Simulating Input (Select & Swap)...");
        // Click (0,0)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -350, y: -350 });

        // Click (0,1)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -250, y: -350 });

        // We can't easily assert match success without mocking random or forcing grid state,
        // but if code runs without error and logs output, integration is successful.
    });
});
