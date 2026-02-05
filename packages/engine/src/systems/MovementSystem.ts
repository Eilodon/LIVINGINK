/**
 * @cjr/engine - MovementSystem
 * Pure movement logic - no VFX dependencies
 */

import { PhysicsStore, TransformStore, InputStore, ConfigStore, StateStore } from '../dod/ComponentStores';
import { MAX_ENTITIES, EntityFlags } from '../dod/EntityFlags';
// EIDOLON-V FIX: Import from unified config SSOT
import { MAX_SPEED_BASE } from '../config/constants';

export class MovementSystem {
    // EIDOLON-V DEBUG: Frame counter (REMOVE AFTER DEBUG)
    private static debugFrameCount = 0;

    /**
     * DOD Movement Logic (Pure Index-Based)
     */
    static update(id: number, dt: number) {
        // 1. Read inputs from InputStore
        const iIdx = id * InputStore.STRIDE;
        const tx = InputStore.data[iIdx];
        const ty = InputStore.data[iIdx + 1];

        // 2. Read state/config
        const speedMult = ConfigStore.getSpeedMultiplier(id) || 1;
        const effectiveMaxSpeed = MAX_SPEED_BASE * speedMult;

        const tIdx = id * 8;
        const pIdx = id * 8;

        const px = TransformStore.data[tIdx];
        const py = TransformStore.data[tIdx + 1];

        // EIDOLON-V DEBUG: Log player movement data (REMOVE AFTER DEBUG)
        if (id === 0 && this.debugFrameCount++ < 10) {
            console.log(`[DEBUG] Movement id=0: target=(${tx.toFixed(1)}, ${ty.toFixed(1)}) pos=(${px.toFixed(1)}, ${py.toFixed(1)}) dt=${dt.toFixed(4)}`);
        }

        // 3. Calculate direction
        const dx = tx - px;
        const dy = ty - py;
        const distSq = dx * dx + dy * dy;

        // Deadzone (squared)
        if (distSq < 1) {
            return;
        }

        const dist = Math.sqrt(distSq);

        // Simple seek behavior with acceleration
        const accel = 2000;
        const ax = (dx / dist) * accel * dt;
        const ay = (dy / dist) * accel * dt;

        PhysicsStore.data[pIdx] += ax;
        PhysicsStore.data[pIdx + 1] += ay;

        // Cap speed
        const vx = PhysicsStore.data[pIdx];
        const vy = PhysicsStore.data[pIdx + 1];
        const vSq = vx * vx + vy * vy;
        const maxSq = effectiveMaxSpeed * effectiveMaxSpeed;

        if (vSq > maxSq) {
            const v = Math.sqrt(vSq);
            const scale = effectiveMaxSpeed / v;
            PhysicsStore.data[pIdx] *= scale;
            PhysicsStore.data[pIdx + 1] *= scale;
        }
    }

    /**
     * Update all active entities
     */
    static updateAll(dt: number) {
        const count = MAX_ENTITIES;
        const flags = StateStore.flags;

        for (let id = 0; id < count; id++) {
            if ((flags[id] & EntityFlags.ACTIVE) !== 0) {
                this.update(id, dt);
            }
        }
    }

    /**
     * Apply input with explicit target/config (for external callers)
     */
    static applyInputDOD(
        id: number,
        target: { x: number; y: number },
        config: { maxSpeed: number; speedMultiplier: number },
        dt: number
    ) {
        const pIdx = id * 8;
        const tIdx = id * 8;
        const px = TransformStore.data[tIdx];
        const py = TransformStore.data[tIdx + 1];

        const dx = target.x - px;
        const dy = target.y - py;
        const distSq = dx * dx + dy * dy;

        if (distSq < 1) return;

        const dist = Math.sqrt(distSq);
        const accel = 2000;
        const ax = (dx / dist) * accel * dt;
        const ay = (dy / dist) * accel * dt;

        PhysicsStore.data[pIdx] += ax;
        PhysicsStore.data[pIdx + 1] += ay;

        const effectiveMaxSpeed = config.maxSpeed * config.speedMultiplier;
        const vx = PhysicsStore.data[pIdx];
        const vy = PhysicsStore.data[pIdx + 1];
        const vSq = vx * vx + vy * vy;
        const maxSq = effectiveMaxSpeed * effectiveMaxSpeed;

        if (vSq > maxSq) {
            const v = Math.sqrt(vSq);
            const scale = effectiveMaxSpeed / v;
            PhysicsStore.data[pIdx] *= scale;
            PhysicsStore.data[pIdx + 1] *= scale;
        }
    }
}
