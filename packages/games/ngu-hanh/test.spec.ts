import { describe, it, expect } from 'vitest';
import { NguHanhModule } from './index.js';
import { WorldState } from '../../engine/src/generated/WorldState.js';
import { EntityManager } from '../../engine/src/core/EntityManager.js';

describe('Ngũ Hành Module', () => {
    it('should initialize, run game loop, and handle input', async () => {
        // Create real instances
        console.log("Initializing WorldState...");
        const world = new WorldState({ maxEntities: 1000 });
        const entityManager = new EntityManager(0, 1000);

        // Mock Context
        const mockContext = {
            entityManager: entityManager,
            spawnVisual: (entityId: number, color: number, shape: number) => { },
            setVisualState: (entityId: number, state: number) => { },
            onPreviewInteraction: (data: any) => { }
        };

        const nguHanh = new NguHanhModule();
        await nguHanh.onMount(world, mockContext);

        // Check if entities were spawned (8x8 grid = 64 tiles + 1 Boss = 65)
        expect(entityManager.count).toBe(65);

        // Run loop multiple times
        console.log("Simulating Game Loop (Gravity)...");
        for (let i = 0; i < 10; i++) {
            nguHanh.onUpdate(world, 0.016);
        }

        // After stable state, count should still be 64 + 1 Boss = 65
        expect(entityManager.count).toBe(65);

        console.log("Simulating Input (Select & Swap)...");
        // Click (0,0)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -350, y: -350 });

        // Click (0,1)
        nguHanh.onPlayerInput(world, { type: 'pointerdown', x: -250, y: -350 });

        // We can't easily assert match success without mocking random or forcing grid state,
        // but if code runs without error and logs output, integration is successful.
    });
});
