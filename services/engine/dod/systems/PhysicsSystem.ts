import { MAX_ENTITIES, EntityFlags } from '../EntityFlags';
import { TransformStore, PhysicsStore, StateStore } from '../ComponentStores';

export const PHY_MAP_RADIUS = 2500;
export const PHY_FRICTION_BASE = 0.9;

export class PhysicsSystem {
    static update(dt: number) {
        const count = MAX_ENTITIES;
        const flags = StateStore.flags;
        // Friction scaler
        const friction = Math.pow(PHY_FRICTION_BASE, dt * 60);

        for (let id = 0; id < count; id++) {
            if ((flags[id] & EntityFlags.ACTIVE) === 0) continue;
            this.integrateEntity(id, dt, friction);
        }
    }

    static integrateEntity(id: number, dt: number, friction: number) {
        const tData = TransformStore.data;
        const pData = PhysicsStore.data;
        const tIdx = id * TransformStore.STRIDE;
        const pIdx = id * PhysicsStore.STRIDE;

        // Unpack Velocity
        let vx = pData[pIdx];
        let vy = pData[pIdx + 1];

        // Apply Friction
        vx *= friction;
        vy *= friction;

        // Snapshot for Interpolation
        tData[tIdx + 4] = tData[tIdx];     // prevX
        tData[tIdx + 5] = tData[tIdx + 1]; // prevY
        tData[tIdx + 6] = tData[tIdx + 2]; // prevRotation

        // Integrate Position
        // Note: Legacy scaler * 10
        tData[tIdx] += vx * dt * 10;
        tData[tIdx + 1] += vy * dt * 10;

        // Store updated velocity
        pData[pIdx] = vx;
        pData[pIdx + 1] = vy;

        // Map Constraints
        const x = tData[tIdx];
        const y = tData[tIdx + 1];
        const r = pData[pIdx + 4]; // Radius

        const distSq = x * x + y * y;
        const limit = PHY_MAP_RADIUS - r;
        const limitSq = limit * limit;

        if (distSq > limitSq) {
            const angle = Math.atan2(y, x);
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);

            // Clamp position
            tData[tIdx] = nx * limit;
            tData[tIdx + 1] = ny * limit;

            // Bounce
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
                pData[pIdx] -= 1.5 * dot * nx;
                pData[pIdx + 1] -= 1.5 * dot * ny;
            }
        }
    }
}
