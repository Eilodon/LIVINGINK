import { GameState } from '../types';
import { WorldState } from '@cjr/engine';
import { PooledEntityFactory } from '../game/pooling/ObjectPool';
import { clientLogger } from '../core/logging/ClientLogger';
import { cjrClientRunner } from '../game/engine/runner/CJRClientRunner';

/**
 * EIDOLON-V: Stress Test Controller
 * Simulates high-load scenarios to verify Frame Pacing and Memory Stability.
 * Target: 2000 Entities @ 60 FPS (Worker Mode)
 */
export class StressTestController {
    private active = false;
    private intervalId: any = null;
    private targetCount = 2000;

    constructor() { }

    public start(state: GameState): void {
        if (this.active) return;
        this.active = true;
        clientLogger.info('🔥 STRESS TEST INITIATED: Target 2000 Entities');

        // Inject loop
        this.intervalId = setInterval(() => {
            if (!state.engine.world) return;
            this.injectBatch(state);
        }, 100);
    }

    public stop(): void {
        if (!this.active) return;
        this.active = false;
        if (this.intervalId) clearInterval(this.intervalId);
        clientLogger.info('🛑 STRESS TEST STOPPED');
    }

    private injectBatch(state: GameState): void {
        const currentCount = state.food.length + state.bots.length; // Approximate
        if (currentCount >= this.targetCount) return;

        const BATCH_SIZE = 50;
        const world = state.engine.world as WorldState;

        for (let i = 0; i < BATCH_SIZE; i++) {
            // Use Object Pool for Logic Entity
            const food = PooledEntityFactory.createPooledFood().acquire();
            food.id = `stress_food_${Math.random()}`;
            food.position.x = (Math.random() - 0.5) * 2000;
            food.position.y = (Math.random() - 0.5) * 2000;
            food.radius = 5 + Math.random() * 5;
            food.color = 0xff00ff; // Magenta for Stress Entities

            // EIDOLON-V: Verify we can add to world.
            // Note: transform synchronization usually goes Server -> Client.
            // In Stress Test, we are faking Client-side entities for rendering load.
            // To test Physics Worker load, we need to inject into Physics World.

            state.food.push(food);

            // Add to Physics (Mocking Server Sync)
            const physicsIdx = state.engine.physicsWorld.addBody(
                food.id,
                food.position.x,
                food.position.y,
                food.radius,
                1,
                true // isStatic?
            );
            food.physicsIndex = physicsIdx;
        }

        clientLogger.info(`[Stress] Entity Count: ${currentCount + BATCH_SIZE}`);
    }
}

export const stressTestController = new StressTestController();
