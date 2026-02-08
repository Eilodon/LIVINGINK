/// <reference lib="webworker" />

import {
    WorldState,
    PhysicsSystem,
    MovementSystem,
    SkillSystem
} from '@cjr/engine';

// Define Worker Context with proper global types
declare const self: Worker;

let world: WorldState | null = null;
let localPlayerId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let _lastTime = 0;
const targetTickRate = 60;
const fixedDt = 1 / targetTickRate;

console.info('[PhysicsWorker] Loaded');

self.onmessage = (e: MessageEvent) => {
    const { type, config, buffers } = e.data;

    if (type === 'INIT') {
        try {
            console.info('[PhysicsWorker] Initializing WorldState...');

            // Hydrate WorldState from SharedArrayBuffers
            world = new WorldState({
                maxEntities: config.maxEntities,
                buffers: {
                    stateFlags: buffers.stateFlags,
                    transform: buffers.transform,
                    physics: buffers.physics,
                    pigment: buffers.pigment,
                    stats: buffers.stats,
                    input: buffers.input,
                    skill: buffers.skill,
                    config: buffers.config,
                    projectile: buffers.projectile,
                    tattoo: buffers.tattoo
                }
            });

            console.info('[PhysicsWorker] WorldState Re-hydrated successfully.');
            self.postMessage({ type: 'INIT_COMPLETE' });

        } catch (err) {
            console.error('[PhysicsWorker] Initialization Failed:', err);
            self.postMessage({ type: 'ERROR', error: String(err) });
        }
    }

    if (type === 'SET_LOCAL_PLAYER') {
        localPlayerId = e.data.id;
        console.info(`[PhysicsWorker] Local Player ID set to: ${localPlayerId}`);
    }

    if (type === 'START') {
        if (!world) {
            console.error('[PhysicsWorker] Cannot start: World not initialized');
            return;
        }

        if (intervalId) clearInterval(intervalId);

        console.info('[PhysicsWorker] Starting Simulation Loop...');
        const _lastTime = performance.now();

        // Fixed Time Step Loop
        intervalId = setInterval(() => {
            try {
                const _now = performance.now();
                // Calculate dt? For fixed tick, we trust the interval or use fixedDt?
                // Physics generally prefers Fixed DT for stability.

                // 1. Movement System (Input -> Velocity)
                MovementSystem.updateAll(world!, fixedDt, undefined, localPlayerId ?? undefined);

                // 2. Physics System (Velocity -> Position)
                PhysicsSystem.update(world!, fixedDt, localPlayerId ?? undefined);

                // 3. Skill System (Cooldowns, etc)
                SkillSystem.update(world!, fixedDt);

                // Post heartbeat / stats occasionally? 
                // For now, silent running. Main thread reads buffers directly.

            } catch (err) {
                console.error('[PhysicsWorker] Loop Error:', err);
            }
        }, 1000 / targetTickRate);
    }

    if (type === 'STOP') {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        console.info('[PhysicsWorker] Stopped.');
    }
};
