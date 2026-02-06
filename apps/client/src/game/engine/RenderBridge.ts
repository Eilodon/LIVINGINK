/**
 * DOD RENDER BRIDGE (V3 - Pure Index-Based API)
 * =============================================================================
 * Provides direct access to TransformStore for rendering.
 * Stride = 8 (x, y, rot, scale, prevX, prevY, prevRot, pad)
 * 
 * V3 CHANGES:
 * - Added index-based functions that bypass Map lookup entirely
 * - Legacy string-based functions preserved for backward compatibility
 * =============================================================================
 */

import { getPhysicsWorld } from './context';
import { TransformStore, defaultWorld } from '@cjr/engine';
const w = defaultWorld;
import { vfxBuffer } from './VFXRingBuffer';

const STRIDE = 8;
const X_OFFSET = 0;
const Y_OFFSET = 1;
const PREV_X_OFFSET = 4;
const PREV_Y_OFFSET = 5;

// ============================================================================
// PHASE 7: INDEX-BASED API (Zero Map Lookup)
// ============================================================================

export type RenderPoint = { x: number; y: number };

// Reusable output point for single entity (zero allocation)
const _indexPoint: RenderPoint = { x: 0, y: 0 };

/**
 * Get interpolated position by DOD index directly - NO MAP LOOKUP
 * This is the fastest path for entities with known physicsIndex.
 */
export const getInterpolatedPositionByIndex = (
  entityIdx: number,
  alpha: number,
  out?: RenderPoint
): RenderPoint => {
  const data = w.transform;
  const baseIdx = entityIdx * STRIDE;

  const currX = data[baseIdx + X_OFFSET];
  const currY = data[baseIdx + Y_OFFSET];
  const prevX = data[baseIdx + PREV_X_OFFSET];
  const prevY = data[baseIdx + PREV_Y_OFFSET];

  const result = out || _indexPoint;
  result.x = prevX + (currX - prevX) * alpha;
  result.y = prevY + (currY - prevY) * alpha;
  return result;
};

/**
 * Batch interpolation by indices - NO MAP LOOKUP
 * Input: Uint16Array of entity indices
 * Output: Float32Array packed [x, y, x, y, ...]
 */
export const getInterpolatedPositionsBatchByIndices = (
  indices: Uint16Array | number[],
  alpha: number,
  output?: Float32Array
): Float32Array => {
  const count = indices.length;
  const result = output || new Float32Array(count * 2);
  const data = w.transform;

  for (let i = 0; i < count; i++) {
    const idx = indices[i];
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

// ============================================================================
// LEGACY API (String-based with Map Lookup) - Preserved for compatibility
// ============================================================================

/**
 * Get interpolated positions for a batch of entities by STRING IDs
 * @deprecated Use getInterpolatedPositionsBatchByIndices for better performance
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
  const data = w.transform;

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
 * Get interpolated position for a single entity by STRING ID
 * @deprecated Use getInterpolatedPositionByIndex for better performance
 */
export function getInterpolatedPosition(entityId: string, alpha: number): RenderPoint | null;
export function getInterpolatedPosition(
  entityId: string,
  alpha: number,
  out: RenderPoint
): RenderPoint | null;
export function getInterpolatedPosition(
  entityId: string,
  alpha: number,
  out?: RenderPoint
): RenderPoint | null {
  const world = getPhysicsWorld();
  const idx = world.idToIndex.get(entityId);
  if (idx === undefined) return null;

  // Delegate to index-based implementation
  return getInterpolatedPositionByIndex(idx, alpha, out);
}

/**
 * Consume all pending VFX events from the ring buffer
 * This should be called once per render frame by the visual system
 */
export const consumeVFXEvents = (
  onEvent: (x: number, y: number, color: number, type: number, data: number) => void
): void => {
  while (true) {
    const evt = vfxBuffer.pop();
    if (!evt) break;
    onEvent(evt.x, evt.y, evt.color, evt.type, evt.data || 0);
  }
};

// Export types compatible with consumers
export type { PhysicsWorld } from './PhysicsWorld';

