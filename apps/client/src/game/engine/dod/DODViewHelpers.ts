/**
 * DOD VIEW HELPERS - Zero-allocation data sampling for high-frequency rendering
 *
 * EIDOLON-V Phase 3.2: Direct DOD reads for minimap/radar without object creation
 */

// EIDOLON-V FIX: Import from engine SSOT instead of local duplicates
import { TransformStore, PhysicsStore, StateStore, defaultWorld } from '@cjr/engine';
import { EntityFlags } from '@cjr/engine';
import { entityManager } from './EntityManager';
const w = defaultWorld;

// Pre-allocated output buffer for position sampling
const _positionBuffer = new Float32Array(4096 * 2); // x,y pairs for up to 4096 entities

/**
 * Sample all active entity positions directly from DOD into a Float32Array.
 * Zero-allocation after init - perfect for minimap/radar rendering.
 *
 * @param out Target Float32Array to write positions into (x,y,x,y,...)
 * @param filterFlags Optional flags to filter entities (e.g., EntityFlags.PLAYER | EntityFlags.BOT)
 * @returns Number of entities sampled (out array contains 2x this many floats)
 */
export function sampleEntityPositionsToArray(out: Float32Array, filterFlags: number = 0): number {
  const tData = w.transform;
  const flags = w.stateFlags;
  const count = entityManager.count;
  const stride = TransformStore.STRIDE;

  let writeIdx = 0;
  const maxWrite = out.length;

  for (let i = 0; i < count; i++) {
    const flag = flags[i];

    // Skip inactive or dead entities
    if ((flag & EntityFlags.ACTIVE) === 0) continue;
    if (flag & EntityFlags.DEAD) continue;

    // Apply filter if specified
    if (filterFlags !== 0 && (flag & filterFlags) === 0) continue;

    // Bounds check
    if (writeIdx + 2 > maxWrite) break;

    const tIdx = i * stride;
    out[writeIdx++] = tData[tIdx]; // x
    out[writeIdx++] = tData[tIdx + 1]; // y
  }

  return writeIdx / 2; // Number of entities
}

/**
 * Sample player positions only (for player radar/minimap dots)
 */
export function samplePlayerPositionsToArray(out: Float32Array): number {
  return sampleEntityPositionsToArray(out, EntityFlags.PLAYER);
}

/**
 * Sample bot positions only
 */
export function sampleBotPositionsToArray(out: Float32Array): number {
  return sampleEntityPositionsToArray(out, EntityFlags.BOT);
}

/**
 * Sample food positions only
 */
export function sampleFoodPositionsToArray(out: Float32Array): number {
  return sampleEntityPositionsToArray(out, EntityFlags.FOOD);
}

/**
 * Sample all unit positions (players + bots) for minimap
 */
export function sampleUnitPositionsToArray(out: Float32Array): number {
  return sampleEntityPositionsToArray(out, EntityFlags.PLAYER | EntityFlags.BOT);
}

/**
 * Get the pre-allocated position buffer for temporary use.
 * WARNING: This buffer is shared - do not hold references across frames.
 */
export function getSharedPositionBuffer(): Float32Array {
  return _positionBuffer;
}

/**
 * Sample positions with radius info for minimap with size variation.
 * Format: [x, y, radius, x, y, radius, ...]
 *
 * @param out Target Float32Array (3 floats per entity)
 * @param filterFlags Entity type filter
 * @returns Number of entities sampled
 */
export function sampleEntityPositionsWithRadiusToArray(
  out: Float32Array,
  filterFlags: number = 0
): number {
  const tData = w.transform;
  const pData = w.physics;
  const flags = w.stateFlags;
  const count = entityManager.count;
  const tStride = TransformStore.STRIDE;
  const pStride = PhysicsStore.STRIDE;

  let writeIdx = 0;
  const maxWrite = out.length;

  for (let i = 0; i < count; i++) {
    const flag = flags[i];

    if ((flag & EntityFlags.ACTIVE) === 0) continue;
    if (flag & EntityFlags.DEAD) continue;
    if (filterFlags !== 0 && (flag & filterFlags) === 0) continue;

    if (writeIdx + 3 > maxWrite) break;

    const tIdx = i * tStride;
    const pIdx = i * pStride;

    out[writeIdx++] = tData[tIdx]; // x
    out[writeIdx++] = tData[tIdx + 1]; // y
    out[writeIdx++] = pData[pIdx + 4]; // radius
  }

  return writeIdx / 3;
}
