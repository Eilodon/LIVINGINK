/**
 * DOD RENDER BRIDGE (V2)
 * =============================================================================
 * Provides direct access to TransformStore for rendering.
 * Stride = 8 (x, y, rot, scale, prevX, prevY, prevRot, pad)
 * =============================================================================
 */

import { getPhysicsWorld } from './context';
import { TransformStore } from './dod/ComponentStores';

const STRIDE = 8;
const X_OFFSET = 0;
const Y_OFFSET = 1;
const PREV_X_OFFSET = 4;
const PREV_Y_OFFSET = 5;

/**
 * Get interpolated positions for a batch of entities directly from TransformStore
 */
export const getInterpolatedPositionsBatch = (
    entityIds: string[],
    alpha: number,
    output?: Float32Array
): Float32Array => {
    const world = getPhysicsWorld(); // Adapter
    const count = entityIds.length;
    // Output is packed tight [x, y, x, y...] so output stride is 2
    const result = output || new Float32Array(count * 2);
    const data = TransformStore.data;

    for (let i = 0; i < count; i++) {
        const idx = world.idToIndex.get(entityIds[i]);
        if (idx === undefined) continue;

        const baseIdx = idx * STRIDE;
        const currX = data[baseIdx + X_OFFSET];
        const currY = data[baseIdx + Y_OFFSET];
        const prevX = data[baseIdx + PREV_X_OFFSET];
        const prevY = data[baseIdx + PREV_Y_OFFSET];

        const outIdx = i * 2;
        result[outIdx] = prevX + (currX - prevX) * alpha;
        result[outIdx + 1] = prevY + (currY - prevY) * alpha;
    }

    return result;
};

/**
 * Get interpolated position for a single entity
 */
export const getInterpolatedPosition = (
    entityId: string,
    alpha: number
): { x: number; y: number } | null => {
    const world = getPhysicsWorld();
    const idx = world.idToIndex.get(entityId);
    if (idx === undefined) return null;

    const baseIdx = idx * STRIDE;
    const data = TransformStore.data;
    const currX = data[baseIdx + X_OFFSET];
    const currY = data[baseIdx + Y_OFFSET];
    const prevX = data[baseIdx + PREV_X_OFFSET];
    const prevY = data[baseIdx + PREV_Y_OFFSET];

    return {
        x: prevX + (currX - prevX) * alpha,
        y: prevY + (currY - prevY) * alpha,
    };
};

// Export types compatible with consumers
export type { PhysicsWorld } from './PhysicsWorld';
